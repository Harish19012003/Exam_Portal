// Shared search / filter / sort pipeline used by every Dynamic* view.
// Pure functions here so Table/List/Card/Kanban/Tree/Calendar all agree on
// the same semantics; view-specific concerns (pagination UI, aggregations,
// virtualization) stay in the view that needs them.
import { useMemo } from 'react';
import { isCompositeColumn } from '../DynamicTable/types';
import type { ColumnConfig, DataRow, FilterValue, NumberFilterValue, SortConfig } from '../DynamicTable/types';

// ─── Client-side filter ────────────────────────────────────────────────────────

export function matchFilter(rawValue: unknown, filter: FilterValue): boolean {
  const strVal = String(rawValue ?? '').toLowerCase();
  switch (filter.op) {
    case 'contains': return strVal.includes(String(filter.value).toLowerCase());
    case 'equals': return strVal === String(filter.value).toLowerCase();
    case 'startsWith': return strVal.startsWith(String(filter.value).toLowerCase());
    case 'in': return (filter.value as string[]).map(s => s.toLowerCase()).includes(strVal);
    case 'between': {
      const n = Number(rawValue);
      const { value: v1, value2: v2 } = filter as NumberFilterValue;
      if (isNaN(n)) return false;
      if (v1 !== null && v1 !== undefined && n < v1) return false;
      if (v2 !== null && v2 !== undefined && n > v2) return false;
      return true;
    }
    case 'gte': return Number(rawValue) >= Number(filter.value);
    case 'lte': return Number(rawValue) <= Number(filter.value);
    default: return true;
  }
}

export function applyFilters(
  rows: DataRow[],
  filters: Record<string, FilterValue>,
  columns: ColumnConfig[]
): DataRow[] {
  const entries = Object.entries(filters);
  if (!entries.length) return rows;

  return rows.filter(row =>
    entries.every(([colKey, filter]) => {
      const col = columns.find(c => c.key === colKey);
      if (!col) return true;
      return matchFilter(row.values[colKey], filter);
    })
  );
}

// ─── Global search ─────────────────────────────────────────────────────────────

export function applySearch(
  rows: DataRow[],
  search: string,
  columns: ColumnConfig[],
  columnVisibility: Record<string, boolean> = {}
): DataRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;

  const visibleCols = columns.filter(c => columnVisibility[c.key] !== false);

  return rows.filter(row =>
    visibleCols.some(col => {
      if (isCompositeColumn(col)) {
        return col.composedOf.some(({ field }) =>
          String(row.values[field] ?? '').toLowerCase().includes(q)
        );
      }
      return String(row.values[col.key] ?? '').toLowerCase().includes(q);
    })
  );
}

// ─── Sort ──────────────────────────────────────────────────────────────────────

export function applySort(rows: DataRow[], sort: SortConfig[], columns: ColumnConfig[]): DataRow[] {
  if (!sort.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { key, direction } of sort) {
      let av = a.values[key];
      let bv = b.values[key];

      const col = columns.find(c => c.key === key);
      if (col && isCompositeColumn(col)) {
        const primaryPart = col.composedOf.find(p => p.role === 'primary');
        if (primaryPart) {
          av = a.values[primaryPart.field];
          bv = b.values[primaryPart.field];
        }
      }

      if (av == null && bv == null) continue;
      if (av == null) return direction === 'asc' ? -1 : 1;
      if (bv == null) return direction === 'asc' ? 1 : -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export function paginateRows(rows: DataRow[], page: number, pageSize: number): DataRow[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

// ─── Combined hook (search + filter + sort, no pagination) ────────────────────
// List/Card/Kanban/Tree/Calendar reach for this directly; Table layers its own
// pagination + aggregations on top (see DynamicTable/hooks/useProcessedRows).

export function useFilteredRows(
  rows: DataRow[],
  columns: ColumnConfig[],
  options: {
    filters?: Record<string, FilterValue>;
    sort?: SortConfig[];
    search?: string;
    columnVisibility?: Record<string, boolean>;
  } = {}
): DataRow[] {
  const { filters = {}, sort = [], search = '', columnVisibility = {} } = options;

  return useMemo(() => {
    let result = applySearch(rows, search, columns, columnVisibility);
    result = applyFilters(result, filters, columns);
    result = applySort(result, sort, columns);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, filters, sort, search, columnVisibility]);
}
