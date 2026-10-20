import {
  getSingleOverlayPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type AlertPosition = FeedbackPosition;
export type AlertPositionSettings = FeedbackPositionSettings;

export const DEFAULT_ALERT_POSITION: AlertPositionSettings = {
  desktop: 'center',
  mobile: 'center',
};

const STORAGE_KEY = 'feedback_alert_position_v1';

export function loadAlertPositionSettings(): AlertPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_ALERT_POSITION);
}

export function saveAlertPositionSettings(settings: AlertPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getAlertPositionClasses(position: AlertPosition): string {
  return getSingleOverlayPositionClasses(position);
}
