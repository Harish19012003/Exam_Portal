/**
 * Parse pasted text into new field definitions for the Fields drawer.
 *
 * One field per line:  Label | type | option 1, option 2   (type and options optional)
 * - Tab also separates columns, so a copy from Excel / Sheets works.
 * - A trailing * on the label marks the field required (e.g. "Roll No*").
 * - A single line with only commas ("Roll No, Name, Marks") is split into one field per item.
 * - Types needing extra setup (formula, composite) are not available in bulk.
 */

export const TYPE_ALIASES = {
  string: 'text',
  integer: 'number',
  int: 'number',
  decimal: 'number',
  float: 'number',
  select: 'dropdown',
  list: 'dropdown',
  bool: 'boolean',
  'yes/no': 'boolean',
  yesno: 'boolean',
  'date & time': 'datetime',
  'date and time': 'datetime',
  timestamp: 'datetime',
  'multi-select': 'multiselect',
  'multi select': 'multiselect',
  url: 'link',
  file: 'attachment',
};

const UNSUPPORTED_IN_BULK = new Set(['formula', 'composite']);
const OPTION_TYPES = new Set(['dropdown', 'multiselect', 'status', 'tags']);
const MAX_LABEL = 120;

const slug = (label) => {
  let key = String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!key) key = 'field';
  // Must start with a letter, and `sys_` is reserved by exam tables.
  if (!/^[a-z]/.test(key) || key.startsWith('sys_')) key = `f_${key}`.slice(0, 40);
  return key;
};

/** `id` is reserved by exam tables; slug() already keeps `sys_` out of keys. */
const isReserved = (key) => key === 'id';

const uniqueKey = (base, taken) => {
  let key = base;
  for (let n = 2; taken.has(key) || isReserved(key); n += 1) {
    const suffix = `_${n}`;
    key = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  return key;
};

export const resolveType = (raw, types) => {
  const wanted = String(raw).trim().toLowerCase();
  if (!wanted) return null;
  const direct = types.find((t) => t.value === wanted || t.label.toLowerCase() === wanted);
  if (direct) return direct.value;
  return types.find((t) => t.value === TYPE_ALIASES[wanted])?.value || null;
};

const splitLines = (text) => {
  const raw = String(text || '');
  const hasStructure = /[\n\t|]/.test(raw.trim());
  if (!hasStructure && raw.includes(',')) return raw.split(',');
  return raw.split(/\r?\n/);
};

/**
 * @returns {{ items: Array, valid: Array }} items keep line order; each has `error` when skipped.
 */
export const parseBulkFields = (text, existingFields = [], { defaultType = 'text', types = [] } = {}) => {
  const takenKeys = new Set(existingFields.map((f) => f.key));
  const takenLabels = new Set(existingFields.map((f) => String(f.label).trim().toLowerCase()));
  const items = [];

  splitLines(text).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [rawLabel = '', rawType = '', rawOptions = ''] = trimmed.split(/\t|\|/).map((s) => s.trim());

    let label = rawLabel;
    let required = false;
    if (label.endsWith('*')) {
      required = true;
      label = label.slice(0, -1).trim();
    }
    const item = { line: index + 1, label, required, dataType: defaultType, options: [], key: '', error: '' };

    if (!label) item.error = 'Name is empty';
    else if (label.length > MAX_LABEL) item.error = `Name is longer than ${MAX_LABEL} characters`;
    else if (takenLabels.has(label.toLowerCase())) item.error = 'A field with this name already exists';

    if (!item.error && rawType) {
      const resolved = resolveType(rawType, types);
      if (!resolved) item.error = `Unknown type "${rawType}"`;
      else item.dataType = resolved;
    }
    if (!item.error && UNSUPPORTED_IN_BULK.has(item.dataType)) {
      item.error = `${item.dataType} fields need the single-field editor`;
    }
    if (!item.error && OPTION_TYPES.has(item.dataType)) {
      item.options = [...new Set(rawOptions.split(',').map((s) => s.trim()).filter(Boolean))];
      if (!item.options.length) item.error = 'Add options after a second |, e.g. Center | dropdown | A, B, C';
    }

    if (!item.error) {
      item.key = uniqueKey(slug(label), takenKeys);
      takenKeys.add(item.key);
      takenLabels.add(label.toLowerCase());
    }
    items.push(item);
  });

  return { items, valid: items.filter((i) => !i.error) };
};

/** Same shape the single-field editor produces. */
export const toFieldDefinition = (item, order) => {
  const def = {
    id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: item.label,
    key: item.key,
    dataType: item.dataType,
    required: item.required,
    options: item.options,
    optionsSource: 'manual',
    configListId: '',
    allowMultiple: item.dataType === 'multiselect',
    autoFill: item.autoFill || 'none',
    layout: item.layout || 'full',
    sameAsFieldKey: '',
    sameAsDefaultOn: true,
    order,
  };
  if (item.unique) def.unique = true;
  if (item.dataType === 'phone' && item.phoneValidation) {
    def.phoneValidation = item.phoneValidation;
  }
  return def;
};
