import { slugifyKey, normalizeFieldKey, isValidFieldKey } from './examFieldTypes';
import {
  DEFAULT_COMBINE_SEPARATOR,
  joinCombinedParts,
  separatorForLabel,
} from './examCombinedFields';

export const DEFAULT_SUMMARY_FIELD_SEPARATOR = ' – ';
export const DEFAULT_SUMMARY_ROW_SEPARATOR = '\n';

const cleanKeys = (keys) => [...new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean))];

export const normalizeSummaryConfig = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const sourceView = String(raw.sourceView || '').trim();
  const matchKeys = cleanKeys(raw.matchKeys);
  const valueKeys = cleanKeys(raw.valueKeys);
  if (!sourceView || matchKeys.length < 1 || valueKeys.length < 1) return null;
  return {
    sourceView,
    sourceLabel: String(raw.sourceLabel || '').trim(),
    matchKeys,
    valueKeys,
    fieldSeparator:
      raw.fieldSeparator == null ? DEFAULT_SUMMARY_FIELD_SEPARATOR : String(raw.fieldSeparator),
    rowSeparator:
      raw.rowSeparator == null ? DEFAULT_SUMMARY_ROW_SEPARATOR : String(raw.rowSeparator),
  };
};

export const isSummaryField = (field) =>
  field?.dataType === 'summary' && Boolean(normalizeSummaryConfig(field.summary));

/** Compare match cells even when one side is ISO and the other is d/m/y. */
export const summaryMatchToken = (raw) => {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) {
    return raw.map((v) => summaryMatchToken(v)).filter(Boolean).join(', ');
  }
  if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return s.toLowerCase();
};

const matchToken = (values, keys) => {
  const parts = (keys || []).map((k) => summaryMatchToken(values?.[k]));
  if (parts.some((p) => !p)) return '';
  return parts.join('\0');
};

const sourceValues = (row) => ({
  ...(row?.rawValues && typeof row.rawValues === 'object' ? row.rawValues : {}),
  ...(row?.values && typeof row.values === 'object' ? row.values : {}),
});

/**
 * One cell: every source row whose match columns equal this row, each row's
 * value columns joined, then those lines joined.
 */
export const summarizeMatches = (rowValues, sourceRows, summary) => {
  const cfg = normalizeSummaryConfig(summary);
  if (!cfg) return '';
  const wanted = matchToken(rowValues, cfg.matchKeys);
  if (!wanted) return '';
  const lines = [];
  (sourceRows || []).forEach((src) => {
    const vals = sourceValues(src);
    if (matchToken(vals, cfg.matchKeys) !== wanted) return;
    const line = joinCombinedParts(vals, cfg.valueKeys, cfg.fieldSeparator);
    if (line) lines.push(line);
  });
  return lines.join(cfg.rowSeparator);
};

export const summaryChipText = (summary) => {
  const cfg = normalizeSummaryConfig(summary);
  if (!cfg) return 'Pick columns';
  const match = cfg.matchKeys.join(' + ');
  const values = cfg.valueKeys.join(separatorForLabel(cfg.fieldSeparator));
  return `${match} → ${values}`;
};

const suggestSummaryKey = (label, takenKeys = []) => {
  const taken = new Set([...(takenKeys || [])].map(String));
  let base = normalizeFieldKey(slugifyKey(label || 'summary')) || 'summary';
  if (!isValidFieldKey(base)) base = 'summary';
  const withSuffix = `${base.replace(/_summary$/, '')}_summary`.slice(0, 40);
  let key = isValidFieldKey(withSuffix) ? withSuffix : base.slice(0, 40);
  for (let n = 2; taken.has(key) || !isValidFieldKey(key); n += 1) {
    const suffix = `_${n}`;
    key = `${(withSuffix || base).slice(0, 40 - suffix.length)}${suffix}`;
  }
  return key;
};

export const buildSummaryField = ({
  label,
  summary,
  takenKeys = [],
  sourceFields = [],
} = {}) => {
  const cfg = normalizeSummaryConfig(summary);
  if (!cfg) throw new Error('Pick a source page, at least one match column, and at least one value column.');
  const name = String(label || '').trim()
    || cfg.valueKeys
      .map((k) => sourceFields.find((f) => f.key === k)?.label || k)
      .join(separatorForLabel(cfg.fieldSeparator));
  return {
    id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: name.slice(0, 120),
    key: suggestSummaryKey(name, takenKeys),
    dataType: 'summary',
    required: false,
    autoFill: 'none',
    layout: 'full',
    summary: cfg,
  };
};

/** Paint summary columns from source rows. Not stored. */
export const applySummaryDisplayValues = (rows, fields, sourceRowsByView = {}) => {
  const summaryFields = (fields || []).filter(isSummaryField);
  if (!summaryFields.length) return rows;
  const indexes = summaryFields.map((field) => {
    const cfg = normalizeSummaryConfig(field.summary);
    const map = new Map();
    const sourceRows = sourceRowsByView[cfg.sourceView] || [];
    sourceRows.forEach((src) => {
      const vals = sourceValues(src);
      const token = matchToken(vals, cfg.matchKeys);
      if (!token) return;
      const line = joinCombinedParts(vals, cfg.valueKeys, cfg.fieldSeparator);
      if (!line) return;
      if (!map.has(token)) map.set(token, []);
      map.get(token).push(line);
    });
    return { field, cfg, map };
  });
  return (rows || []).map((row) => {
    const rawBase = row.rawValues || row.values || {};
    const values = { ...(row.values || {}) };
    indexes.forEach(({ field, cfg, map }) => {
      const token = matchToken(rawBase, cfg.matchKeys) || matchToken(values, cfg.matchKeys);
      const lines = token ? map.get(token) : null;
      values[field.key] = lines?.length ? lines.join(cfg.rowSeparator) : '';
    });
    return { ...row, values, rawValues: rawBase };
  });
};

export const restoreSummaryValues = (updatedValues, originalValues, fields) => {
  const next = { ...updatedValues };
  (fields || []).filter(isSummaryField).forEach((f) => {
    if (originalValues && f.key in originalValues) next[f.key] = originalValues[f.key];
    else delete next[f.key];
  });
  return next;
};
