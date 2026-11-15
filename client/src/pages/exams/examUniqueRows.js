/**
 * Composite uniqueness for imported / shared columns (e.g. State + City + Vendor Name).
 * Stored on view/preset features as:
 *   uniqueRowKeys: string[]
 *   uniqueRowAggregates: [{
 *     targetKey, op: 'count'|'sum', sourceKey?,
 *     whereKey?, whereOp?: 'eq'|'neq'|'filled'|'empty', whereValue?,
 *     whereFormula? // snapshot when Where targets a formula field (survives missing schema)
 *   }]
 */

import { getAggregatableValue } from '../../components/DynamicTable/utils/evaluateFormula';
import {
  DATE_SHIFT_ALL_DAY_KEY,
  FOCUS_MAX_ALL_DAY_COLUMN_KEY,
  FOCUS_TOTAL_CENTER_COLUMN_KEY,
  isAllDayDateShiftField,
  resolveAllDayValueFromRow,
  resolveDayAggregateFromRow,
  rowHasActivityOnDate,
} from './dateShiftsConfig';

export const UNIQUE_ROW_AGGREGATE_OPS = [
  { value: 'count', label: 'Count rows' },
  { value: 'sum', label: 'Sum values' },
];

export const UNIQUE_ROW_WHERE_OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'filled', label: 'is filled' },
  { value: 'empty', label: 'is empty' },
];

const WHERE_OP_SET = new Set(UNIQUE_ROW_WHERE_OPS.map((o) => o.value));

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

const normalizeWhereClause = (raw = {}) => {
  const whereKey = String(raw.whereKey || '').trim();
  if (!whereKey) return null;
  const whereOp = WHERE_OP_SET.has(String(raw.whereOp || '').trim().toLowerCase())
    ? String(raw.whereOp).trim().toLowerCase()
    : 'eq';
  const whereValue = String(raw.whereValue ?? '').trim();
  if ((whereOp === 'eq' || whereOp === 'neq') && !whereValue) return null;
  const whereFormula = String(raw.whereFormula || '').trim();
  return whereFormula
    ? { whereKey, whereOp, whereValue, whereFormula }
    : { whereKey, whereOp, whereValue };
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
    const where = normalizeWhereClause(raw);
    const base = op === 'sum' ? { targetKey, op, sourceKey } : { targetKey, op };
    out.push(where ? { ...base, ...where } : base);
  }
  return out;
};

const rowValues = (row) => (row?.values && typeof row.values === 'object' ? row.values : row) || {};

const YES_VALUES = new Set(['yes', 'y', 'true', '1']);
const NO_VALUES = new Set(['no', 'n', 'false', '0']);

const normalizeCompareToken = (value) => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) return 'yes';
    if (value === 0) return 'no';
  }
  return String(value ?? '')
    .trim()
    .toLowerCase();
};

/** Case-insensitive equality with Yes/No ↔ true/false/1/0 aliases. */
const valuesEqualLoose = (leftRaw, rightRaw) => {
  const left = normalizeCompareToken(leftRaw);
  const right = normalizeCompareToken(rightRaw);
  if (left === right) return true;
  if (YES_VALUES.has(left) && YES_VALUES.has(right)) return true;
  if (NO_VALUES.has(left) && NO_VALUES.has(right)) return true;
  return false;
};

/** Minimal FieldColumn list so formula Where clauses resolve like the grid. */
const columnsForWhere = (ctx = {}) => {
  if (Array.isArray(ctx.columns) && ctx.columns.length) return ctx.columns;
  return (Array.isArray(ctx.fields) ? ctx.fields : [])
    .filter((f) => f?.key)
    .map((f) => ({
      key: f.key,
      label: f.label || f.key,
      dataType: f.dataType || 'text',
      formula: f.formula,
      resultType: f.resultType || (f.dataType === 'formula' ? 'text' : undefined),
    }));
};

/**
 * Formula refs like {mock_attendance} may live on another tab and not be in this page's
 * column schema. Without a column stub, evaluateFormulaHelper replaces them with 0 and
 * Final Mock never equals "Yes" during Count Where — Mock Done stays 0.
 */
const columnsForFormulaWhere = (formulaCol, bag, ctx = {}) => {
  const base = columnsForWhere(ctx);
  const byKey = new Map(base.map((c) => [c.key, c]));
  if (formulaCol?.key) byKey.set(formulaCol.key, formulaCol);
  const expr = String(formulaCol?.formula || '');
  for (const m of expr.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    const ref = m[1];
    if (byKey.has(ref)) continue;
    // Prefer text so "Yes" compares as a string, not a number 0.
    const sample = bag?.[ref];
    const dataType =
      typeof sample === 'boolean'
        ? 'boolean'
        : typeof sample === 'number'
          ? 'number'
          : 'text';
    byKey.set(ref, { key: ref, label: ref, dataType });
  }
  // Also stub any other keys present on the row (linked / shared values).
  Object.keys(bag || {}).forEach((ref) => {
    if (byKey.has(ref)) return;
    const sample = bag[ref];
    const dataType =
      typeof sample === 'boolean'
        ? 'boolean'
        : typeof sample === 'number'
          ? 'number'
          : 'text';
    byKey.set(ref, { key: ref, label: ref, dataType });
  });
  return Array.from(byKey.values());
};

