import type { ColumnConfig, SavedView, Density, ConditionalFormatRule } from '../types';

export const TABLE_PREFS_KEY = 'dynamic_table_prefs_v7';

export function getStorageKey(tableId?: string): string {
  return tableId ? `dynamic_table_prefs_${tableId}_v2` : TABLE_PREFS_KEY;
}

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

export function loadTablePrefs(tableId?: string): TablePrefs | null {
  try {
    const key = getStorageKey(tableId);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved) as TablePrefs;
  } catch {
    return null;
  }
}

export function saveTablePrefs(prefs: TablePrefs, tableId?: string): void {
  try {
    const key = getStorageKey(tableId);
    localStorage.setItem(key, JSON.stringify(prefs));
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

