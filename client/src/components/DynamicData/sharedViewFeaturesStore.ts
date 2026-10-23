// Single source of truth for Feature Builder flags shared across Dynamic* views.
// Enable Export (etc.) in Table → visible on List/Card/Kanban/Tree/Calendar.
// Disable anywhere → hidden on every view that supports it.
import { useCallback, useSyncExternalStore } from 'react';
import { ALL_SHARED_FEATURES } from './viewFeatures';

export type SharedViewFeatureKey =
  | 'enableSearch'
  | 'enableRefresh'
  | 'enableExport'
  | 'enableFullScreen'
  | 'enableOpenDetail'
  | 'enableDensity';

const STORAGE_KEY = 'dynamic_shared_view_features_v2';

/** Opt-in defaults — Feature Builder turns a feature on once for every view. */
const DEFAULT_FLAGS: Record<SharedViewFeatureKey, boolean> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
  enableDensity: false,
};

export const SHARED_VIEW_FEATURE_KEYS = Object.keys(DEFAULT_FLAGS) as SharedViewFeatureKey[];

const CROSS_VIEW_KEY_SET = new Set(
  ALL_SHARED_FEATURES.filter(item => item.views.length > 1)
    .map(item => item.key)
    .filter(key => key !== 'enableSummaryChips' && key !== 'enableQuickFilters' && key in DEFAULT_FLAGS),
);

export function isSharedViewFeatureKey(key: string): key is SharedViewFeatureKey {
  return CROSS_VIEW_KEY_SET.has(key);
}

function loadFlags(): Record<SharedViewFeatureKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw) as Partial<Record<SharedViewFeatureKey, boolean>>;
    const next = { ...DEFAULT_FLAGS };
    SHARED_VIEW_FEATURE_KEYS.forEach(key => {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key]!;
    });
    return next;
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

function saveFlags(next: Record<SharedViewFeatureKey, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

let flags: Record<SharedViewFeatureKey, boolean> = loadFlags();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function setFlags(patch: Partial<Record<SharedViewFeatureKey, boolean>>) {
  let changed = false;
  const next = { ...flags };
  (Object.keys(patch) as SharedViewFeatureKey[]).forEach(key => {
    if (typeof patch[key] === 'boolean' && next[key] !== patch[key]) {
      next[key] = patch[key]!;
      changed = true;
    }
  });
  if (!changed) return;
  flags = next;
  saveFlags(flags);
  emit();
}

export function getSharedViewFeatures(): Record<SharedViewFeatureKey, boolean> {
  return flags;
}

export function subscribeSharedViewFeatures(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSharedViewFeature(key: SharedViewFeatureKey, value: boolean): void {
  setFlags({ [key]: value });
}

/** Replace all shared flags (portal config hydrate / restore). */
export function replaceSharedViewFeatures(
  nextFlags: Partial<Record<SharedViewFeatureKey, boolean>>,
): void {
  const next = { ...DEFAULT_FLAGS };
  SHARED_VIEW_FEATURE_KEYS.forEach(key => {
    if (typeof nextFlags[key] === 'boolean') next[key] = nextFlags[key]!;
  });
  flags = next;
  saveFlags(flags);
  emit();
}

export function toggleSharedViewFeature(key: SharedViewFeatureKey): void {
  setFlags({ [key]: !flags[key] });
}

/** Strip shared keys from a per-view persisted blob (they must not live there). */
export function omitSharedViewFeatureKeys<T extends Record<string, unknown>>(value: T): Partial<T> {
  const next = { ...value };
  SHARED_VIEW_FEATURE_KEYS.forEach(key => {
    delete next[key];
  });
  return next;
}

export function useSharedViewFeatures() {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeSharedViewFeatures(onChange),
    [],
  );
  const snapshot = useSyncExternalStore(subscribe, getSharedViewFeatures, getSharedViewFeatures);

  return {
    flags: snapshot,
    setFeature: setSharedViewFeature,
    toggleFeature: toggleSharedViewFeature,
  };
}
