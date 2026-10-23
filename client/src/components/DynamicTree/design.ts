// Tree layout registry. Parent nodes use the shared record model;
// expand/collapse chrome stays in the view.
import { createDefaultRecordDesign } from '../DynamicData';
import type { RecordDesignConfig, RecordItemLayout } from '../DynamicData';

export type TreeLayoutKind = 'comfortable' | 'compact';

export interface TreeDesignConfig extends RecordDesignConfig<TreeLayoutKind> {
  /** Show “N sub-items” chip on expandable parents. */
  showSubItemCount: boolean;
}

export const TREE_DESIGN_STORAGE_KEY = 'dynamic_tree_design_v1';
export const TREE_DEFAULT_LAYOUT_KEY = 'dynamic_tree_default_layout_v1';

export const TREE_LAYOUTS: Record<TreeLayoutKind, RecordItemLayout> = {
  comfortable: {
    label: 'Comfortable',
    description: 'Avatar, title, subtitle and a few field chips',
    arrangement: 'inline',
    mediaSize: 32,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 2,
    // Flat divider rows below lg — no per-row “mini cards”.
    itemClass:
      'group flex items-center gap-2.5 px-3 py-2.5 border-0 border-b border-gray-100 lg:border lg:border-gray-100 transition-colors cursor-pointer rounded-none lg:[border-radius:var(--record-radius)]',
    titleClass: 'font-semibold text-[13px]',
    subtitleClass: 'text-[11px]',
    fieldsClass: 'hidden lg:flex items-center gap-3 flex-shrink-0 min-w-0',
    fieldsDivider: 'none',
    fieldCellClass: 'w-[100px] max-w-[100px] min-w-0 overflow-hidden flex items-center justify-start [&_*]:text-[11px]',
    badgePlacement: 'trailing',
    containerClass: 'flex flex-col gap-0 lg:gap-1',
    flattenOnMobile: true,
  },
  compact: {
    label: 'Compact',
    description: 'Tighter rows for deep trees',
    arrangement: 'inline',
    mediaSize: 28,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 1,
    itemClass:
      'group flex items-center gap-2 px-3 py-2 border-0 border-b border-gray-100 lg:border lg:border-gray-100 transition-colors cursor-pointer rounded-none lg:[border-radius:var(--record-radius)]',
    titleClass: 'font-semibold text-[12.5px]',
    subtitleClass: 'text-[10.5px]',
    fieldsClass: 'hidden lg:flex items-center gap-2.5 flex-shrink-0 min-w-0',
    fieldsDivider: 'none',
    fieldCellClass: 'w-[90px] max-w-[90px] min-w-0 overflow-hidden flex items-center justify-start [&_*]:text-[11px]',
    badgePlacement: 'trailing',
    containerClass: 'flex flex-col gap-0 lg:gap-0.5',
    flattenOnMobile: true,
  },
};

export const TREE_LAYOUT_KEYS = Object.keys(TREE_LAYOUTS) as TreeLayoutKind[];

export function createDefaultTreeDesign(layout: TreeLayoutKind = 'comfortable'): TreeDesignConfig {
  return {
    ...createDefaultRecordDesign<TreeLayoutKind>(layout, TREE_LAYOUTS[layout], {
      badge: { show: false },
      cornerRadius: 10,
      excludeIdentityFields: true,
    }),
    showSubItemCount: true,
  };
}
