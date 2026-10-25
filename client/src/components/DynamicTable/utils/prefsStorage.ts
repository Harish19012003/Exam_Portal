import type { ColumnConfig, SavedView, Density, ConditionalFormatRule } from '../types';

export const TABLE_PREFS_KEY = 'dynamic_table_prefs_v7';

export interface TablePrefs {
  columns?: ColumnConfig[];
  columnWidths?: Record<string, number>;
  density?: Density;
  savedViews?: SavedView[];
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
  conditionalFormats?: ConditionalFormatRule[];
  recentFormatColors?: string[];
}

export function getStorageKey(tableId?: string): string {
  return tableId ? `dynamic_table_prefs_${tableId}_v7` : TABLE_PREFS_KEY;
}

export function loadTablePrefs(tableId?: string): TablePrefs | null {
  try {
    const saved = localStorage.getItem(getStorageKey(tableId));
    if (!saved) return null;
    return JSON.parse(saved) as TablePrefs;
  } catch {
    return null;
  }
}

export function saveTablePrefs(prefs: TablePrefs, tableId?: string): void {
  try {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(prefs));
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function readPref<K extends keyof TablePrefs>(
  key: K,
  fallback: NonNullable<TablePrefs[K]>,
  tableId?: string,
): NonNullable<TablePrefs[K]> {
  const prefs = loadTablePrefs(tableId);
  const value = prefs?.[key];
  return (value ?? fallback) as NonNullable<TablePrefs[K]>;
}

/** Keep saved order for known keys; append any new schema columns at the end */
export function mergeColumnOrder(schemaKeys: string[], savedOrder?: string[] | null): string[] {
  const keys = Array.isArray(schemaKeys) ? schemaKeys.filter(Boolean) : [];
  if (!keys.length) return [];
  const keySet = new Set(keys);
  const ordered = (Array.isArray(savedOrder) ? savedOrder : []).filter((k) => keySet.has(k));
  const seen = new Set(ordered);
  keys.forEach((k) => {
    if (!seen.has(k)) ordered.push(k);
  });
  return ordered;
}

export function mergeColumnVisibility(
  schemaKeys: string[],
  schemaDefaults: Record<string, boolean>,
  saved?: Record<string, boolean> | null,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  schemaKeys.forEach((key) => {
    if (saved && Object.prototype.hasOwnProperty.call(saved, key)) {
      next[key] = Boolean(saved[key]);
    } else {
      next[key] = schemaDefaults[key] !== false;
    }
  });
  return next;
}

export function pickLayoutSlice(prefs: Partial<TablePrefs> | null | undefined): TablePrefs {
  if (!prefs || typeof prefs !== 'object') return {};
  const slice: TablePrefs = {};
  if (Array.isArray(prefs.columnOrder)) slice.columnOrder = prefs.columnOrder;
  if (prefs.columnVisibility && typeof prefs.columnVisibility === 'object') {
    slice.columnVisibility = prefs.columnVisibility;
  }
  if (prefs.columnWidths && typeof prefs.columnWidths === 'object') {
    slice.columnWidths = prefs.columnWidths;
  }
  if (typeof prefs.density === 'string') slice.density = prefs.density;
  return slice;
}
