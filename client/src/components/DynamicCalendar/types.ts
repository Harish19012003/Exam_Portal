import type { ColumnConfig, DataRow } from '../DynamicData';

export interface DynamicCalendarFeatures {
  /** Column key to plot on the calendar. Defaults to the first date/datetime column. */
  dateFieldKey?: string;
  enableSearch?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableFullScreen?: boolean;
  enableOpenDetail?: boolean;
}

/** Shared flags default off — `sharedViewFeaturesStore` is the source of truth. */
export const DEFAULT_CALENDAR_FEATURES: Required<Omit<DynamicCalendarFeatures, 'dateFieldKey'>> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
};

export interface DynamicCalendarProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  features?: DynamicCalendarFeatures;
}
