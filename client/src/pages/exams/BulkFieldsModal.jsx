import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Copy, Download, Info, ListPlus, Plus, Trash2, X } from 'lucide-react';
import {
  EXAM_FIELD_TYPES,
  AUTO_FILL_OPTIONS,
  OPTIONS_FIELD_TYPES,
  PHONE_VALIDATION_PRESETS,
  UNIQUE_FIELD_TYPES,
  emptyPhoneValidation,
  isValidRegexPattern,
  normalizeFieldKey,
  slugifyKey,
  isValidFieldKey,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';
import { parseBulkFields, resolveType, toFieldDefinition, TYPE_ALIASES } from './examBulkFields';

const BULK_TYPES = EXAM_FIELD_TYPES.filter((t) => t.value !== 'formula' && t.value !== 'composite');
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
  phoneValidationMode: 'none',
  phonePattern: '',
  phoneMessage: '',
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
    existingId: f.id,
    orig: f,
    // Options linked to a shared list are managed in the single-field editor.
    lockOptions: Boolean(f.configListId) || (f.optionsSource && f.optionsSource !== 'manual'),
  };
};

const rowToItem = (r, allowUnique = false) => ({
  label: r.label.trim(),
  key: r.key.trim(),
  dataType: r.dataType,
  required: r.autoFill === 'none' && r.required,
  unique: allowUnique && r.unique && UNIQUE_FIELD_TYPES.has(r.dataType),
  options: OPTIONS_FIELD_TYPES.has(r.dataType) ? splitOptions(r.optionsText) : [],
  autoFill: r.autoFill,
  layout: r.layout,
  phoneValidation: buildPhoneValidation(r),
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
    allowMultiple: item.dataType === 'multiselect',
    ...(r.lockOptions ? {} : { options: item.options }),
    ...(item.dataType === 'phone' ? { phoneValidation: item.phoneValidation } : {}),
  };
  const sig = (f) =>
    JSON.stringify([f.label, f.dataType, Boolean(f.required), Boolean(f.unique), f.autoFill || 'none', f.layout || 'full', f.options || [], f.phoneValidation || null]);
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

const isBlank = (row) => !row.label.trim() && !row.key.trim() && !row.optionsText.trim();

const splitOptions = (text) => [...new Set(String(text).split(',').map((s) => s.trim()).filter(Boolean))];

/** Per-row validation. Blank rows are ignored (no error, not saved). */
const validateRows = (rows, existingFields, extraReserved) => {
  // Fields shown as editable rows claim their names in row order; every other field is taken up front.
  const editing = new Set(rows.map((r) => r.existingId).filter(Boolean));
  const others = existingFields.filter((f) => !editing.has(f.id));
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

    if (!row.lockOptions && OPTIONS_FIELD_TYPES.has(row.dataType) && !splitOptions(row.optionsText).length) {
      errors.optionsText = 'Add options';
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
    case 'options':
      return [{ optionsText: v }, null];
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
  labelPlaceholder = 'e.g. Exam Type',
  keyPlaceholder = 'exam_type',
  reservedKeys = [],
  allowUnique = false,
  saving = false,
  error = '',
}) => {
  const initialRows = () => [
    ...fields.filter((f) => BULK_TYPES.some((t) => t.value === f.dataType)).map(rowFromField),
    ...Array.from({ length: INITIAL_ROWS }, () => newRow()),
  ];
  const [rows, setRows] = useState(initialRows);
  const existingCount = rows.filter((r) => r.existingId).length;
  const maxRows = MAX_ROWS + existingCount;
  const bodyRef = useRef(null);
  const focusRidRef = useRef(null);

  const reservedSet = useMemo(() => new Set(reservedKeys), [reservedKeys]);
  const validation = useMemo(() => validateRows(rows, fields, reservedSet), [rows, fields, reservedSet]);
  const filled = validation.filter((v) => !v.blank);
  const errorCount = filled.filter((v) => Object.keys(v.errors).length).length;
  const validCount = filled.length - errorCount;
  const changedIds = useMemo(
    () => new Set(rows.filter((r) => r.existingId && changedField(r)).map((r) => r.rid)),
    [rows]
  );
  const newCount = rows.filter((r, i) => !r.existingId && !validation[i].blank).length;
  const updateCount = changedIds.size;
  const pending = newCount + updateCount;

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
    setRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));

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

  const removeRow = (rid) =>
    setRows((prev) => {
      if (prev.find((r) => r.rid === rid)?.existingId) return prev;
      const next = prev.filter((r) => r.rid !== rid);
      return next.some((r) => !r.existingId) ? next : [...next, newRow()];
    });

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
    setRows(initialRows());
    setNotice('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (errorCount || !pending) return;
    const items = rows.filter((r, i) => !r.existingId && !validation[i].blank).map((r) => rowToItem(r, allowUnique));
    const updated = rows.filter((r) => r.existingId).map((r) => changedField(r, allowUnique)).filter(Boolean);
    onAdd(items.map((item, i) => toFieldDefinition(item, fields.length + i + 1)), updated);
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
          <div>
            <h2 className="exams-bulk-title">
              <ListPlus size={16} /> {title}
            </h2>
            <p className="exams-bulk-sub">
              Existing fields are listed first and can be edited in place. Add one row per new field; its key fills in from the label.
            </p>
          </div>
          <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="exams-bulk-toolbar">
          <span className="exams-bulk-tip">
            <strong>Paste from Excel / Sheets:</strong> click any cell and paste. Columns are Label · Key · Type · Options · Auto-fill · Width · Required{allowUnique ? ' · Unique' : ''}, and rows are added automatically.
          </span>
          <span className="exams-bulk-toolbar-actions">
            <button type="button" className="exams-text-add-btn" onClick={() => addRow()} disabled={rows.length >= maxRows}>
              <Plus size={14} /> Add row
            </button>
            <button type="button" className="exams-text-add-btn" onClick={downloadSample}>
              <Download size={14} /> Sample file
            </button>
            <button type="button" className="exams-text-add-btn" onClick={clearAll}>
              Clear all
            </button>
          </span>
        </div>
        {notice && (
          <div className="exams-bulk-notice" role="status">
            {notice}
          </div>
        )}

        <div className="exams-bulk-body" ref={bodyRef} onScroll={() => tip && setTip(null)}>
          <table className="exams-bulk-table" style={allowUnique ? { width: 'max(100%, 1640px)' } : undefined}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col />
              <col style={{ width: 180 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 210 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 90 }} />
              {allowUnique && <col style={{ width: 90 }} />}
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Label</th>
                <th>Key</th>
                <th>
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
                  </span>
                </th>
                <th>Validation</th>
                <th>Options</th>
                <th>Auto-fill</th>
                <th>Width</th>
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
                  <tr key={row.rid} data-rid={row.rid} className={Object.keys(validation[i].errors).length ? 'has-error' : ''}>
                    <td className="col-num" data-label="#">
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
                      </span>
                    </td>
                    <td data-label="Label">
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
                    <td data-label="Key">
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
                    <td data-label="Type">
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
                    <td data-label="Options">
                      <input
                        type="text"
                        data-col="options"
                        onPaste={(e) => handlePaste(e, row.rid, 'options')}
                        value={row.optionsText}
                        disabled={!needsOptions || row.lockOptions}
                        title={row.lockOptions ? 'Options come from a shared list; edit them in the single-field editor' : undefined}
                        placeholder={needsOptions ? 'A, B, C' : '—'}
                        className={cellError(i, 'optionsText') ? 'invalid' : ''}
                        onChange={(e) => update(row.rid, { optionsText: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, row, isLast)}
                        aria-label={`Row ${i + 1} options`}
                      />
                      {cellError(i, 'optionsText') && <span className="exams-bulk-err">{cellError(i, 'optionsText')}</span>}
                    </td>
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
                        disabled={Boolean(row.existingId)}
                        aria-label={`Remove row ${i + 1}`}
                        title={row.existingId ? 'Existing fields are deleted from Manage fields' : 'Remove row'}
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
            {rows.length} rows ·{' '}
            {errorCount
              ? `${errorCount} row${errorCount === 1 ? '' : 's'} need fixing`
              : pending
                ? [newCount && `${newCount} new`, updateCount && `${updateCount} to update`].filter(Boolean).join(' · ')
                : 'Edit a field or fill a new row'}
          </span>
          <div className="exams-bulk-footer-actions">
            <button type="button" className="exams-btn secondary compact" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="exams-btn primary compact" disabled={!pending || errorCount > 0 || saving}>
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
    </div>,
    document.body
  );
};
