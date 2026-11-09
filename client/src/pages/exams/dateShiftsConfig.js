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

export const newShiftColumn = (label = '', { color = '', width } = {}) => ({
  id: `shift_${Date.now().toString(36)}_${(shiftSeq += 1)}`,
  label: String(label || ''),
  color: normalizeColumnColor(color),
  width: resolveDateShiftColumnWidth(
    width != null && width !== '' ? width : DATE_SHIFT_COLUMN_WIDTH_DEFAULT,
  ),
});

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
 */
export const buildDateShiftFields = (input) => {
  const cfg = normalizeDateShiftsConfig(input);
  if (!cfg.shifts.length || !cfg.dates.length) return [];

  const widths = cfg.columnWidths || emptyDateShiftColumnWidths();
  const out = [];
  const allShiftKeys = [];

  if (cfg.allDayColumn.enabled) {
    // Placeholder — formula filled after all shift keys are known.
    const allDayColor = normalizeColumnColor(cfg.allDayColumn.color);
    out.push({
      id: fieldId(),
      key: makeKey('allday'),
      label: allDayColumnLabel(cfg.allDayColumn),
      dataType: cfg.allDayColumn.type === 'custom' ? 'number' : 'formula',
      required: false,
      layout: 'full',
      autoFill: 'none',
      order: 0,
      width: widths.allDay,
      ...(allDayColor ? { color: allDayColor } : {}),
      dateShift: { kind: 'allDay', type: cfg.allDayColumn.type },
    });
  }

  cfg.dates.forEach((date, dayIndex) => {
    const dayKeys = [];
    cfg.shifts.forEach((shift) => {
      const key = makeKey(date.id, shift.id);
      dayKeys.push(key);
      allShiftKeys.push(key);
      const shiftColor = normalizeColumnColor(shift.color);
      const shiftWidth = resolveDateShiftColumnWidth(shift.width ?? widths.shift);
      out.push({
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
      out.push({
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

  if (cfg.allDayColumn.enabled && out[0]?.dateShift?.kind === 'allDay') {
    const type = cfg.allDayColumn.type || 'max';
    if (type !== 'custom') {
      out[0].formula = formulaFor(type, allShiftKeys);
    }
  }

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
  if (!key.startsWith('ds_') || key.includes('allday') || /_smry$/i.test(key)) return null;
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
    if (f?.dateShift?.kind === 'shift') {
      const shiftId = String(f.dateShift.shiftId || '');
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
  if (field?.dateShift?.kind === 'shift') {
    const shiftId = String(field.dateShift.shiftId || '');
    const shift = cfg.shifts.find((s) => String(s.id) === shiftId);
    return normalizeColumnColor(shift?.color);
  }
  return '';
};
