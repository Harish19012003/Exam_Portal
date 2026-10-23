import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Trash2, Star, Paperclip, FileText } from 'lucide-react';
import { Icon as IconifyIcon } from '@iconify/react';
import type { AttachmentItem, ColumnConfig, DataRow, SubRowsConfig } from '../types';
import { isFieldColumn } from '../types';
import { resolveSubRowColumns } from '../utils/subRowDisplay';
import {
  DynamicDropdown,
  DynamicMultiSelectDropdown,
  DynamicDatePicker,
  DynamicDateTimePicker,
  DynamicTimePicker,
  normalizeMultiSelectValue,
  resolveDropdownOptions,
  toDateValue,
  toDatetimeLocalValue,
  toTimeValue,
} from '../../DynamicData/fields';

interface RecordEditSidebarProps {
  row: DataRow;
  columns: ColumnConfig[];
  isDarkMode: boolean;
  enableSubRows?: boolean;
  subRowsConfig?: SubRowsConfig;
  onSave: (updatedRow: DataRow) => void;
  onClose: () => void;
}

function FieldDropdownShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full h-[34px]">{children}</div>;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string' && value) return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// ─── Reusable field styling ─────────────────────────────────────────────────

function fieldStyles(isDarkMode: boolean) {
  return {
    input: isDarkMode
      ? 'bg-[#101f1b] border-gray-700 text-gray-100 placeholder-gray-600 focus:border-[#13C296] focus:ring-1 focus:ring-[#13C296]'
      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#13C296] focus:ring-1 focus:ring-[#13C296] focus:bg-white',
    chip: isDarkMode ? 'bg-[#182d27] border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-700',
    wrapper: isDarkMode ? 'bg-[#101f1b] border-gray-700' : 'bg-gray-50 border-gray-300',
  };
}

// ─── Chip list editor (multiselect / tags) ──────────────────────────────────

function ChipListField({
  value,
  onChange,
  isDarkMode,
  placeholder = 'Type and press Enter…',
}: {
  value: unknown;
  onChange: (v: string[]) => void;
  isDarkMode: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const list = toStringList(value);
  const s = fieldStyles(isDarkMode);

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...list, v]);
    setDraft('');
  };

  return (
    <div className={`w-full rounded-lg border px-2 py-1.5 transition-all ${s.wrapper}`}>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {list.map((tag, i) => (
          <span
            key={`${tag}_${i}`}
            className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border text-[11px] font-medium ${s.chip}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              className={`p-0.5 rounded-full ${isDarkMode ? 'hover:bg-white/10 text-gray-500 hover:text-red-400' : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {list.length === 0 && (
          <span className={`text-[11px] italic py-0.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>None yet</span>
        )}
      </div>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className={`w-full text-xs bg-transparent outline-none ${isDarkMode ? 'placeholder-gray-600 text-gray-200' : 'placeholder-gray-400 text-gray-800'}`}
      />
    </div>
  );
}

// ─── Read-only attachment list ──────────────────────────────────────────────

function AttachmentField({ value, isDarkMode }: { value: unknown; isDarkMode: boolean }) {
  const items = Array.isArray(value) ? (value as AttachmentItem[]) : [];
  if (items.length === 0) {
    return <span className={`text-xs italic ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>No attachments</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
            isDarkMode ? 'border-gray-700 bg-[#101f1b] text-gray-300 hover:bg-[#182d27]' : 'border-gray-300 bg-gray-50 hover:bg-white'
          }`}
        >
          {item.type === 'image' ? <Paperclip className="w-3 h-3 opacity-70" /> : <FileText className="w-3 h-3 opacity-70" />}
          <span className="truncate max-w-[130px]">{item.name}</span>
        </a>
      ))}
    </div>
  );
}

// ─── Toggle switch (boolean) ─────────────────────────────────────────────────

