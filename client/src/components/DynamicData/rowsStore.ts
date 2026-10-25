// Session-scoped row sharing for the Dynamic* view family.
//
// Columns are already shared via schemaStore. Rows were still per-view clones
// of MOCK_ROWS, so edits in Table never reached List/chips and parent chrome
// always aggregated the static seed. This store mirrors schemaStore: in-memory
// only, Table (and any view that mutates) publishes; siblings subscribe.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { DataRow } from '../DynamicTable/types';

let sharedRows: DataRow[] | null = null;
const listeners = new Set<() => void>();

export function publishSharedRows(rows: DataRow[]): void {
  if (sharedRows === rows) return;
  sharedRows = rows;
  listeners.forEach(listener => listener());
}

export function getSharedRows(): DataRow[] | null {
  return sharedRows;
}

export function subscribeSharedRows(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type RowsUpdater = DataRow[] | ((prev: DataRow[]) => DataRow[]);

function resolveUpdater(prev: DataRow[], updater: RowsUpdater): DataRow[] {
  return typeof updater === 'function' ? updater(prev) : updater;
}

/**
 * Live rows for a Dynamic* view.
 * `override` (explicit `initialRows`) always wins and stays local.
 * Otherwise: shared session rows, seeded from `fallback` on first mount.
 */
export function useSharedRows(
  fallback: DataRow[],
  override?: DataRow[],
): [DataRow[], (updater: RowsUpdater) => void] {
  const subscribe = useCallback((onChange: () => void) => subscribeSharedRows(onChange), []);
  const published = useSyncExternalStore(subscribe, getSharedRows, getSharedRows);

  useEffect(() => {
    if (!override && getSharedRows() == null) {
      publishSharedRows(fallback);
    }
  }, [override, fallback]);

  const [localOverride, setLocalOverride] = useState<DataRow[] | undefined>(override);

  useEffect(() => {
    if (override) setLocalOverride(override);
  }, [override]);

  const rows = override ? (localOverride ?? override) : (published ?? fallback);

  const setRows = useCallback(
    (updater: RowsUpdater) => {
      if (override) {
        setLocalOverride(prev => resolveUpdater(prev ?? override, updater));
        return;
      }
      const prev = getSharedRows() ?? fallback;
      publishSharedRows(resolveUpdater(prev, updater));
    },
    [override, fallback],
  );

  return [rows, setRows];
}

/** Read-only snapshot for parent chrome (chips / filter option discovery). */
export function useSharedRowsSnapshot(fallback: DataRow[]): DataRow[] {
  const subscribe = useCallback((onChange: () => void) => subscribeSharedRows(onChange), []);
  const published = useSyncExternalStore(subscribe, getSharedRows, getSharedRows);
  return published ?? fallback;
}
