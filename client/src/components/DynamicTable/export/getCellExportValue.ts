import { isCompositeColumn, isFieldColumn } from '../types';
import type { ColumnConfig, DataRow } from '../types';

/** Resolve a display/export value for one cell (composites → primary field). */
export function getCellExportValue(col: ColumnConfig, row: DataRow): unknown {
  if (isCompositeColumn(col)) {
    const primary = col.composedOf.find(p => p.role === 'primary');
    return primary ? (row.values[primary.field] ?? '') : '';
  }
  if (isFieldColumn(col)) {
    return row.values[col.key] ?? '';
  }
  return '';
}

export function getCellExportString(col: ColumnConfig, row: DataRow): string {
  const val = getCellExportValue(col, row);
  if (col.dataType === 'progress') return `${Number(val) || 0}%`;
  if (col.dataType === 'rating') return `${Number(val) || 0} Stars`;
  if (col.dataType === 'tags' || col.dataType === 'multiselect') {
    return Array.isArray(val) ? val.join(', ') : String(val);
  }
  if (col.dataType === 'attachment') {
    if (Array.isArray(val)) return val.map((v: any) => v.name || v.url || String(v)).join(', ');
    if (typeof val === 'string') return val.split('/').pop() || val;
  }
  return String(val);
}

/** Excel-friendly: numbers/currency/progress/rating as number, otherwise string. */
export function getCellExportExcelValue(col: ColumnConfig, row: DataRow): string | number {
  const val = getCellExportValue(col, row);
  if (col.dataType === 'number' || col.dataType === 'currency' || col.dataType === 'progress' || col.dataType === 'rating') {
    return Number(val) || 0;
  }
  if (col.dataType === 'tags' || col.dataType === 'multiselect') {
    return Array.isArray(val) ? val.join(', ') : String(val);
  }
  if (col.dataType === 'attachment') {
    if (Array.isArray(val)) return val.map((v: any) => v.name || v.url || String(v)).join(', ');
    if (typeof val === 'string') return val.split('/').pop() || val;
  }
  return String(val);
}
