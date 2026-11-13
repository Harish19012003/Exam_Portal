import { useCallback, useEffect, useRef } from 'react';
import type { DataRow } from '../types';

type PendingSave = {
  values: Record<string, unknown>;
  row: DataRow;
};

type SaveFn = (
  rowId: string,
  values: Record<string, unknown>,
  row: DataRow,
) => Promise<void> | void;

const DEFAULT_DEBOUNCE_MS = 450;

/**
 * Coalesce rapid inline cell edits into one PATCH per row.
 * UI still updates immediately; the network call waits for a quiet window.
 */
export function useDebouncedRowSave(
  onRowUpdate: SaveFn | undefined,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) {
  const pendingRef = useRef<Map<string, PendingSave>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const onRowUpdateRef = useRef(onRowUpdate);
  onRowUpdateRef.current = onRowUpdate;

  const flushRow = useCallback((rowId: string) => {
    const timer = timersRef.current.get(rowId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(rowId);
    }
    const pending = pendingRef.current.get(rowId);
    if (!pending) return;
    pendingRef.current.delete(rowId);
    const save = onRowUpdateRef.current;
    if (save) void save(rowId, pending.values, pending.row);
  }, []);

  const flushAll = useCallback(() => {
    const ids = [...pendingRef.current.keys()];
    ids.forEach((id) => flushRow(id));
  }, [flushRow]);

  const queueSave = useCallback(
    (rowId: string, patch: Record<string, unknown>, row: DataRow) => {
      if (!onRowUpdateRef.current) return;
      if (!patch || !Object.keys(patch).length) return;

      const prev = pendingRef.current.get(rowId);
      const mergedValues = { ...(prev?.values || {}), ...patch };
      pendingRef.current.set(rowId, {
        values: mergedValues,
        row: { ...row, values: { ...row.values, ...mergedValues } },
      });

      const existing = timersRef.current.get(rowId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        rowId,
        setTimeout(() => flushRow(rowId), Math.max(0, debounceMs)),
      );
    },
    [debounceMs, flushRow],
  );

  const cancelRow = useCallback((rowId: string) => {
    const timer = timersRef.current.get(rowId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(rowId);
    }
    pendingRef.current.delete(rowId);
  }, []);

  // Flush before unload / unmount so debounced edits are not lost.
  useEffect(() => {
    const onLeave = () => flushAll();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      flushAll();
    };
  }, [flushAll]);

  return { queueSave, flushRow, flushAll, cancelRow };
}
