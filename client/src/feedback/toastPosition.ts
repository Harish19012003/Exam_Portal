import {
  FEEDBACK_POSITION_LABELS,
  FEEDBACK_POSITION_OPTIONS,
  getStackPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type ToastPosition = FeedbackPosition;
export type ToastPositionSettings = FeedbackPositionSettings;

export const TOAST_POSITION_LABELS = FEEDBACK_POSITION_LABELS;
export const TOAST_POSITION_OPTIONS = FEEDBACK_POSITION_OPTIONS;

export const DEFAULT_TOAST_POSITION: ToastPositionSettings = {
  desktop: 'bottom-center',
  mobile: 'bottom-center',
};

const STORAGE_KEY = 'feedback_toast_position_v1';

export function loadToastPositionSettings(): ToastPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_TOAST_POSITION);
}

export function saveToastPositionSettings(settings: ToastPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getToastPositionClasses(position: ToastPosition): string {
  return getStackPositionClasses(position);
}
