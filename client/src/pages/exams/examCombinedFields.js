import { slugifyKey, normalizeFieldKey, isValidFieldKey } from './examFieldTypes';

export const DEFAULT_COMBINE_SEPARATOR = ', ';

/** Separator choices shown to the user ("custom" lets them type their own). */
export const COMBINE_SEPARATORS = [
  { id: 'comma', label: 'Comma  ( , )', value: ', ' },
  { id: 'space', label: 'Space', value: ' ' },
  { id: 'dash', label: 'Dash  ( – )', value: ' – ' },
  { id: 'slash', label: 'Slash  ( / )', value: ' / ' },
  { id: 'pipe', label: 'Pipe  ( | )', value: ' | ' },
  { id: 'newline', label: 'Line break (new line)', value: '\n' },
];

/** A readable name for a joined column title (a line break can't go in a label). */
export const separatorForLabel = (separator) =>
  String(separator ?? '').includes('\n') ? ' / ' : (separator || DEFAULT_COMBINE_SEPARATOR);

export const isCombinedField = (field) =>
  field?.dataType === 'combined' && Array.isArray(field?.combine?.keys) && field.combine.keys.length >= 2;

const partText = (raw) => {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean).join(', ');
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  return String(raw).trim();
};

/** Join non-empty parts with separator (no stray separators). */
export const joinCombinedParts = (values, keys = [], separator = DEFAULT_COMBINE_SEPARATOR) => {
  const sep = separator == null ? DEFAULT_COMBINE_SEPARATOR : String(separator);
  const source = values && typeof values === 'object' ? values : {};
  return (keys || [])
    .map((key) => partText(source[key]))
    .filter(Boolean)
    .join(sep);
};

/** Suggest a unique key for a combined column label. */
export const suggestCombinedKey = (label, takenKeys = []) => {
  const taken = new Set([...(takenKeys || [])].map(String));
  let base = normalizeFieldKey(slugifyKey(label || 'combined')) || 'combined';
  if (!isValidFieldKey(base)) base = 'combined';
  if (!base.endsWith('_combined') && !taken.has(base)) {
    // Prefer a clear suffix when free.
    const withSuffix = `${base}_combined`.slice(0, 40);
    if (isValidFieldKey(withSuffix) && !taken.has(withSuffix)) return withSuffix;
  }
  let key = base.slice(0, 40);
  for (let n = 2; taken.has(key) || !isValidFieldKey(key); n += 1) {
    const suffix = `_${n}`;
    key = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  return key;
};

/**
 * Build a read-only combined field def from source fields on one home page.
 * Does not include the source columns themselves — only the joined column.
 */
export const buildCombinedField = ({
  label,
  keys,
  separator = DEFAULT_COMBINE_SEPARATOR,
  sourceView,
  takenKeys = [],
  sourceFields = [],
} = {}) => {
  const cleanKeys = [...new Set((keys || []).map(String).filter(Boolean))];
  if (cleanKeys.length < 2) throw new Error('Pick at least two fields to combine.');
  const name = String(label || '').trim() || cleanKeys
    .map((k) => sourceFields.find((f) => f.key === k)?.label || k)
    .join(separatorForLabel(separator));
  return {
    id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: name.slice(0, 120),
    key: suggestCombinedKey(name, takenKeys),
    dataType: 'combined',
    required: false,
    autoFill: 'none',
    layout: 'full',
    sharedFromView: sourceView || undefined,
    combine: {
      keys: cleanKeys,
      separator: separator == null ? DEFAULT_COMBINE_SEPARATOR : String(separator),
    },
  };
};

/** Paint combined columns onto table rows from the shared values bag (not stored). */
export const applyCombinedDisplayValues = (rows, fields) => {
  const combined = (fields || []).filter(isCombinedField);
  if (!combined.length) return rows;
  return (rows || []).map((row) => {
    const rawBase = row.rawValues || row.values || {};
    const values = { ...(row.values || {}) };
    combined.forEach((f) => {
      values[f.key] = joinCombinedParts(rawBase, f.combine.keys, f.combine.separator);
    });
    return { ...row, values, rawValues: rawBase };
  });
};

/** Drop painted combined keys before persist (same idea as fromExam / linked). */
export const restoreCombinedValues = (updatedValues, originalValues, fields) => {
  const next = { ...updatedValues };
  (fields || []).filter(isCombinedField).forEach((f) => {
    if (originalValues && f.key in originalValues) next[f.key] = originalValues[f.key];
    else delete next[f.key];
  });
  return next;
};
