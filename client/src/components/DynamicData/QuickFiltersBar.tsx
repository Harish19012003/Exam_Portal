import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import type { ColumnConfig, DataRow, FilterValue } from '../DynamicTable/types';
import { isFieldColumn } from '../DynamicTable/types';
import { FilterUI } from '../DynamicTable/filters';
import { useQuickFiltersStore } from './quickFiltersStore';

function uniqueOptions(rows: DataRow[], fieldKey: string): string[] {
  const set = new Set<string>();
  rows.forEach(row => {
    const raw = row.values[fieldKey];
    if (raw == null || raw === '') return;
    if (Array.isArray(raw)) {
      raw.forEach(v => {
        const s = String(v).trim();
        if (s) set.add(s);
      });
    } else {
      set.add(String(raw));
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Ensure set-type columns have options (from schema or distinct row values). */
function columnForFilter(col: ColumnConfig, rows: DataRow[]): ColumnConfig {
  if (!isFieldColumn(col)) return col;
  const dt = col.dataType;
  if (dt !== 'status' && dt !== 'dropdown' && dt !== 'multiselect' && dt !== 'select' && dt !== 'tags') {
    return col;
  }
  if (col.options && col.options.length > 0) return col;
  return { ...col, options: uniqueOptions(rows, col.key) };
}

function summarizeFilter(filter: FilterValue | undefined): string | null {
  if (!filter) return null;
  switch (filter.op) {
    case 'contains':
    case 'equals':
    case 'startsWith':
      return String(filter.value ?? '');
    case 'in':
      return (filter.value as string[]).join(', ');
    case 'between': {
      const a = filter.value != null ? String(filter.value) : '…';
      const b = filter.value2 != null ? String(filter.value2) : '…';
      return `${a} – ${b}`;
    }
    case 'gte':
      return `≥ ${filter.value}`;
    case 'lte':
      return `≤ ${filter.value}`;
    default:
      return 'Filtered';
  }
}

/** True when a stored filter actually constrains rows (not empty / no-op). */
function isQuickFilterApplied(filter: FilterValue | undefined): boolean {
  if (!filter) return false;
  if (filter.op === 'in' && Array.isArray(filter.value) && filter.value.length === 0) return false;
  if (filter.op === 'contains' && !String(filter.value ?? '').trim()) return false;
  if (filter.op === 'equals' && (filter.value === '' || filter.value === null || filter.value === undefined)) {
    return false;
  }
  if (filter.op === 'startsWith' && !String(filter.value ?? '').trim()) return false;
  if (filter.op === 'between' && filter.value == null && filter.value2 == null) return false;
  return true;
}

function countAppliedQuickFilters(
  fieldKeys: string[],
  values: Record<string, FilterValue>,
): number {
  return fieldKeys.reduce((n, key) => (isQuickFilterApplied(values[key]) ? n + 1 : n), 0);
}

function isSetFilterColumn(column: ColumnConfig): boolean {
  if (!isFieldColumn(column)) return false;
  const dt = column.dataType;
  return dt === 'status' || dt === 'dropdown' || dt === 'multiselect' || dt === 'select' || dt === 'tags';
}

function QuickFilterField({
  column,
  allColumns,
  rows,
  value,
  isDarkMode,
  onChange,
}: {
  column: ColumnConfig;
  allColumns: ColumnConfig[];
  rows: DataRow[];
  value: FilterValue | undefined;
  isDarkMode: boolean;
  onChange: (next: FilterValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [draftSelection, setDraftSelection] = useState<{ selected: number; total: number } | null>(null);

  const filterCol = useMemo(() => columnForFilter(column, rows), [column, rows]);
  const label = isFieldColumn(column) ? column.label : column.key;
  const summary = summarizeFilter(value);
  const active = Boolean(value);
  const isSet = isSetFilterColumn(filterCol);
  const optionTotal = isFieldColumn(filterCol) ? (filterCol.options?.length ?? 0) : 0;
  const appliedSelected =
    value?.op === 'in' && Array.isArray(value.value) ? value.value.length : 0;
  const selectedCount = open && draftSelection ? draftSelection.selected : appliedSelected;
  const totalCount = open && draftSelection ? draftSelection.total : optionTotal;

  const handleDraftSelection = useCallback((selected: number, total: number) => {
    setDraftSelection(prev =>
      prev && prev.selected === selected && prev.total === total
        ? prev
        : { selected, total },
    );
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      setDraftSelection(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      left: Math.min(rect.left, window.innerWidth - 240),
      top: rect.bottom + 4,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative flex min-w-0 flex-col">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={summary ? `${label}: ${summary}` : label}
        className={`flex h-[32px] min-w-[140px] max-w-[200px] items-center gap-1.5 rounded-lg border px-2 text-left text-[12.5px] transition-colors ${
          open
            ? 'border-[#13C296] ring-2 ring-[#13C296]/20'
            : active
              ? isDarkMode
                ? 'border-[#13C296]/50 bg-[#13C296]/10 text-gray-100'
                : 'border-[#13C296]/40 bg-[#13C296]/5 text-gray-800'
              : isDarkMode
                ? 'border-gray-700 bg-[#0e1a17] text-gray-300 hover:border-gray-600'
                : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${summary ? '' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {summary || label}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9998, minWidth: 220 }}
          className={`flex flex-col gap-2 rounded-xl border p-3 shadow-xl ${
            isDarkMode
              ? 'border-gray-700 bg-gray-900 shadow-black/40'
              : 'border-gray-200 bg-white shadow-gray-200'
          }`}
          role="dialog"
          aria-label={`Filter ${label}`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Filter: {label}
              {isSet && totalCount > 0 ? (
                <span className={`ml-1.5 font-semibold normal-case tracking-normal ${
                  selectedCount > 0
                    ? 'text-[#13C296]'
                    : isDarkMode
                      ? 'text-gray-500'
                      : 'text-gray-400'
                }`}>
                  ({selectedCount}/{totalCount})
                </span>
              ) : null}
            </span>
            {active && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#13C296]" aria-label="Filter active" />
            )}
          </div>
          <FilterUI
            column={filterCol}
            allColumns={allColumns}
            currentFilter={value}
            onFilterChange={next => onChange(next)}
            onClose={() => setOpen(false)}
            isDarkMode={isDarkMode}
            onDraftSelectionChange={isSet ? handleDraftSelection : undefined}
          />
        </div>
      )}
    </div>
  );
}

export interface QuickFiltersBarProps {
  columns: ColumnConfig[];
  rows: DataRow[];
  isDarkMode: boolean;
}

/** Toolbar funnel — show/hide bar; Clear when quick or header filters are applied. */
export function QuickFiltersVisibilityToggle({
  isDarkMode,
  hasActiveFilters = false,
  activeFilterCount = 0,
  onClearAll,
}: {
  isDarkMode: boolean;
  /** True when column-header filters, search, or sort are active. */
  hasActiveFilters?: boolean;
  /** Combined active filter/sort/search count for the badge. */
  activeFilterCount?: number;
  /** Clears header filters + quick filters + sort/search. */
  onClearAll?: () => void;
}) {
  const { enabled, fieldKeys, visible, values, toggleVisible, clearValues } = useQuickFiltersStore();
  if (!enabled || fieldKeys.length === 0) return null;

  const appliedCount = countAppliedQuickFilters(fieldKeys, values);
  const badgeCount = Math.max(appliedCount, activeFilterCount);
  const showClear = appliedCount > 0 || hasActiveFilters;
  const handleClear = () => {
    if (onClearAll) onClearAll();
    else clearValues();
  };

  // Match SummaryChipsEyeToggle icon button styling.
  const iconBtnCls = isDarkMode
    ? 'text-gray-500 hover:text-[#13C296] hover:bg-white/5'
    : 'text-gray-400 hover:text-[#13C296] hover:bg-teal-50';

  return (
    <div className="flex flex-shrink-0 items-center gap-0.5" role="group" aria-label="Quick filters">
      <button
        type="button"
        onClick={toggleVisible}
        className={`relative p-1.5 rounded-lg transition-colors ${iconBtnCls}`}
        aria-pressed={visible}
        aria-label={
          showClear
            ? `${visible ? 'Hide' : 'Show'} filter bar (filters applied)`
            : visible
              ? 'Hide filter bar'
              : 'Show filter bar'
        }
        title={visible ? 'Hide filter bar' : 'Show filter bar'}
      >
        <Filter className="w-4 h-4" strokeWidth={2} />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#13C296] px-0.5 text-[8px] font-bold leading-none text-white">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {showClear && (
        <button
          type="button"
          onClick={handleClear}
          className={`rounded-lg px-1.5 py-1 text-[11.5px] font-semibold transition-colors ${
            isDarkMode
              ? 'text-rose-400 hover:bg-white/5 hover:text-rose-300'
              : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
          }`}
          aria-label="Clear filters"
          title="Clear filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function QuickFiltersBar({ columns, rows, isDarkMode }: QuickFiltersBarProps) {
  const { enabled, fieldKeys, visible, values, setValue, clearValues } = useQuickFiltersStore();

  const fields = useMemo(() => {
    return fieldKeys
      .map(key => columns.find(c => c.key === key))
      .filter((c): c is ColumnConfig => Boolean(c));
  }, [fieldKeys, columns]);

  const appliedCount = countAppliedQuickFilters(fieldKeys, values);

  if (!enabled || !visible || fields.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
        isDarkMode ? 'border-gray-800 bg-[#0e1a17]/80' : 'border-gray-200 bg-white'
      }`}
    >
      {fields.map(col => (
        <QuickFilterField
          key={col.key}
          column={col}
          allColumns={columns}
          rows={rows}
          value={values[col.key]}
          isDarkMode={isDarkMode}
          onChange={next => setValue(col.key, next)}
        />
      ))}
      <button
        type="button"
        onClick={clearValues}
        disabled={appliedCount === 0}
        className={`ml-auto inline-flex h-[32px] items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold transition-colors disabled:pointer-events-none ${
          appliedCount > 0
            ? isDarkMode
              ? 'text-rose-400 hover:bg-white/5 hover:text-rose-300'
              : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
            : isDarkMode
              ? 'text-gray-600'
              : 'text-gray-300'
        }`}
        aria-label={
          appliedCount > 0
            ? `Clear ${appliedCount} filter${appliedCount === 1 ? '' : 's'}`
            : 'No filters to clear'
        }
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}
