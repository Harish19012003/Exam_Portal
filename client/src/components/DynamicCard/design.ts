// Card layout registry. The record model itself (slots, resolution, persistence)
// is shared — see DynamicData/recordDesign.ts. Only arrangement lives here.
import { createDefaultRecordDesign } from '../DynamicData';
import type { RecordDesignConfig, RecordItemLayout } from '../DynamicData';

export type CardLayoutKind = 'card' | 'gallery' | 'compact' | 'cover';

export type CardDesignConfig = RecordDesignConfig<CardLayoutKind>;

export const CARD_DESIGN_STORAGE_KEY = 'dynamic_card_design_v1';
export const CARD_DEFAULT_LAYOUT_KEY = 'dynamic_card_default_layout_v1';

// Class strings for 'card' and 'gallery' are carried over verbatim from the
// previous hardcoded branches so the default rendering is unchanged.
export const CARD_LAYOUTS: Record<CardLayoutKind, RecordItemLayout> = {
  card: {
    label: 'Card',
    description: 'Avatar beside the title, fields in two columns',
    arrangement: 'header',
    mediaSize: 40,
    mediaShape: 'circle',
    showFieldLabels: true,
    autoFieldCap: 4,
    itemClass: 'group flex flex-col gap-3 p-4 border transition-all cursor-pointer',
    titleClass: 'font-semibold text-[13.5px]',
    subtitleClass: 'text-[11px]',
    fieldsClass: 'grid grid-cols-2 gap-y-1.5 gap-x-2 pt-3 border-t min-w-0',
    fieldsDivider: 'theme',
    fieldCellClass: 'min-w-0 overflow-hidden',
    badgePlacement: 'trailing',
    containerClass:
      'grid w-full min-w-0 gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  },
  gallery: {
    label: 'Gallery',
    description: 'Large centred avatar, image-first',
    arrangement: 'stacked',
    mediaSize: 72,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 2,
    itemClass: 'group flex flex-col items-center text-center gap-2.5 p-5 border transition-all cursor-pointer',
    titleClass: 'font-bold text-[14px]',
    subtitleClass: 'text-[11.5px]',
    fieldsClass: 'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1 pt-2 border-t w-full min-w-0',
    fieldsDivider: 'dashed',
    fieldCellClass: 'min-w-0 max-w-full overflow-hidden flex items-center justify-center',
    badgePlacement: 'trailing',
    containerClass:
      'grid w-full min-w-0 gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  },
  compact: {
    label: 'Compact',
    description: 'Dense single-line rows, more per screen',
    arrangement: 'inline',
    mediaSize: 32,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 2,
    itemClass: 'group flex items-center gap-3 px-3 py-2 border transition-all cursor-pointer',
    titleClass: 'font-semibold text-[13px]',
    subtitleClass: 'text-[10.5px]',
    // Chips only when the row has room; fixed 110px widths were blowing out multi-col grids.
    fieldsClass: 'hidden 2xl:flex items-center gap-2 min-w-0 overflow-hidden flex-shrink',
    fieldsDivider: 'none',
    fieldCellClass: 'min-w-0 w-[100px] max-w-[100px] overflow-hidden',
    badgePlacement: 'title-inline',
    containerClass: 'grid w-full min-w-0 gap-2 grid-cols-1 lg:grid-cols-2',
  },
  cover: {
    label: 'Cover',
    description: 'Full-width media banner above the details',
    arrangement: 'cover',
    mediaSize: 96,
    mediaShape: 'rounded',
    showFieldLabels: true,
    autoFieldCap: 4,
    itemClass: 'group flex flex-col gap-0 p-0 overflow-hidden border transition-all cursor-pointer',
    titleClass: 'font-bold text-[14px]',
    subtitleClass: 'text-[11.5px]',
    fieldsClass: 'grid grid-cols-2 gap-y-1.5 gap-x-2 pt-3 border-t min-w-0',
    fieldsDivider: 'theme',
    fieldCellClass: 'min-w-0 overflow-hidden',
    badgePlacement: 'trailing',
    containerClass:
      'grid w-full min-w-0 gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  },
};

export const CARD_LAYOUT_KEYS = Object.keys(CARD_LAYOUTS) as CardLayoutKind[];

export function createDefaultCardDesign(layout: CardLayoutKind = 'card'): CardDesignConfig {
  return createDefaultRecordDesign<CardLayoutKind>(layout, CARD_LAYOUTS[layout], {
    // The old card layout never rendered identity.badge (only the list did).
    badge: { show: layout === 'compact' },
  });
}
