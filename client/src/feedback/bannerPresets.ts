import type { FeedbackComponentName } from './registry';

export function isBannerName(name: FeedbackComponentName): boolean {
  return name.startsWith('banner.');
}
