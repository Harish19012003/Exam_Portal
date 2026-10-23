// Calendar layout registry. In-cell events are tiny — layouts stay chip-scale.
// Board prefs (date field, density) live beside the shared record slots.
import { createDefaultRecordDesign } from '../DynamicData';
import type { RecordDesignConfig, RecordItemLayout } from '../DynamicData';

export type CalendarLayoutKind = 'chip' | 'stack';

export interface CalendarDesignConfig extends RecordDesignConfig<CalendarLayoutKind> {
  /** Column key plotted on the month grid. */
  dateFieldKey?: string;
  /** How many events to show per day before “+N more”. */
  maxEventsPerDay: number;
}

export const CALENDAR_DESIGN_STORAGE_KEY = 'dynamic_calendar_design_v1';

export const CALENDAR_LAYOUTS: Record<CalendarLayoutKind, RecordItemLayout> = {
  chip: {
    label: 'Chip',
    description: 'Avatar + title — densest day cells',
    arrangement: 'inline',
    mediaSize: 14,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 0,
    itemClass: 'group flex items-center gap-1 px-1 py-0.5 transition-colors cursor-pointer',
    titleClass: 'font-medium text-[10px]',
    subtitleClass: 'hidden',
    fieldsClass: 'hidden',
    fieldsDivider: 'none',
    fieldCellClass: 'hidden',
    badgePlacement: 'trailing',
    containerClass: '',
  },
  stack: {
    label: 'Stack',
    description: 'Title and subtitle stacked — fewer events fit',
    arrangement: 'inline',
    mediaSize: 18,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 0,
    itemClass: 'group flex items-center gap-1.5 px-1 py-1 transition-colors cursor-pointer',
    titleClass: 'font-medium text-[10.5px]',
    subtitleClass: 'text-[9px]',
    fieldsClass: 'hidden',
    fieldsDivider: 'none',
    fieldCellClass: 'hidden',
    badgePlacement: 'trailing',
    containerClass: '',
  },
};

/** Slightly larger layout for the day popover list. */
export const CALENDAR_OVERLAY_LAYOUT: RecordItemLayout = {
  label: 'Overlay',
  description: 'Day popover row',
  arrangement: 'inline',
  mediaSize: 28,
  mediaShape: 'circle',
  showFieldLabels: false,
  autoFieldCap: 0,
  itemClass: 'group flex items-center gap-2 p-2 transition-colors cursor-pointer',
  titleClass: 'font-semibold text-[12.5px]',
  subtitleClass: 'text-[11px]',
  fieldsClass: 'hidden',
  fieldsDivider: 'none',
  fieldCellClass: 'hidden',
  badgePlacement: 'trailing',
  containerClass: '',
};

export function createDefaultCalendarDesign(
  layout: CalendarLayoutKind = 'chip',
  dateFieldKey?: string,
): CalendarDesignConfig {
  return {
    ...createDefaultRecordDesign<CalendarLayoutKind>(layout, CALENDAR_LAYOUTS[layout], {
      // Day cells are too tight for status / badge chrome.
      status: { show: false },
      badge: { show: false },
      subtitle: { show: layout === 'stack' },
      cornerRadius: 6,
      excludeIdentityFields: true,
    }),
    dateFieldKey,
    maxEventsPerDay: 3,
  };
}
