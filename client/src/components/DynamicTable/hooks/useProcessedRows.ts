import { useMemo } from 'react';
import { isFieldColumn } from '../types';
import type { ColumnConfig, DataRow, FilterValue, SortConfig } from '../types';
import { applyFilters, applySearch, applySort } from '../../DynamicData/dataProcessing';
import { computeAggregationValue } from '../utils/computeAggregation';

// Search/filter/sort now live in DynamicData (shared with List/Card/Kanban/...).
// This hook layers table-only concerns on top: pagination + aggregations.

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useProcessedRows(
  rows: DataRow[],
  columns: ColumnConfig[],
  filters: Record<string, FilterValue>,
  sort: SortConfig[],
  search: string,
  page: number,
  pageSize: number,
  columnVisibility: Record<string, boolean>,
  /** When set, rows are already one server page — do not slice again. */
  serverTotalCount?: number | null,
  /**
   * When true (server-driven search), skip local applySearch — the parent already
   * filtered the full dataset / current page from the API.
   */
  serverSearchActive?: boolean,
) {
  const serverSide = typeof serverTotalCount === 'number' && serverTotalCount >= 0;

  const filteredRows = useMemo(() => {
    let result = rows;
    // Client-paginated tables: search all loaded rows, then page.
    // Server-paginated: parent searches the full DB — do not re-filter the page slice.
    if (!serverSearchActive) {
      result = applySearch(result, search, columns, columnVisibility);
    }
    result = applyFilters(result, filters, columns);
    result = applySort(result, sort, columns);
    return result;
  }, [rows, columns, filters, sort, search, columnVisibility, serverSearchActive]);

  const paginatedRows = useMemo(() => {
    if (serverSide) return filteredRows;
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize, serverSide]);

  const totalCount = serverSide ? serverTotalCount : rows.length;
  const filteredCount = serverSide ? serverTotalCount : filteredRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil((serverSide ? serverTotalCount : filteredRows.length) / pageSize) || 1,
  );

  const aggregations = useMemo(() => {
    const aggs: Record<string, number> = {};
    for (const col of columns) {
      if (!isFieldColumn(col) || !col.aggregation) continue;
      aggs[col.key] = computeAggregationValue(col, filteredRows, col.aggregation, columns);
    }
    return aggs;
  }, [filteredRows, columns]);

  return { filteredRows, paginatedRows, filteredCount, totalCount, totalPages, aggregations };
}
