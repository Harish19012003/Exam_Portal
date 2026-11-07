/** Shared identity column across every exam sub-tab. */
export const CENTER_CODE_KEY = 'center_code';

/** Default / legacy tab — existing exam tables map here. */
export const DEFAULT_EXAM_VIEW = 'center-list';

/** Exam operational views (sidebar + /exams/:id/:subTab). */
export const EXAM_VIEWS = [
  { key: 'center-list', label: 'Center list' },
  { key: 'op-guard-list', label: 'Op/Guard List' },
  { key: 'mock-day', label: 'Mock Day' },
  { key: 'operator-guard-calling', label: 'Op/Guard Calling' },
  { key: 'exam-day', label: 'Exam Day' },
  { key: 'device-master', label: 'Device Master' },
];

export const EXAM_VIEW_KEYS = EXAM_VIEWS.map((v) => v.key);

export const examViewLabel = (key) =>
  EXAM_VIEWS.find((v) => v.key === key)?.label || String(key || DEFAULT_EXAM_VIEW);

export const isExamViewKey = (key) => EXAM_VIEW_KEYS.includes(String(key || ''));

/**
 * Field imported from another exam tab. Same key/value is shared; edits belong on the home tab.
 * `sharedFromView` stores the home tab key (e.g. 'center-list').
 */
export const isSharedImportedField = (field) => Boolean(field?.sharedFromView);
