import type { FeedbackComponentName } from './registry';
import type { PopupShowOptions, ToastVariant } from './types';

interface PopupPreset extends PopupShowOptions {
  variant: ToastVariant;
}

export const POPUP_PRESETS: Partial<Record<FeedbackComponentName, PopupPreset>> = {
  'popup.menu': {
    variant: 'info',
    title: 'Row actions',
    menuItems: [
      { label: 'Edit row' },
      { label: 'Duplicate' },
      { label: 'Share link' },
      { label: 'Delete row', variant: 'destructive' },
    ],
  },
  'popup.panel': {
    variant: 'info',
    title: 'Column settings',
    message: 'Adjust visibility, width, and formatting for this column.',
    tertiary: 'Changes apply to the current view only.',
    actions: [
      { label: 'Cancel', variant: 'secondary' },
      { label: 'Apply', variant: 'primary' },
    ],
  },
};

export function resolvePopupShow(
  name: FeedbackComponentName,
  overrides?: PopupShowOptions,
): PopupPreset & PopupShowOptions {
  const preset = POPUP_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isPopupName(name: FeedbackComponentName): boolean {
  return name.startsWith('popup.');
}

export function getPopupKind(name: FeedbackComponentName): 'menu' | 'panel' {
  if (name === 'popup.menu') return 'menu';
  return 'panel';
}
