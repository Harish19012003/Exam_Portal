import {
  getSingleOverlayPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type PopupPosition = FeedbackPosition;
export type PopupPositionSettings = FeedbackPositionSettings;

export const DEFAULT_POPUP_POSITION: PopupPositionSettings = {
  desktop: 'bottom-right',
  mobile: 'bottom-center',
};

const STORAGE_KEY = 'feedback_popup_position_v1';

export function loadPopupPositionSettings(): PopupPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_POPUP_POSITION);
}

export function savePopupPositionSettings(settings: PopupPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getPopupPositionClasses(position: PopupPosition): string {
  return getSingleOverlayPositionClasses(position);
}
