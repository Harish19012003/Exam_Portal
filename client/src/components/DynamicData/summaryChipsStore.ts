// Shared Summary Chips config for every Dynamic* view.
// One enabled flag, one chip list, one eye visibility — all views read/write here.
import { useCallback, useSyncExternalStore } from 'react';
import type { SummaryChipConfig } from '../DynamicTable/types';

const STORAGE_KEY = 'dynamic_summary_chips_v1';

export interface SummaryChipsStoreState {
  enabled: boolean;
  chips: SummaryChipConfig[];
  visible: boolean;
}

const DEFAULT_STATE: SummaryChipsStoreState = {
  enabled: false,
  chips: [],
  visible: true,
};

function loadState(): SummaryChipsStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<SummaryChipsStoreState>;
    return {
      enabled: Boolean(parsed.enabled),
      chips: Array.isArray(parsed.chips) ? normalizeChips(parsed.chips) : [],
      visible: parsed.visible !== false,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function normalizeChips(chips: SummaryChipConfig[]): SummaryChipConfig[] {
  return chips.map(chip => ({
    ...chip,
    aggregations: (chip.aggregations ?? []).slice(0, 3),
  }));
}

function saveState(state: SummaryChipsStoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore
  }
}

let state: SummaryChipsStoreState = loadState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function setState(patch: Partial<SummaryChipsStoreState>) {
  const next: SummaryChipsStoreState = {
    ...state,
    ...patch,
    chips: patch.chips !== undefined ? normalizeChips(patch.chips) : state.chips,
  };
  if (
    next.enabled === state.enabled &&
    next.visible === state.visible &&
    next.chips === state.chips
  ) {
    return;
  }
  state = next;
  saveState(state);
  emit();
}

export function getSummaryChipsState(): SummaryChipsStoreState {
  return state;
}

export function subscribeSummaryChips(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace summary-chip portal config (hydrate / restore). */
export function replaceSummaryChipsState(next: Partial<SummaryChipsStoreState>): void {
  setState({
    enabled: typeof next.enabled === 'boolean' ? next.enabled : DEFAULT_STATE.enabled,
    chips: Array.isArray(next.chips) ? next.chips : [],
    visible: next.visible !== false,
  });
}

export function setSummaryChipsEnabled(enabled: boolean): void {
  setState({ enabled });
}

export function setSummaryChips(chips: SummaryChipConfig[]): void {
  setState({ chips });
}

export function setSummaryChipsVisible(visible: boolean): void {
  setState({ visible });
}

export function toggleSummaryChipsVisible(): void {
  setState({ visible: !state.visible });
}

export function toggleSummaryChipsEnabled(): void {
  setState({ enabled: !state.enabled });
}

/** Drop chips whose field no longer exists in the live schema. */
export function pruneSummaryChipsToColumnKeys(columnKeys: Iterable<string>): void {
  const keys = columnKeys instanceof Set ? columnKeys : new Set(columnKeys);
  const next = state.chips.filter(c => keys.has(c.fieldKey));
  if (next.length !== state.chips.length) setSummaryChips(next);
}

export function useSummaryChipsStore() {
  const subscribe = useCallback((onChange: () => void) => subscribeSummaryChips(onChange), []);
  const snapshot = useSyncExternalStore(subscribe, getSummaryChipsState, getSummaryChipsState);

  return {
    enabled: snapshot.enabled,
    chips: snapshot.chips,
    visible: snapshot.visible,
    setEnabled: setSummaryChipsEnabled,
    setChips: setSummaryChips,
    setVisible: setSummaryChipsVisible,
    toggleVisible: toggleSummaryChipsVisible,
    toggleEnabled: toggleSummaryChipsEnabled,
  };
}