const findWhereFieldCol = (whereKey, ctx = {}) => {
  const key = String(whereKey || '').trim();
  if (!key) return null;
  const columns = columnsForWhere(ctx);
  const fromCols = columns.find((c) => c.key === key);
  if (fromCols) return fromCols;
  const field = (Array.isArray(ctx.fields) ? ctx.fields : []).find((f) => f?.key === key);
  if (!field) return null;
  return {
    key: field.key,
    label: field.label || field.key,
    dataType: field.dataType || 'text',
    formula: field.formula,
    resultType: field.resultType || (field.dataType === 'formula' ? 'text' : undefined),
  };
};

/**
 * Value used for Where matching — stored cell, or live formula result (same as grid display).
 * `rule.whereFormula` is a snapshot so Count still works when the formula field is missing
 * from this page's schema (UI shows "final_mock (saved)").
 */
export const resolveAggregateWhereValue = (row, whereKey, ctx = {}, rule = {}) => {
  const key = String(whereKey || '').trim();
  if (!key) return undefined;
  const bag = rowValues(row);
  const snapFormula = String(rule?.whereFormula || '').trim();
  let col = findWhereFieldCol(key, ctx);
  if ((!col || col.dataType !== 'formula' || !col.formula) && snapFormula) {
    col = {
      key,
      label: key,
      dataType: 'formula',
      formula: snapFormula,
      resultType: 'text',
    };
  }
  if (col?.dataType === 'formula' && col.formula) {
    const formulaColumns = columnsForFormulaWhere(col, bag, ctx);
    const computed = getAggregatableValue(col, { values: bag }, formulaColumns);
    // Empty string is a real formula result (Final Mock → blank when not Yes).
    if (computed !== undefined && computed !== null) return computed;
  }
  if (bag[key] !== undefined && bag[key] !== null && bag[key] !== '') return bag[key];
  const rawBag = row?.rawValues && typeof row.rawValues === 'object' ? row.rawValues : null;
  if (rawBag && rawBag[key] !== undefined && rawBag[key] !== null && rawBag[key] !== '') {
    return rawBag[key];
  }
  // Last resort for Final Mock–style formulas: any referenced field equals the target.
  if (col?.dataType === 'formula' && col.formula && (!rule?.whereOp || rule.whereOp === 'eq')) {
    const refs = [...String(col.formula).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (valuesEqualLoose(bag[ref], rule.whereValue)) return rule.whereValue;
    }
  }
  // Known Final Mock shape when formula schema is missing from this page ("final_mock (saved)").
  if (
    (key === 'final_mock' || /final_?mock/i.test(key)) &&
    (!rule?.whereOp || rule.whereOp === 'eq') &&
    rule?.whereValue != null &&
    String(rule.whereValue).trim() !== ''
  ) {
    for (const ref of ['mock_attendance', 'mock_report', 'final_mock']) {
      if (valuesEqualLoose(bag[ref], rule.whereValue)) return rule.whereValue;
    }
  }
  return bag[key];
};

/** True when a center row matches an aggregate where-clause (case-insensitive). */
export const rowMatchesAggregateWhere = (row, rule, ctx = {}) => {
  const whereKey = String(rule?.whereKey || '').trim();
  if (!whereKey) return true;
  const whereOp = WHERE_OP_SET.has(String(rule?.whereOp || '').trim().toLowerCase())
    ? String(rule.whereOp).trim().toLowerCase()
    : 'eq';
  const raw = resolveAggregateWhereValue(row, whereKey, ctx, rule);
  const filled =
    raw != null &&
    !(typeof raw === 'string' && !String(raw).trim()) &&
    !(Array.isArray(raw) && raw.length === 0) &&
    raw !== false;
  if (whereOp === 'filled') return filled;
  if (whereOp === 'empty') return !filled;
  const equal = valuesEqualLoose(raw, rule?.whereValue);
  if (whereOp === 'neq') return !equal;
  return equal;
};

export const uniqueAggregateTargetKeys = (rules) =>
  new Set(normalizeUniqueRowAggregates(rules).map((r) => r.targetKey));

