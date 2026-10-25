import type { ColumnConfig, DataRow } from '../types';
import { isFieldColumn } from '../types';
import { formatAggregationLabel, formatAggregationValue } from './formatAggregation';

export const TRANSPOSE_ATTR_KEY = '__attribute__';
export const TRANSPOSE_AGG_KEY = '__aggregation__';
export const TRANSPOSE_CHECKBOX_ROW_ID = 't_row___checkbox__';
export const TRANSPOSE_ACTIONS_ROW_ID = 't_row___actions__';

export function isTransposedSyntheticRow(rowId: string): boolean {
  return rowId === TRANSPOSE_CHECKBOX_ROW_ID || rowId === TRANSPOSE_ACTIONS_ROW_ID;
}

export function isTransposedRowId(rowId: string): boolean {
  return rowId.startsWith('t_row_');
}

export function parseTransposedFieldKey(rowId: string): string {
  return rowId.replace(/^t_row_/, '');
}

export function parseTransposedSourceRowId(colKey: string): string | null {
  const match = /^__row_(.+)__$/.exec(colKey);
  return match ? match[1] : null;
}

export function toTransposedColKey(rowId: string): string {
  return `__row_${rowId}__`;
}

function buildAggregationText(
  col: ColumnConfig,
  aggregations?: Record<string, number>,
): string {
  if (!isFieldColumn(col) || !col.aggregation) return '—';
  if (!aggregations || aggregations[col.key] === undefined) return '—';
  return `${formatAggregationLabel(col.aggregation)}: ${formatAggregationValue(col, aggregations[col.key])}`;
}

export interface TransposeTableOptions {
  aggregations?: Record<string, number>;
  enableActionsColumn?: boolean;
  enableRowSelection?: boolean;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  includeSummaryColumn?: boolean;
}

/**
 * Flip columns ↔ rows as plain data (no thead).
 * Field row order matches the normal table column order.
 */
export function transposeTable(
  columns: ColumnConfig[],
  rows: DataRow[],
  options: TransposeTableOptions = {},
): { transposedColumns: ColumnConfig[]; transposedRows: DataRow[] } {
  const {
    aggregations,
    enableActionsColumn = true,
    enableRowSelection = true,
    columnVisibility = {},
    columnOrder,
    includeSummaryColumn = false,
  } = options;

  if (!columns.length || !rows.length) {
    return { transposedColumns: [], transposedRows: [] };
  }

  const orderedKeys =
    columnOrder && columnOrder.length > 0
      ? columnOrder
      : columns.map(c => c.key);

  const ordered = orderedKeys
    .map(key => columns.find(c => c.key === key))
    .filter((c): c is ColumnConfig => Boolean(c) && columnVisibility[c!.key] !== false);

  // Same visual order as the normal table: left-pinned → unpinned → right-pinned.
  const sourceColumns = [
    ...ordered.filter(c => c.pinned === 'left'),
    ...ordered.filter(c => !c.pinned),
    ...ordered.filter(c => c.pinned === 'right'),
  ];

  // No thead in transpose — column labels are unused; attribute names live in cells.
  const transposedColumns: ColumnConfig[] = [
    {
      key: TRANSPOSE_ATTR_KEY,
      label: '',
      dataType: 'text',
      width: 190,
      pinned: null,
      sortable: false,
      filterable: false,
      editable: false,
    },
  ];

  if (includeSummaryColumn) {
    transposedColumns.push({
      key: TRANSPOSE_AGG_KEY,
      label: '',
      dataType: 'text',
      width: 160,
      pinned: null,
      sortable: false,
      filterable: false,
      editable: false,
    });
  }

  rows.forEach(r => {
    transposedColumns.push({
      key: toTransposedColKey(r.rowId),
      label: '',
      dataType: 'text',
      width: 200,
      pinned: null,
      sortable: false,
      filterable: false,
      editable: false,
    });
  });

  const rawTransposedRows: DataRow[] = [];

  if (enableRowSelection !== false) {
    const checkboxRowValues: Record<string, unknown> = {
      [TRANSPOSE_ATTR_KEY]: 'Selection',
    };
    rows.forEach(r => {
      checkboxRowValues[toTransposedColKey(r.rowId)] = r.rowId;
    });
    rawTransposedRows.push({
      rowId: TRANSPOSE_CHECKBOX_ROW_ID,
      values: checkboxRowValues,
      pinnedDirection: null,
    });
  }

  sourceColumns.forEach(col => {
    const rowValues: Record<string, unknown> = {
      [TRANSPOSE_ATTR_KEY]: col.label || col.key,
    };
    if (includeSummaryColumn) {
      rowValues[TRANSPOSE_AGG_KEY] = buildAggregationText(col, aggregations);
    }

    rows.forEach(r => {
      rowValues[toTransposedColKey(r.rowId)] = r.values[col.key];
    });

    rawTransposedRows.push({
      rowId: `t_row_${col.key}`,
      values: rowValues,
      pinnedDirection: null,
    });
  });

  if (enableActionsColumn !== false) {
    const actionsRowValues: Record<string, unknown> = {
      [TRANSPOSE_ATTR_KEY]: 'Actions',
    };

    rows.forEach(r => {
      actionsRowValues[toTransposedColKey(r.rowId)] = r;
    });

    rawTransposedRows.push({
      rowId: TRANSPOSE_ACTIONS_ROW_ID,
      values: actionsRowValues,
      pinnedDirection: null,
    });
  }

  return {
    transposedColumns,
    transposedRows: rawTransposedRows,
  };
}
