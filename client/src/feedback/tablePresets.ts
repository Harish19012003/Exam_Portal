import type { FeedbackComponentName } from './registry';

export function isTableName(name: FeedbackComponentName): boolean {
  return name.startsWith('table.');
}
