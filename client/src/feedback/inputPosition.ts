import {
  getSingleOverlayPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type InputPosition = FeedbackPosition;
export type InputPositionSettings = FeedbackPositionSettings;

export const DEFAULT_INPUT_POSITION: InputPositionSettings = {
  desktop: 'center',
  mobile: 'center',
};

const STORAGE_KEY = 'feedback_input_position_v1';

export function loadInputPositionSettings(): InputPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_INPUT_POSITION);
}

export function saveInputPositionSettings(settings: InputPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getInputPositionClasses(position: InputPosition): string {
  return getSingleOverlayPositionClasses(position);
}
