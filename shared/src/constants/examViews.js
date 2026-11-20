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

/** Op/Guard Calling tab — own row bag expanded from Center list. */
export const OPERATOR_GUARD_CALLING_VIEW = 'operator-guard-calling';

/**
 * Nested bag on each Center list row for Exam Day–only values per exam date
 * (Reached, status, First T., Last T., and other Exam Day fields).
 * Shape: { [dateId]: { s1_reached, s1_status, s1_first_t, … } }
 */
export const EXAM_DAY_META_KEY = '__exam_day';

/** Calling identity / soft-hide keys (stored on Calling rows, not Center list). */
export const CALLING_CENTER_ROW_ID_KEY = 'calling_center_row_id';
export const CALLING_DATE_ID_KEY = 'calling_date_id';
export const CALLING_SLOT_KEY = 'calling_slot';
export const CALLING_SHIFT_ID_KEY = 'calling_shift_id';
export const CALLING_HIDDEN_KEY = 'calling_hidden';

/** Preset / table feature: how Calling expands from Center list. */
export const CALLING_EXPAND_MODES = Object.freeze({
  MAX_DAY_N: 'max_day_n',
  PER_SHIFT: 'per_shift',
  /** One row per unit across configured categories (Male/Female/Baggage counts). */
  CATEGORY_COUNTS: 'category_counts',
});

/** How Calling rows are auto-named on sync. */
export const CALLING_LABEL_MODES = Object.freeze({
  NONE: 'none',
  /** Row 1 = firstLabel; rest = `${restPrefix} 1..n` */
  FIRST_NUMBERED: 'first_numbered',
  /** Category head + numbered items (Frisking-style). */
  CATEGORY_HEAD: 'category_head',
  /** Same string on every row. */
  CONSTANT: 'constant',
});

/** Default field key for auto designation / role labels (overridable in preset). */
export const CALLING_LABEL_DEFAULT_TARGET_KEY = 'designation';

/** Exam operational views (sidebar + /exams/:id/:subTab). */
export const EXAM_VIEWS = [
  { key: 'center-list', label: 'Center list' },
  { key: 'op-guard-list', label: 'Op/Guard List' },
  { key: 'mock-day', label: 'Mock Day' },
  { key: OPERATOR_GUARD_CALLING_VIEW, label: 'Op/Guard Calling' },
  { key: EXAM_DAY_VIEW, label: 'Exam Day' },
  { key: 'device-master', label: 'Device Master' },
];

export const EXAM_VIEW_KEYS = EXAM_VIEWS.map((v) => v.key);

/** Exam Day uses Center list rows + a different (expanded) view — not a separate row set. */
export const isExamDayView = (view) => String(view || '').trim() === EXAM_DAY_VIEW;

export const isOperatorGuardCallingView = (view) =>
  String(view || '').trim() === OPERATOR_GUARD_CALLING_VIEW;

/**
 * Tabs that persist their own Mongo row bag (not the shared Center list spreadsheet).
 * Exam Day is live-expanded from Center list — not an own row set.
 */
export const isOwnRowSetView = (view) => isOperatorGuardCallingView(view);

/** System value keys allowed on Calling rows outside configured fields. */
export const CALLING_SYSTEM_KEYS = Object.freeze([
  CALLING_CENTER_ROW_ID_KEY,
  CALLING_DATE_ID_KEY,
  CALLING_SLOT_KEY,
  CALLING_SHIFT_ID_KEY,
  CALLING_HIDDEN_KEY,
]);

export const isCallingSystemKey = (key) => CALLING_SYSTEM_KEYS.includes(String(key || ''));

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