function ToggleField({ value, onChange, isDarkMode }: { value: unknown; onChange: (v: boolean) => void; isDarkMode: boolean }) {
  const checked = Boolean(value);
  return (
    <div className="flex items-center h-8 gap-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-[#0e1a17]' : 'focus-visible:ring-offset-white'} ${
          checked ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-xs font-medium">{checked ? 'Yes' : 'No'}</span>
    </div>
  );
}

// ─── Checkbox (square) ───────────────────────────────────────────────────────

function CheckboxField({ value, onChange, isDarkMode }: { value: unknown; onChange: (v: boolean) => void; isDarkMode: boolean }) {
  const checked = Boolean(value);
  return (
    <div className="flex items-center h-8 gap-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex items-center justify-center w-5 h-5 rounded border transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-[#0e1a17]' : 'focus-visible:ring-offset-white'} ${
          checked
            ? 'bg-[#13C296] border-[#13C296]'
            : isDarkMode
              ? 'bg-[#101f1b] border-gray-600'
              : 'bg-gray-50 border-gray-300'
        }`}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className="text-xs font-medium">{checked ? 'Checked' : 'Unchecked'}</span>
    </div>
  );
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function RatingField({ value, onChange, isDarkMode }: { value: unknown; onChange: (v: number) => void; isDarkMode: boolean }) {
  const rating = Number(value) || 0;
  return (
    <div className="flex items-center gap-1 h-8">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === rating ? 0 : star)}
          className={`p-0.5 rounded outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-1 ${isDarkMode ? 'focus-visible:ring-offset-[#0e1a17]' : 'focus-visible:ring-offset-white'}`}
        >
          <Star className={`w-4 h-4 transition-colors ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-700'}`} />
        </button>
      ))}
    </div>
  );
}

// ─── Progress slider ─────────────────────────────────────────────────────────

function ProgressField({ value, onChange, isDarkMode }: { value: unknown; onChange: (v: number) => void; isDarkMode: boolean }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const trackColor = isDarkMode ? '#2a3d38' : '#e5e7eb';
  return (
    <div className="flex items-center gap-2.5 h-8">
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={e => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, #13C296 ${pct}%, ${trackColor} ${pct}%)` }}
        className="flex-1 cursor-pointer appearance-none h-1.5 rounded-full outline-none
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#13C296] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#13C296] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
      />
      <span className={`text-[11px] font-bold w-9 text-right tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{pct}%</span>
    </div>
  );
}

// ─── Generic field control dispatcher (shared with RecordModal) ─────────────

export function FieldControl({
  col,
  value,
  onChange,
  row,
  isDarkMode,
}: {
  col: ColumnConfig;
  value: unknown;
  onChange: (v: unknown) => void;
  row: DataRow;
  isDarkMode: boolean;
}) {
  const s = fieldStyles(isDarkMode);
  const dataType = isFieldColumn(col) ? col.dataType : 'text';

  switch (dataType) {
    case 'status':
    case 'dropdown': {
      const field = isFieldColumn(col) ? col : null;
      return (
        <FieldDropdownShell>
          <DynamicDropdown
            value={String(value ?? '')}
            onChange={onChange}
            options={field ? resolveDropdownOptions(field, row) : []}
            isDarkMode={isDarkMode}
            variant="form"
            allowCustom={field?.allowCustom}
            required={field?.required}
          />
        </FieldDropdownShell>
      );
    }

    case 'multiselect': {
      const field = isFieldColumn(col) ? col : null;
      return (
        <FieldDropdownShell>
          <DynamicMultiSelectDropdown
            value={normalizeMultiSelectValue(value)}
            onChange={onChange}
            options={field ? resolveDropdownOptions(field, row) : []}
            isDarkMode={isDarkMode}
            variant="form"
            allowCustom={field?.allowCustom}
          />
        </FieldDropdownShell>
      );
    }

    case 'tags':
      return <ChipListField value={value} onChange={v => onChange(v)} isDarkMode={isDarkMode} />;

    case 'attachment':
      return <AttachmentField value={value} isDarkMode={isDarkMode} />;

    case 'boolean':
      return <ToggleField value={value} onChange={onChange} isDarkMode={isDarkMode} />;

    case 'checkbox':
      return <CheckboxField value={value} onChange={onChange} isDarkMode={isDarkMode} />;

    case 'rating':
      return <RatingField value={value} onChange={onChange} isDarkMode={isDarkMode} />;

    case 'progress':
      return <ProgressField value={value} onChange={onChange} isDarkMode={isDarkMode} />;

    case 'date':
      return (
        <FieldDropdownShell>
          <DynamicDatePicker
            value={toDateValue(value)}
            onChange={onChange}
            isDarkMode={isDarkMode}
            variant="form"
          />
        </FieldDropdownShell>
      );

    case 'datetime':
      return (
        <FieldDropdownShell>
          <DynamicDateTimePicker
            value={toDatetimeLocalValue(value)}
            onChange={onChange}
            isDarkMode={isDarkMode}
            variant="form"
          />
        </FieldDropdownShell>
      );

    case 'time':
      return (
        <FieldDropdownShell>
          <DynamicTimePicker
            value={toTimeValue(value)}
            onChange={onChange}
            isDarkMode={isDarkMode}
            variant="form"
          />
        </FieldDropdownShell>
      );

    case 'number':
    case 'currency':
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium outline-none transition-all ${s.input}`}
        />
      );

    case 'image':
      return (
        <div className="flex items-center gap-2">
          {value ? (
            <img src={String(value)} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-black/5" />
          ) : null}
          <input
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Image URL"
            className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium outline-none transition-all ${s.input}`}
          />
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={e => onChange(e.target.value)}
          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium outline-none transition-all ${s.input}`}
        />
      );
  }
}

