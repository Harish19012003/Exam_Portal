// Session-scoped schema sharing for the Dynamic* view family.
//
// Views keep their own column copies; a composite built in the Table is
// otherwise invisible in Card/List/Kanban unless they read this store.
// The Table publishes its live column set here; other views subscribe.
//
// Deliberately in-memory, not localStorage: useTableState persists `columns`
// but never rehydrates them, so a disk-backed store would resurrect composites
// in the Card that the Table itself has forgotten after a reload.
import { useCallback, useSyncExternalStore } from 'react';
import type { ColumnConfig } from '../DynamicTable/types';

let sharedColumns: ColumnConfig[] | null = null;
const listeners = new Set<() => void>();

export function publishSharedColumns(columns: ColumnConfig[]): void {
  if (sharedColumns === columns) return;
  sharedColumns = columns;
  listeners.forEach(listener => listener());
}

export function getSharedColumns(): ColumnConfig[] | null {
  return sharedColumns;
}

export function subscribeSharedColumns(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Columns a non-Table view should render.
 * `override` (an explicit `initialColumns` prop) always wins, then whatever the
 * Table last published this session, then the caller's fallback schema.
 */
export function useSharedColumns(fallback: ColumnConfig[], override?: ColumnConfig[]): ColumnConfig[] {
  const subscribe = useCallback((onChange: () => void) => subscribeSharedColumns(onChange), []);
  const published = useSyncExternalStore(subscribe, getSharedColumns, getSharedColumns);
  return override ?? published ?? fallback;
}
