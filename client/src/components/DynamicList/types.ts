import type { ColumnConfig, DataRow } from '../DynamicData';
import type { ListLayoutKind } from './design';

export interface DynamicListFeatures {
  enableSearch?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableFullScreen?: boolean;
  enableOpenDetail?: boolean;
  /** Show comfortable / compact density switcher in the toolbar. */
  enableDensity?: boolean;
  /** Maps to list design layout (comfortable / compact). */
  density?: ListLayoutKind;
}

/** Shared flags default off — `sharedViewFeaturesStore` is the source of truth. */
export const DEFAULT_LIST_FEATURES: Required<DynamicListFeatures> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
  enableDensity: false,
  density: 'comfortable',
};

export interface DynamicListProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  features?: DynamicListFeatures;
  /** Registers guided-tour handlers (Dynamic Views page only). */
  isTourHost?: boolean;
}
