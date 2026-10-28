import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_EXAM_TABLE_FEATURES } from '../pages/exams/examTableConfig';
import {
  hydrateFeatureStores,
  normalizeFeaturesDraft,
  restoreFeatureStores,
  snapshotFeatureStores,
} from '../pages/exams/examTableHelpers';

/** What the portal always forces for a field-driven table (same as the Exams table). */
export const withPortalFeatureLocks = (features) => ({
  ...DEFAULT_EXAM_TABLE_FEATURES,
  ...features,
  enableAddColumn: false,
  enableAddRow: false,
  enableSubRows: false,
  enableTranspose: false,
});

/**
 * Portal-published Feature Builder state, shared by every field-driven table
 * (Exams, Vendors, ...). Toggles preview live; `save` persists them for everyone.
 *
 * `persist(features)` must save to the API and throw on failure.
 * Call `hydrate(savedFeatures)` once the table's config has loaded.
 */
export const usePortalTableFeatures = ({ canConfigure, persist }) => {
  const [features, setFeatures] = useState(() => ({ ...DEFAULT_EXAM_TABLE_FEATURES }));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const featuresRef = useRef(features);
  const lastSavedRef = useRef(null);
  const syncReadyRef = useRef(false);
  const snapshotRef = useRef(null);

  useEffect(() => {
    snapshotRef.current = snapshotFeatureStores();
    return () => {
      syncReadyRef.current = false;
      restoreFeatureStores(snapshotRef.current);
    };
  }, []);

  const hydrate = useCallback((saved) => {
    const next = { ...DEFAULT_EXAM_TABLE_FEATURES, ...(saved || {}) };
    setFeatures(next);
    featuresRef.current = next;
    lastSavedRef.current = next;
    setDirty(false);
    hydrateFeatureStores(next);
    setReady(true);
    // Ignore the table echoing its own hydrated state back as "edits".
    syncReadyRef.current = false;
    window.setTimeout(() => {
      syncReadyRef.current = true;
    }, 1200);
  }, []);

  const onChange = useCallback(
    (draft) => {
      if (!canConfigure || !ready) return;
      const next = normalizeFeaturesDraft(draft);
      setFeatures(next);
      featuresRef.current = next;
      if (!syncReadyRef.current) {
        lastSavedRef.current = next;
        setDirty(false);
        return;
      }
      const saved = lastSavedRef.current;
      setDirty(!saved || JSON.stringify(next) !== JSON.stringify(saved));
    },
    [canConfigure, ready]
  );

  const save = useCallback(
    async (draft) => {
      if (!canConfigure || !ready) return false;
      const next = normalizeFeaturesDraft(draft || featuresRef.current);
      setFeatures(next);
      featuresRef.current = next;
      setSaving(true);
      try {
        await persist(next);
        lastSavedRef.current = next;
        setDirty(false);
        return true;
      } catch {
        setDirty(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [canConfigure, ready, persist]
  );

  return { features, ready, dirty, saving, hydrate, onChange, save };
};
