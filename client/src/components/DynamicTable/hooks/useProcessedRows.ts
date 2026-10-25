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
  columnVisibility: Record<string, boolean>
) {
  const filteredRows = useMemo(() => {
    let result = applySearch(rows, search, columns, columnVisibility);
    result = applyFilters(result, filters, columns);
    result = applySort(result, sort, columns);
    return result;
  }, [rows, columns, filters, sort, search, columnVisibility]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const aggregations = useMemo(() => {
    const aggs: Record<string, number> = {};
    for (const col of columns) {
      if (!isFieldColumn(col) || !col.aggregation) continue;
      aggs[col.key] = computeAggregationValue(col, filteredRows, col.aggregation, columns);
    }
    return aggs;
  }, [filteredRows, columns]);

  return { filteredRows, paginatedRows, filteredCount: filteredRows.length, totalCount: rows.length, totalPages, aggregations };
}
