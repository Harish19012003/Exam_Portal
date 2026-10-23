import { useCallback, useMemo, useState } from 'react';
import {
  isSharedViewFeatureKey,
  omitSharedViewFeatureKeys,
  setSharedViewFeature,
  toggleSharedViewFeature,
  useSharedViewFeatures,
  type SharedViewFeatureKey,
} from './sharedViewFeaturesStore';

function loadStored<T extends Record<string, unknown>>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    // Shared flags live only in sharedViewFeaturesStore.
    return omitSharedViewFeatureKeys(parsed as T) as Partial<T>;
  } catch {
    return null;
  }
}

function saveStored<T extends Record<string, unknown>>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(omitSharedViewFeatureKeys(value)));
  } catch {
    // Quota / private mode — ignore
  }
}

/**
 * Feature Builder state for non-table views.
 * Shared toolbar/interaction flags always come from `sharedViewFeaturesStore`
 * (one toggle → every supporting view). View-only flags stay per-view.
 */
export function useViewFeatures<T extends Record<string, unknown>>(
  storageKey: string,
  defaults: T,
  propOverrides?: Partial<T>,
) {
  const [custom, setCustom] = useState<Partial<T>>(() => loadStored<T>(storageKey) ?? {});
  const { flags: sharedFlags } = useSharedViewFeatures();

  const features = useMemo(() => {
    const sharedPatch = {} as Partial<T>;
    (Object.keys(sharedFlags) as SharedViewFeatureKey[]).forEach(key => {
      if (key in defaults) {
        (sharedPatch as Record<string, boolean>)[key] = sharedFlags[key];
      }
    });
    // Order: defaults → view-only custom → shared (canonical) → props
    return { ...defaults, ...custom, ...sharedPatch, ...propOverrides } as T;
  }, [defaults, custom, sharedFlags, propOverrides]);

  const toggleFeature = useCallback(
    (key: keyof T & string) => {
      if (isSharedViewFeatureKey(key)) {
        toggleSharedViewFeature(key);
        return;
      }
      setCustom(prev => {
        const current = { ...defaults, ...prev, ...propOverrides } as T;
        const next = omitSharedViewFeatureKeys({
          ...prev,
          [key]: !Boolean(current[key]),
        } as T) as Partial<T>;
        saveStored(storageKey, next as T);
        return next;
      });
    },
    [defaults, propOverrides, storageKey],
  );

  const setFeature = useCallback(
    (key: keyof T & string, value: boolean) => {
      if (isSharedViewFeatureKey(key)) {
        setSharedViewFeature(key, value);
        return;
      }
      setCustom(prev => {
        const next = omitSharedViewFeatureKeys({ ...prev, [key]: value } as T) as Partial<T>;
        saveStored(storageKey, next as T);
        return next;
      });
    },
    [storageKey],
  );

  return { features, toggleFeature, setFeature };
}
