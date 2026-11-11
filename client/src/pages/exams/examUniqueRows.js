/**
 * Composite uniqueness for imported / shared columns (e.g. State + City + Vendor Name).
 * Stored on view/preset features as:
 *   uniqueRowKeys: string[]
 *   uniqueRowAggregates: [{ targetKey, op: 'count'|'sum', sourceKey? }]
 */

import {
  DATE_SHIFT_ALL_DAY_KEY,
  isAllDayDateShiftField,
  resolveAllDayValueFromRow,
} from './dateShiftsConfig';

export const UNIQUE_ROW_AGGREGATE_OPS = [
  { value: 'count', label: 'Count rows' },
  { value: 'sum', label: 'Sum values' },
];

export const normalizeUniqueRowKeys = (keys) =>
  Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [])
        .map((k) => String(k || '').trim())
        .filter(Boolean),
    ),
  );

/** Build a stable composite identity from row values (case-insensitive, trimmed). */
export const uniqueRowComposite = (values, keys) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length) return '';
  const bag = values && typeof values === 'object' ? values : {};
  return keyList.map((k) => String(bag[k] ?? '').trim().toLowerCase()).join('\0');
};

export const normalizeUniqueRowAggregates = (rules) => {
  if (!Array.isArray(rules)) return [];
  const out = [];
  const seenTargets = new Set();
  for (const raw of rules) {
    if (!raw || typeof raw !== 'object') continue;
    const targetKey = String(raw.targetKey || '').trim();
    const op = String(raw.op || '').trim().toLowerCase();
    if (!targetKey || (op !== 'count' && op !== 'sum')) continue;
    if (seenTargets.has(targetKey)) continue;
    const sourceKey = String(raw.sourceKey || '').trim();
    if (op === 'sum' && !sourceKey) continue;
    seenTargets.add(targetKey);
    out.push(op === 'sum' ? { targetKey, op, sourceKey } : { targetKey, op });
  }
  return out;
};

export const uniqueAggregateTargetKeys = (rules) =>
  new Set(normalizeUniqueRowAggregates(rules).map((r) => r.targetKey));

const rowValues = (row) => (row?.values && typeof row.values === 'object' ? row.values : row) || {};

const toFiniteNumber = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Keep the first row for each composite key combination.
 * Empty key lists return the input unchanged.
 */
export const dedupeRowsByUniqueKeys = (rows = [], keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length || !Array.isArray(rows) || rows.length === 0) return rows;
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const composite = uniqueRowComposite(rowValues(row), keyList);
    if (seen.has(composite)) continue;
    seen.add(composite);
    out.push(row);
  }
  return out;
};

const isAllDaySumSource = (sourceKey, fields = []) => {
  if (sourceKey === DATE_SHIFT_ALL_DAY_KEY) return true;
  const sourceField = fields.find((f) => f?.key === sourceKey);
  return Boolean(sourceField && isAllDayDateShiftField(sourceField));
};

/** Near-duplicate result columns users often create (Max All Day / Max All Days / All Day Max). */
const isMaxAllDayResultField = (field) => {
  if (!field?.key) return false;
  const key = String(field.key);
  const label = String(field.label || '');
  return (
    /^(all_day_max|max_all_days?)$/i.test(key) ||
    /\bmax\s*all\s*days?\b/i.test(label) ||
    /\ball\s*day\s*max\b/i.test(label)
  );
};

/**
 * Resolve a sum source cell. Max all day is formula-only on Center list — compute from shift cells.
 * Prefer live shift aggregate over a stored 0 / empty formula cell.
 * @param {{ dateShifts?: object, fields?: object[] }} [ctx]
 */
const resolveSumSourceNumber = (row, sourceKey, ctx = {}) => {
  const bag = rowValues(row);
  const fields = Array.isArray(ctx.fields) ? ctx.fields : [];
  if (isAllDaySumSource(sourceKey, fields)) {
    const computed = resolveAllDayValueFromRow(bag, ctx.dateShifts);
    if (computed != null) return computed;
  }
  return toFiniteNumber(bag[sourceKey]);
};

/**
 * Collapse to one row per unique key and fill aggregate result fields
 * (count of matching centers, sum of a source column across the group).
 * @param {{ dateShifts?: object, fields?: object[] }} [ctx]
 */
export const rollupRowsByUniqueKeys = (rows = [], keys = [], aggregates = [], ctx = {}) => {
  const keyList = normalizeUniqueRowKeys(keys);
  const rules = normalizeUniqueRowAggregates(aggregates);
  if (!keyList.length || !Array.isArray(rows) || rows.length === 0) return rows;

  const groups = new Map();
  for (const row of rows) {
    const composite = uniqueRowComposite(rowValues(row), keyList);
    let group = groups.get(composite);
    if (!group) {
      group = { first: row, members: [] };
      groups.set(composite, group);
    }
    group.members.push(row);
  }

  return Array.from(groups.values()).map(({ first, members }) => {
    if (!rules.length) return first;
    const patch = {};
    for (const rule of rules) {
      if (rule.op === 'count') {
        patch[rule.targetKey] = members.length;
        continue;
      }
      if (rule.op === 'sum') {
        let sum = 0;
        for (const member of members) {
          const n = resolveSumSourceNumber(member, rule.sourceKey, ctx);
          if (n != null) sum += n;
        }
        patch[rule.targetKey] = sum;
        // Write-to may be "All Day Max" while the visible column is "Max All Days" — fill both.
        if (isAllDaySumSource(rule.sourceKey, ctx.fields)) {
          for (const f of Array.isArray(ctx.fields) ? ctx.fields : []) {
            if (!isMaxAllDayResultField(f) || f.key === rule.targetKey) continue;
            patch[f.key] = sum;
          }
        }
      }
    }
    return {
      ...first,
      values: { ...rowValues(first), ...patch },
    };
  });
};

export const uniqueRowKeysLabel = (fields = [], keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length) return '';
  const byKey = new Map((fields || []).map((f) => [f.key, f.label || f.key]));
  return keyList.map((k) => byKey.get(k) || k).join(' · ');
};
