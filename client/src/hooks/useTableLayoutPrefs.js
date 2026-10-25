import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [bundle, setBundle] = useState(null);
  const [ready, setReady] = useState(!enabled || !tableId);
  const [epoch, setEpoch] = useState(0);
  const canSaveAsDefault = useMemo(() => isSuperAdminUser(), []);

  const reload = useCallback(async () => {
    if (!enabled || !tableId) {
      setBundle(null);
      setReady(true);
      return null;
    }
    try {
      const next = await fetchTableLayout(tableId);
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
  }, [enabled, tableId]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const onLayoutPrefsChange = useCallback(
    async (prefs) => {
      if (!tableId) return;
      try {
        const result = await saveUserTableLayout(tableId, prefs);
        setBundle(result);
      } catch {
        // localStorage cache still holds the layout
      }
    },
    [tableId],
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
    [tableId],
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
  }, [tableId]);

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