export function RecordEditSidebar({
  row,
  columns,
  isDarkMode,
  enableSubRows = true,
  subRowsConfig,
  onSave,
  onClose,
}: RecordEditSidebarProps) {
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({ ...row.values });
  const [draftSubRows, setDraftSubRows] = useState<DataRow[]>(row.subRows ? [...row.subRows] : []);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [expandedSubRowId, setExpandedSubRowId] = useState<string | null>(null);

  const subRowColumns = resolveSubRowColumns(row, subRowsConfig);
  const fieldCols = columns.filter(c => isFieldColumn(c));

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsAnimatingIn(true);
    });
  }, []);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 250);
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setDraftValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubRowFieldChange = (subRowId: string, colKey: string, value: unknown) => {
    setDraftSubRows(prev =>
      prev.map(r =>
        r.rowId === subRowId
          ? { ...r, values: { ...r.values, [colKey]: value } }
          : r
      )
    );
  };

  const handleAddSubRow = () => {
    const newId = `sub_row_sidebar_${Date.now()}`;
    const newValues: Record<string, unknown> = {};
    subRowColumns.forEach(c => {
      newValues[c.key] = c.dataType === 'number' || c.dataType === 'currency' ? 0 : '';
    });
    newValues['task_id'] = `TASK-NEW-${draftSubRows.length + 1}`;
    newValues['task_name'] = 'New Sub-item Milestone';
    newValues['status'] = 'Active';

    const newSubRow: DataRow = {
      rowId: newId,
      values: newValues,
    };

    setDraftSubRows(prev => [...prev, newSubRow]);
    setExpandedSubRowId(newId);
  };

  const handleDeleteSubRow = (subRowId: string) => {
    setDraftSubRows(prev => prev.filter(r => r.rowId !== subRowId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...row,
      values: draftValues,
      subRows: draftSubRows,
    });
    handleClose();
  };

  const bgPanel = isDarkMode ? 'bg-[#0e1a17] text-gray-100 border-teal-500/30' : 'bg-white text-gray-800 border-gray-200';
  const headerBg = isDarkMode ? 'bg-[#132520] border-teal-500/20' : 'bg-teal-50/80 border-gray-200';
  const cardBg = isDarkMode ? 'bg-[#142520]/80 border-gray-800' : 'bg-gray-50 border-gray-200';

  const recordTitle = (draftValues['task_name'] || draftValues['first_name'] || draftValues['name'] || row.rowId) as string;

  const WIDE_TYPES = new Set(['multiselect', 'tags', 'attachment']);

  const recordContext: DataRow = { ...row, values: draftValues };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/15 transition-opacity duration-250 ${
          isAnimatingIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Slide-over Drawer Panel */}
      <div
        className={`relative z-10 w-[520px] max-w-full h-full shadow-2xl border-l flex flex-col transition-transform duration-250 ease-out ${bgPanel} ${
          isAnimatingIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#13C296]/20 text-[#13C296] border border-[#13C296]/30 flex-shrink-0">
              <IconifyIcon icon="hugeicons:sidebar-right" className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">{recordTitle}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">ID: {row.rowId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="record-sidebar-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {/* Main Record Fields Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-gray-200/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Record Information
              </h4>
              <span className="text-[11px] text-gray-400">{fieldCols.length} fields</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {fieldCols.map(col => {
                const val = draftValues[col.key];
                const isWide = (col.width && col.width > 220) || WIDE_TYPES.has(col.dataType);
                return (
                  <div key={col.key} className={isWide ? 'col-span-2' : 'col-span-1'}>
                    <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {col.label}
                    </label>
                    <FieldControl
                      col={col}
                      value={val}
                      onChange={v => handleFieldChange(col.key, v)}
                      row={recordContext}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-Rows Section (if enableSubRows is enabled) */}
          {enableSubRows && (
            <div className="space-y-4 pt-3 border-t border-gray-200/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Nested Sub-Items
                  </h4>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#13C296]/20 text-[#13C296]">
                    {draftSubRows.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#13C296] text-white hover:bg-[#0eb188] transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Sub-Item
                </button>
              </div>

              {draftSubRows.length === 0 ? (
                <div className={`p-4 text-center rounded-xl border border-dashed text-xs text-gray-400 ${cardBg}`}>
                  No sub-items exist for this record. Click "+ Add Sub-Item" to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {draftSubRows.map((subRow, idx) => {
                    const isExpanded = expandedSubRowId === subRow.rowId;
                    const subName = (subRow.values['task_name'] || subRow.values['name'] || `Sub-item #${idx + 1}`) as string;
                    const subStatus = String(subRow.values['status'] || 'Active');

                    return (
                      <div key={subRow.rowId} className={`rounded-xl border transition-all overflow-hidden ${cardBg}`}>
                        {/* Sub-item Header */}
                        <div
                          className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-teal-500/5 select-none"
                          onClick={() => setExpandedSubRowId(isExpanded ? null : subRow.rowId)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold truncate">{subName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-500">
                              {subStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubRow(subRow.rowId);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete sub-item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Sub-item Form Fields Drawer */}
                        {isExpanded && (
                          <div className="p-3.5 border-t border-gray-200/40 grid grid-cols-2 gap-2.5 bg-black/5 dark:bg-black/20">
                            {subRowColumns.slice(0, 8).map(scol => {
                              const sval = subRow.values[scol.key];
                              return (
                                <div key={scol.key} className="col-span-1">
                                  <label className={`block text-[11px] font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {scol.label}
                                  </label>
                                  <FieldControl
                                    col={scol}
                                    value={sval}
                                    onChange={v => handleSubRowFieldChange(subRow.rowId, scol.key, v)}
                                    row={subRow}
                                    isDarkMode={isDarkMode}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className={`px-5 py-3 border-t flex items-center justify-end gap-2 ${headerBg}`}>
          <button
            type="button"
            onClick={handleClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isDarkMode
                ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-sidebar-form"
            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#13C296] text-white hover:bg-[#0eb188] transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
