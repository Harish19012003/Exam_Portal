export type FeedbackPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface FeedbackPositionSettings {
  desktop: FeedbackPosition;
  mobile: FeedbackPosition;
}

export const FEEDBACK_POSITION_LABELS: Record<FeedbackPosition, string> = {
  'top-left': 'Top left corner',
  'top-center': 'Top center',
  'top-right': 'Top right corner',
  center: 'Center',
  'bottom-left': 'Bottom left corner',
  'bottom-center': 'Bottom center',
  'bottom-right': 'Bottom right corner',
};

export const FEEDBACK_POSITION_OPTIONS: FeedbackPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function isValidFeedbackPosition(v: unknown): v is FeedbackPosition {
  return typeof v === 'string' && FEEDBACK_POSITION_OPTIONS.includes(v as FeedbackPosition);
}

/** Tailwind classes for stacked toast container */
export function getStackPositionClasses(position: FeedbackPosition): string {
  switch (position) {
    case 'top-left':
      return 'top-4 sm:top-6 left-4 sm:left-6 right-auto translate-x-0 items-start flex-col';
    case 'top-center':
      return 'top-4 sm:top-6 left-1/2 -translate-x-1/2 items-center flex-col';
    case 'top-right':
      return 'top-4 sm:top-6 right-4 sm:right-6 left-auto translate-x-0 items-end flex-col';
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center flex-col';
    case 'bottom-left':
      return 'bottom-4 sm:bottom-6 left-4 sm:left-6 right-auto translate-x-0 items-start flex-col-reverse';
    case 'bottom-center':
      return 'bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 items-center flex-col-reverse';
    case 'bottom-right':
      return 'bottom-4 sm:bottom-6 right-4 sm:right-6 left-auto translate-x-0 items-end flex-col-reverse';
  }
}

/** Tailwind classes for a single positioned overlay (alert modal) */
export function getSingleOverlayPositionClasses(position: FeedbackPosition): string {
  switch (position) {
    case 'top-left':
      return 'top-4 sm:top-6 left-4 sm:left-6 right-auto bottom-auto translate-x-0 translate-y-0';
    case 'top-center':
      return 'top-4 sm:top-6 left-1/2 -translate-x-1/2 right-auto bottom-auto translate-y-0';
    case 'top-right':
      return 'top-4 sm:top-6 right-4 sm:right-6 left-auto bottom-auto translate-x-0 translate-y-0';
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    case 'bottom-left':
      return 'bottom-4 sm:bottom-6 left-4 sm:left-6 right-auto top-auto translate-x-0 translate-y-0';
    case 'bottom-center':
      return 'bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 top-auto translate-y-0';
    case 'bottom-right':
      return 'bottom-4 sm:bottom-6 right-4 sm:right-6 left-auto top-auto translate-x-0 translate-y-0';
  }
}

export function loadPositionSettings(
  storageKey: string,
  defaults: FeedbackPositionSettings,
): FeedbackPositionSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<FeedbackPositionSettings>;
    return {
      desktop: isValidFeedbackPosition(parsed.desktop) ? parsed.desktop : defaults.desktop,
      mobile: isValidFeedbackPosition(parsed.mobile) ? parsed.mobile : defaults.mobile,
    };
  } catch {
    return defaults;
  }
}

export function savePositionSettings(storageKey: string, settings: FeedbackPositionSettings): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/** Full-width flash banner anchor — top positions pin to viewport top (y=0) */
export function getFlashPositionClasses(position: FeedbackPosition): string {
  switch (position) {
    case 'top-left':
    case 'top-center':
    case 'top-right':
      return 'top-0 left-0 right-0 flex-col';
    case 'bottom-left':
    case 'bottom-center':
    case 'bottom-right':
      return 'bottom-0 left-0 right-0 flex-col-reverse';
    case 'center':
      return 'top-1/2 left-0 right-0 -translate-y-1/2 flex-col';
  }
}

export function getFlashInnerAlign(position: FeedbackPosition): string {
  if (position.endsWith('-right')) return 'justify-end';
  if (position.endsWith('-center') || position === 'center') return 'justify-center';
  return 'justify-start';
}

/** @deprecated Use getFlashInnerAlign */
export function getFlashContentAlign(position: FeedbackPosition): string {
  return getFlashInnerAlign(position);
}
