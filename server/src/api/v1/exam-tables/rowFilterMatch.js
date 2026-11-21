/**
 * Mirror of client DynamicData/dataProcessing matchFilter + search.
 * Used by Mass Edit "Filtered" so the server can select matching row ids
 * without the client downloading the whole table.
 *
 * `buildValuesMongoMatch` pushes the same filters into Mongo on `values.*`
 * so paginated list endpoints do not load the whole exam into Node.
 */

const SAFE_VALUE_KEY = /^[a-z][a-z0-9_]{0,39}$/;

const asSearchText = (raw) => {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? '')).join(' ');
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
};

const escapeRegex = (raw) => String(raw ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const matchFilter = (rawValue, filter) => {
  if (!filter || typeof filter !== 'object') return true;
  const op = filter.op;
  const strVal = asSearchText(rawValue).toLowerCase();

  switch (op) {
    case 'contains':
      return strVal.includes(String(filter.value ?? '').toLowerCase());
    case 'equals': {
      // Booleans / numbers may arrive as primitives; compare loosely via string.
      if (typeof filter.value === 'boolean' || filter.value === null) {
        return String(rawValue ?? '').toLowerCase() === String(filter.value).toLowerCase();
      }
      return strVal === String(filter.value ?? '').toLowerCase();
    }
    case 'startsWith':
      return strVal.startsWith(String(filter.value ?? '').toLowerCase());
    case 'in': {
      const wanted = (Array.isArray(filter.value) ? filter.value : [])
        .map((s) => String(s).toLowerCase());
      if (!wanted.length) return true;
      if (Array.isArray(rawValue)) {
        return rawValue.some((v) => wanted.includes(String(v ?? '').toLowerCase()));
      }
      return wanted.includes(strVal);
    }
    case 'between': {
      const n = Number(rawValue);
      if (Number.isNaN(n)) return false;
      const v1 = filter.value;
      const v2 = filter.value2;
      if (v1 !== null && v1 !== undefined && n < Number(v1)) return false;
      if (v2 !== null && v2 !== undefined && n > Number(v2)) return false;
      return true;
    }
    case 'gte':
      return Number(rawValue) >= Number(filter.value);
    case 'lte':
      return Number(rawValue) <= Number(filter.value);
    default:
      return true;
  }
};

const normalizeFilters = (filters) => {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  const out = {};
  Object.entries(filters).forEach(([key, filter]) => {
    if (filter == null || filter === '') return;
    out[String(key)] = filter;
  });
  return out;
};

/** One column filter → Mongo clause on `values.<key>` (or null if unsupported). */
const filterToMongoClause = (path, filter) => {
  if (!filter || typeof filter !== 'object') return {};
  const op = filter.op;

  switch (op) {
    case 'contains':
      return { [path]: { $regex: escapeRegex(filter.value ?? ''), $options: 'i' } };
    case 'equals': {
      if (typeof filter.value === 'boolean') return { [path]: filter.value };
      if (filter.value === null) return { [path]: null };
      if (typeof filter.value === 'number') return { [path]: filter.value };
      // Case-insensitive string equals (matches JS toLowerCase path).
      return { [path]: { $regex: `^${escapeRegex(filter.value ?? '')}$`, $options: 'i' } };
    }
    case 'startsWith':
      return { [path]: { $regex: `^${escapeRegex(filter.value ?? '')}`, $options: 'i' } };
    case 'in': {
      const wanted = (Array.isArray(filter.value) ? filter.value : [])
        .map((s) => String(s))
        .filter((s) => s !== '');
      if (!wanted.length) return {};
      // Regex on a scalar or array field: any element matching counts (same as JS).
      return {
        $or: wanted.map((w) => ({
          [path]: { $regex: `^${escapeRegex(w)}$`, $options: 'i' },
        })),
      };
    }
    case 'between': {
      const range = {};
      if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
        range.$gte = Number(filter.value);
      }
      if (filter.value2 !== null && filter.value2 !== undefined && filter.value2 !== '') {
        range.$lte = Number(filter.value2);
      }
      if (!Object.keys(range).length) return {};
      return { [path]: range };
    }
    case 'gte':
      return { [path]: { $gte: Number(filter.value) } };
    case 'lte':
      return { [path]: { $lte: Number(filter.value) } };
    default:
      // Unknown op → treat as no-op in JS; same here.
      return {};
  }
};

/**
 * Translate search/filters into a Mongo match on `values.*`.
 * Returns `null` when the query cannot be expressed safely (caller falls back to in-memory).
 *
 * @param {{ search?: string, filters?: Record<string, unknown>, searchKeys?: string[] }} query
 * @returns {Record<string, unknown> | null}
 */
export const buildValuesMongoMatch = (query = {}) => {
  const filters = normalizeFilters(query.filters);
  const and = [];

  for (const [key, filter] of Object.entries(filters)) {
    if (!SAFE_VALUE_KEY.test(key)) return null;
    const clause = filterToMongoClause(`values.${key}`, filter);
    if (clause == null) return null;
    if (Object.keys(clause).length) and.push(clause);
  }

  const q = String(query.search || '').trim();
  if (q) {
    const keys = Array.isArray(query.searchKeys)
      ? query.searchKeys.map(String).filter((k) => SAFE_VALUE_KEY.test(k))
      : [];
    // Without an explicit key list we cannot safely $or across unknown value keys.
    if (!keys.length) return null;
    const rx = escapeRegex(q);
    and.push({
      $or: keys.map((k) => ({ [`values.${k}`]: { $regex: rx, $options: 'i' } })),
    });
  }

  if (!and.length) return {};
  return and.length === 1 ? and[0] : { $and: and };
};

/** Merge a base entity match with an optional values filter clause. */
export const combineMongoMatch = (base, extra) => {
  if (!extra || (typeof extra === 'object' && !Object.keys(extra).length)) return base;
  return { $and: [base, extra] };
};

/**
 * @param {Record<string, unknown>} values decoded row.values
 * @param {{ search?: string, filters?: Record<string, unknown>, searchKeys?: string[] }} query
 */
export const rowMatchesQuery = (values, query = {}) => {
  const filters = normalizeFilters(query.filters);
  const entries = Object.entries(filters);
  for (const [key, filter] of entries) {
    if (!matchFilter(values?.[key], filter)) return false;
  }

  const q = String(query.search || '').trim().toLowerCase();
  if (!q) return true;

  const keys = Array.isArray(query.searchKeys) && query.searchKeys.length
    ? query.searchKeys.map(String)
    : Object.keys(values || {});

  return keys.some((key) => asSearchText(values?.[key]).toLowerCase().includes(q));
};

export const hasActiveQuery = (query = {}) => {
  const search = String(query.search || '').trim();
  const filters = normalizeFilters(query.filters);
  return Boolean(search) || Object.keys(filters).length > 0;
};
