import type { ColumnConfig, DataRow } from '../DynamicData';
import type { CardLayoutKind } from './design';

export type CardLayout = CardLayoutKind;

export interface DynamicCardFeatures {
  enableSearch?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableFullScreen?: boolean;
  enableOpenDetail?: boolean;
  layout?: CardLayout;
}

/** Shared flags default off — `sharedViewFeaturesStore` is the source of truth. */
export const DEFAULT_CARD_FEATURES: Required<DynamicCardFeatures> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
  layout: 'card',
};

export interface DynamicCardProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  features?: DynamicCardFeatures;
}
