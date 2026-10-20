import type { FeedbackComponentName } from './registry';
import type { ConfirmShowOptions, ToastVariant } from './types';

interface ConfirmPreset extends ConfirmShowOptions {
  variant: ToastVariant;
}

export const CONFIRM_PRESETS: Partial<Record<FeedbackComponentName, ConfirmPreset>> = {
  'confirm.default': {
    variant: 'info',
    title: 'Confirm action',
    message: 'Are you sure you want to proceed?',
    tertiary: 'This action can be reversed later.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Confirm',
    confirmVariant: 'primary',
  },
  'confirm.delete': {
    variant: 'error',
    title: 'Delete item?',
    message: 'This will permanently remove the selected item.',
    tertiary: 'This action cannot be undone.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete',
    confirmVariant: 'destructive',
  },
  'confirm.discard': {
    variant: 'warning',
    title: 'Discard changes?',
    message: 'You have unsaved changes that will be lost.',
    tertiary: 'Save your work before leaving this page.',
    cancelLabel: 'Keep editing',
    confirmLabel: 'Discard',
    confirmVariant: 'destructive',
  },
  'confirm.custom': {
    variant: 'info',
    title: 'Choose an action',
    message: 'How would you like to handle this request?',
    tertiary: 'You can change this later in settings.',
    actions: [
      { label: 'Cancel', variant: 'secondary' },
      { label: 'Save draft', variant: 'secondary' },
      { label: 'Publish', variant: 'primary' },
    ],
  },
};

export function resolveConfirmShow(
  name: FeedbackComponentName,
  overrides?: ConfirmShowOptions,
): ConfirmPreset & ConfirmShowOptions {
  const preset = CONFIRM_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Confirm',
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isConfirmName(name: FeedbackComponentName): boolean {
  return name.startsWith('confirm.');
}

export function isCustomConfirm(name: FeedbackComponentName): boolean {
  return name === 'confirm.custom';
}
