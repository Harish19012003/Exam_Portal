import {
  loadPositionSettings,
  savePositionSettings,
  type FeedbackPosition,
  type FeedbackPositionSettings,
} from './feedbackPosition';

export type FlashPosition = FeedbackPosition;
export type FlashPositionSettings = FeedbackPositionSettings;

export const DEFAULT_FLASH_POSITION: FlashPositionSettings = {
  desktop: 'top-center',
  mobile: 'top-center',
};

const STORAGE_KEY = 'feedback_flash_position_v1';

export function loadFlashPositionSettings(): FlashPositionSettings {
  return loadPositionSettings(STORAGE_KEY, DEFAULT_FLASH_POSITION);
}

export function saveFlashPositionSettings(settings: FlashPositionSettings): void {
  savePositionSettings(STORAGE_KEY, settings);
}

export { getFlashPositionClasses, getFlashInnerAlign } from './feedbackPosition';
