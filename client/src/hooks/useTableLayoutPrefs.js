import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import {
  fetchTableLayout,
  saveUserTableLayout,
  clearUserTableLayout,
  saveOrgTableLayoutDefault,
  isSuperAdminUser,
} from '../api/tableLayoutApi';

/**
 * Load / save DynamicTable layout prefs for any portal table.
 * Pass a stable unique `tableId` per table (e.g. exam_management_v1, vendor_master_data_v3).
 */
export function useTableLayoutPrefs(tableId, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const cachedBundle = tableId ? queryClient.getQueryData(queryKeys.tableLayout(tableId)) : null;
  const [bundle, setBundleState] = useState(cachedBundle || null);
  const [ready, setReady] = useState(!enabled || !tableId || Boolean(cachedBundle));
  const setBundle = useCallback(
    (next) => {
      if (tableId && next) queryClient.setQueryData(queryKeys.tableLayout(tableId), next);
      setBundleState(next);
    },
    [queryClient, tableId],
  );
  const [epoch, setEpoch] = useState(0);
  const canSaveAsDefault = useMemo(() => isSuperAdminUser(), []);

  const reload = useCallback(async ({ force = true } = {}) => {
    if (!enabled || !tableId) {
      setBundle(null);
      setReady(true);
      return null;
    }
    try {
      const next = await queryClient.fetchQuery({
        queryKey: queryKeys.tableLayout(tableId),
        queryFn: () => fetchTableLayout(tableId),
        staleTime: force ? 0 : undefined,
      });
      setBundle(next);
      setReady(true);
      return next;
    } catch {
      setBundle({
        layout: null,
        source: 'none',
        hasUserOverride: false,
        hasOrgDefault: false,
        orgDefault: null,
      });
      setReady(true);
      return null;
    }
  }, [enabled, tableId, queryClient, setBundle]);

  useEffect(() => {
    let cancelled = false;
    if (!queryClient.getQueryData(queryKeys.tableLayout(tableId))) setReady(false);
    (async () => {
      await reload({ force: false });
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, queryClient, tableId]);

  // Called when the user clicks Save on the table's unsaved-changes bar. Errors are rethrown so the bar
  // can say the save failed (the draft stays in the browser) — they used to be swallowed silently.
  const onLayoutPrefsChange = useCallback(
    async (prefs) => {
      if (!tableId) return null;
      const result = await saveUserTableLayout(tableId, prefs);
      setBundle(result);
      return result;
    },
    [tableId, setBundle],
  );

  const onSaveLayoutAsDefault = useCallback(
    async (prefs) => {
      if (!tableId) return { ok: false, message: 'Missing table id' };
      try {
        const result = await saveOrgTableLayoutDefault(tableId, prefs);
        setBundle(result);
        return { ok: true, message: 'Default table layout saved for all users', result };
      } catch {
        return { ok: false, message: 'Could not save default table layout' };
      }
    },
    [tableId, setBundle],
  );

  const onResetLayoutToDefault = useCallback(async () => {
    if (!tableId) return { ok: false, message: 'Missing table id' };
    try {
      const result = await clearUserTableLayout(tableId);
      setBundle(result);
      setEpoch((n) => n + 1);
      return { ok: true, message: 'Reset to default table layout', result };
    } catch {
      return { ok: false, message: 'Could not reset table layout' };
    }
  }, [tableId, setBundle]);

  return {
    tableId,
    layoutReady: ready,
    layoutPrefs: bundle?.layout || null,
    hasUserLayoutOverride: Boolean(bundle?.hasUserOverride),
    hasOrgDefault: Boolean(bundle?.hasOrgDefault),
    layoutSource: bundle?.source || 'none',
    layoutEpoch: epoch,
    canSaveLayoutAsDefault: canSaveAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault: canSaveAsDefault ? onSaveLayoutAsDefault : undefined,
    onResetLayoutToDefault: bundle?.hasUserOverride ? onResetLayoutToDefault : undefined,
    reloadLayout: reload,
  };
}
