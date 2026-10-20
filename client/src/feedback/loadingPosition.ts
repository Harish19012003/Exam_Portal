import {
  getSingleOverlayPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type LoadingPosition = FeedbackPosition;
export type LoadingPositionSettings = FeedbackPositionSettings;

export const DEFAULT_LOADING_POSITION: LoadingPositionSettings = {
  desktop: 'center',
  mobile: 'center',
};

const STORAGE_KEY = 'feedback_loading_position_v1';

export function loadLoadingPositionSettings(): LoadingPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_LOADING_POSITION);
}

export function saveLoadingPositionSettings(settings: LoadingPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getLoadingPositionClasses(position: LoadingPosition): string {
  return getSingleOverlayPositionClasses(position);
}