/** Count / Max-all-day sum targets used to attach Date Total Center / Date Max All Day fields. */
export const focusDateTargetsFromAggregates = (rules) => {
  const list = normalizeUniqueRowAggregates(rules);
  const countTargetKey = list.find((r) => r.op === 'count')?.targetKey || '';
  const sumTargetKey =
    list.find(
      (r) =>
        r.op === 'sum' &&
        (r.sourceKey === DATE_SHIFT_ALL_DAY_KEY || /allday/i.test(String(r.sourceKey || ''))),
    )?.targetKey || '';
  return { countTargetKey, sumTargetKey };
};

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
const rowUpdatedAt = (row) => {
  const t =
    row?.updatedAt ||
    row?.values?.updated_at ||
    row?.createdAt ||
    row?.values?.created_at ||
    0;
  const n = new Date(t).getTime();
  return Number.isFinite(n) ? n : 0;
};

/** Prefer the most recently updated member so an edit stays visible after refresh. */
const pickRepresentative = (members = []) => {
  if (!members.length) return null;
  return [...members].sort((a, b) => rowUpdatedAt(b) - rowUpdatedAt(a))[0];
};

export const rollupRowsByUniqueKeys = (rows = [], keys = [], aggregates = [], ctx = {}) => {
  const keyList = normalizeUniqueRowKeys(keys);
  const rules = normalizeUniqueRowAggregates(aggregates);
  if (!keyList.length || !Array.isArray(rows) || rows.length === 0) return rows;

  const focusDateId = String(ctx.focusDateId || '').trim();
  const focusDateShifts = ctx.dateShifts || null;

  const groups = new Map();
  for (const row of rows) {
    const composite = uniqueRowComposite(rowValues(row), keyList);
    let group = groups.get(composite);
    if (!group) {
      group = { members: [] };
      groups.set(composite, group);
    }
    group.members.push(row);
  }

  return Array.from(groups.values()).map(({ members }) => {
    const first = pickRepresentative(members);
    if (!rules.length) return first;
    const patch = {};
    for (const rule of rules) {
      const matched = members.filter((m) => rowMatchesAggregateWhere(m, rule, ctx));
      if (rule.op === 'count') {
        // Permanent target = matching centers (optionally filtered by where-clause).
        patch[rule.targetKey] = matched.length;
        // Focus-date Total Center stays unconditioned (activity on selected exam date).
        if (focusDateId && focusDateShifts && !rule.whereKey) {
          patch[FOCUS_TOTAL_CENTER_COLUMN_KEY] = members.filter((m) =>
            rowHasActivityOnDate(rowValues(m), focusDateShifts, focusDateId),
          ).length;
        }
        continue;
      }
      if (rule.op === 'sum') {
        let overall = 0;
        for (const member of matched) {
          const n = resolveSumSourceNumber(member, rule.sourceKey, ctx);
          if (n != null) overall += n;
        }
        patch[rule.targetKey] = overall;
        // Write-to may be "All Day Max" while the visible column is "Max All Days" — fill both.
        if (isAllDaySumSource(rule.sourceKey, ctx.fields)) {
          for (const f of Array.isArray(ctx.fields) ? ctx.fields : []) {
            if (!isMaxAllDayResultField(f) || f.key === rule.targetKey) continue;
            patch[f.key] = overall;
          }
        }
        // Sheet-style `{date} Max All Day` for the selected exam date.
        if (focusDateId && focusDateShifts && isAllDaySumSource(rule.sourceKey, ctx.fields)) {
          let focusSum = 0;
          for (const member of matched) {
            const n = resolveDayAggregateFromRow(rowValues(member), focusDateShifts, focusDateId);
            if (n != null) focusSum += n;
          }
          patch[FOCUS_MAX_ALL_DAY_COLUMN_KEY] = focusSum;
        }
      }
    }
    return {
      ...first,
      values: { ...rowValues(first), ...patch },
    };
  });
};

/** All physical row ids that share the same unique-key composite as `rowId`. */
export const siblingIdsForUniqueRow = (rows = [], rowId, keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length || !rowId) return [String(rowId)].filter(Boolean);
  const edited = (rows || []).find((r) => String(r.id || r.rowId) === String(rowId));
  if (!edited) return [String(rowId)];
  const composite = uniqueRowComposite(rowValues(edited), keyList);
  if (!composite) return [String(rowId)];
  const ids = (rows || [])
    .filter((r) => uniqueRowComposite(rowValues(r), keyList) === composite)
    .map((r) => String(r.id || r.rowId))
    .filter(Boolean);
  return ids.length ? ids : [String(rowId)];
};

export const uniqueRowKeysLabel = (fields = [], keys = []) => {
  const keyList = normalizeUniqueRowKeys(keys);
  if (!keyList.length) return '';
  const byKey = new Map((fields || []).map((f) => [f.key, f.label || f.key]));
  return keyList.map((k) => byKey.get(k) || k).join(' · ');
};
