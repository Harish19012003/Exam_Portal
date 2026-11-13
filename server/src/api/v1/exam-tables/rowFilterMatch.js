/**
 * Mirror of client DynamicData/dataProcessing matchFilter + search.
 * Used by Mass Edit "Filtered" so the server can select matching row ids
 * without the client downloading the whole table.
 */

const asSearchText = (raw) => {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? '')).join(' ');
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
};

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
