import type { ColumnConfig, DataRow } from '../DynamicData';

export interface DynamicKanbanFeatures {
  /** Column key to group cards by. Defaults to the first `status` column, else first `dropdown`. */
  groupByKey?: string;
  enableSearch?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableFullScreen?: boolean;
  enableOpenDetail?: boolean;
  /** Allow dragging cards between columns to update the group field. */
  enableDragUpdate?: boolean;
}

/** Shared flags default off — `sharedViewFeaturesStore` is the source of truth. */
export const DEFAULT_KANBAN_FEATURES: Required<Omit<DynamicKanbanFeatures, 'groupByKey'>> = {
  enableSearch: false,
  enableRefresh: false,
  enableExport: false,
  enableFullScreen: false,
  enableOpenDetail: false,
  enableDragUpdate: true,
};

export interface DynamicKanbanProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  features?: DynamicKanbanFeatures;
}
