import type { FeedbackComponentName } from './registry';
import type { ToastShowOptions, ToastVariant } from './types';

interface ToastPreset extends ToastShowOptions {
  variant: ToastVariant;
}

export const TOAST_PRESETS: Partial<Record<FeedbackComponentName, ToastPreset>> = {
  'toast.success': {
    variant: 'success',
    title: 'Success',
    message: 'Operation completed successfully!',
    tertiary: 'Your changes were saved and synced.',
    duration: 3000,
  },
  'toast.error': {
    variant: 'error',
    title: 'Error',
    message: 'Something went wrong. Please try again.',
    tertiary: 'This toast stays until you dismiss it.',
    duration: null,
  },
  'toast.warning': {
    variant: 'warning',
    title: 'Warning',
    message: 'Please review before continuing.',
    duration: 5000,
  },
  'toast.info': {
    variant: 'info',
    title: 'Info',
    message: 'Your changes will sync automatically.',
    duration: 4000,
  },
  'toast.action': {
    variant: 'info',
    title: 'New comment',
    message: 'Sarah left a note on your project.',
    duration: null,
    actions: [
      { label: 'Dismiss', variant: 'secondary' },
      { label: 'View', variant: 'primary' },
    ],
  },
  'toast.undo': {
    variant: 'info',
    title: 'Row deleted',
    message: 'This action can be undone within 15 seconds.',
    duration: null,
    undoDuration: 15000,
  },
  'toast.undoEdit': {
    variant: 'info',
    title: 'Row updated',
    message: 'This action can be undone within 15 seconds.',
    duration: null,
    undoDuration: 15000,
  },
};

export function resolveToastShow(
  name: FeedbackComponentName,
  overrides?: ToastShowOptions,
): ToastPreset & ToastShowOptions {
  const preset = TOAST_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      duration: 3000,
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isToastName(name: FeedbackComponentName): boolean {
  return name.startsWith('toast.');
}
