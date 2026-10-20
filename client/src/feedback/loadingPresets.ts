import type { FeedbackComponentName } from './registry';
import type { LoadingShowOptions, ToastVariant } from './types';

interface LoadingPreset extends LoadingShowOptions {
  variant: ToastVariant;
}

export const LOADING_PRESETS: Partial<Record<FeedbackComponentName, LoadingPreset>> = {
  'loading.spinner': {
    variant: 'info',
    title: 'Loading',
    message: 'Fetching your data…',
    tertiary: 'This usually takes a few seconds.',
    duration: 4000,
  },
  'loading.loader': {
    variant: 'info',
    title: 'Please wait',
    message: 'Saving your changes…',
    tertiary: 'Do not close this window.',
    duration: null,
    overlay: true,
  },
  'loading.progressbar': {
    variant: 'info',
    title: 'Uploading file',
    message: 'report-q4.csv',
    progress: 65,
    duration: null,
    animateProgress: true,
  },
  'loading.indeterminate': {
    variant: 'info',
    title: 'Processing',
    message: 'Running calculations on 1,240 rows…',
    duration: 5000,
    indeterminate: true,
  },
  'loading.progresscircle': {
    variant: 'success',
    title: 'Syncing',
    message: 'Almost done',
    progress: 72,
    duration: null,
    animateProgress: true,
  },
  'loading.skeleton': {
    variant: 'info',
    title: 'Loading content',
    message: 'Placeholder layout while data loads.',
    duration: 5000,
  },
  'loading.dots': {
    variant: 'info',
    title: 'Working',
    message: 'Please wait a moment…',
    duration: 4000,
  },
};

export function resolveLoadingShow(
  name: FeedbackComponentName,
  overrides?: LoadingShowOptions,
): LoadingPreset & LoadingShowOptions {
  const preset = LOADING_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Loading',
      message: `${name} preview`,
      duration: 3500,
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isLoadingName(name: FeedbackComponentName): boolean {
  return name.startsWith('loading.');
}

export function isLoadingOverlay(name: FeedbackComponentName): boolean {
  return name === 'loading.loader';
}

export type LoadingKind =
  | 'spinner'
  | 'loader'
  | 'progressbar'
  | 'indeterminate'
  | 'progresscircle'
  | 'skeleton'
  | 'dots';

export function getLoadingKind(name: FeedbackComponentName): LoadingKind {
  if (name === 'loading.spinner') return 'spinner';
  if (name === 'loading.loader') return 'loader';
  if (name === 'loading.progressbar') return 'progressbar';
  if (name === 'loading.indeterminate') return 'indeterminate';
  if (name === 'loading.progresscircle') return 'progresscircle';
  if (name === 'loading.skeleton') return 'skeleton';
  return 'dots';
}
