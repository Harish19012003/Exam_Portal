import {
  getConfigListOptions,
  loadConfigDropdownLists,
} from '../settings/configStorage';

/** Mirrors DynamicTable DataType — all creatable exam field types */
export const EXAM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'code', label: 'Code' },
  { value: 'mono', label: 'Mono' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'time', label: 'Time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'status', label: 'Status' },
  { value: 'tags', label: 'Tags' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dot', label: 'Dot' },
  { value: 'progress', label: 'Progress' },
  { value: 'rating', label: 'Rating' },
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'icon', label: 'Icon' },
  { value: 'formula', label: 'Formula' },
  { value: 'composite', label: 'Composite' },
];

export const AUTO_FILL_OPTIONS = [
  { value: 'none', label: 'None (user enters)' },
  { value: 'currentUser', label: 'Current user (auto)' },
  { value: 'today', label: 'Today’s date (auto)' },
  { value: 'timestamp', label: 'Timestamp (auto)' },
  { value: 'dash', label: 'Dash — (auto)' },
];

/** Phone field validation presets (pattern applied on create / edit forms). */
export const PHONE_VALIDATION_PRESETS = [
  { value: 'none', label: 'No extra validation', pattern: '', message: '' },
  {
    value: 'india_mobile',
    label: 'India mobile (10 digits)',
    pattern: '^[6-9]\\d{9}$',
    message: 'Enter a 10-digit Indian mobile number',
  },
  {
    value: 'india_e164',
    label: 'India (+91 optional)',
    pattern: '^(?:\\+91[\\s-]?)?[6-9]\\d{9}$',
    message: 'Enter a valid Indian mobile number',
  },
  {
    value: 'e164',
    label: 'International (E.164)',
    pattern: '^\\+[1-9]\\d{7,14}$',
    message: 'Use + and country code, e.g. +919876543210',
  },
  {
    value: 'digits_10_15',
    label: 'Digits only (10–15)',
    pattern: '^\\d{10,15}$',
    message: 'Enter 10–15 digits',
  },
  { value: 'custom', label: 'Custom regex', pattern: '', message: '' },
];

export const emptyPhoneValidation = () => ({
  mode: 'none',
  pattern: '',
  message: '',
});

/** Resolve effective pattern + message from a field’s phoneValidation config. */
export const resolvePhoneValidation = (fieldOrValidation) => {
  const v =
    fieldOrValidation && typeof fieldOrValidation === 'object'
      ? fieldOrValidation.phoneValidation || fieldOrValidation
      : null;
  if (!v || typeof v !== 'object') return { pattern: '', message: '' };
  const mode = v.mode || 'none';
  if (mode === 'none') return { pattern: '', message: '' };
  if (mode === 'custom') {
    return {
      pattern: String(v.pattern || '').trim(),
      message: String(v.message || '').trim() || 'Enter a valid phone number',
    };
  }
  const preset = PHONE_VALIDATION_PRESETS.find((p) => p.value === mode);
  return {
    pattern: preset?.pattern || '',
    message: String(v.message || '').trim() || preset?.message || 'Enter a valid phone number',
  };
};

export const isValidRegexPattern = (pattern) => {
  if (!pattern) return false;
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

/** Returns error string if phone value fails the field’s validation; otherwise ''. */
export const validatePhoneFieldValue = (field, value) => {
  if (!field || field.dataType !== 'phone') return '';
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return '';
  const { pattern, message } = resolvePhoneValidation(field);
  if (!pattern) return '';
  try {
    if (!new RegExp(pattern).test(raw)) return message || `${field.label} is invalid.`;
  } catch {
    return '';
  }
  return '';
};

export const OPTIONS_FIELD_TYPES = new Set(['dropdown', 'multiselect', 'status', 'tags']);
export const CHOICE_FIELD_TYPES = new Set(['dropdown', 'multiselect', 'status']);
export const BOOLEAN_FIELD_TYPES = new Set(['boolean', 'checkbox', 'dot']);
export const DATE_LINK_TYPES = new Set(['date', 'datetime']);

export const FIELDS_STORAGE_KEY = 'exam_form_fields_v2';

export { loadConfigDropdownLists, getConfigListOptions };

/** Field types that can be marked Unique (matches the server). */
export const UNIQUE_FIELD_TYPES = new Set(['text', 'code', 'mono', 'email', 'phone', 'number', 'currency', 'link']);

export const slugifyKey = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `field_${Date.now()}`;

/** Normalize a user-entered field key (slug). Empty string if nothing usable. */
export const normalizeFieldKey = (raw) => {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return key;
};

/** Valid persisted key: starts with a letter, then letters/digits/underscore */
export const isValidFieldKey = (key) => /^[a-z][a-z0-9_]{0,39}$/.test(String(key || ''));

/** ISO date (yyyy-mm-dd) — safe for DynamicTable date/datetime columns */
export const formatISODate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

/** Local datetime (yyyy-mm-ddThh:mm) — works with datetime-local inputs */
export const formatISODateTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

/** Display date (dd/mm/yyyy) for form audit labels */
export const formatDisplayDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getCurrentUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || user.email || 'User';
  } catch {
    return 'User';
  }
};

