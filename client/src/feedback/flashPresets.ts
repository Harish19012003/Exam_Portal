import type { FeedbackComponentName } from './registry';
import type { FlashShowOptions, ToastVariant } from './types';

interface FlashPreset extends FlashShowOptions {
  variant: ToastVariant;
}

export const FLASH_PRESETS: Partial<Record<FeedbackComponentName, FlashPreset>> = {
  'flash.info': {
    variant: 'info',
    title: 'Heads up',
    message: 'Your workspace has been synced successfully.',
    tertiary: 'All changes are now up to date.',
    duration: 6000,
    dismissible: true,
  },
  'flash.warning': {
    variant: 'warning',
    title: 'Important notice',
    message: 'Scheduled maintenance tonight from 11 PM to 1 AM.',
    tertiary: 'Some features may be temporarily unavailable.',
    duration: null,
    dismissible: true,
  },
  'flash.update': {
    variant: 'success',
    title: 'New version available',
    message: 'Dashboard v2.4 includes improved exports and faster filters.',
    tertiary: 'Update now to get the latest features.',
    duration: null,
    dismissible: true,
    action: { label: 'Learn more', variant: 'primary' },
  },
  'flash.sticky': {
    variant: 'info',
    title: 'Beta feature enabled',
    message: 'You are using the new table engine preview.',
    tertiary: 'Feedback is welcome — use the Help menu to report issues.',
    duration: null,
    dismissible: true,
  },
};

export function resolveFlashShow(
  name: FeedbackComponentName,
  overrides?: FlashShowOptions,
): FlashPreset & FlashShowOptions {
  const preset = FLASH_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      duration: 4000,
      dismissible: true,
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isFlashName(name: FeedbackComponentName): boolean {
  return name.startsWith('flash.');
}
