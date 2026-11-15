/** Date × shift column template (Bulk add → Date shifts). Labels are user-defined; no hardcoded names. */

let shiftSeq = 0;

export const DATE_SHIFT_SUMMARY_TYPES = [
  { value: 'max', label: 'Max', hint: 'Highest value across that day’s shifts' },
  { value: 'sum', label: 'Sum', hint: 'Total of that day’s shifts' },
  { value: 'counta', label: 'CountA', hint: 'Count of filled shift cells that day' },
  { value: 'custom', label: 'Custom', hint: 'Type your own column name (manual entry)' },
];

/** Same types as per-day summary; hints describe the all-days column. */
export const DATE_SHIFT_ALL_DAY_TYPES = [
  { value: 'max', label: 'Max', hint: 'Highest value across every date’s shifts' },
  { value: 'sum', label: 'Sum', hint: 'Total of all shifts across every date' },
  { value: 'counta', label: 'CountA', hint: 'Count of filled shift cells across every date' },
  { value: 'custom', label: 'Custom', hint: 'Type your own column name (manual entry)' },
];

/** Preset swatches (plus free color picker in the UI). */
export const DATE_SHIFT_COLUMN_COLORS = [
  '#0f766e', // teal
  '#5c43fa', // brand purple
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const normalizeColumnColor = (value) => {
  const raw = String(value || '').trim();
  return HEX_COLOR.test(raw) ? raw.toLowerCase() : '';
};

/** Soft fill from a hex color (for headers / chips). */
export const hexWithAlpha = (hex, alpha = 0.12) => {
  const color = normalizeColumnColor(hex);
  if (!color) return '';
  const n = Number.parseInt(color.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const emptySummaryColumn = () => ({
  enabled: false,
  type: 'max', // default selection when summary is turned on
  customLabel: '',
  color: '',
});

export const emptyAllDayColumn = () => ({
  enabled: false,
  type: 'max',
  customLabel: '',
  color: '',
});

/** Default / clamp for Center-list date×shift column width (px). */
export const DATE_SHIFT_COLUMN_WIDTH_DEFAULT = 148;
export const DATE_SHIFT_COLUMN_WIDTH_MIN = 72;
export const DATE_SHIFT_COLUMN_WIDTH_MAX = 220;
export const DATE_SHIFT_COLUMN_WIDTH_PRESETS = [
  { value: 96, label: 'Compact', hint: 'Tight — short labels / numbers' },
  { value: 148, label: 'Default', hint: 'Balanced for typical shift headers' },
  { value: 180, label: 'Wide', hint: 'More room for wrapped 2-line headers' },
];

export const resolveDateShiftColumnWidth = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DATE_SHIFT_COLUMN_WIDTH_DEFAULT;
  return Math.min(
    DATE_SHIFT_COLUMN_WIDTH_MAX,
    Math.max(DATE_SHIFT_COLUMN_WIDTH_MIN, Math.round(n)),
  );
};

export const newShiftColumn = (label = '', { color = '', width, maxEnabled = false } = {}) => ({
  id: `shift_${Date.now().toString(36)}_${(shiftSeq += 1)}`,
  label: String(label || ''),
  color: normalizeColumnColor(color),
  width: resolveDateShiftColumnWidth(
    width != null && width !== '' ? width : DATE_SHIFT_COLUMN_WIDTH_DEFAULT,
  ),
  /** When true, add a Max column for this shift across all exam dates. */
  maxEnabled: Boolean(maxEnabled),
});

/** Header for an optional per-shift Max column (e.g. "Max OP S1"). */
export const shiftMaxColumnLabel = (shift) => {
  const label = String(shift?.label || '').trim();
  return label ? `Max ${label}` : 'Max shift';
};

export const emptyDateShiftColumnWidths = () => ({
  allDay: DATE_SHIFT_COLUMN_WIDTH_DEFAULT,
  shift: DATE_SHIFT_COLUMN_WIDTH_DEFAULT,
  summary: DATE_SHIFT_COLUMN_WIDTH_DEFAULT,
});

/**
 * Per-kind widths. Migrates legacy single `columnWidth` onto all three.
 */
export const normalizeDateShiftColumnWidths = (input, legacyShared = null) => {
  const base = emptyDateShiftColumnWidths();
  const legacy =
    legacyShared != null && legacyShared !== ''
      ? resolveDateShiftColumnWidth(legacyShared)
      : null;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return {
      allDay: resolveDateShiftColumnWidth(
        input.allDay ?? input.allDayColumn ?? legacy ?? base.allDay,
      ),
      shift: resolveDateShiftColumnWidth(input.shift ?? input.shifts ?? legacy ?? base.shift),
      summary: resolveDateShiftColumnWidth(
        input.summary ?? input.summaryColumn ?? legacy ?? base.summary,
      ),
    };
  }
  if (legacy != null) return { allDay: legacy, shift: legacy, summary: legacy };
  return base;
};

export const emptyDateShiftsConfig = () => ({
  shifts: [],
  summaryColumn: emptySummaryColumn(),
  allDayColumn: emptyAllDayColumn(),
  /** Width (px) per column kind on Center list. */
  columnWidths: emptyDateShiftColumnWidths(),
  /** Selected exam dates that expand into Center list columns. */
  dates: [],
});

let dateSeq = 0;
export const newDateShiftDate = (title = '') => ({
  id: `d${Date.now().toString(36).slice(-6)}${(dateSeq += 1).toString(36)}`,
  title: String(title || '').trim(),
});

export const isDateShiftField = (field) =>
  Boolean(field?.dateShift && typeof field.dateShift === 'object') ||
  String(field?.key || '').startsWith('ds_');

const shortId = (id) =>
  String(id || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-8) || 'x';

const fieldId = () => `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const makeKey = (...parts) => {
  const raw = parts
    .map((p) => shortId(p))
    .filter(Boolean)
    .join('_');
  let key = `ds_${raw}`.toLowerCase().replace(/_+/g, '_').slice(0, 40);
  if (!/^[a-z]/.test(key)) key = `d${key}`.slice(0, 40);
  return key;
};

const formulaFor = (type, keys) => {
  if (!keys.length) return '';
  const refs = keys.map((k) => `{${k}}`);
  if (type === 'sum') return refs.join('+');
  if (type === 'counta') return refs.map((r) => `IF(${r},1,0)`).join('+');
  return `MAX(${refs.join(',')})`;
};

const SUMMARY_TYPE_SET = new Set(DATE_SHIFT_SUMMARY_TYPES.map((t) => t.value));

/** Normalize summary / all-day column shape. */
export const normalizeSummaryColumn = (input, { includeMaxDay } = {}) => {
  const base = emptySummaryColumn();
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const type = SUMMARY_TYPE_SET.has(input.type) ? input.type : 'max';
    const enabled =
      typeof input.enabled === 'boolean'
        ? input.enabled
        : Boolean(input.type) || Boolean(String(input.customLabel || '').trim());
    return {
      enabled,
      type,
      customLabel: String(input.customLabel || '').trim(),
      color: normalizeColumnColor(input.color),
    };
  }
  // Legacy per-day checkbox → Max summary.
  if (includeMaxDay) {
    return { ...base, enabled: true, type: 'max' };
  }
  return base;
};

/** Normalize all-day column; migrates legacy `maxAllDay: true`. */
export const normalizeAllDayColumn = (input, { maxAllDay } = {}) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return normalizeSummaryColumn(input);
  }
  if (maxAllDay === true) {
    return { ...emptyAllDayColumn(), enabled: true, type: 'max' };
  }
  return emptyAllDayColumn();
};

/**
 * Header label for the per-date summary column.
 * With dayIndex (1-based): "Max Day 1", "Sum Day 2", …
 */
export const summaryColumnLabel = (summary, dayIndex = null) => {
  const s = normalizeSummaryColumn(summary);
  if (!s.enabled) return '';
  const base =
    s.type === 'custom'
      ? s.customLabel || 'Custom'
      : DATE_SHIFT_SUMMARY_TYPES.find((t) => t.value === s.type)?.label || s.type;
  const day = Number(dayIndex);
  if (!Number.isFinite(day) || day < 1) return base;
  return `${base} Day ${Math.floor(day)}`;
};

/**
 * Header for the column before all date groups.
 * Max → "Max all day", Sum → "Sum all day", Custom → typed name.
 */
export const allDayColumnLabel = (allDay) => {
  const s = normalizeAllDayColumn(allDay);
  if (!s.enabled) return '';
  if (s.type === 'custom') return s.customLabel || 'Custom';
  const found = DATE_SHIFT_ALL_DAY_TYPES.find((t) => t.value === s.type);
  return `${found?.label || s.type} all day`;
};

/** Sample aggregate for preview (all shift values across dates). */
export const aggregateShiftValues = (type, values) => {
  const nums = (Array.isArray(values) ? values : []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (type === 'custom') return '—';
  if (!nums.length) return '—';
  if (type === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (type === 'counta') return nums.length;
  return Math.max(...nums);
};

/** Per-date shift cell keys (not all-day / not day-summary / not shift-max). */
export const isDateShiftShiftKey = (key) => {
  const k = String(key || '');
  return (
    k.startsWith('ds_') &&
    !/allday/i.test(k) &&
    !/^ds_smax_/i.test(k) &&
    !/_smax$/i.test(k) &&
    !/_smry$/i.test(k)
  );
};

const toShiftNumber = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Live Max/Sum/CountA all-day value from shift cells on a row.
 * Used when `ds_allday` is formula-only (not stored) — e.g. Unique import Sum.
 */
export const resolveAllDayValueFromRow = (values, dateShiftsConfig = null) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const type = cfg.allDayColumn?.enabled ? cfg.allDayColumn.type || 'max' : 'max';
  if (type === 'custom') return null;
  const bag = values && typeof values === 'object' ? values : {};
  const nums = Object.keys(bag)
    .filter(isDateShiftShiftKey)
    .map((k) => toShiftNumber(bag[k]))
    .filter((n) => n != null);
  const result = aggregateShiftValues(type, nums);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
};

/** Stable shift cell keys for one exam date (from the Center list template). */
export const shiftKeysForDate = (dateShiftsConfig, dateId) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const id = String(dateId || '').trim();
  if (!id || !cfg.shifts.length) return [];
  return cfg.shifts.map((shift) => makeKey(id, shift.id));
};

/**
 * Live Max/Sum/CountA for one exam date's shifts on a center row
 * (same math as that day's summary column on Center list).
 */
export const resolveDayAggregateFromRow = (values, dateShiftsConfig, dateId) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const type = cfg.summaryColumn?.enabled ? cfg.summaryColumn.type || 'max' : 'max';
  if (type === 'custom') return null;
  const keys = shiftKeysForDate(cfg, dateId);
  if (!keys.length) return null;
  const bag = values && typeof values === 'object' ? values : {};
  const nums = keys.map((k) => toShiftNumber(bag[k])).filter((n) => n != null);
  const result = aggregateShiftValues(type, nums);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
};

/** True when the center has any filled shift cell on that exam date. */
export const rowHasActivityOnDate = (values, dateShiftsConfig, dateId) => {
  const keys = shiftKeysForDate(dateShiftsConfig, dateId);
  if (!keys.length) return false;
  const bag = values && typeof values === 'object' ? values : {};
  return keys.some((k) => toShiftNumber(bag[k]) != null);
};

/**
 * Real Unique-import fields (formula-friendly keys). Table headers become
 * `{date} Total Center` / `{date} Max All Day` when an exam date is selected.
 * Order with count/sum targets: Days Total Center → All Day Max → these two.
 */
export const FOCUS_TOTAL_CENTER_COLUMN_KEY = 'date_total_center';
export const FOCUS_MAX_ALL_DAY_COLUMN_KEY = 'date_max_all_day';
/** @deprecated use FOCUS_MAX_ALL_DAY_COLUMN_KEY */
export const FOCUS_EXAM_DATE_COLUMN_KEY = FOCUS_MAX_ALL_DAY_COLUMN_KEY;

/** Labels for Unique-import focus-date columns (sheet-style, e.g. 26-Oct-26 Total Center). */
export const focusDateColumnLabels = (dateTitle) => {
  const title = String(dateTitle || '').trim() || 'Selected date';
  return {
    totalCenter: `${title} Total Center`,
    maxAllDay: `${title} Max All Day`,
  };
};

export const isFocusDateField = (field) => {
  const kind = field?.focusDateColumn;
  if (kind === 'totalCenter' || kind === 'maxAllDay') return true;
  const key = String(field?.key || '');
  return key === FOCUS_TOTAL_CENTER_COLUMN_KEY || key === FOCUS_MAX_ALL_DAY_COLUMN_KEY;
};

const newFocusDateField = (kind) => {
  const isTotal = kind === 'totalCenter';
  return {
    id: `fld_${isTotal ? FOCUS_TOTAL_CENTER_COLUMN_KEY : FOCUS_MAX_ALL_DAY_COLUMN_KEY}_${Date.now().toString(36).slice(-5)}`,
    key: isTotal ? FOCUS_TOTAL_CENTER_COLUMN_KEY : FOCUS_MAX_ALL_DAY_COLUMN_KEY,
    label: isTotal ? 'Date Total Center' : 'Date Max All Day',
    dataType: 'number',
    required: false,
    layout: 'full',
    autoFill: 'none',
    focusDateColumn: kind,
  };
};

/**
 * Ensure Date Total Center / Date Max All Day exist and sit in this order:
 * count target → sum target → date_total_center → date_max_all_day
 */
export const ensureFocusDateFields = (
  fields = [],
  { countTargetKey = '', sumTargetKey = '' } = {},
) => {
  const countKey = String(countTargetKey || '').trim();
  const sumKey = String(sumTargetKey || '').trim();
  const wantTotal = Boolean(countKey);
  const wantMax = Boolean(sumKey);
  if (!wantTotal && !wantMax) {
    return { fields: Array.isArray(fields) ? fields : [], changed: false };
  }

  let list = Array.isArray(fields) ? fields.map((f) => ({ ...f })) : [];
  let changed = false;
  const byKey = () => new Map(list.map((f) => [f.key, f]));

  if (wantTotal && !byKey().has(FOCUS_TOTAL_CENTER_COLUMN_KEY)) {
    list.push(newFocusDateField('totalCenter'));
    changed = true;
  } else if (wantTotal) {
    list = list.map((f) => {
      if (f.key !== FOCUS_TOTAL_CENTER_COLUMN_KEY) return f;
      if (f.focusDateColumn === 'totalCenter' && f.dataType === 'number') return f;
      changed = true;
      return {
        ...f,
        focusDateColumn: 'totalCenter',
        dataType: f.dataType || 'number',
        label: f.label || 'Date Total Center',
      };
    });
  }

  if (wantMax && !byKey().has(FOCUS_MAX_ALL_DAY_COLUMN_KEY)) {
    list.push(newFocusDateField('maxAllDay'));
    changed = true;
  } else if (wantMax) {
    list = list.map((f) => {
      if (f.key !== FOCUS_MAX_ALL_DAY_COLUMN_KEY) return f;
      if (f.focusDateColumn === 'maxAllDay' && f.dataType === 'number') return f;
      changed = true;
      return {
        ...f,
        focusDateColumn: 'maxAllDay',
        dataType: f.dataType || 'number',
        label: f.label || 'Date Max All Day',
      };
    });
  }

  const blockKeys = [
    countKey,
    sumKey,
    wantTotal ? FOCUS_TOTAL_CENTER_COLUMN_KEY : '',
    wantMax ? FOCUS_MAX_ALL_DAY_COLUMN_KEY : '',
  ].filter(Boolean);
  // De-dupe while keeping order (count/sum might theoretically collide).
  const blockKeyList = [...new Set(blockKeys)];
  const map = new Map(list.map((f) => [f.key, f]));
  if (!blockKeyList.every((k) => map.has(k))) {
    return {
      fields: list.map((f, i) => ({ ...f, order: i + 1 })),
      changed,
    };
  }

  const blockSet = new Set(blockKeyList);
  let insertAt = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (blockSet.has(list[i].key)) break;
    insertAt += 1;
  }
  const without = list.filter((f) => !blockSet.has(f.key));
  const blockFields = blockKeyList.map((k) => map.get(k));
  const next = [...without.slice(0, insertAt), ...blockFields, ...without.slice(insertAt)];
  if (next.some((f, i) => f.key !== list[i]?.key)) changed = true;

  return {
    fields: next.map((f, i) => ({ ...f, order: i + 1 })),
    changed,
  };
};

/** Force table column order for the Days Total / Max / date-focus block. */
export const orderFocusDateColumns = (
  columns = [],
  { countTargetKey = '', sumTargetKey = '' } = {},
) => {
  const blockKeys = [
    String(countTargetKey || '').trim(),
    String(sumTargetKey || '').trim(),
    FOCUS_TOTAL_CENTER_COLUMN_KEY,
    FOCUS_MAX_ALL_DAY_COLUMN_KEY,
  ].filter(Boolean);
  const blockKeyList = [...new Set(blockKeys)];
  const present = blockKeyList.filter((k) => columns.some((c) => c.key === k));
  if (present.length < 2) return columns;

  const blockSet = new Set(present);
  let insertAt = 0;
  for (let i = 0; i < columns.length; i += 1) {
    if (blockSet.has(columns[i].key)) break;
    insertAt += 1;
  }
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const without = columns.filter((c) => !blockSet.has(c.key));
  const block = present.map((k) => byKey.get(k)).filter(Boolean);
  return [...without.slice(0, insertAt), ...block, ...without.slice(insertAt)];
};

/** Normalize persisted / draft date-shifts config. */
export const normalizeDateShiftsConfig = (input) => {
  const base = emptyDateShiftsConfig();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const columnWidths = normalizeDateShiftColumnWidths(input.columnWidths, input.columnWidth);
  const shifts = Array.isArray(input.shifts)
    ? input.shifts
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const label = String(s.label || '').trim();
          if (!label) return null;
          const id = String(s.id || '').trim() || newShiftColumn(label).id;
          const hasOwnWidth = s.width != null && s.width !== '';
          return {
            id,
            label,
            color: normalizeColumnColor(s.color),
            width: resolveDateShiftColumnWidth(
              hasOwnWidth ? s.width : columnWidths.shift,
            ),
            maxEnabled: Boolean(s.maxEnabled),
          };
        })
        .filter(Boolean)
    : [];
  const dates = Array.isArray(input.dates)
    ? input.dates
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const title = String(d.title || '').trim();
          if (!title) return null;
          const id = String(d.id || '').trim() || newDateShiftDate(title).id;
          return { id, title };
        })
        .filter(Boolean)
    : [];
  return {
    shifts,
    summaryColumn: normalizeSummaryColumn(input.summaryColumn, {
      includeMaxDay: input.includeMaxDay,
    }),
    allDayColumn: normalizeAllDayColumn(input.allDayColumn, {
      maxAllDay: input.maxAllDay,
    }),
    columnWidths,
    dates,
  };
};

export const dateShiftsConfigEqual = (a, b) =>
  JSON.stringify(normalizeDateShiftsConfig(a)) === JSON.stringify(normalizeDateShiftsConfig(b));

/** True when the template has at least one shift label to expand. */
export const hasDateShiftTemplate = (input) => normalizeDateShiftsConfig(input).shifts.length > 0;

/**
 * Prefer this exam’s saved dateShifts; if it has no shift template yet, use the
 * Field preset’s template (dates still come from the exam when present).
 */
export const resolveDateShiftsConfig = (examDateShifts, presetDateShifts) => {
  const exam = normalizeDateShiftsConfig(examDateShifts);
  if (hasDateShiftTemplate(exam)) return exam;
  const preset = normalizeDateShiftsConfig(presetDateShifts);
  if (!hasDateShiftTemplate(preset)) return exam;
  return {
    ...preset,
    dates: exam.dates,
  };
};

/**
 * Build Center-list field defs from the date×shift template + selected dates.
 * Stable keys use date/shift ids so renaming a date keeps cell values.
 * Order: optional per-shift Max columns → All day → each date’s shifts → Summary.
 */
export const buildDateShiftFields = (input) => {
  const cfg = normalizeDateShiftsConfig(input);
  if (!cfg.shifts.length || !cfg.dates.length) return [];

  const widths = cfg.columnWidths || emptyDateShiftColumnWidths();
  const allShiftKeys = [];
  const keysByShiftId = new Map();
  const dateFields = [];

  cfg.dates.forEach((date, dayIndex) => {
    const dayKeys = [];
    cfg.shifts.forEach((shift) => {
      const key = makeKey(date.id, shift.id);
      dayKeys.push(key);
      allShiftKeys.push(key);
      const list = keysByShiftId.get(shift.id) || [];
      list.push(key);
      keysByShiftId.set(shift.id, list);
      const shiftColor = normalizeColumnColor(shift.color);
      const shiftWidth = resolveDateShiftColumnWidth(shift.width ?? widths.shift);
      dateFields.push({
        id: fieldId(),
        key,
        label: `${date.title} · ${shift.label}`,
        dataType: 'number',
        required: false,
        layout: 'full',
        autoFill: 'none',
        order: 0,
        width: shiftWidth,
        ...(shiftColor ? { color: shiftColor } : {}),
        dateShift: {
          kind: 'shift',
          dateId: date.id,
          dateTitle: date.title,
          shiftId: shift.id,
          dayIndex: dayIndex + 1,
        },
      });
    });

    if (cfg.summaryColumn.enabled) {
      const type = cfg.summaryColumn.type || 'max';
      const key = makeKey(date.id, 'smry');
      const summaryColor = normalizeColumnColor(cfg.summaryColumn.color);
      dateFields.push({
        id: fieldId(),
        key,
        label: `${date.title} · ${summaryColumnLabel(cfg.summaryColumn, dayIndex + 1)}`,
        dataType: type === 'custom' ? 'number' : 'formula',
        formula: type === 'custom' ? undefined : formulaFor(type, dayKeys),
        required: false,
        layout: 'full',
        autoFill: 'none',
        order: 0,
        width: widths.summary,
        ...(summaryColor ? { color: summaryColor } : {}),
        dateShift: {
          kind: 'summary',
          dateId: date.id,
          dateTitle: date.title,
          type,
          dayIndex: dayIndex + 1,
        },
      });
    }
  });

  const shiftMaxFields = [];
  cfg.shifts.forEach((shift) => {
    if (!shift.maxEnabled) return;
    const keys = keysByShiftId.get(shift.id) || [];
    if (!keys.length) return;
    const shiftColor = normalizeColumnColor(shift.color);
    const shiftWidth = resolveDateShiftColumnWidth(shift.width ?? widths.shift);
    shiftMaxFields.push({
      id: fieldId(),
      key: makeKey('smax', shift.id),
      label: shiftMaxColumnLabel(shift),
      dataType: 'formula',
      formula: formulaFor('max', keys),
      required: false,
      layout: 'full',
      autoFill: 'none',
      order: 0,
      width: shiftWidth,
      ...(shiftColor ? { color: shiftColor } : {}),
      dateShift: {
        kind: 'shiftMax',
        shiftId: shift.id,
        shiftLabel: shift.label,
      },
    });
  });

  const out = [...shiftMaxFields];

  if (cfg.allDayColumn.enabled) {
    const type = cfg.allDayColumn.type || 'max';
    const allDayColor = normalizeColumnColor(cfg.allDayColumn.color);
    out.push({
      id: fieldId(),
      key: makeKey('allday'),
      label: allDayColumnLabel(cfg.allDayColumn),
      dataType: type === 'custom' ? 'number' : 'formula',
      formula: type === 'custom' ? undefined : formulaFor(type, allShiftKeys),
      required: false,
      layout: 'full',
      autoFill: 'none',
      order: 0,
      width: widths.allDay,
      ...(allDayColor ? { color: allDayColor } : {}),
      dateShift: { kind: 'allDay', type },
    });
  }

  out.push(...dateFields);
  return out.map((f, i) => ({ ...f, order: i + 1 }));
};

/**
 * Replace previous date-shift columns; keep all other fields.
 * Reuses existing field ids when keys match so row values stay attached.
 */
export const mergeDateShiftFields = (existingFields, dateShiftsConfig) => {
  const existing = Array.isArray(existingFields) ? existingFields : [];
  const keep = existing.filter((f) => !isDateShiftField(f));
  const generated = buildDateShiftFields(dateShiftsConfig);
  const byKey = new Map(existing.map((f) => [f.key, f]));

  const mergedGenerated = generated.map((f) => {
    const prev = byKey.get(f.key);
    if (!prev) return f;
    return {
      ...f,
      id: prev.id,
      // Keep prior order preference only if still a date-shift field of same key.
    };
  });

  const combined = [...keep, ...mergedGenerated];
  return combined.map((f, i) => ({ ...f, order: i + 1 }));
};

export const isAllDayDateShiftField = (field) =>
  field?.dateShift?.kind === 'allDay' ||
  /^ds_allday$/i.test(String(field?.key || '')) ||
  /\ball day\b/i.test(String(field?.label || ''));

export const isShiftMaxDateShiftField = (field) =>
  field?.dateShift?.kind === 'shiftMax' ||
  /^ds_smax_/i.test(String(field?.key || '')) ||
  /_smax$/i.test(String(field?.key || ''));

/** Stable key for the all-day column (`buildDateShiftFields` → makeKey('allday')). */
export const DATE_SHIFT_ALL_DAY_KEY = 'ds_allday';

/**
 * Sum-of sources for Unique import: date×shift number/formula columns, plus the
 * all-day column from the Center list format/preset even before dates materialize it.
 */
export const dateShiftSumSourceOptions = (dateShiftsConfig, fields = []) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const opts = [];
  const seen = new Set();

  const push = (value, label) => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    opts.push({ value: key, label: label || key });
  };

  // Template all-day first (preset / format may enable it before dates exist).
  if (cfg.allDayColumn.enabled) {
    const label = allDayColumnLabel(cfg.allDayColumn) || 'Max all day';
    push(DATE_SHIFT_ALL_DAY_KEY, `${label} (${DATE_SHIFT_ALL_DAY_KEY})`);
  }

  for (const f of Array.isArray(fields) ? fields : []) {
    if (!isDateShiftField(f) || !f?.key) continue;
    if (f.dataType !== 'number' && f.dataType !== 'formula' && f.dataType !== 'currency') continue;
    push(f.key, `${f.label || f.key} (${f.key})`);
  }

  return opts;
};

/** Minimal field def so Unique import can attach a sum source that only exists on the template. */
export const buildAllDaySumSourceField = (dateShiftsConfig) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  if (!cfg.allDayColumn.enabled) return null;
  const type = cfg.allDayColumn.type || 'max';
  return {
    id: `fld_${DATE_SHIFT_ALL_DAY_KEY}`,
    key: DATE_SHIFT_ALL_DAY_KEY,
    label: allDayColumnLabel(cfg.allDayColumn) || 'Max all day',
    dataType: type === 'custom' ? 'number' : 'formula',
    required: false,
    layout: 'full',
    autoFill: 'none',
    order: 0,
    dateShift: { kind: 'allDay', type },
  };
};

export const isSummaryDateShiftField = (field) =>
  field?.dateShift?.kind === 'summary' ||
  /_smry$/i.test(String(field?.key || '')) ||
  /\bday\s+\d+\b/i.test(String(field?.label || ''));

/**
 * Chip groups for Center-list hide/show: one chip per dynamic shift (+ All day / Summary).
 * Keys come from generated fields so renaming a shift still targets the right columns.
 */
export const buildDateShiftVisibilityGroups = (dateShiftsConfig, fields) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const list = Array.isArray(fields) ? fields.filter(isDateShiftField) : [];
  const groups = [];

  cfg.shifts.forEach((shift) => {
    if (!shift?.maxEnabled) return;
    const shiftId = String(shift?.id || '');
    if (!shiftId) return;
    const keys = list
      .filter(
        (f) =>
          isShiftMaxDateShiftField(f) && String(f?.dateShift?.shiftId || '') === shiftId,
      )
      .map((f) => f.key)
      .filter(Boolean);
    if (!keys.length) return;
    groups.push({
      id: `shiftMax:${shiftId}`,
      kind: 'shiftMax',
      shiftId,
      label: shiftMaxColumnLabel(shift),
      keys,
    });
  });

  if (cfg.allDayColumn.enabled) {
    const keys = list.filter(isAllDayDateShiftField).map((f) => f.key).filter(Boolean);
    if (keys.length) {
      groups.push({
        id: 'allDay',
        kind: 'allDay',
        label: allDayColumnLabel(cfg.allDayColumn) || 'All day',
        keys,
      });
    }
  }

  cfg.shifts.forEach((shift) => {
    const shiftId = String(shift?.id || '');
    if (!shiftId) return;
    const keys = list
      .filter((f) => f?.dateShift?.kind === 'shift' && String(f.dateShift.shiftId) === shiftId)
      .map((f) => f.key)
      .filter(Boolean);
    if (!keys.length) return;
    const label = String(shift.label || '').trim() || 'Shift';
    groups.push({ id: `shift:${shiftId}`, kind: 'shift', shiftId, label, keys });
  });

  if (cfg.summaryColumn.enabled) {
    const keys = list.filter(isSummaryDateShiftField).map((f) => f.key).filter(Boolean);
    if (keys.length) {
      groups.push({
        id: 'summary',
        kind: 'summary',
        label: summaryColumnLabel(cfg.summaryColumn) || 'Summary',
        keys,
      });
    }
  }

  return groups;
};

/** Match a shift template row for a Center-list field (by id, then by key suffix). */
const findShiftForField = (field, cfg) => {
  const shiftId = String(field?.dateShift?.shiftId || '').trim();
  if (shiftId) {
    const byId = cfg.shifts.find((s) => String(s.id) === shiftId);
    if (byId) return byId;
  }
  const key = String(field?.key || '').toLowerCase();
  if (
    !key.startsWith('ds_') ||
    key.includes('allday') ||
    key.includes('smax') ||
    /_smry$/i.test(key)
  ) {
    return null;
  }
  const suffix = key.split('_').pop();
  if (!suffix) return null;
  return (
    cfg.shifts.find((s) => shortId(s.id).toLowerCase() === suffix) || null
  );
};

/** Width for a Center-list field from template kind (All day / shift / Summary). */
export const resolveDateShiftWidthForField = (field, dateShiftsConfig) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const widths = cfg.columnWidths;
  // Always prefer live features.dateShifts template — never stale field.width.
  if (isAllDayDateShiftField(field)) return widths.allDay;
  if (isSummaryDateShiftField(field)) return widths.summary;
  if (isShiftMaxDateShiftField(field)) {
    const shift = findShiftForField(field, cfg);
    if (shift) {
      return resolveDateShiftColumnWidth(
        shift.width != null && shift.width !== '' ? shift.width : widths.shift,
      );
    }
    return widths.shift;
  }
  const shift = findShiftForField(field, cfg);
  if (shift) {
    // Per-shift px when set; otherwise shared Shifts width.
    return resolveDateShiftColumnWidth(
      shift.width != null && shift.width !== '' ? shift.width : widths.shift,
    );
  }
  if (isDateShiftField(field)) return widths.shift;
  return resolveDateShiftColumnWidth(field?.width);
};

/** Stamp per-kind template widths onto existing date-shift fields. */
export const applyDateShiftColumnWidths = (fields, dateShiftsConfig) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  return (Array.isArray(fields) ? fields : []).map((f) => {
    if (!isDateShiftField(f)) return f;
    const w = resolveDateShiftWidthForField(f, cfg);
    return f.width === w ? f : { ...f, width: w };
  });
};

const stampFieldColor = (field, hex) => {
  const color = normalizeColumnColor(hex);
  if (!color) {
    if (!field.color) return field;
    const next = { ...field };
    delete next.color;
    return next;
  }
  return field.color === color ? field : { ...field, color };
};

/**
 * Stamp All day / per-shift / Summary `color` onto existing date-shift fields (no remesh needed).
 */
export const applyDateShiftColumnColors = (fields, dateShiftsConfig) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const allDayColor = cfg.allDayColumn.enabled ? normalizeColumnColor(cfg.allDayColumn.color) : '';
  const summaryColor = cfg.summaryColumn.enabled ? normalizeColumnColor(cfg.summaryColumn.color) : '';
  const shiftColorById = new Map(
    cfg.shifts.map((s) => [String(s.id), normalizeColumnColor(s.color)]),
  );
  return (Array.isArray(fields) ? fields : []).map((f) => {
    if (isAllDayDateShiftField(f)) return stampFieldColor(f, allDayColor);
    if (isSummaryDateShiftField(f)) return stampFieldColor(f, summaryColor);
    if (f?.dateShift?.kind === 'shift' || isShiftMaxDateShiftField(f)) {
      const shiftId = String(f.dateShift?.shiftId || '');
      return stampFieldColor(f, shiftColorById.get(shiftId) || '');
    }
    return f;
  });
};

/** Resolve accent hex for a Center-list field from field.color or features.dateShifts. */
export const resolveDateShiftFieldAccent = (field, dateShiftsConfig) => {
  const fromField = normalizeColumnColor(field?.color);
  if (fromField) return fromField;
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  if (isAllDayDateShiftField(field) && cfg.allDayColumn.enabled) {
    return normalizeColumnColor(cfg.allDayColumn.color);
  }
  if (isSummaryDateShiftField(field) && cfg.summaryColumn.enabled) {
    return normalizeColumnColor(cfg.summaryColumn.color);
  }
  if (field?.dateShift?.kind === 'shift' || isShiftMaxDateShiftField(field)) {
    const shiftId = String(field.dateShift?.shiftId || '');
    const shift = cfg.shifts.find((s) => String(s.id) === shiftId);
    return normalizeColumnColor(shift?.color);
  }
  return '';
};
