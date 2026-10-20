import {
  getStackPositionClasses,
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type NotificationPosition = FeedbackPosition;
export type NotificationPositionSettings = FeedbackPositionSettings;

export const DEFAULT_NOTIFICATION_POSITION: NotificationPositionSettings = {
  desktop: 'top-right',
  mobile: 'top-right',
};

const STORAGE_KEY = 'feedback_notification_position_v1';

export function loadNotificationPositionSettings(): NotificationPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_NOTIFICATION_POSITION);
}

export function saveNotificationPositionSettings(settings: NotificationPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export function getNotificationPositionClasses(position: NotificationPosition): string {
  return getStackPositionClasses(position);
}
