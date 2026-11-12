import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Check, Copy, CornerDownRight, CalendarDays, Download, GripVertical, Info, Link2, ListPlus, Network, Pin, PinOff, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { DEFAULT_EXAM_VIEW, examViewLabel } from '@exam-view/shared';
import {
  EXAM_FIELD_TYPES,
  AUTO_FILL_OPTIONS,
  OPTIONS_FIELD_TYPES,
  CHOICE_FIELD_TYPES,
  DATE_LINK_TYPES,
  PHONE_VALIDATION_PRESETS,
  UNIQUE_FIELD_TYPES,
  emptyPhoneValidation,
  isValidRegexPattern,
  normalizeFieldKey,
  slugifyKey,
  isValidFieldKey,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';
import { getConfigListById, loadConfigDropdownLists } from '../settings/configStorage';
import { fetchConfigLists } from '../settings/configListApi';
import { listLookupSources } from './tableLookupApi';
import { parseBulkFields, resolveType, toFieldDefinition, TYPE_ALIASES } from './examBulkFields';
import { SCHEDULE_ROLE_OPTIONS } from './examDateWindow';
import { TagPickCellButton } from './TagMultiPicker';
import { listAssignableTags } from './assigneeApi';
import { ImportFieldsFromTabModal } from './ImportFieldsFromTabModal';
import {
  normalizeUniqueRowAggregates,
  normalizeUniqueRowKeys,
  uniqueRowKeysLabel,
} from './examUniqueRows';
import {
  DATE_SHIFT_ALL_DAY_TYPES,
  DATE_SHIFT_COLUMN_COLORS,
  DATE_SHIFT_COLUMN_WIDTH_MAX,
  DATE_SHIFT_COLUMN_WIDTH_MIN,
  DATE_SHIFT_SUMMARY_TYPES,
  aggregateShiftValues,
  allDayColumnLabel,
  dateShiftsConfigEqual,
  emptyAllDayColumn,
  emptyDateShiftColumnWidths,
  emptyDateShiftsConfig,
  emptySummaryColumn,
  hexWithAlpha,
  newShiftColumn,
  normalizeColumnColor,
  normalizeDateShiftColumnWidths,
  normalizeDateShiftsConfig,
  resolveDateShiftColumnWidth,
  summaryColumnLabel,
} from './dateShiftsConfig';

/** Compact px width field for All day / Shifts / Summary (right side). */
const DateShiftPxInput = ({ value, onChange, disabled = false, label = 'Width' }) => {
  const px = resolveDateShiftColumnWidth(value);
  return (
    <label className={`exams-date-shifts-px${disabled ? ' is-disabled' : ''}`} title={`${label} in pixels`}>
      <span className="exams-date-shifts-px-label sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={DATE_SHIFT_COLUMN_WIDTH_MIN}
        max={DATE_SHIFT_COLUMN_WIDTH_MAX}
        step={4}
        value={px}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={(e) => onChange?.(resolveDateShiftColumnWidth(e.target.value))}
        aria-label={label}
      />
      <span className="exams-date-shifts-px-unit" aria-hidden="true">
        px
      </span>
    </label>
  );
};

/** Inline color: 2 presets + free picker — sits on the type row. */
const DateShiftColumnColorPicker = ({ value, onChange, disabled = false, label = 'Column color' }) => {
  const color = normalizeColumnColor(value);
  const isCustom = Boolean(color) && !DATE_SHIFT_COLUMN_COLORS.includes(color);
  return (
    <div
      className={`exams-date-shifts-color-inline${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label={label}
    >
      <div className="exams-date-shifts-color-presets">
        {DATE_SHIFT_COLUMN_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`exams-date-shifts-color-dot${color === hex ? ' is-active' : ''}`}
            style={{ backgroundColor: hex }}
            disabled={disabled}
            aria-pressed={color === hex}
            aria-label={`Use ${hex}`}
            title={hex}
            onClick={() => onChange(color === hex ? '' : hex)}
          />
        ))}
      </div>
      <label
        className={`exams-date-shifts-color-well${color ? ' is-filled' : ''}${isCustom ? ' is-custom' : ''}`}
        title={color ? `${label}: ${color}` : `${label} (pick any color)`}
        style={color ? { backgroundColor: color } : undefined}
      >
        <input
          type="color"
          value={color || '#5c43fa'}
          disabled={disabled}
          onChange={(e) => onChange(normalizeColumnColor(e.target.value))}
          aria-label={`${label} picker`}
        />
      </label>
      {color ? (
        <button
          type="button"
          className="exams-date-shifts-color-clear"
          disabled={disabled}
          onClick={() => onChange('')}
          title="Clear color"
          aria-label={`Clear ${label}`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

const OPTIONS_SOURCES = [
  { value: 'manual', label: 'Typed' },
  { value: 'config', label: 'Config list' },
  { value: 'table', label: 'Table column' },
  { value: 'userTags', label: 'User tags' },
];

const BULK_TYPES = EXAM_FIELD_TYPES.filter(
  (t) =>
    t.value !== 'formula' &&
    t.value !== 'composite' &&
    t.value !== 'linked' &&
    t.value !== 'combined',
);
const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full width' },
  { value: 'half', label: 'Half (side by side)' },
];
const INITIAL_ROWS = 5;
const MAX_ROWS = 100;
const RESERVED_KEYS = new Set(['id']);

let rowSeq = 0;
const newRow = (dataType = 'text') => ({
  rid: `r${(rowSeq += 1)}`,
  label: '',
  key: '',
  keyTouched: false,
  dataType,
  autoFill: 'none',
  layout: 'full',
  required: false,
  unique: false,
  optionsText: '',
  optionsSource: 'manual', // 'manual' | 'config' | 'table' | 'userTags'
  configListId: '',
  userTagIds: [],
  lookupTable: '',
  lookupColumn: '',
  lookupDetail: '',
  linkedRid: '', // Linked value: the row (field) it depends on, and which of its table's columns to show
  linkedColumn: '',
  examFieldKey: '', // From exam: parent exam.values key to mirror
  scheduleRole: '', // Date chips: '' | 'start' | 'end'
  phoneValidationMode: 'none',
  phonePattern: '',
  phoneMessage: '',
  sharedFromView: '',
  combineKeys: [],
  combineSeparator: ', ',
  existingId: null,
  orig: null,
  lockOptions: false,
});

/** A row pre-filled from a saved field, so it can be edited in place. The key stays fixed. */
const rowFromField = (f) => {
  const pv = f.phoneValidation || {};
  return {
    ...newRow(f.dataType),
    label: f.label || '',
    key: f.key || '',
    keyTouched: true,
    autoFill: f.autoFill || 'none',
    layout: f.layout || 'full',
    required: Boolean(f.required),
    unique: Boolean(f.unique),
    optionsText: Array.isArray(f.options) ? f.options.join(', ') : '',
    phoneValidationMode: pv.mode || 'none',
    phonePattern: pv.pattern || '',
    phoneMessage: pv.message || '',
    optionsSource:
      f.optionsSource === 'config' && f.configListId
        ? 'config'
        : f.optionsSource === 'table' && f.tableSource
          ? 'table'
          : f.optionsSource === 'userTags'
            ? 'userTags'
            : 'manual',
    configListId: f.optionsSource === 'config' ? f.configListId || '' : '',
    userTagIds: Array.isArray(f.userTagIds) ? f.userTagIds.map(String) : [],
    lookupTable: f.tableSource?.table || '',
    lookupColumn: f.tableSource?.column || '',
    lookupDetail: f.tableSource?.detailColumn || '',
    linkedKey: f.linkedFrom?.fieldKey || '',
    linkedColumn: f.linkedFrom?.column || '',
    examFieldKey: f.examFieldKey || '',
    scheduleRole: f.scheduleRole === 'start' || f.scheduleRole === 'end' ? f.scheduleRole : '',
    sharedFromView: f.sharedFromView || '',
    combineKeys: Array.isArray(f.combine?.keys) ? f.combine.keys.map(String) : [],
    combineSeparator: f.combine?.separator == null ? ', ' : String(f.combine.separator),
    existingId: f.id,
    orig: f,
    // Any other options source is managed in the single-field editor.
    lockOptions: Boolean(f.optionsSource) && !['manual', 'config', 'table', 'userTags'].includes(f.optionsSource),
  };
};

/** Only choice types can read from a Config list or another table; Tags are always typed. */
const effectiveSource = (r) => {
  if (!OPTIONS_FIELD_TYPES.has(r.dataType)) return 'manual';
  if (!CHOICE_FIELD_TYPES.has(r.dataType)) return 'manual';
  return r.optionsSource || 'manual';
};

const optionsPart = (r) => {
  const source = effectiveSource(r);
  return {
    options: OPTIONS_FIELD_TYPES.has(r.dataType) && source === 'manual' ? splitOptions(r.optionsText) : [],
    optionsSource: source,
    configListId: source === 'config' ? r.configListId : '',
    userTagIds: source === 'userTags' ? (r.userTagIds || []).map(String) : [],
    // Multi is only from Multiselect dropdown (or Tags) — not implied by User tags.
    allowMultiple: r.dataType === 'multiselect' || r.dataType === 'tags',
    tableSource:
      source === 'table'
        ? { table: r.lookupTable, column: r.lookupColumn, ...(r.lookupDetail ? { detailColumn: r.lookupDetail } : {}) }
        : undefined,
  };
};

const rowToItem = (r, allowUnique = false) => ({
  label: r.label.trim(),
  key: r.key.trim(),
  dataType: r.dataType,
  required: r.dataType !== 'linked' && r.dataType !== 'fromExam' && r.autoFill === 'none' && r.required,
  unique: allowUnique && r.unique && UNIQUE_FIELD_TYPES.has(r.dataType),
  ...optionsPart(r),
  ...(r.dataType === 'linked' ? { linkedFrom: { fieldKey: r.linkedFieldKey || '', column: r.linkedColumn } } : {}),
  ...(r.dataType === 'fromExam' ? { examFieldKey: r.examFieldKey || '' } : {}),
  ...((r.dataType === 'date' || r.dataType === 'datetime') &&
  (r.scheduleRole === 'start' || r.scheduleRole === 'end')
    ? { scheduleRole: r.scheduleRole }
    : {}),
  autoFill: r.autoFill,
  layout: r.layout,
  phoneValidation: buildPhoneValidation(r),
  ...(r.sharedFromView ? { sharedFromView: r.sharedFromView } : {}),
  ...(r.dataType === 'combined' && Array.isArray(r.combineKeys) && r.combineKeys.length >= 2
    ? { combine: { keys: r.combineKeys.map(String), separator: r.combineSeparator ?? ', ' } }
    : {}),
});

/** The saved field with this row's edits applied, or null when nothing changed. */
const changedField = (r, allowUnique = false) => {
  const item = rowToItem(r, allowUnique);
  const o = r.orig;
  const next = {
    ...o,
    label: item.label,
    dataType: item.dataType,
    required: item.required,
    ...(allowUnique ? { unique: item.unique } : {}),
    autoFill: item.autoFill,
    layout: item.layout,
    allowMultiple: item.dataType === 'multiselect' || item.dataType === 'tags',
    ...(r.lockOptions
      ? {}
      : {
          options: item.options,
          optionsSource: item.optionsSource,
          configListId: item.configListId,
          userTagIds: item.userTagIds || [],
          tableSource: item.tableSource,
        }),
    ...(item.dataType === 'phone' ? { phoneValidation: item.phoneValidation } : {}),
    ...(item.dataType === 'linked' ? { linkedFrom: item.linkedFrom } : {}),
    ...(item.dataType === 'fromExam' ? { examFieldKey: item.examFieldKey } : { examFieldKey: undefined }),
    scheduleRole:
      item.dataType === 'date' || item.dataType === 'datetime'
        ? item.scheduleRole === 'start' || item.scheduleRole === 'end'
          ? item.scheduleRole
          : undefined
        : undefined,
    ...(item.dataType === 'combined' && item.combine
      ? { combine: item.combine }
      : item.dataType === 'combined'
        ? {}
        : { combine: undefined }),
  };
  const sig = (f) =>
    JSON.stringify([
      f.label,
      f.dataType,
      Boolean(f.required),
      Boolean(f.unique),
      f.autoFill || 'none',
      f.layout || 'full',
      f.options || [],
      f.optionsSource || 'manual',
      f.configListId || '',
      f.userTagIds || [],
      f.tableSource || null,
      f.linkedFrom || null,
      f.examFieldKey || '',
      f.scheduleRole || '',
      f.phoneValidation || null,
      f.combine || null,
      f.sharedFromView || '',
    ]);
  return sig(next) === sig(o) ? null : next;
};

const buildPhoneValidation = (row) => {
  if (row.dataType !== 'phone') return undefined;
  const mode = row.phoneValidationMode || 'none';
  if (mode === 'none') return emptyPhoneValidation();
  if (mode === 'custom') {
    return {
      mode: 'custom',
      pattern: String(row.phonePattern || '').trim(),
      message: String(row.phoneMessage || '').trim(),
    };
  }
  return { mode, pattern: '', message: String(row.phoneMessage || '').trim() };
};

const isBlank = (row) =>
  !row.label.trim() &&
  !row.key.trim() &&
  !row.optionsText.trim() &&
  !row.configListId &&
  !row.lookupColumn &&
  !(row.userTagIds || []).length;

const splitOptions = (text) => [...new Set(String(text).split(',').map((s) => s.trim()).filter(Boolean))];

/** Per-row validation. Blank rows are ignored (no error, not saved). */
const validateRows = (rows, existingFields, extraReserved, removedIds = []) => {
  // Fields shown as editable rows claim their names in row order; every other field is taken up front.
  // Fields queued for delete (removedIds) free their label/key so recreate-after-delete works before Save.
  const editing = new Set(rows.map((r) => r.existingId).filter(Boolean));
  const removing = new Set(removedIds);
  const others = existingFields.filter((f) => !editing.has(f.id) && !removing.has(f.id));
  const takenKeys = new Map(others.map((f) => [f.key, true]));
  const takenLabels = new Set(others.map((f) => String(f.label).trim().toLowerCase()));
  return rows.map((row) => {
    if (!row.existingId && isBlank(row)) return { blank: true, errors: {} };
    const errors = {};
    const label = row.label.trim();
    const key = row.key.trim();
    const labelKey = label.toLowerCase();

    if (!label) errors.label = 'Label is required';
    else if (takenLabels.has(labelKey)) errors.label = 'Name already used';

    if (!key) errors.key = 'Key is required';
    else if (!isValidFieldKey(key)) errors.key = 'Start with a letter; a-z, 0-9, _';
    else if (!row.existingId && (RESERVED_KEYS.has(key) || extraReserved.has(key) || key.startsWith('sys_'))) errors.key = 'Reserved key';
    else if (takenKeys.has(key)) errors.key = 'Key already used';

    if (!row.lockOptions && OPTIONS_FIELD_TYPES.has(row.dataType)) {
      const source = effectiveSource(row);
      if (source === 'config') {
        if (!row.configListId) errors.optionsText = 'Select a list';
        else if (!getConfigListById(row.configListId)?.options?.length) errors.optionsText = 'List missing or empty';
      } else if (source === 'table') {
        if (!row.lookupTable || !row.lookupColumn) errors.optionsText = 'Select a table and column';
      } else if (source === 'userTags') {
        if (!(row.userTagIds || []).length) errors.optionsText = 'Select at least one tag';
      } else if (!splitOptions(row.optionsText).length) {
        errors.optionsText = 'Add options';
      }
    }

    if (row.dataType === 'linked') {
      const src = rows.find((x) => x.rid === row.linkedRid);
      if (!src || src.rid === row.rid || effectiveSource(src) !== 'table' || !src.lookupColumn) {
        errors.optionsText = 'Pick the field it depends on';
      } else if (!row.linkedColumn) {
        errors.optionsText = 'Pick a column';
      }
    }

    if (row.dataType === 'fromExam' && !row.examFieldKey) {
      errors.optionsText = 'Pick an exam field';
    }

    if (row.dataType === 'phone' && row.phoneValidationMode === 'custom') {
      const pattern = String(row.phonePattern || '').trim();
      if (!pattern) errors.phonePattern = 'Enter a regex pattern';
      else if (!isValidRegexPattern(pattern)) errors.phonePattern = 'Invalid regex';
    }

    if (label) takenLabels.add(labelKey);
    if (key) takenKeys.set(key, true);
    return { blank: false, errors };
  });
};


const COLUMNS = ['label', 'key', 'type', 'options', 'autofill', 'width', 'required', 'unique'];
const HEADER_WORDS = new Set(['label', 'name', 'field', 'field name', 'field label']);
const TRUTHY = new Set(['yes', 'y', 'true', '1', 'x', '✓', '✔', 'required', '*']);

/** Parse clipboard text (Excel / Sheets TSV) into a 2D array of strings. */
const parseGrid = (text) => {
  const grid = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text).replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      grid.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    grid.push(row);
  }
  // Drop trailing fully-empty rows (Excel adds a final newline).
  while (grid.length && grid[grid.length - 1].every((c) => !c.trim())) grid.pop();
  return grid;
};

const matchAutoFill = (raw) => {
  const w = raw.trim().toLowerCase();
  if (!w) return 'none';
  return AUTO_FILL_OPTIONS.find((o) => o.value.toLowerCase() === w || o.label.toLowerCase().startsWith(w))?.value || null;
};

/** A valid, unused key suggested from a label: `Center Code` → `center_code`, then `_2`, `_3` on clashes. */
const suggestKey = (label, taken) => {
  let base = normalizeFieldKey(slugifyKey(label)) || 'field';
  if (!/^[a-z]/.test(base) || base === 'id' || base.startsWith('sys_')) base = `f_${base}`.slice(0, 40);
  let key = base;
  for (let n = 2; taken.has(key); n += 1) {
    const suffix = `_${n}`;
    key = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  return key;
};

/** Apply one pasted cell to a row. Returns [patch, problem|null]. */
const cellPatch = (colName, raw) => {
  const v = String(raw).trim();
  switch (colName) {
    case 'label':
      return [{ label: v.replace(/\*$/, '').trim(), ...(v.endsWith('*') ? { required: true } : {}) }, null];
    case 'key':
      return [{ key: normalizeFieldKey(v), keyTouched: Boolean(v) }, null];
    case 'type': {
      if (!v) return [{}, null];
      const t = resolveType(v, BULK_TYPES);
      return t ? [{ dataType: t }, null] : [{}, `type "${v}"`];
    }
    case 'options': {
      // A pasted cell that is exactly a Config list's name links the field to that list.
      const list = v
        ? loadConfigDropdownLists().find((l) => String(l.name).trim().toLowerCase() === v.toLowerCase())
        : null;
      return list
        ? [{ optionsSource: 'config', configListId: list.id, optionsText: '' }, null]
        : [{ optionsSource: 'manual', configListId: '', optionsText: v }, null];
    }
    case 'autofill': {
      const a = matchAutoFill(v);
      return a ? [{ autoFill: a }, null] : [{}, `auto-fill "${v}"`];
    }
    case 'width':
      return [{ layout: /^h/i.test(v) ? 'half' : 'full' }, null];
    case 'required':
      return [{ required: TRUTHY.has(v.toLowerCase()) }, null];
    case 'unique':
      return [{ unique: TRUTHY.has(v.toLowerCase()) }, null];
    default:
      return [{}, null];
  }
};

/** Words accepted in the Type column for each dropdown type (label, value and aliases). */
const TYPE_WORDS = BULK_TYPES.map((t) => {
  const words = new Set([t.label.toLowerCase(), t.value]);
  Object.entries(TYPE_ALIASES).forEach(([alias, target]) => {
    if (target === t.value) words.add(alias);
  });
  return { value: t.value, label: t.label, words: [...words] };
});

const SAMPLE_CSV = [
  ['Label', 'Key', 'Type', 'Options', 'Auto-fill', 'Width', 'Required'],
  ['Roll No', 'roll_no', 'text', '', 'none', 'full', 'yes'],
  ['Candidate Name', 'candidate_name', 'text', '', 'none', 'full', 'yes'],
  ['Marks', 'marks', 'number', '', 'none', 'half', 'no'],
  ['Exam Date', 'exam_date', 'date', '', 'today', 'half', 'no'],
  ['Center', 'center', 'dropdown', 'Lucknow, Delhi, Noida', 'none', 'full', 'no'],
  ['Present', 'present', 'yes/no', '', 'none', 'half', 'no'],
]
  .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
  .join('\r\n');

const downloadSample = () => {
  // BOM so Excel reads the file as UTF-8.
  const blob = new Blob([`﻿${SAMPLE_CSV}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exam-fields-sample.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const BulkFieldsModal = ({
  fields,
  onClose,
  onAdd,
  title = 'Bulk add fields',
  /** Where the user is editing, e.g. "Field preset · Bio-Metric · Mock Day". */
  workingContext = '',
  labelPlaceholder = 'e.g. Exam Type',
  keyPlaceholder = 'exam_type',
  reservedKeys = [],
  allowUnique = false,
  saving = false,
  error = '',
  examSourceFields = [],
  /** When set with currentView, enables “Import from tab” on an exam page. */
  examId = null,
  currentView = null,
  /** Other field presets — enables “Import from preset” on Settings → Field presets. */
  presetSources = null,
  /** Existing unique-import config (features) so Import can re-edit it. */
  uniqueRowKeys = null,
  uniqueRowAggregates = null,
  /** Apply unique keys / count / sum as soon as Import finishes (don’t wait for Bulk Save). */
  onUniqueImportChange = null,
  /** Date × shift column template stored on features.dateShifts. */
  dateShifts = null,
  /**
   * Date shifts are Center list only. Defaults from `currentView === center-list`.
   * Pass false to hide even on Center list.
   */
  enableDateShifts = null,
}) => {
  const examFieldOptions = (examSourceFields || [])
    .filter((f) => f?.key)
    .map((f) => ({ value: f.key, label: f.label || f.key }));
  const initialRows = () => {
    const existing = fields
      .filter(
        (f) =>
          f.dataType === 'linked' ||
          f.dataType === 'combined' ||
          BULK_TYPES.some((t) => t.value === f.dataType),
      )
      .map(rowFromField);
    // A Linked value points at the row (field) it reads from.
    existing.forEach((r) => {
      if (r.linkedKey) r.linkedRid = existing.find((x) => x.key === r.linkedKey)?.rid || '';
    });
    return [...existing, ...Array.from({ length: INITIAL_ROWS }, () => newRow())];
  };
  const [rows, setRows] = useState(initialRows);
  const existingCount = rows.filter((r) => r.existingId).length;
  const maxRows = MAX_ROWS + existingCount;
  const bodyRef = useRef(null);
  const focusHandleRidRef = useRef(null);
  useEffect(() => {
    const rid = focusHandleRidRef.current;
    if (!rid) return;
    focusHandleRidRef.current = null;
    tableRef.current?.querySelector(`[data-grip="${rid}"]`)?.focus();
  });
  const tableRef = useRef(null);
  const focusRidRef = useRef(null);

  const [tab, setTab] = useState('fields'); // 'fields' | 'dateShifts' | 'deps'
  const showDateShifts =
    enableDateShifts == null
      ? String(currentView || '') === DEFAULT_EXAM_VIEW
      : Boolean(enableDateShifts);
  useEffect(() => {
    if (!showDateShifts && tab === 'dateShifts') setTab('fields');
  }, [showDateShifts, tab]);
  const initialDateShifts = useMemo(
    () => normalizeDateShiftsConfig(dateShifts || emptyDateShiftsConfig()),
    // Only seed from the prop when the modal mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [shiftDraft, setShiftDraft] = useState(() => {
    const cfg = normalizeDateShiftsConfig(dateShifts || emptyDateShiftsConfig());
    return {
      summaryColumn: { ...cfg.summaryColumn },
      allDayColumn: { ...cfg.allDayColumn },
      columnWidths: { ...cfg.columnWidths },
      // Keep one blank row so the user can type immediately.
      shifts: cfg.shifts.length ? cfg.shifts.map((s) => ({ ...s })) : [newShiftColumn()],
    };
  });
  const dateShiftsDirty = useMemo(() => {
    if (!showDateShifts) return false;
    const next = normalizeDateShiftsConfig({
      summaryColumn: shiftDraft.summaryColumn,
      allDayColumn: shiftDraft.allDayColumn,
      columnWidths: shiftDraft.columnWidths,
      shifts: shiftDraft.shifts,
      dates: initialDateShifts.dates,
    });
    return !dateShiftsConfigEqual(initialDateShifts, next);
  }, [shiftDraft, initialDateShifts, showDateShifts]);
  const columnWidths = normalizeDateShiftColumnWidths(shiftDraft.columnWidths);
  const filledShiftCount = shiftDraft.shifts.filter((s) => String(s.label || '').trim()).length;
  const summaryOn = Boolean(shiftDraft.summaryColumn?.enabled);
  const allDayOn = Boolean(shiftDraft.allDayColumn?.enabled);
  const summaryHeader = summaryColumnLabel(shiftDraft.summaryColumn);
  const allDayHeader = allDayColumnLabel(shiftDraft.allDayColumn);
  const [removedIds, setRemovedIds] = useState([]); // existing field ids to delete on save
  const [lookupSources, setLookupSources] = useState([]);
  const [assignableTags, setAssignableTags] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  /** Open Import modal scrolled to Unique import (edit existing unique key / count / sum). */
  const [importFocusUnique, setImportFocusUnique] = useState(false);
  /** Composite unique row keys / aggregates from “Unique import” — applied on Save via meta. */
  const [pendingUniqueRowKeys, setPendingUniqueRowKeys] = useState(null);
  const [pendingUniqueRowAggregates, setPendingUniqueRowAggregates] = useState(null);
  const hasUniqueImportConfig =
    (Array.isArray(uniqueRowKeys) && uniqueRowKeys.length > 0) ||
    (Array.isArray(pendingUniqueRowKeys) && pendingUniqueRowKeys.length > 0);

  const openImportModal = (focusUnique = false) => {
    setImportFocusUnique(Boolean(focusUnique));
    setImportOpen(true);
  };
  const canImportFromExam = Boolean(examId && currentView);
  // Explicit null = feature off; [] still shows the button (empty state inside the modal).
  const canImportFromPreset = !examId && Array.isArray(presetSources);
  const canImportShared = canImportFromExam || canImportFromPreset;
  useEffect(() => {
    let cancelled = false;
    listLookupSources()
      .then((rows) => {
        if (!cancelled) setLookupSources(rows);
      })
      .catch(() => {});
    listAssignableTags()
      .then((rows) => {
        if (!cancelled) setAssignableTags(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const reservedSet = useMemo(() => new Set(reservedKeys), [reservedKeys]);
  const validation = useMemo(
    () => validateRows(rows, fields, reservedSet, removedIds),
    [rows, fields, reservedSet, removedIds],
  );
  const filled = validation.filter((v) => !v.blank);
  const errorCount = filled.filter((v) => Object.keys(v.errors).length).length;
  const validCount = filled.length - errorCount;
  // Linked rows point at their source by row id while editing; saving needs that field's key.
  const resolvedRows = useMemo(
    () =>
      rows.map((r) =>
        r.dataType === 'linked'
          ? { ...r, linkedFieldKey: rows.find((x) => x.rid === r.linkedRid)?.key.trim() || '' }
          : r,
      ),
    [rows],
  );
  const changedIds = useMemo(
    () => new Set(resolvedRows.filter((r) => r.existingId && changedField(r)).map((r) => r.rid)),
    [resolvedRows],
  );
  const newCount = rows.filter((r, i) => !r.existingId && !validation[i].blank).length;
  const updateCount = changedIds.size;
  const fieldPending = newCount + updateCount + removedIds.length;
  const uniqueKeysDirty = Array.isArray(pendingUniqueRowKeys) && pendingUniqueRowKeys.length > 0;
  const uniqueAggregatesDirty =
    Array.isArray(pendingUniqueRowAggregates) && pendingUniqueRowAggregates.length > 0;
  const uniqueImportDirty = uniqueKeysDirty || uniqueAggregatesDirty;
  const pending = fieldPending + (dateShiftsDirty ? 1 : 0) + (uniqueImportDirty ? 1 : 0);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // An open dropdown menu takes the first Escape; the next one closes the modal.
        if (document.querySelector('.exams-search-select-portal')) {
          document.dispatchEvent(new MouseEvent('mousedown'));
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (!focusRidRef.current) return;
    const el = bodyRef.current?.querySelector(`[data-rid="${focusRidRef.current}"] [data-col="label"]`);
    focusRidRef.current = null;
    el?.focus();
  }, [rows.length]);

  const update = (rid, patch) =>
    setRows((prev) => {
      const role = patch.scheduleRole;
      const exclusive = role === 'start' || role === 'end';
      return prev.map((r) => {
        if (r.rid === rid) return { ...r, ...patch };
        // Only one field can be Schedule start / Schedule end.
        if (exclusive && r.scheduleRole === role) return { ...r, scheduleRole: '' };
        return r;
      });
    });

  const setLabel = (rid, label) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.rid !== rid) return r;
        const next = { ...r, label };
        if (!r.keyTouched) next.key = label.trim() ? normalizeFieldKey(slugifyKey(label)) : '';
        return next;
      })
    );

  const addRow = (afterRid) => {
    setRows((prev) => {
      if (prev.length >= maxRows) return prev;
      const lastExisting = prev.reduce((n, r, i) => (r.existingId ? i : n), -1);
      const idx = Math.max(afterRid ? prev.findIndex((r) => r.rid === afterRid) : prev.length - 1, lastExisting);
      const source = prev[idx] || prev[prev.length - 1];
      const row = newRow(source?.dataType || 'text');
      focusRidRef.current = row.rid;
      const copy = [...prev];
      copy.splice(idx + 1, 0, row);
      return copy;
    });
  };

  const removeRow = (rid) => {
    const target = rows.find((r) => r.rid === rid);
    if (!target) return;
    if (target.existingId) {
      setRemovedIds((prev) => (prev.includes(target.existingId) ? prev : [...prev, target.existingId]));
    }
    setRows((prev) => {
      const next = prev.filter((r) => r.rid !== rid);
      return next.some((r) => !r.existingId) ? next : [...next, newRow()];
    });
  };

  // Auto-fill and Width are rarely changed, so they stay hidden until asked for (or already in use).
  const [showMore, setShowMore] = useState(() =>
    rows.some((r) => (r.autoFill || 'none') !== 'none' || (r.layout || 'full') !== 'full'),
  );
  // Column pinning: columns 0..pinCount (# / Label / Key / Type) stay put while scrolling sideways; null = none.
  // Label (column 1) is pinned by default so rows stay identifiable when scrolling right.
  const [pinCount, setPinCount] = useState(1);
  const [pinLefts, setPinLefts] = useState([]);
  // Config lists for the Options cell. Start from the local cache, then refresh from the server.
  const [configLists, setConfigLists] = useState(loadConfigDropdownLists);
  useEffect(() => {
    let cancelled = false;
    fetchConfigLists()
      .then((lists) => {
        if (!cancelled) setConfigLists(lists);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const configListChoices = useMemo(
    () => configLists.map((l) => ({ value: l.id, label: `${l.name} (${(l.options || []).length})` })),
    [configLists],
  );
  const [notice, setNotice] = useState('');
  // Type help tooltip: opens on hover/focus, or stays open after a click until dismissed.
  const [tip, setTip] = useState(null); // { top, left, maxHeight, pinned }
  const tipTimer = useRef(null);

  const showTip = (btn, pinned = false) => {
    clearTimeout(tipTimer.current);
    const r = btn.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth * 0.92);
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - width - 8));
    const top = r.bottom + 8;
    setTip((prev) => ({
      top,
      left,
      width,
      maxHeight: Math.max(160, window.innerHeight - top - 16),
      pinned: pinned || Boolean(prev?.pinned),
    }));
  };
  const hideTip = (force = false) => {
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip((prev) => (prev && (force || !prev.pinned) ? null : prev)), force ? 0 : 150);
  };

  useEffect(() => {
    if (!tip?.pinned) return undefined;
    const close = (e) => {
      if (!e.target.closest?.('.exams-bulk-tooltip, .exams-bulk-info-btn')) setTip(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [tip?.pinned]);

  useEffect(() => () => clearTimeout(tipTimer.current), []);

  /**
   * Spreadsheet-style paste: a block of cells lands at the focused cell and spreads
   * right across columns and down across rows (new rows are added as needed).
   * Text with `|` and no tabs still uses the `Label | type | options` shorthand.
   */
  const handlePaste = (e, rid, colName) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!/[\n\t]/.test(text.trim()) && !(colName === 'label' && text.includes('|'))) return;
    e.preventDefault();

    let grid;
    if (!text.includes('\t') && text.includes('|')) {
      const { items } = parseBulkFields(text, [], { types: EXAM_FIELD_TYPES });
      grid = items
        .filter((i) => i.label)
        .map((i) => [`${i.label}${i.required ? '*' : ''}`, '', i.error ? '' : i.dataType, i.options.join(', ')]);
      colName = 'label';
    } else {
      grid = parseGrid(text);
    }
    if (!grid.length) return;

    const startCol = Math.max(COLUMNS.indexOf(colName), 0);
    // Skip a pasted header row ("Label, Key, Type, ...") when pasting from the first column.
    if (startCol === 0 && grid.length > 1 && HEADER_WORDS.has(grid[0][0].trim().toLowerCase())) grid.shift();

    const problems = new Set();
    let added = 0;
    let updated = 0;
    const startIdx = Math.max(rows.findIndex((r) => r.rid === rid), 0);
    // Pasting while a saved field is focused must never overwrite rows by position:
    // match pasted rows to saved fields by key (or label), and put the rest in blank rows.
    const matchMode = Boolean(rows[startIdx]?.existingId);
    const norm = (v) => String(v ?? '').replace(/\*$/, '').trim().toLowerCase();
    const next = [...rows];
    const touched = new Set();
    grid.forEach((cols, ri) => {
      let idx = startIdx + ri;
      if (matchMode) {
        const at = (name) => {
          const ci = COLUMNS.indexOf(name) - startCol;
          return ci >= 0 ? cols[ci] : undefined;
        };
        const k = norm(at('key'));
        const l = norm(at('label'));
        idx = next.findIndex((r, i) => r.existingId && !touched.has(i) && (k ? r.key === k : l && norm(r.label) === l));
        if (idx < 0) idx = next.findIndex((r, i) => !r.existingId && !touched.has(i) && isBlank(r));
        if (idx < 0) idx = next.length;
      }
      if (idx >= maxRows) return;
      if (!next[idx]) {
        next[idx] = newRow(next[next.length - 1]?.dataType);
        added += 1;
      } else if (next[idx].existingId) updated += 1;
      touched.add(idx);
      let row = next[idx];
      cols.forEach((raw, ci) => {
        const col = COLUMNS[startCol + ci];
        if (!col) return;
        // A blank pasted Key cell means "suggest one", not "clear it".
        if (col === 'key' && (!String(raw).trim() || row.existingId)) return;
        const [patch, problem] = cellPatch(col, raw);
        if (problem) problems.add(problem);
        row = { ...row, ...patch };
      });
      next[idx] = row;
    });

    // Suggest keys for pasted rows that have a label but no key of their own,
    // keeping them unique against existing fields and every other row.
    const taken = new Set([...fields.map((f) => f.key), ...reservedKeys]);
    next.forEach((r, i) => {
      if (r.key && (r.keyTouched || !touched.has(i))) taken.add(r.key);
    });
    touched.forEach((i) => {
      const r = next[i];
      if (!r || r.keyTouched || !r.label.trim()) return;
      const key = suggestKey(r.label, taken);
      taken.add(key);
      next[i] = { ...r, key };
    });
    setRows(next.slice(0, maxRows));
    setNotice(
      `Pasted ${grid.length} row${grid.length === 1 ? '' : 's'}` +
        (added ? ` (${added} new)` : '') +
        (updated ? ` · ${updated} existing updated` : '') +
        (problems.size ? ` · ignored unknown ${[...problems].slice(0, 3).join(', ')}` : '')
    );
  };

  /* ---------- Reorder rows (drag the handle, or Alt+Up / Alt+Down on it) ---------- */
  const [dragRid, setDragRid] = useState(null);
  const [dragOverRid, setDragOverRid] = useState(null);

  const moveRow = (fromRid, toRid) => {
    if (!fromRid || !toRid || fromRid === toRid) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.rid === fromRid);
      const to = prev.findIndex((r) => r.rid === toRid);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const nudgeRow = (rid, delta) => {
    setRows((prev) => {
      const from = prev.findIndex((r) => r.rid === rid);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    focusHandleRidRef.current = rid;
  };

  const duplicateRow = (rid) =>
    setRows((prev) => {
      if (prev.length >= maxRows) return prev;
      const idx = prev.findIndex((r) => r.rid === rid);
      const lastExisting = prev.reduce((n, r, i) => (r.existingId ? i : n), -1);
      const copy = { ...prev[idx], rid: newRow().rid, label: '', key: '', keyTouched: false, existingId: null, orig: null, lockOptions: false };
      focusRidRef.current = copy.rid;
      const next = [...prev];
      next.splice(Math.max(idx, lastExisting) + 1, 0, copy);
      return next;
    });

  const clearAll = () => {
    setRemovedIds([]);
    setRows(initialRows());
    setNotice('');
  };

  const insertBulkRows = (additions, notice) => {
    if (!additions.length) {
      setNotice('Those fields are already in this list.');
      return;
    }
    setRows((prev) => {
      const blankStart = prev.findIndex(
        (r) => !r.existingId && !String(r.label || '').trim() && !String(r.key || '').trim(),
      );
      if (blankStart < 0) return [...prev, ...additions].slice(0, maxRows);
      return [...prev.slice(0, blankStart), ...additions, ...prev.slice(blankStart)].slice(0, maxRows);
    });
    setNotice(notice);
    setTab('fields');
  };

  /** Pull shared / combined columns from another tab or preset into this bulk grid. */
  const handleImportFromTab = (result) => {
    const home = String(result?.sourceView || '').trim();
    const haveKeys = new Set(rows.map((r) => String(r.key || '').trim()).filter(Boolean));
    const nextUniqueKeys = normalizeUniqueRowKeys(result?.uniqueRowKeys);
    const nextUniqueAggregates = normalizeUniqueRowAggregates(result?.uniqueRowAggregates);
    if (nextUniqueKeys.length) setPendingUniqueRowKeys(nextUniqueKeys);
    if (nextUniqueAggregates.length || nextUniqueKeys.length) {
      setPendingUniqueRowAggregates(nextUniqueAggregates);
    }
    // Count / sum must hit features immediately — waiting for Bulk Save left Days Total Center at 0.
    if (nextUniqueKeys.length || nextUniqueAggregates.length) {
      onUniqueImportChange?.({
        uniqueRowKeys: nextUniqueKeys,
        uniqueRowAggregates: nextUniqueAggregates,
      });
    }
    const uniqueLabel = nextUniqueKeys.length
      ? uniqueRowKeysLabel(
          [
            ...rows.map((r) => ({ key: r.key, label: r.label })),
            ...(Array.isArray(result?.fields) ? result.fields : []),
          ],
          nextUniqueKeys,
        )
      : '';
    const aggNotice = nextUniqueAggregates.length
      ? ` · ${nextUniqueAggregates.length} result field${nextUniqueAggregates.length === 1 ? '' : 's'}`
      : '';

    if (result?.combinedField) {
      const f = result.combinedField;
      if (haveKeys.has(f.key)) {
        setNotice(`“${f.label || f.key}” is already in this list.`);
        return;
      }
      const row = rowFromField({ ...f, id: undefined });
      insertBulkRows(
        [
          {
            ...row,
            rid: newRow().rid,
            existingId: null,
            orig: null,
            keyTouched: true,
            sharedFromView: f.sharedFromView || home,
            combineKeys: f.combine?.keys || [],
            combineSeparator: f.combine?.separator ?? ', ',
          },
        ],
        `Added combined column “${f.label}” from ${examViewLabel(home)}. Save to keep it.`,
      );
      return;
    }

    const pickedFields = Array.isArray(result?.fields) ? result.fields : Array.isArray(result) ? result : [];
    const additions = pickedFields
      .filter((f) => f?.key && !haveKeys.has(f.key))
      .map((f) => {
        const sharedFromView = String(f.sharedFromView || home || '').trim();
        const row = rowFromField({ ...f, id: undefined, sharedFromView });
        return {
          ...row,
          rid: newRow().rid,
          existingId: null,
          orig: null,
          sharedFromView,
          keyTouched: true,
        };
      });

    if (!additions.length) {
      if (nextUniqueKeys.length || nextUniqueAggregates.length) {
        setNotice(
          examId
            ? `Unique import active: ${uniqueLabel || nextUniqueKeys.join(' · ')}${aggNotice}.`
            : `Unique import set to ${uniqueLabel || nextUniqueKeys.join(' · ')}${aggNotice}. Save the preset to keep it.`,
        );
        setTab('fields');
        return;
      }
      setNotice('Those fields are already in this list.');
      return;
    }

    insertBulkRows(
      additions,
      nextUniqueKeys.length
        ? examId
          ? `Imported ${additions.length} field${additions.length === 1 ? '' : 's'} from ${examViewLabel(home)} with unique key ${uniqueLabel || nextUniqueKeys.join(' · ')}${aggNotice}.`
          : `Imported ${additions.length} field${additions.length === 1 ? '' : 's'} from ${examViewLabel(home)} with unique key ${uniqueLabel || nextUniqueKeys.join(' · ')}${aggNotice}. Save the preset to keep them.`
        : `Imported ${additions.length} shared field${additions.length === 1 ? '' : 's'} from ${examViewLabel(home)}. Save to keep them.`,
    );
  };

  const handleKeyDown = (e, row, isLast) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.tagName === 'INPUT') {
      const tr = e.target.closest('tr');
      const sib = e.key === 'ArrowDown' ? tr?.nextElementSibling : tr?.previousElementSibling;
      const target = sib?.querySelector(`[data-col="${e.target.dataset.col}"]`);
      if (target) {
        e.preventDefault();
        target.focus();
      }
      return;
    }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
      e.preventDefault();
      if (isLast) addRow(row.rid);
      else {
        const next = e.target.closest('tr')?.nextElementSibling?.querySelector(`[data-col="${e.target.dataset.col}"]`);
        next?.focus();
      }
    }
  };

  const addShiftRow = (afterId) => {
    setShiftDraft((prev) => {
      const row = newShiftColumn();
      const idx = afterId ? prev.shifts.findIndex((s) => s.id === afterId) : prev.shifts.length - 1;
      const next = [...prev.shifts];
      next.splice(Math.max(idx, -1) + 1, 0, row);
      return { ...prev, shifts: next };
    });
  };

  const updateShiftLabel = (id, label) =>
    setShiftDraft((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) => (s.id === id ? { ...s, label } : s)),
    }));

  const updateShiftWidth = (id, px) =>
    setShiftDraft((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) =>
        s.id === id ? { ...s, width: resolveDateShiftColumnWidth(px) } : s,
      ),
    }));

  const removeShiftRow = (id) =>
    setShiftDraft((prev) => {
      const next = prev.shifts.filter((s) => s.id !== id);
      return { ...prev, shifts: next.length ? next : [newShiftColumn()] };
    });

  const [dragShiftId, setDragShiftId] = useState(null);
  const [dragOverShiftId, setDragOverShiftId] = useState(null);

  const moveShift = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setShiftDraft((prev) => {
      const from = prev.shifts.findIndex((s) => s.id === fromId);
      const to = prev.shifts.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev.shifts];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, shifts: next };
    });
  };

  const nudgeShift = (id, delta) =>
    setShiftDraft((prev) => {
      const from = prev.shifts.findIndex((s) => s.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.shifts.length) return prev;
      const next = [...prev.shifts];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...prev, shifts: next };
    });

  const clearShifts = () =>
    setShiftDraft({
      summaryColumn: emptySummaryColumn(),
      allDayColumn: emptyAllDayColumn(),
      columnWidths: emptyDateShiftColumnWidths(),
      shifts: [newShiftColumn()],
    });

  const patchSummary = (patch) =>
    setShiftDraft((prev) => ({
      ...prev,
      summaryColumn: { ...emptySummaryColumn(), ...prev.summaryColumn, ...patch },
    }));

  const patchAllDay = (patch) =>
    setShiftDraft((prev) => ({
      ...prev,
      allDayColumn: { ...emptyAllDayColumn(), ...prev.allDayColumn, ...patch },
    }));

  const patchColumnWidth = (kind, px) =>
    setShiftDraft((prev) => ({
      ...prev,
      columnWidths: {
        ...emptyDateShiftColumnWidths(),
        ...prev.columnWidths,
        [kind]: resolveDateShiftColumnWidth(px),
      },
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pending) return;
    // Feature-only saves (date shifts / unique keys) must not be blocked by Fields-tab errors.
    const metaOnly = fieldPending === 0 && removedIds.length === 0 && (dateShiftsDirty || uniqueImportDirty);
    if (errorCount && !metaOnly) return;
    const items = metaOnly
      ? []
      : resolvedRows
          .filter((r, i) => !r.existingId && !validation[i].blank)
          .map((r) => rowToItem(r, allowUnique));
    const updated = metaOnly
      ? []
      : resolvedRows.filter((r) => r.existingId).map((r) => changedField(r, allowUnique)).filter(Boolean);
    const newDefs = items.map((item, i) => toFieldDefinition(item, fields.length + i + 1));
    // Row order = field order: existing fields by id, new ones by key.
    const order = metaOnly
      ? []
      : resolvedRows
          .filter((r, i) => r.existingId || !validation[i].blank)
          .map((r) => (r.existingId ? `id:${r.existingId}` : `key:${r.key.trim()}`));
    const meta = {
      ...(dateShiftsDirty
        ? {
            // Keep previously selected Center-list dates; this tab only edits the template.
            dateShifts: normalizeDateShiftsConfig({
              summaryColumn: shiftDraft.summaryColumn,
              allDayColumn: shiftDraft.allDayColumn,
              columnWidths: shiftDraft.columnWidths,
              shifts: shiftDraft.shifts,
              dates: initialDateShifts.dates,
            }),
          }
        : {}),
      ...(uniqueKeysDirty ? { uniqueRowKeys: pendingUniqueRowKeys } : {}),
      ...(uniqueImportDirty
        ? {
            uniqueRowAggregates: Array.isArray(pendingUniqueRowAggregates)
              ? pendingUniqueRowAggregates
              : [],
          }
        : {}),
    };
    onAdd(newDefs, updated, metaOnly ? [] : removedIds, order, meta);
  };

  /* ---------- Dependencies: lookup fields and the Linked values that follow them ---------- */
  const columnsOf = (tableKey) => lookupSources.find((t) => t.table === tableKey)?.columns || [];
  const columnLabel = (tableKey, column) => columnsOf(tableKey).find((c) => c.key === column)?.label || column;
  const tableLabelOf = (tableKey) => lookupSources.find((t) => t.table === tableKey)?.label || tableKey;

  const linkedRows = rows.filter((r) => r.dataType === 'linked');
  const sourceRows = rows.filter((r) => r.dataType !== 'linked' && effectiveSource(r) === 'table' && r.lookupColumn);
  const orphanRows = linkedRows.filter((l) => !sourceRows.some((s) => s.rid === l.linkedRid));

  const removeLinked = (row) => {
    if (row.existingId) setRemovedIds((prev) => (prev.includes(row.existingId) ? prev : [...prev, row.existingId]));
    setRows((prev) => prev.filter((r) => r.rid !== row.rid));
  };

  /** Tick / untick one column of a lookup field's table as a Linked value. */
  const toggleLinked = (source, column) => {
    const existing = rows.find((r) => r.dataType === 'linked' && r.linkedRid === source.rid && r.linkedColumn === column);
    if (existing) {
      removeLinked(existing);
      return;
    }
    const label = columnLabel(source.lookupTable, column);
    const taken = new Set([...rows.map((r) => r.key), ...fields.map((f) => f.key)].filter(Boolean));
    const row = {
      ...newRow('linked'),
      label,
      key: suggestKey(label, taken),
      keyTouched: true,
      linkedRid: source.rid,
      linkedColumn: column,
    };
    setRows((prev) => {
      const at = prev.findIndex((r) => r.rid === source.rid);
      if (at < 0) return prev;
      let end = at;
      prev.forEach((r, i) => {
        if (r.dataType === 'linked' && r.linkedRid === source.rid) end = Math.max(end, i);
      });
      const next = [...prev];
      next.splice(end + 1, 0, row);
      return next;
    });
  };

  // Pinned columns need real widths for their `left` offsets (fixed table layout stretches them).
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || pinCount == null) return undefined;
    const measure = () => {
      const ths = Array.from(table.querySelectorAll('thead th')).slice(0, 4);
      let left = 0;
      const lefts = ths.map((th) => {
        const at = left;
        left += th.getBoundingClientRect().width;
        return at;
      });
      setPinLefts((prev) =>
        prev.length === lefts.length && prev.every((v, i) => Math.abs(v - lefts[i]) < 0.5) ? prev : lefts,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [pinCount, showMore]);

  // colIdx: 0 = #, 1 = Label, 2 = Key, 3 = Type
  const pinned = (colIdx, base = '') => {
    if (pinCount == null || colIdx > pinCount) return { className: base || undefined };
    return {
      className: `${base} is-pinned${colIdx === pinCount ? ' pin-edge' : ''}`.trim(),
      style: { left: pinLefts[colIdx] ?? 0 },
    };
  };

  const pinButton = (colIdx, label) => {
    const active = pinCount === colIdx;
    return (
      <button
        type="button"
        className={`exams-bulk-info-btn exams-bulk-pin-btn${active ? ' is-open' : ''}`}
        onClick={() => setPinCount(active ? null : colIdx)}
        aria-pressed={active}
        aria-label={active ? 'Unpin columns' : `Pin columns up to ${label}`}
        title={active ? 'Unpin columns' : `Pin columns up to ${label}`}
      >
        {active ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
    );
  };

  const cellError = (i, col) => validation[i].errors[col];

  return createPortal(
    <div className="exams-bulk-overlay" onClick={onClose}>
      <form
        className="exams-bulk-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="exams-bulk-header">
          <div className="exams-bulk-heading">
            <h2 className="exams-bulk-title">
              <ListPlus size={16} /> {title}
            </h2>
            {workingContext ? (
              <p className="exams-bulk-sub" title={workingContext}>
                Working on: <strong>{workingContext}</strong>
              </p>
            ) : null}
          </div>
          <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="exams-bulk-headrow">
        <div className="exams-bulk-tabs" role="tablist" aria-label="Bulk add sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fields'}
            className={`exams-bulk-tab${tab === 'fields' ? ' active' : ''}`}
            onClick={() => setTab('fields')}
          >
            <ListPlus size={14} /> Fields
            <span className="exams-bulk-tab-count">{rows.filter((r, i) => !validation[i].blank).length}</span>
          </button>
          {showDateShifts && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'dateShifts'}
            className={`exams-bulk-tab${tab === 'dateShifts' ? ' active' : ''}`}
            onClick={() => setTab('dateShifts')}
          >
            <CalendarDays size={14} /> Date shifts
            <span className="exams-bulk-tab-count">{filledShiftCount}</span>
          </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'deps'}
            className={`exams-bulk-tab${tab === 'deps' ? ' active' : ''}`}
            onClick={() => setTab('deps')}
          >
            <Network size={14} /> Dependencies
            <span className="exams-bulk-tab-count">{linkedRows.length}</span>
            {orphanRows.length > 0 && <span className="exams-bulk-tab-warn" title="Needs attention" aria-label="Needs attention" />}
          </button>
        </div>

        {tab === 'fields' && (
        <div className="exams-bulk-toolbar">
          <span
            className="exams-bulk-tip"
            title={`Columns: Label · Key · Type · Options · Auto-fill · Width · Required${allowUnique ? ' · Unique' : ''}. Existing fields are listed first and can be edited in place; a new row's key fills in from its label.`}
          >
            <Info size={14} aria-hidden="true" />
            <span className="exams-bulk-tip-text">Paste rows from Excel or Sheets into any cell.</span>
          </span>
          <span className="exams-bulk-toolbar-actions">
            <button type="button" className="exams-text-add-btn" onClick={() => addRow()} disabled={rows.length >= maxRows}>
              <Plus size={14} /> Add row
            </button>
            <button
              type="button"
              className="exams-text-add-btn"
              onClick={() => setShowMore((v) => !v)}
              aria-pressed={showMore}
              title="Auto-fill and Width columns"
            >
              {showMore ? 'Hide' : 'Show'} auto-fill &amp; width
            </button>
            {canImportShared && (
              <button
                type="button"
                className="exams-text-add-btn"
                onClick={() => openImportModal(false)}
                title={
                  canImportFromPreset
                    ? 'Import shared columns from another field preset'
                    : 'Import shared columns from another exam page'
                }
              >
                <Sparkles size={14} /> {canImportFromPreset ? 'Import from preset' : 'Import from tab'}
              </button>
            )}
            {canImportShared && (
              <button
                type="button"
                className="exams-text-add-btn"
                onClick={() => openImportModal(true)}
                title={
                  hasUniqueImportConfig
                    ? 'Edit unique key and count / sum result fields'
                    : 'Set unique import key and count / sum results'
                }
              >
                <Link2 size={14} /> {hasUniqueImportConfig ? 'Edit unique import' : 'Unique import'}
              </button>
            )}
            <button type="button" className="exams-text-add-btn" onClick={downloadSample}>
              <Download size={14} /> Sample file
            </button>
            <button type="button" className="exams-text-add-btn" onClick={clearAll}>
              Clear all
            </button>
          </span>
        </div>
        )}

        {tab === 'dateShifts' && (
        <div className="exams-bulk-toolbar">
          <span
            className="exams-bulk-tip"
            title="Define shift column labels once. On Center list, each selected exam date gets this same set. Renaming a date later keeps the shift values. Labels are yours — nothing is hardcoded."
          >
            <Info size={14} aria-hidden="true" />
          </span>
          <span className="exams-bulk-toolbar-actions">
            <button type="button" className="exams-text-add-btn" onClick={() => addShiftRow()}>
              <Plus size={14} /> Add shift
            </button>
            <button type="button" className="exams-text-add-btn" onClick={clearShifts}>
              Clear shifts
            </button>
          </span>
        </div>
        )}
        </div>
        {notice && (
          <div className="exams-bulk-notice" role="status">
            {notice}
          </div>
        )}

        {tab === 'dateShifts' && (
          <div className="exams-bulk-body exams-bulk-date-shifts">
            <div className="exams-date-shifts-layout">
              <section className="exams-date-shifts-panel" aria-label="Date shift columns">
                <p className="exams-date-shifts-flow" aria-hidden="true">
                  <span>All day</span>
                  <span aria-hidden="true">→</span>
                  <span>Shifts</span>
                  <span aria-hidden="true">→</span>
                  <span>Summary</span>
                </p>

                {/* 1. All day — before date groups */}
                <div className={`exams-date-shifts-step${allDayOn ? ' is-on' : ''}`}>
                  <div className="exams-date-shifts-step-head">
                    <span className="exams-date-shifts-step-badge">1</span>
                    <label className="exams-date-shifts-option-toggle" title="Before all date columns">
                      <input
                        type="checkbox"
                        checked={allDayOn}
                        onChange={(e) => {
                          if (e.target.checked) {
                            patchAllDay({
                              enabled: true,
                              type: shiftDraft.allDayColumn?.type || 'max',
                            });
                          } else {
                            patchAllDay({ enabled: false });
                          }
                        }}
                      />
                      <strong>All day</strong>
                    </label>
                    <button
                      type="button"
                      className="exams-bulk-info-btn"
                      title="Aggregate across every date’s shifts. Placed before all date columns."
                      aria-label="About all-day column"
                    >
                      <Info size={13} />
                    </button>
                  </div>
                  <div className="exams-date-shifts-type-row">
                    <div
                      className={`exams-date-shifts-type-seg${allDayOn ? '' : ' is-disabled'}`}
                      role="radiogroup"
                      aria-label="All-day column type"
                      aria-disabled={!allDayOn}
                    >
                      {DATE_SHIFT_ALL_DAY_TYPES.map((t) => {
                        const active = allDayOn && (shiftDraft.allDayColumn?.type || 'max') === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={!allDayOn}
                            className={`exams-date-shifts-type-btn${active ? ' is-active' : ''}`}
                            onClick={() => patchAllDay({ enabled: true, type: t.value })}
                            title={t.hint}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <DateShiftColumnColorPicker
                      value={shiftDraft.allDayColumn?.color}
                      onChange={(color) => patchAllDay({ color })}
                      disabled={!allDayOn}
                      label="All day column color"
                    />
                    <DateShiftPxInput
                      label="All day width"
                      value={columnWidths.allDay}
                      disabled={!allDayOn}
                      onChange={(px) => patchColumnWidth('allDay', px)}
                    />
                  </div>
                  {allDayOn && (shiftDraft.allDayColumn?.type || 'max') === 'custom' && (
                    <input
                      type="text"
                      className="exams-date-shifts-custom-input"
                      value={shiftDraft.allDayColumn?.customLabel || ''}
                      onChange={(e) => patchAllDay({ customLabel: e.target.value })}
                      placeholder="Type column name"
                      aria-label="Custom all-day column name"
                      autoFocus
                    />
                  )}
                </div>

                {/* 2. Shift columns — repeat under each date */}
                <div className="exams-date-shifts-step is-core">
                  <div className="exams-date-shifts-step-head">
                    <span className="exams-date-shifts-step-badge">2</span>
                    <h3 className="exams-date-shifts-panel-title">
                      Shift columns
                      <button
                        type="button"
                        className="exams-bulk-info-btn"
                        title="Type each column name. The same set repeats under every exam date on Center list."
                        aria-label="About shift columns"
                      >
                        <Info size={13} />
                      </button>
                    </h3>
                    <button type="button" className="exams-btn secondary compact" onClick={() => addShiftRow()}>
                      <Plus size={14} /> Add
                    </button>
                  </div>

                  <div className="exams-date-shifts-list" role="list">
                    {shiftDraft.shifts.map((shift, index) => {
                      const isLast = index === shiftDraft.shifts.length - 1;
                      const dragging = dragShiftId === shift.id;
                      const dragOver =
                        dragOverShiftId === shift.id && dragShiftId && dragShiftId !== shift.id;
                      return (
                        <div
                          key={shift.id}
                          className={`exams-date-shifts-row${dragging ? ' is-dragging' : ''}${dragOver ? ' is-drag-over' : ''}`}
                          role="listitem"
                          onDragOver={(e) => {
                            if (!dragShiftId) return;
                            e.preventDefault();
                            if (dragOverShiftId !== shift.id) setDragOverShiftId(shift.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            moveShift(dragShiftId, shift.id);
                            setDragShiftId(null);
                            setDragOverShiftId(null);
                          }}
                        >
                          <button
                            type="button"
                            className="exams-date-shifts-grip"
                            draggable
                            data-shift-grip={shift.id}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', shift.id);
                              setDragShiftId(shift.id);
                            }}
                            onDragEnd={() => {
                              setDragShiftId(null);
                              setDragOverShiftId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                e.preventDefault();
                                nudgeShift(shift.id, e.key === 'ArrowUp' ? -1 : 1);
                              }
                            }}
                            aria-label={`Reorder shift ${index + 1}. Drag, or press Alt and an arrow key`}
                            title="Drag to reorder (Alt + ↑ / ↓)"
                          >
                            <GripVertical size={15} aria-hidden="true" />
                          </button>
                          <span className="exams-date-shifts-num" aria-hidden="true">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={shift.label}
                            onChange={(e) => updateShiftLabel(shift.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              if (isLast) addShiftRow(shift.id);
                              else {
                                const next = e.currentTarget
                                  .closest('.exams-date-shifts-row')
                                  ?.nextElementSibling?.querySelector('input[type="text"]');
                                next?.focus();
                              }
                            }}
                            placeholder="Shift column name"
                            aria-label={`Shift column ${index + 1} label`}
                            className="exams-date-shifts-input"
                            autoFocus={
                              index === 0 &&
                              !String(shift.label || '').trim() &&
                              shiftDraft.shifts.length === 1
                            }
                          />
                          <DateShiftPxInput
                            label={`Shift ${index + 1} width`}
                            value={shift.width ?? columnWidths.shift}
                            onChange={(px) => updateShiftWidth(shift.id, px)}
                          />
                          <button
                            type="button"
                            className="exams-bulk-remove"
                            onClick={() => removeShiftRow(shift.id)}
                            aria-label={`Remove shift ${index + 1}`}
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Summary — after shifts under each date */}
                <div className={`exams-date-shifts-step${summaryOn ? ' is-on' : ''}`}>
                  <div className="exams-date-shifts-step-head">
                    <span className="exams-date-shifts-step-badge">3</span>
                    <label className="exams-date-shifts-option-toggle" title="After the shifts for each date">
                      <input
                        type="checkbox"
                        checked={summaryOn}
                        onChange={(e) => {
                          if (e.target.checked) {
                            patchSummary({
                              enabled: true,
                              type: shiftDraft.summaryColumn?.type || 'max',
                            });
                          } else {
                            patchSummary({ enabled: false });
                          }
                        }}
                      />
                      <strong>Summary</strong>
                    </label>
                    <button
                      type="button"
                      className="exams-bulk-info-btn"
                      title="One extra column after the shifts for each date (e.g. Max Day 1)."
                      aria-label="About summary column"
                    >
                      <Info size={13} />
                    </button>
                  </div>
                  <div className="exams-date-shifts-type-row">
                    <div
                      className={`exams-date-shifts-type-seg${summaryOn ? '' : ' is-disabled'}`}
                      role="radiogroup"
                      aria-label="Summary column type"
                      aria-disabled={!summaryOn}
                    >
                      {DATE_SHIFT_SUMMARY_TYPES.map((t) => {
                        const active = summaryOn && (shiftDraft.summaryColumn?.type || 'max') === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={!summaryOn}
                            className={`exams-date-shifts-type-btn${active ? ' is-active' : ''}`}
                            onClick={() => patchSummary({ enabled: true, type: t.value })}
                            title={t.hint}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <DateShiftColumnColorPicker
                      value={shiftDraft.summaryColumn?.color}
                      onChange={(color) => patchSummary({ color })}
                      disabled={!summaryOn}
                      label="Summary column color"
                    />
                    <DateShiftPxInput
                      label="Summary width"
                      value={columnWidths.summary}
                      disabled={!summaryOn}
                      onChange={(px) => patchColumnWidth('summary', px)}
                    />
                  </div>
                  {summaryOn && (shiftDraft.summaryColumn?.type || 'max') === 'custom' && (
                    <input
                      type="text"
                      className="exams-date-shifts-custom-input"
                      value={shiftDraft.summaryColumn?.customLabel || ''}
                      onChange={(e) => patchSummary({ customLabel: e.target.value })}
                      placeholder="Type column name"
                      aria-label="Custom summary column name"
                      autoFocus
                    />
                  )}
                </div>
              </section>

              <aside className="exams-date-shifts-preview-panel" aria-label="Column preview">
                <header className="exams-date-shifts-panel-head">
                  <h3 className="exams-date-shifts-panel-title">
                    How it looks
                    <button
                      type="button"
                      className="exams-bulk-info-btn"
                      title={`Each selected date gets this group. Renaming a date later keeps the values. Dates are chosen later on the Center list. ${filledShiftCount} shift${filledShiftCount === 1 ? '' : 's'}${summaryOn ? ` + ${summaryHeader}` : ''} per date.${allDayOn ? ` ${allDayHeader} sits before all date columns.` : ''}`}
                      aria-label="About preview"
                    >
                      <Info size={13} />
                    </button>
                  </h3>
                </header>

                <div className="exams-date-shifts-sheet" role="presentation">
                  <div className="exams-date-shifts-sheet-scroll">
                    {(() => {
                      const filledShifts = shiftDraft.shifts.filter((s) =>
                        String(s.label || '').trim(),
                      );
                      const labels = filledShifts.map((s) => String(s.label).trim());
                      const days = [
                        { key: 'd1', title: '10-Nov-2026', dayIndex: 1 },
                        { key: 'd2', title: '11-Nov-2026', dayIndex: 2 },
                      ];
                      const colCount = Math.max(labels.length + (summaryOn ? 1 : 0), 1);
                      const sampleVals = (di) => labels.map((_, i) => 8 + ((di + i) % 3));
                      const allShiftVals = days.flatMap((_, di) => sampleVals(di));
                      const allDaySample = aggregateShiftValues(
                        shiftDraft.allDayColumn?.type || 'max',
                        allShiftVals,
                      );
                      const emptyDay = labels.length === 0 && !summaryOn;
                      const allDayColor = normalizeColumnColor(shiftDraft.allDayColumn?.color);
                      const summaryColor = normalizeColumnColor(shiftDraft.summaryColumn?.color);
                      const tintStyle = (hex) =>
                        hex
                          ? {
                              color: hex,
                              backgroundColor: hexWithAlpha(hex, 0.12),
                            }
                          : undefined;
                      return (
                        <table className="exams-date-shifts-sheet-table">
                          <thead>
                            <tr>
                              {allDayOn && (
                                <th
                                  rowSpan={2}
                                  className="is-max exams-date-shifts-all-day"
                                  style={tintStyle(allDayColor)}
                                >
                                  {allDayHeader}
                                </th>
                              )}
                              {days.map((d) => (
                                <th key={d.key} colSpan={colCount}>
                                  {d.title}
                                </th>
                              ))}
                            </tr>
                            <tr>
                              {days.flatMap((d) =>
                                emptyDay
                                  ? [
                                      <th key={`${d.key}-empty`} className="is-empty">
                                        Add a shift name →
                                      </th>,
                                    ]
                                  : [
                                      ...labels.map((label, i) => (
                                        <th key={`${d.key}-s${i}`}>{label}</th>
                                      )),
                                      ...(summaryOn
                                        ? [
                                            <th
                                              key={`${d.key}-sum`}
                                              className="is-max"
                                              style={tintStyle(summaryColor)}
                                            >
                                              {summaryColumnLabel(
                                                shiftDraft.summaryColumn,
                                                d.dayIndex,
                                              )}
                                            </th>,
                                          ]
                                        : []),
                                    ],
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {allDayOn && (
                                <td
                                  className="is-max exams-date-shifts-all-day"
                                  style={tintStyle(allDayColor)}
                                >
                                  {allDaySample}
                                </td>
                              )}
                              {days.flatMap((d, di) => {
                                const vals = sampleVals(di);
                                return emptyDay
                                  ? [
                                      <td key={`${d.key}-v`} className="is-empty">
                                        —
                                      </td>,
                                    ]
                                  : [
                                      ...vals.map((v, i) => <td key={`${d.key}-v${i}`}>{v}</td>),
                                      ...(summaryOn
                                        ? [
                                            <td
                                              key={`${d.key}-vmax`}
                                              className="is-max"
                                              style={tintStyle(summaryColor)}
                                            >
                                              {aggregateShiftValues(
                                                shiftDraft.summaryColumn?.type || 'max',
                                                vals,
                                              )}
                                            </td>,
                                          ]
                                        : []),
                                    ];
                              })}
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {tab === 'deps' && (
          <div className="exams-bulk-body exams-bulk-deps">
            <p className="exams-bulk-deps-intro">
              A lookup field stores the row you pick from another table. Tick columns to also show them as read-only
              fields that follow that row.
            </p>

            {sourceRows.length === 0 && orphanRows.length === 0 && (
              <div className="exams-bulk-deps-empty">
                <Network size={22} aria-hidden="true" />
                <strong>No lookup fields yet</strong>
                <span>
                  In the Fields tab, set a field’s <em>Options from</em> to <em>Table column</em> and choose a table and
                  column. It will appear here.
                </span>
                <button type="button" className="exams-btn secondary compact" onClick={() => setTab('fields')}>
                  Go to Fields
                </button>
              </div>
            )}

            <div className="exams-bulk-deps-grid">
              {sourceRows.map((src) => {
                const linkedOf = linkedRows.filter((l) => l.linkedRid === src.rid);
                return (
                  <section key={src.rid} className="exams-dep-card" aria-label={`Dependencies of ${src.label || 'field'}`}>
                    <header className="exams-dep-head">
                      <strong>{src.label.trim() || 'Untitled field'}</strong>
                      <span className="exams-dep-source">
                        {tableLabelOf(src.lookupTable)} › {columnLabel(src.lookupTable, src.lookupColumn)}
                      </span>
                    </header>

                    <span className="exams-dep-sub">Also show these columns</span>
                    <div className="exams-dep-chips" role="group" aria-label="Columns to show">
                      {columnsOf(src.lookupTable)
                        .filter((c) => c.key !== src.lookupColumn)
                        .map((c) => {
                          const on = linkedOf.some((l) => l.linkedColumn === c.key);
                          return (
                            <button
                              key={c.key}
                              type="button"
                              aria-pressed={on}
                              className={`exams-dep-chip${on ? ' on' : ''}`}
                              onClick={() => toggleLinked(src, c.key)}
                            >
                              {on ? <Check size={13} /> : <Plus size={13} />} {c.label}
                            </button>
                          );
                        })}
                    </div>

                    {linkedOf.length > 0 && (
                      <ul className="exams-dep-list">
                        {linkedOf.map((l) => (
                          <li key={l.rid} className="exams-dep-item">
                            <CornerDownRight size={14} aria-hidden="true" />
                            <input
                              type="text"
                              value={l.label}
                              onChange={(e) => update(l.rid, { label: e.target.value })}
                              aria-label={`Name of the field showing ${columnLabel(src.lookupTable, l.linkedColumn)}`}
                              className={cellError(rows.indexOf(l), 'label') ? 'invalid' : ''}
                            />
                            <span className="exams-dep-col">shows {columnLabel(src.lookupTable, l.linkedColumn)}</span>
                            <button
                              type="button"
                              className="exams-bulk-remove"
                              onClick={() => removeLinked(l)}
                              aria-label={`Remove ${l.label || 'linked value'}`}
                              title="Remove this linked value"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}

              {orphanRows.length > 0 && (
                <section className="exams-dep-card exams-dep-warn" aria-label="Linked values that need attention">
                  <header className="exams-dep-head">
                    <strong>Needs attention</strong>
                    <span className="exams-dep-source">Their lookup field is missing</span>
                  </header>
                  <ul className="exams-dep-list">
                    {orphanRows.map((l) => (
                      <li key={l.rid} className="exams-dep-item exams-dep-item-stack">
                        <span className="exams-dep-orphan-name">{l.label || 'Linked value'}</span>
                        <SearchableSelect
                          className="exams-bulk-select"
                          portal
                          value=""
                          options={sourceRows.map((r) => ({ value: r.rid, label: r.label.trim() || r.key || 'Untitled field' }))}
                          placeholder="Move to field…"
                          searchThreshold={8}
                          disabled={sourceRows.length === 0}
                          ariaLabel={`Move ${l.label || 'linked value'} to another lookup field`}
                          onChange={(next) => update(l.rid, { linkedRid: next, linkedColumn: '' })}
                        />
                        <button type="button" className="exams-bulk-remove" onClick={() => removeLinked(l)} aria-label={`Remove ${l.label || 'linked value'}`}>
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}

        {tab === 'fields' && (
        <div className="exams-bulk-body" ref={bodyRef} onScroll={() => tip && setTip(null)}>
          <table
            ref={tableRef}
            className="exams-bulk-table"
            style={{ width: `max(100%, ${(showMore ? 2080 : 1720) + (allowUnique ? 90 : 0)}px)` }}
          >
            <colgroup>
              <col style={{ width: 92 }} />
              <col />
              <col style={{ width: 180 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 280 }} />
              {showMore && <col style={{ width: 210 }} />}
              {showMore && <col style={{ width: 150 }} />}
              <col style={{ width: 90 }} />
              {allowUnique && <col style={{ width: 90 }} />}
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr>
                <th {...pinned(0, 'col-num')}>
                  <span className="exams-bulk-th-info">
                    #
                    {pinButton(0, '#')}
                  </span>
                </th>
                <th {...pinned(1)}>
                  <span className="exams-bulk-th-info">
                    Label
                    {pinButton(1, 'Label')}
                  </span>
                </th>
                <th {...pinned(2)}>
                  <span className="exams-bulk-th-info">
                    Key
                    {pinButton(2, 'Key')}
                  </span>
                </th>
                <th {...pinned(3)}>
                  <span className="exams-bulk-th-info">
                    Type
                    <button
                      type="button"
                      className={`exams-bulk-info-btn${tip ? ' is-open' : ''}`}
                      onMouseEnter={(e) => showTip(e.currentTarget)}
                      onMouseLeave={() => hideTip()}
                      onFocus={(e) => showTip(e.currentTarget)}
                      onBlur={() => hideTip()}
                      onClick={(e) => (tip?.pinned ? hideTip(true) : showTip(e.currentTarget, true))}
                      aria-label="How pasted types are matched"
                      aria-describedby={tip ? 'exams-bulk-type-tip' : undefined}
                    >
                      <Info size={14} />
                    </button>
                    {pinButton(3, 'Type')}
                  </span>
                </th>
                <th>Validation</th>
                <th>Options from</th>
                <th>Table</th>
                <th>Column</th>
                <th>Options</th>
                {showMore && <th>Auto-fill</th>}
                {showMore && <th>Width</th>}
                <th className="col-req">Required</th>
                {allowUnique && (
                  <th className="col-req" title="No two records can share a value in this field">
                    Unique
                  </th>
                )}
                <th className="col-act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const needsOptions = OPTIONS_FIELD_TYPES.has(row.dataType);
                const isPhone = row.dataType === 'phone';
                const isLast = i === rows.length - 1;
                return (
                  <tr
                    key={row.rid}
                    data-rid={row.rid}
                    className={`${Object.keys(validation[i].errors).length ? 'has-error' : ''}${dragRid === row.rid ? ' is-dragging' : ''}${dragOverRid === row.rid && dragRid !== row.rid ? ' is-drag-over' : ''}`.trim()}
                    onDragOver={(e) => {
                      if (!dragRid) return;
                      e.preventDefault();
                      if (dragOverRid !== row.rid) setDragOverRid(row.rid);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      moveRow(dragRid, row.rid);
                      setDragRid(null);
                      setDragOverRid(null);
                    }}
                  >
                    <td {...pinned(0, 'col-num')} data-label="#">
                      <button
                        type="button"
                        className="exams-bulk-grip"
                        draggable
                        data-grip={row.rid}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', row.rid);
                          setDragRid(row.rid);
                        }}
                        onDragEnd={() => {
                          setDragRid(null);
                          setDragOverRid(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                            e.preventDefault();
                            nudgeRow(row.rid, e.key === 'ArrowUp' ? -1 : 1);
                          }
                        }}
                        aria-label={`Move row ${i + 1}. Drag, or press Alt and an arrow key`}
                        title="Drag to reorder (Alt + ↑ / ↓)"
                      >
                        <GripVertical size={14} />
                      </button>
                      <span className="exams-bulk-rownum">
                        {validation[i].blank ? (
                          i + 1
                        ) : rows[i].existingId && !changedIds.has(row.rid) && !Object.keys(validation[i].errors).length ? (
                          i + 1
                        ) : Object.keys(validation[i].errors).length ? (
                          <AlertCircle size={15} className="is-bad" aria-label="Row has errors" />
                        ) : (
                          <CheckCircle2 size={15} className="is-ok" aria-label="Row is valid" />
                        )}
                        {row.sharedFromView ? (
                          <button
                            type="button"
                            className="exams-bulk-imported-badge"
                            title={`Imported · shared from ${examViewLabel(row.sharedFromView)}. Click to edit unique import.`}
                            aria-label={`Imported · shared from ${examViewLabel(row.sharedFromView)}. Edit unique import.`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (canImportShared) openImportModal(true);
                            }}
                          >
                            <Link2 size={11} strokeWidth={2.25} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td {...pinned(1)} data-label="Label">
                      <input
                        type="text"
                        data-col="label"
                        value={row.label}
                        placeholder={labelPlaceholder}
                        className={cellError(i, 'label') ? 'invalid' : ''}
                        onChange={(e) => setLabel(row.rid, e.target.value)}
                        onPaste={(e) => handlePaste(e, row.rid, 'label')}
                        onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                        autoFocus={i === existingCount}
                        aria-label={`Row ${i + 1} label`}
                      />
                      {cellError(i, 'label') && <span className="exams-bulk-err">{cellError(i, 'label')}</span>}
                    </td>
                    <td {...pinned(2)} data-label="Key">
                      <input
                        type="text"
                        data-col="key"
                        onPaste={(e) => handlePaste(e, row.rid, 'key')}
                        value={row.key}
                        disabled={Boolean(row.existingId)}
                        title={row.existingId ? 'A key cannot change after the field is created' : undefined}
                        placeholder={keyPlaceholder}
                        className={cellError(i, 'key') ? 'invalid' : ''}
                        onChange={(e) =>
                          update(row.rid, { key: normalizeFieldKey(e.target.value), keyTouched: true })
                        }
                        onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                        aria-label={`Row ${i + 1} key`}
                      />
                      {cellError(i, 'key') && <span className="exams-bulk-err">{cellError(i, 'key')}</span>}
                    </td>
                    <td {...pinned(3)} data-label="Type">
                      {row.dataType === 'linked' ? (
                        <span className="exams-bulk-static-chip">Linked value</span>
                      ) : row.dataType === 'combined' ? (
                        <span
                          className="exams-bulk-static-chip"
                          title={(row.combineKeys || []).join(row.combineSeparator || ', ')}
                        >
                          Combined
                        </span>
                      ) : (
                      <SearchableSelect
                        className="exams-bulk-select"
                        portal
                        value={row.dataType}
                        options={BULK_TYPES}
                        searchPlaceholder="Search field types…"
                        ariaLabel={`Row ${i + 1} type`}
                        onChange={(next) =>
                          update(row.rid, {
                            dataType: next,
                            ...(CHOICE_FIELD_TYPES.has(next) ? {} : { optionsSource: 'manual' }),
                            ...(DATE_LINK_TYPES.has(next) ? {} : { scheduleRole: '' }),
                            ...(next !== 'phone'
                              ? {
                                  phoneValidationMode: 'none',
                                  phonePattern: '',
                                  phoneMessage: '',
                                }
                              : {}),
                          })
                        }
                      />
                      )}
                    </td>
                    <td data-label="Validation" className="exams-bulk-validation-cell">
                      {isPhone ? (
                        <div className="exams-bulk-phone-validation">
                          <SearchableSelect
                            className="exams-bulk-select"
                            portal
                            value={row.phoneValidationMode || 'none'}
                            options={PHONE_VALIDATION_PRESETS}
                            searchThreshold={8}
                            ariaLabel={`Row ${i + 1} phone validation`}
                            onChange={(next) =>
                              update(row.rid, {
                                phoneValidationMode: next,
                                phonePattern: next === 'custom' ? row.phonePattern : '',
                              })
                            }
                          />
                          {row.phoneValidationMode === 'custom' && (
                            <>
                              <input
                                type="text"
                                data-col="phonePattern"
                                value={row.phonePattern}
                                placeholder="Regex e.g. ^[6-9]\\d{9}$"
                                className={cellError(i, 'phonePattern') ? 'invalid' : ''}
                                onChange={(e) => update(row.rid, { phonePattern: e.target.value })}
                                onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                                aria-label={`Row ${i + 1} custom regex`}
                                spellCheck={false}
                              />
                              {cellError(i, 'phonePattern') && (
                                <span className="exams-bulk-err">{cellError(i, 'phonePattern')}</span>
                              )}
                              <input
                                type="text"
                                data-col="phoneMessage"
                                value={row.phoneMessage}
                                placeholder="Error message (optional)"
                                onChange={(e) => update(row.rid, { phoneMessage: e.target.value })}
                                onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                                aria-label={`Row ${i + 1} validation message`}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <input type="text" disabled placeholder="—" aria-hidden="true" tabIndex={-1} />
                      )}
                    </td>
                    <td data-label="Options from">
                      {row.dataType === 'fromExam' ? (
                        examFieldOptions.length ? (
                          <SearchableSelect
                            className="exams-bulk-select"
                            portal
                            value={row.examFieldKey || ''}
                            options={examFieldOptions}
                            placeholder="Exam field…"
                            searchThreshold={8}
                            ariaLabel={`Row ${i + 1} exam field`}
                            onChange={(next) => update(row.rid, { examFieldKey: next })}
                          />
                        ) : (
                          <span className="exams-bulk-static-chip" title="Open bulk add from a center list">
                            No exam fields
                          </span>
                        )
                      ) : DATE_LINK_TYPES.has(row.dataType) ? (
                        <SearchableSelect
                          className="exams-bulk-select"
                          portal
                          value={row.scheduleRole || ''}
                          options={SCHEDULE_ROLE_OPTIONS}
                          searchThreshold={8}
                          ariaLabel={`Row ${i + 1} date chip role (Upcoming / Today / Last 7 days)`}
                          onChange={(next) => update(row.rid, { scheduleRole: next })}
                        />
                      ) : row.dataType === 'linked' ? (
                        <button
                          type="button"
                          className="exams-bulk-dep-link"
                          onClick={() => setTab('deps')}
                          title="Manage in the Dependencies tab"
                        >
                          <CornerDownRight size={13} aria-hidden="true" />
                          {rows.find((r) => r.rid === row.linkedRid)?.label.trim() || 'Pick a field'}
                        </button>
                      ) : row.dataType === 'combined' ? (
                        <span
                          className="exams-bulk-static-chip"
                          title={`Joins ${(row.combineKeys || []).join(' + ')} with “${row.combineSeparator ?? ', '}”`}
                        >
                          {(row.combineKeys || []).join(row.combineSeparator || ', ') || 'Parts'}
                        </span>
                      ) : needsOptions && CHOICE_FIELD_TYPES.has(row.dataType) && !row.lockOptions ? (
                        <SearchableSelect
                          className="exams-bulk-select"
                          portal
                          value={row.optionsSource || 'manual'}
                          options={OPTIONS_SOURCES}
                          searchThreshold={8}
                          ariaLabel={`Row ${i + 1} options source`}
                          onChange={(next) => update(row.rid, { optionsSource: next })}
                        />
                      ) : (
                        <input type="text" disabled placeholder={needsOptions ? 'Typed' : '—'} aria-hidden="true" tabIndex={-1} />
                      )}
                    </td>
                    <td data-label="Table">
                      {needsOptions && CHOICE_FIELD_TYPES.has(row.dataType) && !row.lockOptions && effectiveSource(row) === 'table' ? (
                        <SearchableSelect
                          className="exams-bulk-select"
                          portal
                          value={row.lookupTable}
                          options={lookupSources.map((t) => ({ value: t.table, label: t.label }))}
                          placeholder={lookupSources.length ? 'Select table…' : 'No tables'}
                          searchThreshold={8}
                          disabled={lookupSources.length === 0}
                          ariaLabel={`Row ${i + 1} source table`}
                          onChange={(next) => update(row.rid, { lookupTable: next, lookupColumn: '', lookupDetail: '' })}
                        />
                      ) : (
                        <input type="text" disabled placeholder="—" aria-hidden="true" tabIndex={-1} />
                      )}
                    </td>
                    <td data-label="Column">
                      {needsOptions && CHOICE_FIELD_TYPES.has(row.dataType) && !row.lockOptions && effectiveSource(row) === 'table' ? (
                        <SearchableSelect
                          className="exams-bulk-select"
                          portal
                          value={row.lookupColumn}
                          options={(lookupSources.find((t) => t.table === row.lookupTable)?.columns || []).map((c) => ({
                            value: c.key,
                            label: c.label,
                          }))}
                          placeholder={row.lookupTable ? 'Select column…' : '—'}
                          searchPlaceholder="Search columns…"
                          searchThreshold={6}
                          disabled={!row.lookupTable}
                          ariaLabel={`Row ${i + 1} source column`}
                          onChange={(next) => update(row.rid, { lookupColumn: next })}
                        />
                      ) : (
                        <input type="text" disabled placeholder="—" aria-hidden="true" tabIndex={-1} />
                      )}
                    </td>
                    <td data-label="Options" className="exams-bulk-options-cell">
                      {row.dataType === 'linked' ? (
                        <button
                          type="button"
                          className={`exams-bulk-dep-link${cellError(i, 'optionsText') ? ' invalid' : ''}`}
                          onClick={() => setTab('deps')}
                          title="Manage in the Dependencies tab"
                        >
                          {row.linkedColumn
                            ? columnLabel(rows.find((r) => r.rid === row.linkedRid)?.lookupTable, row.linkedColumn)
                            : 'Pick a column'}
                        </button>
                      ) : needsOptions && !row.lockOptions && effectiveSource(row) === 'config' ? (
                        <>
                          <SearchableSelect
                            className="exams-bulk-select"
                            portal
                            value={row.configListId}
                            options={configListChoices}
                            placeholder={configListChoices.length ? 'Pick a Config list…' : 'No Config lists yet'}
                            searchPlaceholder="Search lists…"
                            searchThreshold={6}
                            disabled={configListChoices.length === 0}
                            ariaLabel={`Row ${i + 1} Config list`}
                            onChange={(next) => update(row.rid, { configListId: next })}
                          />
                          {row.configListId && (
                            <span className="exams-bulk-hint" title={(getConfigListById(row.configListId)?.options || []).map((o) => o.label).join(', ')}>
                              Live: {(getConfigListById(row.configListId)?.options || []).map((o) => o.label).join(', ') || 'list missing'}
                            </span>
                          )}
                        </>
                      ) : needsOptions && !row.lockOptions && effectiveSource(row) === 'table' ? (
                        <>
                          <input type="text" disabled placeholder="Read from the table" aria-hidden="true" tabIndex={-1} />
                          {cellError(i, 'optionsText') && <span className="exams-bulk-err">{cellError(i, 'optionsText')}</span>}
                        </>
                      ) : needsOptions && !row.lockOptions && effectiveSource(row) === 'userTags' ? (
                        <TagPickCellButton
                          value={row.userTagIds || []}
                          tags={assignableTags}
                          invalid={Boolean(cellError(i, 'optionsText'))}
                          errorText={cellError(i, 'optionsText') || ''}
                          ariaLabel={`Row ${i + 1} user tags`}
                          onChange={(next) => update(row.rid, { userTagIds: next })}
                        />
                      ) : (
                        <input
                          type="text"
                          data-col="options"
                          onPaste={(e) => handlePaste(e, row.rid, 'options')}
                          value={row.optionsText}
                          disabled={!needsOptions || row.lockOptions}
                          title={row.lockOptions ? 'Options come from another source; edit them in the single-field editor' : undefined}
                          placeholder={needsOptions ? 'A, B, C' : '—'}
                          className={cellError(i, 'optionsText') ? 'invalid' : ''}
                          onChange={(e) => update(row.rid, { optionsText: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                          aria-label={`Row ${i + 1} options`}
                        />
                      )}
                      {cellError(i, 'optionsText') && effectiveSource(row) !== 'userTags' && (
                        <span className="exams-bulk-err">{cellError(i, 'optionsText')}</span>
                      )}
                    </td>
                    {showMore && (
                    <td data-label="Auto-fill">
                      <SearchableSelect
                        className="exams-bulk-select"
                        portal
                        value={row.autoFill}
                        options={AUTO_FILL_OPTIONS}
                        searchThreshold={8}
                        ariaLabel={`Row ${i + 1} auto-fill`}
                        onChange={(next) => update(row.rid, { autoFill: next })}
                      />
                    </td>
                    )}
                    {showMore && (
                    <td data-label="Width">
                      <SearchableSelect
                        className="exams-bulk-select"
                        portal
                        value={row.layout}
                        options={WIDTH_OPTIONS}
                        ariaLabel={`Row ${i + 1} width`}
                        onChange={(next) => update(row.rid, { layout: next })}
                      />
                    </td>
                    )}
                    <td className="col-req" data-label="Required">
                      <input
                        type="checkbox"
                        checked={row.autoFill === 'none' && row.required}
                        disabled={row.autoFill !== 'none'}
                        onChange={(e) => update(row.rid, { required: e.target.checked })}
                        aria-label={`Row ${i + 1} required`}
                      />
                    </td>
                    {allowUnique && (
                      <td className="col-req" data-label="Unique">
                        <input
                          type="checkbox"
                          checked={row.unique && UNIQUE_FIELD_TYPES.has(row.dataType)}
                          disabled={!UNIQUE_FIELD_TYPES.has(row.dataType)}
                          onChange={(e) => update(row.rid, { unique: e.target.checked })}
                          aria-label={`Row ${i + 1} unique`}
                          title={UNIQUE_FIELD_TYPES.has(row.dataType) ? 'No two records can share a value' : 'This field type cannot be unique'}
                        />
                      </td>
                    )}
                    <td className="col-act">
                      <button
                        type="button"
                        className="exams-bulk-remove"
                        onClick={() => duplicateRow(row.rid)}
                        aria-label={`Duplicate row ${i + 1}`}
                        title="Duplicate row (type, options, width)"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="exams-bulk-remove"
                        onClick={() => removeRow(row.rid)}
                        aria-label={`Remove row ${i + 1}`}
                        title={row.existingId ? 'Remove field (applies when you Save changes)' : 'Remove row'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {tip && (
          <div
            id="exams-bulk-type-tip"
            role="tooltip"
            className="exams-bulk-tooltip"
            style={{ top: tip.top, left: tip.left, width: tip.width, maxHeight: tip.maxHeight }}
            onMouseEnter={() => clearTimeout(tipTimer.current)}
            onMouseLeave={() => hideTip()}
          >
            <strong>How the Type column is matched</strong>
            <p>
              Pasted text is matched to the dropdown, ignoring case. Use the dropdown name or any word beside it.
              A blank keeps the current type; an unknown word is ignored and reported. Formula and composite need the single-field editor.
            </p>
            <ul>
              {TYPE_WORDS.map((t) => (
                <li key={t.value}>
                  <span className="exams-bulk-type-name">{t.label}</span>
                  <span className="exams-bulk-type-words">{t.words.join(' · ')}</span>
                </li>
              ))}
            </ul>
            <p className="exams-bulk-typeinfo-foot">
              Width: <code>full</code> / <code>half</code> · Required: <code>yes</code> / <code>no</code> · Auto-fill: <code>none</code>, <code>currentUser</code>, <code>today</code>, <code>timestamp</code>, <code>dash</code>
            </p>
          </div>
        )}

        <div className="exams-bulk-footer">
          <span className={`exams-bulk-status${errorCount || error ? ' has-error' : ''}`}>
            {error ? `${error} ` : ''}
            {tab === 'dateShifts'
              ? `${filledShiftCount} shift column${filledShiftCount === 1 ? '' : 's'}${
                  allDayOn ? ` · ${allDayHeader}` : ''
                }${summaryOn ? ` · ${summaryHeader}` : ''}${dateShiftsDirty ? ' · unsaved' : ''}`
              : `${rows.length} rows · `}
            {tab !== 'dateShifts' &&
              (errorCount
                ? `${errorCount} row${errorCount === 1 ? '' : 's'} need fixing`
                : fieldPending
                  ? [
                      newCount && `${newCount} new`,
                      updateCount && `${updateCount} to update`,
                      removedIds.length && `${removedIds.length} to remove`,
                      dateShiftsDirty && 'date shifts',
                      uniqueImportDirty && 'unique import',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : dateShiftsDirty || uniqueImportDirty
                    ? [
                        dateShiftsDirty && 'Date shifts changed',
                        uniqueImportDirty && 'Unique import updated',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Edit a field or fill a new row')}
          </span>
          <div className="exams-bulk-footer-actions">
            <button type="button" className="exams-btn secondary compact" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="exams-btn primary compact"
              disabled={
                !pending ||
                saving ||
                (errorCount > 0 &&
                  !(
                    (dateShiftsDirty || uniqueImportDirty) &&
                    fieldPending === 0 &&
                    removedIds.length === 0
                  ))
              }
            >
              <ListPlus size={14} />
              <span>
                {saving
                  ? 'Saving…'
                  : pending
                    ? `Save ${pending} change${pending === 1 ? '' : 's'}`
                    : 'Save changes'}
              </span>
            </button>
          </div>
        </div>
      </form>
      {canImportShared && (
        <ImportFieldsFromTabModal
          open={importOpen}
          examId={canImportFromExam ? examId : null}
          currentView={currentView}
          presetSources={canImportFromPreset ? presetSources : null}
          existingUniqueRowKeys={pendingUniqueRowKeys || uniqueRowKeys}
          existingUniqueRowAggregates={
            pendingUniqueRowAggregates || uniqueRowAggregates
          }
          focusUnique={importFocusUnique}
          currentFields={[
            ...(fields || []),
            ...rows
              .filter((r) => String(r.key || '').trim())
              .map((r) => ({ key: String(r.key).trim(), label: r.label || r.key })),
          ]}
          onClose={() => {
            setImportOpen(false);
            setImportFocusUnique(false);
          }}
          onImport={handleImportFromTab}
        />
      )}
    </div>,
    document.body
  );
};