export const resolveAutoFillValue = (autoFill) => {
  switch (autoFill) {
    case 'currentUser':
      return getCurrentUserName();
    case 'today':
      return formatISODate();
    case 'timestamp':
      return formatISODateTime();
    case 'dash':
      return '—';
    default:
      return null;
  }
};

/** Effective type for rendering (Dropdown + multi → multiselect) */
export const getEffectiveDataType = (field) => {
  if (!field) return 'text';
  if (
    (field.dataType === 'dropdown' || field.dataType === 'status') &&
    field.allowMultiple
  ) {
    return 'multiselect';
  }
  return field.dataType;
};

/** Live-resolve options: Config preset is always read fresh from storage */
export const resolveFieldOptions = (field) => {
  if (!field) return [];
  if (field.optionsSource === 'config' && field.configListId) {
    return getConfigListOptions(field.configListId);
  }
  return Array.isArray(field.options) ? field.options : [];
};

export const defaultValueForType = (dataType, autoFill = 'none', allowMultiple = false) => {
  const auto = resolveAutoFillValue(autoFill);
  if (auto !== null) return auto;

  const effective =
    allowMultiple && (dataType === 'dropdown' || dataType === 'status')
      ? 'multiselect'
      : dataType;

  if (BOOLEAN_FIELD_TYPES.has(effective)) return false;
  if (effective === 'multiselect' || effective === 'tags' || effective === 'attachment') return [];
  return '';
};

export const loadExamFields = () => {
  try {
    const raw = localStorage.getItem(FIELDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveExamFields = (fields) => {
  try {
    localStorage.setItem(FIELDS_STORAGE_KEY, JSON.stringify(fields));
  } catch {
    // ignore
  }
};

export const emptyFieldForm = () => ({
  id: null,
  label: '',
  key: '',
  /** When true, label changes no longer overwrite the key (user edited key). */
  keyTouched: false,
  dataType: 'text',
  required: false,
  optionsText: '',
  formula: '',
  autoFill: 'none',
  layout: 'full',
  optionsSource: 'manual',
  configListId: '',
  allowMultiple: false,
  sameAsFieldKey: '',
  sameAsDefaultOn: true,
  phoneValidation: emptyPhoneValidation(),
});

/** Date fields that can be used as a “same as” source (excludes current field) */
export const getDateLinkCandidates = (fields, currentFieldId = null) =>
  (fields || []).filter(
    (f) =>
      DATE_LINK_TYPES.has(f.dataType) &&
      f.id !== currentFieldId &&
      !(f.autoFill && f.autoFill !== 'none')
  );

export const buildSameAsFlags = (fields = []) => {
  const flags = {};
  fields.forEach((f) => {
    if (f.sameAsFieldKey && DATE_LINK_TYPES.has(f.dataType)) {
      flags[f.key] = f.sameAsDefaultOn !== false;
    }
  });
  return flags;
};

/** Group consecutive half-width fields into rows for the create form */
export const groupFieldsForLayout = (fields) => {
  const rows = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    const next = fields[i + 1];
    if (field.layout === 'half' && next?.layout === 'half') {
      rows.push([field, next]);
      i += 2;
    } else {
      rows.push([field]);
      i += 1;
    }
  }
  return rows;
};
