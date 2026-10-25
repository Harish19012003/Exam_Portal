import { useCallback, useState } from 'react';
import { loadRecordDesign, saveRecordDesign } from './recordDesign';
import type { RecordDesignConfig } from './recordDesign';

/**
 * Design config state for a view, hydrated from and written back to
 * localStorage under `storageKey`. Each view uses its own key so layouts
 * (which are per-view) never collide.
 *
 * `T` may extend RecordDesignConfig with view-specific board prefs
 * (e.g. Kanban groupByKey).
 *
 * Pass `validLayouts` so a stale key from another view / older registry
 * cannot crash the design sidebar.
 */
export function useRecordDesign<T extends RecordDesignConfig<string>>(
  storageKey: string,
  createDefault: () => T,
  validLayouts?: readonly T['layout'][],
) {
  const [design, setDesign] = useState<T>(() =>
    loadRecordDesign(storageKey, createDefault(), validLayouts) as T,
  );

  const updateDesign = useCallback(
    (patch: Partial<T>) => {
      setDesign(prev => {
        const next = { ...prev, ...patch };
        saveRecordDesign(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const resetDesign = useCallback(() => {
    const fresh = createDefault();
    saveRecordDesign(storageKey, fresh);
    setDesign(fresh);
  }, [storageKey, createDefault]);

  return { design, updateDesign, resetDesign };
}
