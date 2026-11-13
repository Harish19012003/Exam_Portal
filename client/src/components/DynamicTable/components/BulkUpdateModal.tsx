import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Layers, Search, Type, Hash, ToggleLeft, List, Check, CheckSquare, Filter, Table2, Tags, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ColumnConfig, FieldColumn } from '../types';
import { DYNAMIC_DROPDOWN_PORTAL_CLASS, DynamicDropdown } from '../../DynamicData/fields';
import { BulkLookupPicker, type BulkLookupPickMeta } from './BulkLookupPicker';
import { BulkAssigneePicker, type BulkAssigneePickMeta } from './BulkAssigneePicker';

export type BulkUpdateScope = 'selected' | 'filtered' | 'all';
/** Which editable fields to show in the Mass Edit list. */
export type BulkFieldKind = 'all' | 'normal' | 'tag';

const isTagField = (col: FieldColumn) => Boolean(col.userTags);

interface BulkUpdateModalProps {
  columns: ColumnConfig[];
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  /** When true, Filtered/All only cover currently loaded rows (legacy). */
  serverPaginated?: boolean;
  /** When true, Filtered/All hit the database (not just the loaded page). */
  dbScoped?: boolean;
  onApply: (
    updates: Record<string, unknown>,
    lookupPicks?: BulkLookupPickMeta[],
    scope?: BulkUpdateScope,
    assigneePicks?: BulkAssigneePickMeta[],
  ) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function BulkUpdateModal({
  columns,
  selectedCount,
  filteredCount,
  totalCount,
  serverPaginated = false,
  dbScoped = false,
  onApply,
  onClose,
  isDarkMode,
}: BulkUpdateModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const editableColumns = columns.filter(c => c.dataType !== 'composite' && c.editable !== false) as FieldColumn[];

  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Record<string, unknown>>({});
  const [lookupPicks, setLookupPicks] = useState<Record<string, BulkLookupPickMeta>>({});
  const [assigneePicks, setAssigneePicks] = useState<Record<string, BulkAssigneePickMeta>>({});
  const [scope, setScope] = useState<BulkUpdateScope>(() => (selectedCount > 0 ? 'selected' : 'filtered'));
  const fieldKindCounts = useMemo(() => {
    let tag = 0;
    let normal = 0;
    editableColumns.forEach((c) => {
      if (isTagField(c)) tag += 1;
      else normal += 1;
    });
    return { all: editableColumns.length, normal, tag };
  }, [editableColumns]);

  // Prefer Tag fields when the table has any; otherwise All.
  const [fieldKind, setFieldKind] = useState<BulkFieldKind>(() =>
    editableColumns.some(isTagField) ? 'tag' : 'all',
  );

  useEffect(() => {
    if (fieldKind === 'tag' && fieldKindCounts.tag === 0) setFieldKind('all');
  }, [fieldKind, fieldKindCounts.tag]);

  const scopeCount =
    scope === 'selected' ? selectedCount : scope === 'filtered' ? filteredCount : totalCount;

  const filteredColumns = useMemo(() => {
    let list = editableColumns;
    if (fieldKind === 'tag') list = list.filter(isTagField);
    else if (fieldKind === 'normal') list = list.filter((c) => !isTagField(c));
    return list;
  }, [editableColumns, fieldKind]);

  const fieldKindOptions: {
    id: BulkFieldKind;
    label: string;
    icon: LucideIcon;
    count: number;
    description: string;
  }[] = [
    {
      id: 'all',
      label: 'All',
      icon: LayoutGrid,
      count: fieldKindCounts.all,
      description: 'Every editable field in this table.',
    },
    {
      id: 'normal',
      label: 'Normal',
      icon: Type,
      count: fieldKindCounts.normal,
      description: 'Text, numbers, lookups, and other non–tag fields.',
    },
    {
      id: 'tag',
      label: 'Tag fields',
      icon: Tags,
      count: fieldKindCounts.tag,
      description: 'People fields filtered by user tags (ZM, VC, …).',
    },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest?.(`.${DYNAMIC_DROPDOWN_PORTAL_CLASS}`)) return;
      if (modalRef.current && !modalRef.current.contains(target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (scope === 'selected' && selectedCount === 0) {
      setScope(filteredCount > 0 ? 'filtered' : 'all');
    }
  }, [scope, selectedCount, filteredCount]);

  const handleToggleField = (colKey: string, isEnabled: boolean) => {
    setEnabledFields(prev => {
      const next = new Set(prev);
      if (isEnabled) {
        next.add(colKey);
        setUpdates(u => {
          if (colKey in u) return u;
          const col = editableColumns.find(c => c.key === colKey);
          let defaultVal: unknown = '';
          if (col) {
            if (col.dataType === 'boolean') defaultVal = false;
            else if (col.lookup) defaultVal = '';
            else if (col.userTags) defaultVal = col.userTags.multiple === false ? '' : [];
            else if (col.dataType === 'multiselect') defaultVal = [];
            else if (col.dataType === 'status' || col.dataType === 'dropdown') defaultVal = col.options?.[0] || '';
          }
          return { ...u, [colKey]: defaultVal };
        });
      } else {
        next.delete(colKey);
      }
      return next;
    });
  };

  const handleValueChange = (colKey: string, val: unknown) => {
    setUpdates(prev => ({ ...prev, [colKey]: val }));
  };

  const handleLookupPatch = (patch: Record<string, unknown>, meta: BulkLookupPickMeta | null) => {
    setUpdates((prev) => ({ ...prev, ...patch }));
    setEnabledFields((prev) => {
      const next = new Set(prev);
      Object.keys(patch).forEach((k) => next.add(k));
      return next;
    });
    if (meta?.columnKey) {
      setLookupPicks((prev) => ({ ...prev, [meta.columnKey]: meta }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledFields.size === 0 || scopeCount === 0) return;

    const finalUpdates: Record<string, unknown> = {};
    enabledFields.forEach(key => {
      finalUpdates[key] = updates[key];
    });
    const picks = Object.values(lookupPicks).filter((p) => enabledFields.has(p.columnKey));
    const people = Object.values(assigneePicks).filter((p) => enabledFields.has(p.columnKey));
    onApply(finalUpdates, picks, scope, people);
  };

  const getDataTypeIcon = (col: FieldColumn) => {
    if (col.lookup || col.userTags) return <List className="w-3.5 h-3.5" />;
    switch (col.dataType) {
      case 'number':
      case 'currency': return <Hash className="w-3.5 h-3.5" />;
      case 'boolean': return <ToggleLeft className="w-3.5 h-3.5" />;
      case 'dropdown':
      case 'status':
      case 'multiselect': return <List className="w-3.5 h-3.5" />;
      default: return <Type className="w-3.5 h-3.5" />;
    }
  };

  const renderInput = (col: FieldColumn) => {
    const value = updates[col.key] ?? '';
    const inputCls = `w-full px-3 py-2 text-[13px] font-medium outline-none rounded-lg border focus:ring-2 focus:ring-[#13C296]/20 transition-all shadow-sm
      ${isDarkMode
        ? 'bg-gray-900 border-gray-700 text-gray-100 focus:border-[#13C296]'
        : 'bg-white border-gray-200 text-gray-900 focus:border-[#13C296]'}`;

    if (col.lookup) {
      return (
        <BulkLookupPicker
          column={col}
          value={String(value ?? '')}
          isDarkMode={isDarkMode}
          onPick={(patch, meta) => handleLookupPatch(patch, meta)}
        />
      );
    }

    if (col.userTags) {
      return (
        <BulkAssigneePicker
          column={col}
          value={value}
          isDarkMode={isDarkMode}
          onPick={(ids, meta) => {
            handleValueChange(col.key, col.userTags?.multiple === false ? ids[0] || '' : ids);
            setAssigneePicks((prev) => ({ ...prev, [meta.columnKey]: meta }));
          }}
        />
      );
    }

    switch (col.dataType) {
      case 'boolean':
        return (
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={Boolean(value)}
                  onChange={e => handleValueChange(col.key, e.target.checked)}
                />
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
              <span className={`text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {value ? 'True / Enabled' : 'False / Disabled'}
              </span>
            </label>
          </div>
        );

      case 'dropdown':
      case 'status':
        return (
          <DynamicDropdown
            variant="form"
            value={String(value)}
            options={col.options ?? []}
            required
            isDarkMode={isDarkMode}
            onChange={v => handleValueChange(col.key, v)}
          />
        );

      case 'multiselect': {
        const selected = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
        const options = col.options ?? [];
        return (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {options.length === 0 ? (
              <p className={`text-[12px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No options configured for this field.
              </p>
            ) : (
              options.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const next = on ? selected.filter((x) => x !== opt) : [...selected, opt];
                      handleValueChange(col.key, next);
                    }}
                    className={`min-h-[36px] px-2.5 rounded-lg text-[12px] font-semibold border transition-colors
                      ${on
                        ? 'bg-[#13C296] border-[#13C296] text-white'
                        : isDarkMode
                          ? 'border-gray-600 text-gray-300 hover:bg-white/5'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {opt}
                  </button>
                );
              })
            )}
          </div>
        );
      }

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            value={String(value)}
            onChange={e => handleValueChange(col.key, Number(e.target.value))}
            className={inputCls}
            placeholder={`Enter new ${col.label.toLowerCase()}...`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={e => handleValueChange(col.key, e.target.value)}
            className={inputCls}
            placeholder={`Enter new ${col.label.toLowerCase()}...`}
          />
        );
    }
  };

  const scopeOptions: {
    id: BulkUpdateScope;
    label: string;
    icon: LucideIcon;
    count: number;
    disabled: boolean;
    description: string;
    hint?: string;
  }[] = [
    {
      id: 'selected',
      label: 'Selected',
      icon: CheckSquare,
      count: selectedCount,
      disabled: selectedCount === 0,
      description:
        selectedCount === 0
          ? 'Tick rows in the table to use this option.'
          : 'Only rows with a checked checkbox.',
    },
    {
      id: 'filtered',
      label: 'Filtered',
      icon: Filter,
      count: filteredCount,
      disabled: filteredCount === 0,
      description: dbScoped
        ? 'Every database row that matches the current search and column filters.'
        : 'Every loaded row that matches your current search and filters.',
      hint:
        dbScoped
          ? 'Applies across the full table in the database'
          : serverPaginated
            ? 'Loaded rows matching filters'
            : undefined,
    },
    {
      id: 'all',
      label: 'All rows',
      icon: Table2,
      count: totalCount,
      disabled: totalCount === 0,
      description: dbScoped
        ? 'Every record in this table in the database (ignores filters).'
        : 'Every loaded row in this table, ignoring filters.',
      hint:
        dbScoped
          ? 'Full table in the database'
          : serverPaginated
            ? 'Loaded rows only'
            : undefined,
    },
  ];

  const activeOption = scopeOptions.find((o) => o.id === scope);
  const activeHint = activeOption?.hint;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div
        ref={modalRef}
        className={`w-full max-w-[540px] sm:max-w-[680px] max-h-[90vh] max-h-[85dvh] flex flex-col rounded-2xl shadow-2xl border animate-[slideUp_0.2s_ease-out] overflow-hidden
          ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}
      >
        <div className={`flex flex-col px-4 sm:px-5 py-4 border-b flex-shrink-0 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border flex-shrink-0 ${isDarkMode ? 'bg-indigo-900/40 border-indigo-800/50' : 'bg-indigo-50 border-indigo-100'}`}>
                <Layers className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <div className="min-w-0">
                <h3 className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Mass Edit Fields</h3>
                <p className={`text-[12px] font-medium mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Choose which rows get these field updates
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-xl transition-colors flex items-center justify-center ${isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* One toolbar, edges apart: FIELDS to list on the left (only filters the list below), ROWS to update on the right. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex w-full sm:w-auto items-center gap-2 min-w-0">
              <div
                role="radiogroup"
                aria-label="Field type"
                className={`grid flex-1 sm:flex-none grid-cols-3 sm:inline-flex sm:items-center gap-0.5 p-0.5 rounded-xl border ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'}`}
              >
                {fieldKindOptions.map((opt) => {
                  const active = fieldKind === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${opt.label}: ${opt.count} fields. ${opt.description}`}
                      title={opt.description}
                      onClick={() => setFieldKind(opt.id)}
                      className={`flex flex-row items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-1.5 sm:px-2.5 rounded-[10px] text-center transition-all
                        ${active
                          ? (isDarkMode ? 'bg-gray-900 text-gray-100 shadow-sm ring-1 ring-gray-600' : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200')
                          : (isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60')
                        }`}
                    >
                      <span className="text-[12px] font-bold leading-tight whitespace-nowrap">{opt.id === 'tag' ? 'Tags' : opt.label}</span>
                      <span className={`text-[11px] font-semibold leading-none tabular-nums ${active ? 'opacity-70' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2 min-w-0">
              <div
                role="radiogroup"
                aria-label="Rows to update"
                className={`grid flex-1 sm:flex-none grid-cols-3 sm:inline-flex sm:items-center gap-0.5 p-0.5 rounded-xl border ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'}`}
              >
                {scopeOptions.map((opt) => {
                  const active = scope === opt.id;
                  const OptionIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${opt.label}: ${opt.count.toLocaleString()} ${opt.count === 1 ? 'row' : 'rows'}. ${opt.description}`}
                      disabled={opt.disabled}
                      onClick={() => setScope(opt.id)}
                      title={`${opt.label} — ${opt.description}`}
                      className={`flex flex-row items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-1.5 sm:px-2.5 rounded-[10px] text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed
                        ${active
                          ? (isDarkMode ? 'bg-gray-900 text-[#13C296] shadow-sm ring-1 ring-[#13C296]/40' : 'bg-white text-[#0a8066] shadow-sm ring-1 ring-[#13C296]/25')
                          : (isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60')
                        }`}
                    >
                      <span className="flex items-center justify-center gap-1.5 min-w-0">
                        <OptionIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                        <span className="sr-only">{opt.label}</span>
                      </span>
                      <span className={`text-[11px] font-semibold leading-none tabular-nums ${active ? 'opacity-90' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {opt.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {activeHint && (
            <p className={`text-[11px] font-medium mt-2 px-1 ${isDarkMode ? 'text-amber-400/90' : 'text-amber-700'}`} aria-live="polite">
              {activeHint}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className={`flex-1 overflow-y-auto p-2 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {filteredColumns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Search className={`w-8 h-8 mb-3 ${isDarkMode ? 'text-gray-700' : 'text-gray-300'}`} />
                <p className={`text-[13px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {fieldKind === 'tag'
                    ? 'No tag / people fields on this table.'
                    : fieldKind === 'normal'
                      ? 'No normal fields on this table.'
                      : 'No editable fields.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredColumns.map(col => {
                  const isEnabled = enabledFields.has(col.key);
                  return (
                    <div
                      key={col.key}
                      className={`flex flex-col rounded-xl border transition-all duration-200 overflow-hidden group
                        ${isEnabled
                          ? (isDarkMode ? 'bg-gray-800/80 border-[#13C296]/50 shadow-[0_4px_12px_rgba(19,194,150,0.1)]' : 'bg-white border-[#13C296] shadow-[0_4px_12px_rgba(19,194,150,0.08)] ring-1 ring-[#13C296]/20')
                          : (isDarkMode ? 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/60' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')
                        }`}
                    >
                      <div
                        className="flex items-center gap-3.5 p-3.5 cursor-pointer select-none min-h-[44px]"
                        onClick={() => handleToggleField(col.key, !isEnabled)}
                      >
                        <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 shadow-inner ${isEnabled ? 'bg-[#13C296]' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300 group-hover:bg-gray-400'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </div>

                        <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${isEnabled ? (isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700') : (isDarkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-200')}`}>
                          {getDataTypeIcon(col)}
                        </div>

                        <span className={`text-[13px] font-bold tracking-wide flex-1 transition-colors ${isEnabled ? (isDarkMode ? 'text-gray-200' : 'text-gray-900') : (isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-600 group-hover:text-gray-900')}`}>
                          {col.label}
                        </span>
                      </div>

                      {isEnabled && (
                        <div className={`px-4 pb-4 pt-1 animate-[slideDown_0.2s_ease-out] ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/80 rounded-b-xl'}`}>
                          <div className={`h-px w-full mb-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
                          <div onClick={e => e.stopPropagation()}>
                            {renderInput(col)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 border-t flex-shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]
            ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <span className={`text-[12px] font-medium px-2 py-1 rounded-md ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
              <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>{enabledFields.size}</strong> field{enabledFields.size !== 1 ? 's' : ''} ·{' '}
              <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>{scopeCount.toLocaleString()}</strong> rows
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 sm:flex-none min-h-[44px] sm:min-h-[34px] px-4 py-2 sm:py-1.5 rounded-xl text-[13px] font-bold transition-colors border
                  ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enabledFields.size === 0 || scopeCount === 0}
                className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[34px] flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl text-[13px] font-bold transition-all bg-[#13C296] hover:bg-[#0f9f7a] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#13C296]/20"
              >
                <Check className="w-4 h-4" />
                Apply to {scopeCount.toLocaleString()} {scopeCount === 1 ? 'row' : 'rows'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
