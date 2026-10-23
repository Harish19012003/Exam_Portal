import { useEffect, useMemo, useRef, useState } from 'react';
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

  const filterCol = useMemo(() => columnForFilter(column, rows), [column, rows]);
  const label = isFieldColumn(column) ? column.label : column.key;
  const summary = summarizeFilter(value);
  const active = Boolean(value);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
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
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Filter: {label}
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

/** Filter controls beside the chips eye — show/hide bar + clear applied filters. */
export function QuickFiltersVisibilityToggle({ isDarkMode }: { isDarkMode: boolean }) {
  const { enabled, fieldKeys, visible, values, toggleVisible, clearValues } = useQuickFiltersStore();
  if (!enabled || fieldKeys.length === 0) return null;

  const appliedCount = fieldKeys.reduce((n, key) => {
    const v = values[key];
    if (!v) return n;
    if (v.op === 'in' && Array.isArray(v.value) && v.value.length === 0) return n;
    if (v.op === 'contains' && !String(v.value ?? '').trim()) return n;
    if (v.op === 'equals' && (v.value === '' || v.value === null || v.value === undefined)) return n;
    return n + 1;
  }, 0);

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
          appliedCount > 0
            ? `${visible ? 'Hide' : 'Show'} filter bar (${appliedCount} applied)`
            : visible
              ? 'Hide filter bar'
              : 'Show filter bar'
        }
        title={visible ? 'Hide filter bar' : 'Show filter bar'}
      >
        <Filter className="w-4 h-4" strokeWidth={2} />
        {appliedCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#13C296] px-0.5 text-[8px] font-bold leading-none text-white">
            {appliedCount > 99 ? '99+' : appliedCount}
          </span>
        )}
      </button>

      {appliedCount > 0 && (
        <button
          type="button"
          onClick={clearValues}
          className={`rounded-lg px-1.5 py-1 text-[11.5px] font-semibold transition-colors ${
            isDarkMode
              ? 'text-gray-500 hover:bg-white/5 hover:text-rose-400'
              : 'text-gray-400 hover:bg-teal-50 hover:text-rose-600'
          }`}
          aria-label={`Clear ${appliedCount} filter${appliedCount === 1 ? '' : 's'}`}
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

  const hasActive = Object.keys(values).length > 0;

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
      {hasActive && (
        <button
          type="button"
          onClick={clearValues}
          className={`inline-flex h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors ${
            isDarkMode
              ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
