import type { FeedbackComponentName } from './registry';

export function isFieldName(name: FeedbackComponentName): boolean {
  return name.startsWith('field.');
}
