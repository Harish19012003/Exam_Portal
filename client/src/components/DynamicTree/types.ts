import type { ColumnConfig, DataRow } from '../DynamicData';

export interface DynamicTreeFeatures {
  enableSearch?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableFullScreen?: boolean;
  enableOpenDetail?: boolean;
  /** Show comfortable / compact density switcher in the toolbar. */
  enableDensity?: boolean;
  /** Expand every branch on first render. */
  defaultExpanded?: boolean;
}

/** Shared flags default off — `sharedViewFeaturesStore` is the source of truth. */
export const DEFAULT_TREE_FEATURES: Required<DynamicTreeFeatures> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
  enableDensity: false,
  defaultExpanded: false,
};

export interface DynamicTreeProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  features?: DynamicTreeFeatures;
}
