import type { AggregationType, ColumnConfig, SavedView, Density, ConditionalFormatRule } from '../types';

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
  /** Footer totals that differ from the page schema (`null` = removed). Part of the saved layout. */
  columnAggregations?: Record<string, AggregationType | null>;
  /**
   * Browser draft only: signature of the SAVED layout this draft was made from. If the saved layout
   * has changed since (e.g. saved from another device), the draft is stale and ignored.
   */
  baseSig?: string;
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

/**
 * Created / Modify by & at — always trail the table (never mid-grid from drag or saved layout).
 * Matches system audit keys and common builder autofill aliases.
 */
export function isAuditColumnKey(key: string): boolean {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return false;
  if (k === '__created_by' || k === '__updated_by') return true;
  if (k === 'created_at' || k === 'updated_at' || k === 'modified_at') return true;
  if (k === 'created_by' || k === 'createdby' || k === 'created_by_user') return true;
  if (
    k === 'modify_by' ||
    k === 'modified_by' ||
    k === 'updated_by' ||
    k === 'modifyby' ||
    k === 'modifiedby'
  ) {
    return true;
  }
  return false;
}

/** Stable audit trailing order: Created by → Modify by → Created at → Updated at → other audit. */
const AUDIT_TRAIL_RANK: Record<string, number> = {
  __created_by: 1,
  created_by: 1,
  createdby: 1,
  created_by_user: 1,
  __updated_by: 2,
  modify_by: 2,
  modified_by: 2,
  updated_by: 2,
  modifyby: 2,
  modifiedby: 2,
  created_at: 3,
  updated_at: 4,
  modified_at: 4,
};

export function pinAuditColumnsLast(order: string[]): string[] {
  const list = Array.isArray(order) ? order.filter(Boolean) : [];
  if (!list.length) return [];
  const body: string[] = [];
  const audit: string[] = [];
  list.forEach((k) => {
    if (isAuditColumnKey(k)) audit.push(k);
    else body.push(k);
  });
  audit.sort((a, b) => {
    const ra = AUDIT_TRAIL_RANK[String(a).toLowerCase()] ?? 50;
    const rb = AUDIT_TRAIL_RANK[String(b).toLowerCase()] ?? 50;
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b));
  });
  return [...body, ...audit];
}

/** Keep saved order for known keys; append any new schema columns at the end; audit always last. */
export function mergeColumnOrder(schemaKeys: string[], savedOrder?: string[] | null): string[] {
  const keys = Array.isArray(schemaKeys) ? schemaKeys.filter(Boolean) : [];
  if (!keys.length) return [];
  const keySet = new Set(keys);
  const ordered = (Array.isArray(savedOrder) ? savedOrder : []).filter((k) => keySet.has(k));
  const seen = new Set(ordered);
  keys.forEach((k) => {
    if (!seen.has(k)) ordered.push(k);
  });
  return pinAuditColumnsLast(ordered);
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
  if (prefs.columnAggregations && typeof prefs.columnAggregations === 'object') {
    slice.columnAggregations = prefs.columnAggregations;
  }
  if (Array.isArray(prefs.conditionalFormats)) slice.conditionalFormats = prefs.conditionalFormats;
  return slice;
}
