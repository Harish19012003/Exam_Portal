// List layout registry. Record model is shared — only arrangement lives here.
import { createDefaultRecordDesign } from '../DynamicData';
import type { RecordDesignConfig, RecordItemLayout } from '../DynamicData';

export type ListLayoutKind = 'comfortable' | 'compact';

export type ListDesignConfig = RecordDesignConfig<ListLayoutKind>;

export const LIST_DESIGN_STORAGE_KEY = 'dynamic_list_design_v1';
export const LIST_DEFAULT_LAYOUT_KEY = 'dynamic_list_default_layout_v1';

export const LIST_LAYOUTS: Record<ListLayoutKind, RecordItemLayout> = {
  comfortable: {
    label: 'Comfortable',
    description: 'Spacious rows with avatar and field chips',
    arrangement: 'inline',
    mediaSize: 40,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 3,
    // Flat divider rows below lg — no per-row “mini cards”.
    itemClass:
      'group flex items-center gap-3 px-4 py-3.5 border-0 border-b border-gray-100 max-lg:last:border-b-0 lg:border lg:border-gray-100 transition-colors cursor-pointer rounded-none lg:[border-radius:var(--record-radius)]',
    titleClass: 'font-semibold text-[13.5px]',
    subtitleClass: 'text-[11.5px]',
    fieldsClass: 'hidden lg:flex items-center gap-4 flex-shrink-0 min-w-0',
    fieldsDivider: 'none',
    fieldCellClass: 'w-[110px] max-w-[110px] min-w-0 overflow-hidden flex items-center justify-start',
    badgePlacement: 'title-inline',
    containerClass: 'flex flex-col gap-0 lg:gap-1.5',
    flattenOnMobile: true,
  },
  compact: {
    label: 'Compact',
    description: 'Denser rows, more records on screen',
    arrangement: 'inline',
    mediaSize: 32,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 2,
    itemClass:
      'group flex items-center gap-3 px-4 py-2.5 border-0 border-b border-gray-100 max-lg:last:border-b-0 lg:border lg:border-gray-100 transition-colors cursor-pointer rounded-none lg:[border-radius:var(--record-radius)]',
    titleClass: 'font-semibold text-[13px]',
    subtitleClass: 'text-[11px]',
    fieldsClass: 'hidden lg:flex items-center gap-3 flex-shrink-0 min-w-0',
    fieldsDivider: 'none',
    fieldCellClass: 'w-[100px] max-w-[100px] min-w-0 overflow-hidden flex items-center justify-start',
    badgePlacement: 'title-inline',
    containerClass: 'flex flex-col gap-0 lg:gap-1',
    flattenOnMobile: true,
  },
};

export const LIST_LAYOUT_KEYS = Object.keys(LIST_LAYOUTS) as ListLayoutKind[];

export function createDefaultListDesign(layout: ListLayoutKind = 'comfortable'): ListDesignConfig {
  return createDefaultRecordDesign<ListLayoutKind>(layout, LIST_LAYOUTS[layout], {
    badge: { show: true },
    cornerRadius: 12,
  });
}
