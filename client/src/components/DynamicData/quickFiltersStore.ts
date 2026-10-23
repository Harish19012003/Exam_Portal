// Shared Quick Filters (filter bar under summary chips).
// Field list + enabled flag persist; active values are session state (also persisted lightly).
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { FilterValue } from '../DynamicTable/types';

const STORAGE_KEY = 'dynamic_quick_filters_v1';

export interface QuickFiltersStoreState {
  enabled: boolean;
  /** Ordered field keys shown in the bar. */
  fieldKeys: string[];
  visible: boolean;
  /** Active filter values keyed by field. */
  values: Record<string, FilterValue>;
}

const DEFAULT_STATE: QuickFiltersStoreState = {
  enabled: false,
  fieldKeys: [],
  visible: true,
  values: {},
};

function loadState(): QuickFiltersStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, values: {} };
    const parsed = JSON.parse(raw) as Partial<QuickFiltersStoreState>;
    return {
      enabled: Boolean(parsed.enabled),
      fieldKeys: Array.isArray(parsed.fieldKeys)
        ? parsed.fieldKeys.filter((k): k is string => typeof k === 'string')
        : [],
      visible: parsed.visible !== false,
      values:
        parsed.values && typeof parsed.values === 'object' && !Array.isArray(parsed.values)
          ? (parsed.values as Record<string, FilterValue>)
          : {},
    };
  } catch {
    return { ...DEFAULT_STATE, values: {} };
  }
}

function saveState(state: QuickFiltersStoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore
  }
}

let state: QuickFiltersStoreState = loadState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function setState(patch: Partial<QuickFiltersStoreState>) {
  const next: QuickFiltersStoreState = {
    ...state,
    ...patch,
    fieldKeys: patch.fieldKeys !== undefined ? patch.fieldKeys : state.fieldKeys,
    values: patch.values !== undefined ? patch.values : state.values,
  };
  // Drop values for fields no longer in the bar
  if (patch.fieldKeys !== undefined) {
    const keep = new Set(next.fieldKeys);
    const pruned: Record<string, FilterValue> = {};
    Object.entries(next.values).forEach(([k, v]) => {
      if (keep.has(k)) pruned[k] = v;
    });
    next.values = pruned;
  }
  state = next;
  saveState(state);
  emit();
}

export function getQuickFiltersState(): QuickFiltersStoreState {
  return state;
}

export function subscribeQuickFilters(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace quick-filter portal config (hydrate / restore). Keeps session values when possible. */
export function replaceQuickFiltersState(next: Partial<QuickFiltersStoreState>): void {
  setState({
    enabled: typeof next.enabled === 'boolean' ? next.enabled : DEFAULT_STATE.enabled,
    fieldKeys: Array.isArray(next.fieldKeys) ? next.fieldKeys : [],
    visible: next.visible !== false,
    values: next.values && typeof next.values === 'object' ? next.values : {},
  });
}

export function setQuickFiltersEnabled(enabled: boolean): void {
  setState({ enabled });
}

export function setQuickFilterFields(fieldKeys: string[]): void {
  setState({ fieldKeys });
}

export function setQuickFiltersVisible(visible: boolean): void {
  setState({ visible });
}

export function toggleQuickFiltersVisible(): void {
  setState({ visible: !state.visible });
}

export function toggleQuickFiltersEnabled(): void {
  setState({ enabled: !state.enabled });
}

export function setQuickFilterValue(fieldKey: string, value: FilterValue | null): void {
  const next = { ...state.values };
  if (value === null) delete next[fieldKey];
  else next[fieldKey] = value;
  setState({ values: next });
}

export function clearQuickFilterValues(): void {
  setState({ values: {} });
}

/** Drop configured fields (and their values) that are gone from the schema. */
export function pruneQuickFilterFieldsToColumnKeys(columnKeys: Iterable<string>): void {
  const keys = columnKeys instanceof Set ? columnKeys : new Set(columnKeys);
  const nextKeys = state.fieldKeys.filter(k => keys.has(k));
  if (nextKeys.length === state.fieldKeys.length) {
    const valueKeys = Object.keys(state.values);
    if (valueKeys.every(k => keys.has(k))) return;
  }
  const nextValues = { ...state.values };
  Object.keys(nextValues).forEach(k => {
    if (!keys.has(k)) delete nextValues[k];
  });
  setState({ fieldKeys: nextKeys, values: nextValues });
}

/** Active filters when the feature is on (bar visibility only hides the UI). */
export function getActiveQuickFilters(): Record<string, FilterValue> {
  if (!state.enabled || state.fieldKeys.length === 0) return {};
  const active: Record<string, FilterValue> = {};
  state.fieldKeys.forEach(key => {
    const v = state.values[key];
    if (!v) return;
    if (v.op === 'in' && Array.isArray(v.value) && v.value.length === 0) return;
    if (v.op === 'contains' && !String(v.value ?? '').trim()) return;
    if (v.op === 'equals' && (v.value === '' || v.value === null || v.value === undefined)) return;
    active[key] = v;
  });
  return active;
}

export function useQuickFiltersStore() {
  const subscribe = useCallback((onChange: () => void) => subscribeQuickFilters(onChange), []);
  const snapshot = useSyncExternalStore(subscribe, getQuickFiltersState, getQuickFiltersState);

  const activeFilters = useMemo(() => {
    if (!snapshot.enabled || snapshot.fieldKeys.length === 0) return {};
    const active: Record<string, FilterValue> = {};
    snapshot.fieldKeys.forEach(key => {
      const v = snapshot.values[key];
      if (!v) return;
      if (v.op === 'in' && Array.isArray(v.value) && v.value.length === 0) return;
      if (v.op === 'contains' && !String(v.value ?? '').trim()) return;
      if (v.op === 'equals' && (v.value === '' || v.value === null || v.value === undefined)) return;
      active[key] = v;
    });
    return active;
  }, [snapshot.enabled, snapshot.fieldKeys, snapshot.values]);

  return {
    enabled: snapshot.enabled,
    fieldKeys: snapshot.fieldKeys,
    visible: snapshot.visible,
    values: snapshot.values,
    setEnabled: setQuickFiltersEnabled,
    setFieldKeys: setQuickFilterFields,
    setVisible: setQuickFiltersVisible,
    toggleVisible: toggleQuickFiltersVisible,
    toggleEnabled: toggleQuickFiltersEnabled,
    setValue: setQuickFilterValue,
    clearValues: clearQuickFilterValues,
    activeFilters,
  };
}
