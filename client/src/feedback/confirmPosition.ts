import {
  getSingleOverlayPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type ConfirmPosition = FeedbackPosition;
export type ConfirmPositionSettings = FeedbackPositionSettings;

export const DEFAULT_CONFIRM_POSITION: ConfirmPositionSettings = {
  desktop: 'center',
  mobile: 'center',
};

const STORAGE_KEY = 'feedback_confirm_position_v1';

export function loadConfirmPositionSettings(): ConfirmPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_CONFIRM_POSITION);
}

export function saveConfirmPositionSettings(settings: ConfirmPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getConfirmPositionClasses(position: ConfirmPosition): string {
  return getSingleOverlayPositionClasses(position);
}
