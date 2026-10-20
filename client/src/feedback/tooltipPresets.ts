import type { FeedbackComponentName } from './registry';
import type { ToastVariant, TooltipShowOptions } from './types';
import type { TooltipDesignKind } from './tooltipTokens';

interface TooltipPreset extends TooltipShowOptions {
  variant: ToastVariant;
}

export const TOOLTIP_PRESETS: Partial<Record<FeedbackComponentName, TooltipPreset>> = {
  'tooltip.default': {
    variant: 'info',
    message: 'Sort by this column · Click again to reverse order.',
  },
  'tooltip.info': {
    variant: 'info',
    message: 'Exports include visible columns only.',
    tertiary: 'Hidden columns are omitted from CSV and Excel downloads.',
  },
  'tooltip.shortcut': {
    variant: 'info',
    message: 'Open command palette',
    shortcut: '⌘ K',
  },
  'tooltip.rich': {
    variant: 'info',
    title: 'Pinned columns',
    message: 'Pinned columns stay visible while you scroll horizontally.',
    tertiary: 'Drag a column header to reorder pins.',
  },
  'tooltip.compact': {
    variant: 'info',
    message: 'Double-click to fit column width',
  },
  'tooltip.dark': {
    variant: 'info',
    message: 'Read-only field',
    tertiary: 'Contact an admin to request edit access.',
  },
  'tooltip.brand': {
    variant: 'info',
    title: 'VisionHQ Pro',
    message: 'Upgrade to unlock advanced filters and scheduled exports.',
  },
  'tooltip.icon': {
    variant: 'info',
    title: 'Smart filter',
    message: 'Filters apply instantly as you type — no need to press Enter.',
  },
  'tooltip.warning': {
    variant: 'warning',
    title: 'Unsaved changes',
    message: 'You have edits that are not saved yet.',
    tertiary: 'Leave anyway or save before navigating away.',
  },
  'tooltip.success': {
    variant: 'success',
    title: 'Synced',
    message: 'Your view was saved to the cloud.',
  },
  'tooltip.multiShortcut': {
    variant: 'info',
    message: 'Table shortcuts',
    shortcuts: ['⌘ C', '⌘ V', '⌘ Z', '⌘ ⇧ Z'],
  },
  'tooltip.list': {
    variant: 'info',
    title: 'Quick tips',
    items: [
      'Drag headers to reorder columns',
      'Shift + click to multi-sort',
      'Right-click a cell for row actions',
    ],
  },
  'tooltip.caret': {
    variant: 'info',
    message: 'Hover any icon for help',
    tertiary: 'Tooltips anchor to the trigger in production.',
  },
};

const TOOLTIP_KIND_MAP: Partial<Record<FeedbackComponentName, TooltipDesignKind>> = {
  'tooltip.info': 'info',
  'tooltip.shortcut': 'shortcut',
  'tooltip.rich': 'rich',
  'tooltip.compact': 'compact',
  'tooltip.dark': 'dark',
  'tooltip.brand': 'brand',
  'tooltip.icon': 'icon',
  'tooltip.warning': 'status',
  'tooltip.success': 'status',
  'tooltip.multiShortcut': 'multiShortcut',
  'tooltip.list': 'list',
  'tooltip.caret': 'caret',
};

export function resolveTooltipShow(
  name: FeedbackComponentName,
  overrides?: TooltipShowOptions,
): TooltipPreset & TooltipShowOptions {
  const preset = TOOLTIP_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      message: `${name} is not implemented yet.`,
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isTooltipName(name: FeedbackComponentName): boolean {
  return name.startsWith('tooltip.');
}

export function getTooltipKind(name: FeedbackComponentName): TooltipDesignKind {
  return TOOLTIP_KIND_MAP[name] ?? 'default';
}
