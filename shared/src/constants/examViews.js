/** Shared identity column across every exam sub-tab. */
export const CENTER_CODE_KEY = 'center_code';

/** Exam Day row date column (one row per center × exam date). */
export const EXAM_DATE_KEY = 'exam_date';

/** Optional Exam Day column for that date’s Max Day N (copied at import). */
export const MAX_DAY_N_KEY = 'max_day_n';

/** Exam Day rollup of per-shift status columns (completed / partial / pending). */
export const MAX_STATUS_KEY = 'max_status';

/** Fixed options for per-shift Exam Day status (auto from Requested vs Reached). */
export const EXAM_DAY_STATUS_OPTIONS = ['completed', 'pending'];

/** Default / legacy tab — existing exam tables map here. */
export const DEFAULT_EXAM_VIEW = 'center-list';

/** Exam Day tab — live expanded view of Center list (center × date). */
export const EXAM_DAY_VIEW = 'exam-day';

/**
 * Nested bag on each Center list row for Exam Day–only values per exam date
 * (Reached, status, First T., Last T., and other Exam Day fields).
 * Shape: { [dateId]: { s1_reached, s1_status, s1_first_t, … } }
 */
export const EXAM_DAY_META_KEY = '__exam_day';

/** Exam operational views (sidebar + /exams/:id/:subTab). */
export const EXAM_VIEWS = [
  { key: 'center-list', label: 'Center list' },
  { key: 'op-guard-list', label: 'Op/Guard List' },
  { key: 'mock-day', label: 'Mock Day' },
  { key: 'operator-guard-calling', label: 'Op/Guard Calling' },
  { key: EXAM_DAY_VIEW, label: 'Exam Day' },
  { key: 'device-master', label: 'Device Master' },
];

export const EXAM_VIEW_KEYS = EXAM_VIEWS.map((v) => v.key);

/** Exam Day uses Center list rows + a different (expanded) view — not a separate row bag. */
export const isExamDayView = (view) => String(view || '').trim() === EXAM_DAY_VIEW;

/**
 * @deprecated Exam Day is a live view of Center list; no separate row set.
 * Kept as always-false so older calls do not open a second row bag.
 */
export const isOwnRowSetView = (_view) => false;

export const examViewLabel = (key) =>
  EXAM_VIEWS.find((v) => v.key === key)?.label || String(key || DEFAULT_EXAM_VIEW);

export const isExamViewKey = (key) => EXAM_VIEW_KEYS.includes(String(key || ''));

/**
 * Field imported from another exam tab. Same key/value is shared; edits belong on the home tab.
 * `sharedFromView` stores the home tab key (e.g. 'center-list').
 * `sharedFromLabel` optionally stores the human source name (preset name, e.g. "Bio Center List").
 */
export const isSharedImportedField = (field) => Boolean(field?.sharedFromView);

/**
 * Prefer the leading name when a compound label was stored
 * ("Bio Center List · Center list" → "Bio Center List").
 */
export const primarySourceName = (label) => {
  const raw = String(label || '').trim();
  if (!raw) return '';
  return raw.split(/\s*·\s*/)[0].trim() || raw;
};

/**
 * Full source name for tooltips / initials.
 * Uses stored preset name when present; otherwise resolves from `presets` (same service + view).
 */
export const importedSourceLabel = (field, { presets = [], preferredService = '' } = {}) => {
  const named = primarySourceName(field?.sharedFromLabel);
  if (named) return named;

  const view = String(field?.sharedFromView || '').trim();
  if (!view) return '';

  const list = Array.isArray(presets) ? presets : [];
  if (list.length) {
    const matches = list.filter((p) => String(p?.view || DEFAULT_EXAM_VIEW) === view);
    const svc = String(preferredService || '').trim();
    const sameService = svc
      ? matches.filter((p) => String(p?.serviceValue || '').trim() === svc)
      : [];
    const pick = sameService.length === 1 ? sameService[0] : matches.length === 1 ? matches[0] : null;
    const fromPreset = primarySourceName(pick?.name || pick?.serviceValue);
    if (fromPreset) return fromPreset;
  }

  return examViewLabel(view);
};

/**
 * Short form of a source name for badges — first letter of each word, uppercased.
 * Uses the leading name only (before ·). e.g. "Bio Center List" → "BCL".
 */
export const sourceNameInitials = (name, { max = 4 } = {}) => {
  const words = primarySourceName(name)
    .split(/[\s/_\-–—]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  if (!words.length) return '';
  const letters = words.map((w) => w[0].toUpperCase()).join('');
  return letters.slice(0, Math.max(1, max));
};
