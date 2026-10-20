import { useMemo } from 'react';
import { isCompositeColumn, isFieldColumn } from '../types';
import type { ColumnConfig, DataRow, FilterValue, NumberFilterValue, SortConfig } from '../types';
import {
  getAggregatableValue,
  getEffectiveDataType,
  isBooleanDataType,
  isNumericDataType,
  isTemporalDataType,
  toTemporalComparable,
} from '../utils/evaluateFormula';

// ─── Client-side filter ────────────────────────────────────────────────────────

function matchFilter(rawValue: unknown, filter: FilterValue): boolean {
  const strVal = String(rawValue ?? '').toLowerCase();
  switch (filter.op) {
    case 'contains':   return strVal.includes(String(filter.value).toLowerCase());
    case 'equals':     return strVal === String(filter.value).toLowerCase();
    case 'startsWith': return strVal.startsWith(String(filter.value).toLowerCase());
    case 'in':         return (filter.value as string[]).map(s => s.toLowerCase()).includes(strVal);
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
    default:    return true;
  }
}

function applyFilters(
  rows: DataRow[],
  filters: Record<string, FilterValue>,
  columns: ColumnConfig[]
): DataRow[] {
  const entries = Object.entries(filters);
  if (!entries.length) return rows;

  return rows.filter(row => {
    if (!row) return false;
    const valMap = (row.values ?? row ?? {}) as Record<string, unknown>;
    return entries.every(([colKey, filter]) => {
      const col = columns.find(c => c.key === colKey);
      if (!col) return true;
      return matchFilter(valMap[colKey], filter);
    });
  });
}

// ─── Global search ─────────────────────────────────────────────────────────────

function applySearch(
  rows: DataRow[],
  search: string,
  columns: ColumnConfig[],
  colVisibility: Record<string, boolean>
): DataRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;

  const visibleCols = columns.filter(c => colVisibility[c.key] !== false);

  return rows.filter(row => {
    if (!row) return false;
    const valMap = (row.values ?? row ?? {}) as Record<string, unknown>;
    return visibleCols.some(col => {
      if (isCompositeColumn(col)) {
        return col.composedOf.some(({ field }) =>
          String(valMap[field] ?? '').toLowerCase().includes(q)
        );
      }
      return String(valMap[col.key] ?? '').toLowerCase().includes(q);
    });
  });
}

// ─── Sort ──────────────────────────────────────────────────────────────────────

function applySort(rows: DataRow[], sort: SortConfig[], columns: ColumnConfig[]): DataRow[] {
  if (!sort.length) return rows;
  return [...rows].sort((a, b) => {
    const aVals = (a?.values ?? a ?? {}) as Record<string, unknown>;
    const bVals = (b?.values ?? b ?? {}) as Record<string, unknown>;
    for (const { key, direction } of sort) {
      let av = aVals[key];
      let bv = bVals[key];

      const col = columns.find(c => c.key === key);
      if (col && isCompositeColumn(col)) {
        const primaryPart = col.composedOf.find(p => p.role === 'primary');
        if (primaryPart) {
          av = aVals[primaryPart.field];
          bv = bVals[primaryPart.field];
        }
      }

      if (av == null && bv == null) continue;
      if (av == null) return direction === 'asc' ? -1 : 1;
      if (bv == null) return direction === 'asc' ?  1 : -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

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

      const key = col.key;
      const effectiveType = getEffectiveDataType(col);
      let sum = 0;
      let count = 0;
      let numericCount = 0;
      let emptyCount = 0;
      let min = Infinity;
      let max = -Infinity;
      const uniqueValues = new Set<unknown>();
      const numbersForMedian: number[] = [];
      let checkedCount = 0;

      for (const row of filteredRows) {
        if (!row) continue;
        const rawVal = getAggregatableValue(col, row, columns);
        if (rawVal === null || rawVal === undefined || rawVal === '') {
          emptyCount++;
          continue;
        }

        count++;
        uniqueValues.add(rawVal);

        if (isBooleanDataType(effectiveType)) {
          if (rawVal === true) checkedCount++;
        } else if (isTemporalDataType(effectiveType)) {
          const d = toTemporalComparable(rawVal, effectiveType);
          if (d !== null) {
            if (d < min) min = d;
            if (d > max) max = d;
          }
        } else if (isNumericDataType(effectiveType)) {
          const val = Number(rawVal);
          if (!isNaN(val)) {
            sum += val;
            numericCount++;
            numbersForMedian.push(val);
            if (val < min) min = val;
            if (val > max) max = val;
          }
        }
      }

      switch (col.aggregation) {
        case 'sum':
          aggs[key] = sum;
          break;
        case 'avg':
          aggs[key] = numericCount > 0 ? sum / numericCount : 0;
          break;
        case 'min':
        case 'earliest':
          aggs[key] = count > 0 && min !== Infinity ? min : 0;
          break;
        case 'max':
        case 'latest':
          aggs[key] = count > 0 && max !== -Infinity ? max : 0;
          break;
        case 'range':
          aggs[key] = count > 0 && min !== Infinity ? max - min : 0;
          break;
        case 'count':
          aggs[key] = count;
          break;
        case 'countUnique':
          aggs[key] = uniqueValues.size;
          break;
        case 'empty':
          aggs[key] = emptyCount;
          break;
        case 'filled':
          aggs[key] = count;
          break;
        case 'percentEmpty':
          aggs[key] =
            filteredRows.length > 0 ? (emptyCount / filteredRows.length) * 100 : 0;
          break;
        case 'percentFilled':
          aggs[key] =
            filteredRows.length > 0 ? (count / filteredRows.length) * 100 : 0;
          break;
        case 'percentChecked':
          aggs[key] =
            filteredRows.length > 0 ? (checkedCount / filteredRows.length) * 100 : 0;
          break;
        case 'median':
          if (numbersForMedian.length > 0) {
            numbersForMedian.sort((a, b) => a - b);
            const mid = Math.floor(numbersForMedian.length / 2);
            aggs[key] =
              numbersForMedian.length % 2 !== 0
                ? numbersForMedian[mid]
                : (numbersForMedian[mid - 1] + numbersForMedian[mid]) / 2;
          } else {
            aggs[key] = 0;
          }
          break;
      }
    }
    return aggs;
  }, [filteredRows, columns]);

  return { filteredRows, paginatedRows, filteredCount: filteredRows.length, totalCount: rows.length, totalPages, aggregations };
}
