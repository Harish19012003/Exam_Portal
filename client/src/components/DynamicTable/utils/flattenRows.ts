import type { DataRow } from '../types';

/**
 * Checks whether a DataRow contains non-empty subRows.
 */
export function hasSubRows(row?: DataRow): boolean {
  if (!row) return false;
  return Boolean(row.subRows && Array.isArray(row.subRows) && row.subRows.length > 0);
}

