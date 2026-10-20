import type { FeedbackComponentName } from './registry';
import type { AlertShowOptions, ToastVariant } from './types';

interface AlertPreset extends AlertShowOptions {
  variant: ToastVariant;
}

export const ALERT_PRESETS: Partial<Record<FeedbackComponentName, AlertPreset>> = {
  'alert.info': {
    variant: 'info',
    title: 'Information',
    message: 'Your session will expire in 5 minutes.',
    tertiary: 'Save your work to avoid losing changes.',
    okLabel: 'OK',
  },
  'alert.warning': {
    variant: 'warning',
    title: 'Warning',
    message: 'This action may affect other records.',
    tertiary: 'Review the details before continuing.',
    okLabel: 'Got it',
  },
  'alert.error': {
    variant: 'error',
    title: 'Error',
    message: 'Unable to save your changes.',
    tertiary: 'Check your connection and try again.',
    okLabel: 'OK',
  },
  'alert.success': {
    variant: 'success',
    title: 'Success',
    message: 'Your report has been generated.',
    tertiary: 'You can download it from the exports page.',
    okLabel: 'OK',
  },
};

export function resolveAlertShow(
  name: FeedbackComponentName,
  overrides?: AlertShowOptions,
): AlertPreset & AlertShowOptions {
  const preset = ALERT_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      okLabel: 'OK',
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isAlertName(name: FeedbackComponentName): boolean {
  return name.startsWith('alert.');
}
