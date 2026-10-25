// Kanban layout registry + board prefs. Card slots use the shared record model.
import { createDefaultRecordDesign } from '../DynamicData';
import type { RecordDesignConfig, RecordItemLayout } from '../DynamicData';

export type KanbanLayoutKind = 'compact' | 'comfortable' | 'detailed';

export interface KanbanDesignConfig extends RecordDesignConfig<KanbanLayoutKind> {
  /** Column key used to group cards into lanes. */
  groupByKey?: string;
  /** Hide lanes that currently have zero cards. */
  hideEmptyColumns: boolean;
  /** Lane width in px. */
  columnWidth: number;
}

export const KANBAN_DESIGN_STORAGE_KEY = 'dynamic_kanban_design_v1';

export const KANBAN_LAYOUTS: Record<KanbanLayoutKind, RecordItemLayout> = {
  compact: {
    label: 'Compact',
    description: 'Avatar, title and subtitle — tight for dense boards',
    arrangement: 'header',
    mediaSize: 28,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 0,
    itemClass: 'group flex flex-col gap-0 p-2.5 transition-all cursor-pointer',
    titleClass: 'font-semibold text-[12.5px]',
    subtitleClass: 'text-[10.5px]',
    fieldsClass: 'hidden',
    fieldsDivider: 'none',
    fieldCellClass: 'min-w-0 overflow-hidden',
    badgePlacement: 'trailing',
    containerClass: '',
  },
  comfortable: {
    label: 'Comfortable',
    description: 'Adds a couple of field chips under the title',
    arrangement: 'header',
    mediaSize: 32,
    mediaShape: 'circle',
    showFieldLabels: false,
    autoFieldCap: 2,
    itemClass: 'group flex flex-col gap-2 p-3 transition-all cursor-pointer',
    titleClass: 'font-semibold text-[12.5px] leading-snug',
    subtitleClass: 'text-[10.5px] leading-snug',
    // Compact meta lines under a hairline — avoid bulky chips / broken phone flex.
    fieldsClass: 'flex flex-col gap-1 min-w-0 w-full pt-2 border-t',
    fieldsDivider: 'theme',
    fieldCellClass:
      'min-w-0 w-full h-6 overflow-hidden flex items-center leading-none [&_span]:text-[11.5px] [&_span]:leading-none [&_.group]:ml-0 [&_.group]:w-full [&_.group]:min-w-0',
    badgePlacement: 'trailing',
    containerClass: '',
  },
  detailed: {
    label: 'Detailed',
    description: 'Labeled fields in two columns',
    arrangement: 'header',
    mediaSize: 34,
    mediaShape: 'circle',
    showFieldLabels: true,
    autoFieldCap: 5,
    itemClass: 'group flex flex-col gap-2.5 p-3.5 transition-all cursor-pointer',
    titleClass: 'font-semibold text-[13px] leading-snug',
    subtitleClass: 'text-[11px] leading-snug',
    fieldsClass: 'grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t min-w-0',
    fieldsDivider: 'theme',
    fieldCellClass:
      'min-w-0 overflow-hidden flex flex-col gap-1 [&_.group]:min-w-0 [&_.group]:w-full [&_.group]:gap-1 [&_span]:text-[12px] [&_span]:leading-none [&_span]:font-medium [&_.group>a:first-child]:size-3.5 [&_.group>a:first-child_svg]:size-3',
    badgePlacement: 'trailing',
    containerClass: '',
  },
};

export function createDefaultKanbanDesign(
  layout: KanbanLayoutKind = 'comfortable',
  groupByKey?: string,
): KanbanDesignConfig {
  return {
    ...createDefaultRecordDesign<KanbanLayoutKind>(layout, KANBAN_LAYOUTS[layout], {
      // Status lives on the column — don't repeat it on every card.
      status: { show: false },
      badge: { show: false },
      cornerRadius: 12,
      excludeIdentityFields: true,
    }),
    groupByKey,
    hideEmptyColumns: false,
    columnWidth: 280,
  };
}
