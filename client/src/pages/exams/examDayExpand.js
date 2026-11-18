/**
 * Expand Center list rows → Exam Day rows (one per center × exam date).
 * Skips a center+date when Max Day N (summary of that day’s shifts) is 0 or empty.
 */

import {
  CENTER_CODE_KEY,
  EXAM_DATE_KEY,
  EXAM_DAY_META_KEY,
  EXAM_DAY_STATUS_OPTIONS,
  MAX_DAY_N_KEY,
  MAX_STATUS_KEY,
  isSharedImportedField,
} from '@exam-view/shared';

/** Virtual Exam Day row id: `{centerRowId}::ed::{dateId}` */
export const EXAM_DAY_ROW_ID_SEP = '::ed::';

export const makeExamDayRowId = (centerRowId, dateId) =>
  `${String(centerRowId)}${EXAM_DAY_ROW_ID_SEP}${String(dateId)}`;

export const parseExamDayRowId = (rowId) => {
  const raw = String(rowId || '');
  const idx = raw.indexOf(EXAM_DAY_ROW_ID_SEP);
  if (idx <= 0) return null;
  const sourceRowId = raw.slice(0, idx);
  const dateId = raw.slice(idx + EXAM_DAY_ROW_ID_SEP.length);
  if (!sourceRowId || !dateId) return null;
  return { sourceRowId, dateId };
};

export const readExamDayMeta = (values) => {
  const bag = values && typeof values === 'object' ? values : {};
  const meta = bag[EXAM_DAY_META_KEY];
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {};
};

export const readExamDayDateMeta = (values, dateId) => {
  const day = readExamDayMeta(values)[String(dateId || '')];
  return day && typeof day === 'object' && !Array.isArray(day) ? { ...day } : {};
};

/** Roles whose values are live from Center list date×shift cells (not stored on Exam Day). */
export const isExamDayLiveCountRole = (role) => {
  const r = String(role || '');
  return r === 'shift' || r === 'examDate' || r === 'maxDayN';
};

/** Fields stored per center×date on the Center list row (`__exam_day[dateId]`). */
export const isExamDayPerDateStoredField = (field) => {
  if (!field) return false;
  const role = String(field.examDayImportRole || '');
  if (isExamDayLiveCountRole(role) || role === 'maxStatus') return false;
  // Status is derived from Requested + Reached (written on persist / expand); still stored.
  if (
    role === 'shiftReached' ||
    role === 'shiftStatus' ||
    role === 'shiftFirstT' ||
    role === 'shiftLastT'
  ) {
    return true;
  }
  if (isSharedImportedField(field)) return false;
  if (field.key === CENTER_CODE_KEY || field.key === EXAM_DATE_KEY || field.key === MAX_DAY_N_KEY) {
    return false;
  }
  if (field.key === MAX_STATUS_KEY || field.key === EXAM_DAY_META_KEY) return false;
  if (String(field.dataType || '') === 'formula') return false;
  if (String(field.key || '').startsWith('ds_')) return false;
  // Exam Day–only columns (not shared from Center list).
  return !isSharedImportedField(field);
};

/** True for auto-derived / system-stamped Exam Day columns (not user-edited). */
export const isExamDayDerivedRole = (role) => {
  const r = String(role || '');
  return (
    r === 'shiftStatus' ||
    r === 'shiftFirstT' ||
    r === 'shiftLastT' ||
    r === 'maxStatus'
  );
};

/** Per-shift Exam Day family: Requested, Reached, Status, First T., Last T. */
export const isExamDayShiftFamilyRole = (role) => {
  const r = String(role || '');
  return (
    r === 'shift' ||
    r === 'shiftReached' ||
    r === 'shiftStatus' ||
    r === 'shiftFirstT' ||
    r === 'shiftLastT'
  );
};

/**
 * Exam Day field keys that belong to Center-list–hidden shifts
 * (count + reached + status + first/last T.).
 */
export const examDayFieldKeysForHiddenShifts = ({
  fields = [],
  centerListDateShifts = null,
  hiddenShiftIds = null,
} = {}) => {
  const hidden = hiddenShiftIds instanceof Set ? hiddenShiftIds : new Set(hiddenShiftIds || []);
  const keys = new Set();
  if (!hidden.size) return keys;
  const list = Array.isArray(fields) ? fields : [];
  const suggestions = examDayShiftSuggestions(centerListDateShifts);
  suggestions.forEach((shift) => {
    if (!hidden.has(String(shift.id))) return;
    const matched = [
      matchExamDayShiftField(list, shift),
      matchExamDayShiftReachedField(list, shift),
      matchExamDayShiftStatusField(list, shift),
      matchExamDayShiftFirstTField(list, shift),
      matchExamDayShiftLastTField(list, shift),
    ];
    matched.forEach((f) => {
      const key = String(f?.key || '').trim();
      if (key) keys.add(key);
    });
    // Also hide by examDayShiftId even if matchers miss (manual key renames).
    list.forEach((f) => {
      if (String(f?.examDayShiftId || '').trim() !== String(shift.id)) return;
      if (!isExamDayShiftFamilyRole(f?.examDayImportRole) && f?.examDayImportRole) return;
      const key = String(f?.key || '').trim();
      if (key) keys.add(key);
    });
  });
  return keys;
};

/** Status keys for shifts that are still visible on Center list (for Max Status formula). */
export const examDayVisibleStatusKeys = ({
  fields = [],
  centerListDateShifts = null,
  hiddenShiftIds = null,
} = {}) => {
  const hidden = hiddenShiftIds instanceof Set ? hiddenShiftIds : new Set(hiddenShiftIds || []);
  const list = Array.isArray(fields) ? fields : [];
  const keys = [];
  examDayShiftSuggestions(centerListDateShifts).forEach((shift) => {
    if (hidden.has(String(shift.id))) return;
    const matched = matchExamDayShiftStatusField(list, shift);
    keys.push(matched?.key || examDayShiftStatusKey(shift));
  });
  return keys.filter(Boolean);
};
import {
  normalizeDateShiftsConfig,
  resolveDayAggregateFromRow,
  shiftKeysForDate,
} from './dateShiftsConfig';

/** Normalize tokens for matching shift labels ↔ Exam Day field keys/labels. */
export const normalizeShiftToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** Default shift columns when Center list dateShifts isn’t available yet. */
export const DEFAULT_EXAM_DAY_SHIFT_SUGGESTIONS = [
  { id: 's1', label: 'S1 Required', key: 's1' },
  { id: 's2', label: 'S2 Required', key: 's2' },
];

const suggestedKeyFromShiftLabel = (label, index) => {
  const m = String(label || '').match(/\bs\s*(\d+)\b/i);
  if (m) return `s${m[1]}`;
  const token = normalizeShiftToken(label).slice(0, 24);
  return token || `s${index + 1}`;
};

/**
 * Shift targets for Exam Day import columns.
 * Prefer Center list dateShifts.shifts; otherwise S1 / S2 defaults.
 */
export const examDayShiftSuggestions = (centerListDateShifts = null) => {
  const cfg = normalizeDateShiftsConfig(centerListDateShifts);
  const shifts = (cfg.shifts || []).filter((s) => String(s?.label || '').trim());
  if (!shifts.length) return DEFAULT_EXAM_DAY_SHIFT_SUGGESTIONS.map((s) => ({ ...s }));
  return shifts.map((s, i) => ({
    id: String(s.id || `shift_${i}`),
    label: String(s.label).trim(),
    key: suggestedKeyFromShiftLabel(s.label, i),
  }));
};

const toShiftNumber = (value) => {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const shiftMatchTokens = (shift) => {
  const tokens = new Set();
  const label = String(shift?.label || '').trim();
  const id = String(shift?.id || '').trim();
  [label, id].forEach((raw) => {
    const t = normalizeShiftToken(raw);
    if (t) tokens.add(t);
  });
  // "OP S1" / "S1 Required" → s1, ops1
  const m = label.match(/\bs\s*(\d+)\b/i) || id.match(/\bs\s*(\d+)\b/i);
  if (m) {
    tokens.add(`s${m[1]}`);
    tokens.add(`ops${m[1]}`);
    tokens.add(`s${m[1]}required`);
  }
  return [...tokens];
};

/**
 * Pick the Exam Day field that should receive a Center list shift value.
 * Prefers `examDayShiftId` meta, then key/label token match.
 */
const isShiftCountLikeField = (f) => {
  const role = String(f?.examDayImportRole || '');
  if (
    role === 'shiftStatus' ||
    role === 'shiftReached' ||
    role === 'shiftFirstT' ||
    role === 'shiftLastT' ||
    role === 'maxStatus' ||
    role === 'examDate' ||
    role === 'maxDayN'
  ) {
    return false;
  }
  const key = String(f?.key || '').trim();
  if (!key) return false;
  if (key === CENTER_CODE_KEY || key === EXAM_DATE_KEY || key === MAX_DAY_N_KEY) return false;
  if (key === MAX_STATUS_KEY) return false;
  if (/_status$/i.test(key) || /_reached$/i.test(key) || /_first_t$/i.test(key) || /_last_t$/i.test(key)) {
    return false;
  }
  if (String(f?.dataType || '') === 'formula') return false;
  return true;
};

export const matchExamDayShiftField = (fields, shift) => {
  const list = Array.isArray(fields) ? fields : [];
  const shiftId = String(shift?.id || '').trim();
  if (shiftId) {
    const byMeta = list.find(
      (f) =>
        String(f?.examDayShiftId || '').trim() === shiftId &&
        (String(f?.examDayImportRole || '') === 'shift' ||
          (!String(f?.examDayImportRole || '').trim() && isShiftCountLikeField(f))),
    );
    if (byMeta) return byMeta;
    const byMetaLoose = list.find(
      (f) => String(f?.examDayShiftId || '').trim() === shiftId && isShiftCountLikeField(f),
    );
    if (byMetaLoose) return byMetaLoose;
  }
  const tokens = shiftMatchTokens(shift);
  if (!tokens.length) return null;
  return (
    list.find((f) => {
      if (!isShiftCountLikeField(f)) return false;
      const key = String(f?.key || '').trim();
      const k = normalizeShiftToken(key);
      const l = normalizeShiftToken(f?.label);
      return tokens.some((t) => t && (k === t || l === t || k.startsWith(t) || l.startsWith(t)));
    }) || null
  );
};

const shiftBaseKey = (shift) =>
  String(shift?.key || suggestedKeyFromShiftLabel(shift?.label, 0) || 's')
    .trim()
    .replace(/_status$/i, '')
    .replace(/_reached$/i, '')
    .replace(/_first_t$/i, '')
    .replace(/_last_t$/i, '');

/** Suggested key for a shift’s status column (`s1` → `s1_status`). */
export const examDayShiftStatusKey = (shift) => {
  const base = shiftBaseKey(shift);
  return base.endsWith('_status') ? base : `${base}_status`;
};

/** Suggested key for a shift’s reached column (`s1` → `s1_reached`). */
export const examDayShiftReachedKey = (shift) => `${shiftBaseKey(shift)}_reached`;

/**
 * Per-shift status from Requested (count) vs Reached.
 * Reached >= Requested → completed; empty Reached or shortfall → pending.
 */
export const computeExamDayShiftStatus = (requested, reached) => {
  const rch = toShiftNumber(reached);
  if (rch == null) return 'pending';
  const req = toShiftNumber(requested);
  if (req == null) return 'pending';
  return rch >= req ? 'completed' : 'pending';
};

const shiftHintFromReachedField = (reachedField) => {
  const shiftId = String(reachedField?.examDayShiftId || '').trim();
  const reachedKey = String(reachedField?.key || '').trim();
  const base = reachedKey.replace(/_reached$/i, '');
  return {
    id: shiftId,
    key: base,
    label:
      String(reachedField?.label || '')
        .replace(/\s*reached\s*$/i, '')
        .trim() || base,
  };
};

/**
 * Recompute every shift Status from Requested vs Reached on a values bag.
 * Pairs by role / examDayShiftId / key suffix — does not depend on Center shift order.
 */
export const applyExamDayDerivedStatuses = (values = {}, fields = []) => {
  const list = Array.isArray(fields) ? fields : [];
  const next = values && typeof values === 'object' ? { ...values } : {};

  list.forEach((reachedField) => {
    const reachedKey = String(reachedField?.key || '').trim();
    if (!reachedKey) return;
    const role = String(reachedField?.examDayImportRole || '');
    if (role !== 'shiftReached' && !/_reached$/i.test(reachedKey)) return;

    const hint = shiftHintFromReachedField(reachedField);
    const statusKeyGuess = `${hint.key}_status`;
    const statusField =
      matchExamDayShiftStatusField(list, hint) ||
      list.find((f) => String(f?.key || '').trim() === statusKeyGuess) ||
      list.find(
        (f) =>
          String(f?.examDayImportRole || '') === 'shiftStatus' &&
          hint.id &&
          String(f?.examDayShiftId || '').trim() === hint.id,
      );
    if (!statusField?.key) return;

    const countField =
      matchExamDayShiftField(list, hint) ||
      list.find(
        (f) => String(f?.key || '').trim() === hint.key && isShiftCountLikeField(f),
      ) ||
      list.find(
        (f) =>
          String(f?.examDayImportRole || '') === 'shift' &&
          hint.id &&
          String(f?.examDayShiftId || '').trim() === hint.id,
      );

    next[statusField.key] = computeExamDayShiftStatus(
      countField?.key ? next[countField.key] : null,
      next[reachedKey],
    );
  });

  return next;
};

/** Match OP S1 Reached / s1_reached for a shift. */
export const matchExamDayShiftReachedField = (fields, shift) => {
  const list = Array.isArray(fields) ? fields : [];
  const shiftId = String(shift?.id || '').trim();
  if (shiftId) {
    const byMeta = list.find(
      (f) =>
        String(f?.examDayImportRole || '') === 'shiftReached' &&
        String(f?.examDayShiftId || '').trim() === shiftId,
    );
    if (byMeta) return byMeta;
  }
  const wantKey = examDayShiftReachedKey(shift);
  const byKey = list.find((f) => String(f?.key || '').trim() === wantKey);
  if (byKey) return byKey;
  const wantLabel = normalizeShiftToken(`${shift?.label || ''} reached`);
  return (
    list.find((f) => {
      if (String(f?.examDayImportRole || '') === 'shiftReached') {
        const l = normalizeShiftToken(f?.label);
        return Boolean(wantLabel) && l === wantLabel;
      }
      const l = normalizeShiftToken(f?.label);
      return Boolean(wantLabel) && l === wantLabel;
    }) || null
  );
};

/** Match OP S1 status / s1_status for a shift. */
export const matchExamDayShiftStatusField = (fields, shift) => {
  const list = Array.isArray(fields) ? fields : [];
  const shiftId = String(shift?.id || '').trim();
  if (shiftId) {
    const byMeta = list.find(
      (f) =>
        String(f?.examDayImportRole || '') === 'shiftStatus' &&
        String(f?.examDayShiftId || '').trim() === shiftId,
    );
    if (byMeta) return byMeta;
  }
  const wantKey = examDayShiftStatusKey(shift);
  const byKey = list.find((f) => String(f?.key || '').trim() === wantKey);
  if (byKey) return byKey;
  const wantLabel = normalizeShiftToken(`${shift?.label || ''} status`);
  return (
    list.find((f) => {
      if (String(f?.examDayImportRole || '') === 'maxStatus') return false;
      const key = String(f?.key || '').trim();
      if (key === MAX_STATUS_KEY) return false;
      const l = normalizeShiftToken(f?.label);
      return Boolean(wantLabel) && l === wantLabel;
    }) || null
  );
};

/**
 * Max Status formula: all completed → completed;
 * any completed (rest pending/blank) → partial; else pending.
 */
export const buildMaxStatusFormula = (statusKeys = []) => {
  const keys = (Array.isArray(statusKeys) ? statusKeys : [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (!keys.length) return '""';
  const refs = keys.map((k) => `{${k}}`);
  const allCompleted = refs.map((r) => `${r}==="completed"`).join('&&');
  const anyCompleted = refs.map((r) => `${r}==="completed"`).join('||');
  return `IFS(${allCompleted},"completed",${anyCompleted},"partial",true,"pending")`;
};

export const matchMaxStatusField = (fields) => {
  const list = Array.isArray(fields) ? fields : [];
  const byRole = list.find((f) => String(f?.examDayImportRole || '') === 'maxStatus');
  if (byRole) return byRole;
  if (list.some((f) => f?.key === MAX_STATUS_KEY)) {
    return list.find((f) => f.key === MAX_STATUS_KEY) || null;
  }
  return list.find((f) => /max\s*status/i.test(String(f?.label || ''))) || null;
};

/** `s1` → `s1_first_t` (OP S1 First T.). */
export const examDayShiftFirstTKey = (shift) => `${shiftBaseKey(shift)}_first_t`;

/** `s1` → `s1_last_t` (OP S1 Last T.). */
export const examDayShiftLastTKey = (shift) => `${shiftBaseKey(shift)}_last_t`;

const matchTimestampField = (fields, shift, role, keyFn, labelSuffix) => {
  const list = Array.isArray(fields) ? fields : [];
  const shiftId = String(shift?.id || '').trim();
  if (shiftId) {
    const byMeta = list.find(
      (f) =>
        String(f?.examDayImportRole || '') === role &&
        String(f?.examDayShiftId || '').trim() === shiftId,
    );
    if (byMeta) return byMeta;
  }
  const wantKey = keyFn(shift);
  const byKey = list.find((f) => String(f?.key || '').trim() === wantKey);
  if (byKey) return byKey;
  const wantLabel = normalizeShiftToken(`${shift?.label || ''} ${labelSuffix}`);
  return (
    list.find((f) => normalizeShiftToken(f?.label) === wantLabel) || null
  );
};

export const matchExamDayShiftFirstTField = (fields, shift) =>
  matchTimestampField(fields, shift, 'shiftFirstT', examDayShiftFirstTKey, 'first t');

export const matchExamDayShiftLastTField = (fields, shift) =>
  matchTimestampField(fields, shift, 'shiftLastT', examDayShiftLastTKey, 'last t');

const cellValueEqual = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

const isReachedEmpty = (value) => {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

/**
 * When a shift Reached cell changes:
 * - Last T. always updates (including clear)
 * - First T. set once when Reached first becomes non-empty; kept on clear
 * - Status auto-filled from Requested (count) vs Reached
 *
 * `rowValues` should include live count keys (e.g. s1) for Requested comparison.
 */
export const applyExamDayReachedSideEffects = ({
  fields = [],
  previousValues = {},
  nextPatch = {},
  rowValues = {},
  now = new Date().toISOString(),
} = {}) => {
  const list = Array.isArray(fields) ? fields : [];
  const prev = previousValues && typeof previousValues === 'object' ? previousValues : {};
  const patch = nextPatch && typeof nextPatch === 'object' ? nextPatch : {};
  const row = rowValues && typeof rowValues === 'object' ? rowValues : {};
  const out = {};

  const reachedFields = list.filter((f) => {
    const role = String(f?.examDayImportRole || '');
    const key = String(f?.key || '').trim();
    if (role === 'shiftReached') return true;
    return Boolean(key) && /_reached$/i.test(key);
  });

  reachedFields.forEach((reachedField) => {
    const reachedKey = String(reachedField.key || '').trim();
    if (!reachedKey || !Object.prototype.hasOwnProperty.call(patch, reachedKey)) return;
    if (cellValueEqual(prev[reachedKey], patch[reachedKey])) return;

    const shiftHint = shiftHintFromReachedField(reachedField);
    const shiftId = String(shiftHint.id || '').trim();

    const lastField =
      matchExamDayShiftLastTField(list, shiftHint) ||
      list.find(
        (f) =>
          String(f?.examDayImportRole || '') === 'shiftLastT' &&
          (shiftId
            ? String(f?.examDayShiftId || '').trim() === shiftId
            : String(f?.key || '') === examDayShiftLastTKey(shiftHint)),
      );
    const firstField =
      matchExamDayShiftFirstTField(list, shiftHint) ||
      list.find(
        (f) =>
          String(f?.examDayImportRole || '') === 'shiftFirstT' &&
          (shiftId
            ? String(f?.examDayShiftId || '').trim() === shiftId
            : String(f?.key || '') === examDayShiftFirstTKey(shiftHint)),
      );
    const statusField = matchExamDayShiftStatusField(list, shiftHint);
    const countField = matchExamDayShiftField(list, shiftHint);

    if (lastField?.key) out[lastField.key] = now;

    const nextReached = patch[reachedKey];
    if (
      firstField?.key &&
      !isReachedEmpty(nextReached) &&
      !String(prev[firstField.key] ?? '').trim()
    ) {
      out[firstField.key] = now;
    }

    if (statusField?.key) {
      const requested =
        countField?.key && Object.prototype.hasOwnProperty.call(row, countField.key)
          ? row[countField.key]
          : countField?.key
            ? prev[countField.key]
            : null;
      out[statusField.key] = computeExamDayShiftStatus(requested, nextReached);
    }
  });

  return out;
};

/** @deprecated Use applyExamDayReachedSideEffects — timestamps now follow Reached, not status. */
export const applyExamDayStatusTimestamps = (args = {}) =>
  applyExamDayReachedSideEffects(args);

export const isExamDayTimestampRole = (role) => {
  const r = String(role || '');
  return r === 'shiftFirstT' || r === 'shiftLastT';
};

/** True for First T. / Last T. import columns (by role or key). */
export const isExamDayTimestampField = (field) => {
  if (!field) return false;
  if (isExamDayTimestampRole(field.examDayImportRole)) return true;
  const key = String(field.key || '').trim().toLowerCase();
  return /_first_t$/.test(key) || /_last_t$/.test(key);
};

/** Sort key from OP S1 / s1 / s1_reached → 1. */
const examDayShiftSortIndex = (field) => {
  const key = String(field?.key || '');
  const label = String(field?.label || '');
  const m =
    key.match(/s(\d+)/i) ||
    label.match(/\bs\s*(\d+)\b/i) ||
    String(field?.examDayShiftId || '').match(/s(\d+)/i);
  return m ? Number(m[1]) : 9999;
};

const classifyExamDayImportBucket = (field) => {
  const role = String(field?.examDayImportRole || '').trim();
  const key = String(field?.key || '').trim().toLowerCase();
  const label = String(field?.label || '');
  if (isExamDayTimestampField(field) || role === 'shiftFirstT' || role === 'shiftLastT') {
    return 'timestamps';
  }
  if (role === 'maxStatus' || key === MAX_STATUS_KEY || /max\s*status/i.test(label)) {
    return 'maxStatus';
  }
  if (role === 'maxDayN' || key === MAX_DAY_N_KEY || /max\s*day/i.test(label)) {
    return 'maxDayN';
  }
  if (role === 'shiftReached' || /_reached$/i.test(key) || /\breached\b/i.test(label)) {
    return 'reached';
  }
  if (role === 'shiftStatus' || (/_status$/i.test(key) && key !== MAX_STATUS_KEY)) {
    return 'status';
  }
  if (role === 'shift') return 'shift';
  if (/^s\d+$/i.test(key)) return 'shift';
  if (/^op\s*s\s*\d+$/i.test(label.trim())) return 'shift';
  return 'other';
};

/**
 * Canonical Exam Day import column order:
 * other fields → OP S1..Sn (counts) → Max Day N → Reached… → Status… → Max Status → First/Last T.
 * Within each shift family, sort by shift number (S1, S2, …).
 */
export const orderExamDayImportFields = (fields = []) => {
  const list = Array.isArray(fields) ? fields : [];
  if (!list.length) return list;

  const buckets = {
    other: [],
    shift: [],
    maxDayN: [],
    reached: [],
    status: [],
    maxStatus: [],
    timestamps: [],
  };

  list.forEach((f, index) => {
    buckets[classifyExamDayImportBucket(f)].push({ f, index });
  });

  const byShiftThenIndex = (a, b) => {
    const sa = examDayShiftSortIndex(a.f);
    const sb = examDayShiftSortIndex(b.f);
    if (sa !== sb) return sa - sb;
    return a.index - b.index;
  };

  const byTimestampOrder = (a, b) => {
    const sa = examDayShiftSortIndex(a.f);
    const sb = examDayShiftSortIndex(b.f);
    if (sa !== sb) return sa - sb;
    const aFirst =
      String(a.f?.examDayImportRole || '') === 'shiftFirstT' ||
      /_first_t$/i.test(String(a.f?.key || '')) ||
      /first\s*t/i.test(String(a.f?.label || ''));
    const bFirst =
      String(b.f?.examDayImportRole || '') === 'shiftFirstT' ||
      /_first_t$/i.test(String(b.f?.key || '')) ||
      /first\s*t/i.test(String(b.f?.label || ''));
    if (aFirst !== bFirst) return aFirst ? -1 : 1;
    return a.index - b.index;
  };

  return [
    ...buckets.other.map((x) => x.f),
    ...buckets.shift.sort(byShiftThenIndex).map((x) => x.f),
    ...buckets.maxDayN.map((x) => x.f),
    ...buckets.reached.sort(byShiftThenIndex).map((x) => x.f),
    ...buckets.status.sort(byShiftThenIndex).map((x) => x.f),
    ...buckets.maxStatus.map((x) => x.f),
    ...buckets.timestamps.sort(byTimestampOrder).map((x) => x.f),
  ];
};

/** @deprecated Prefer orderExamDayImportFields — same canonical Exam Day order. */
export const orderExamDayFieldsTimestampsLast = orderExamDayImportFields;

/** Prefer key `exam_date`, else first date-typed field. */
export const resolveExamDateFieldKey = (fields) => {
  const list = Array.isArray(fields) ? fields : [];
  if (list.some((f) => f?.key === EXAM_DATE_KEY)) return EXAM_DATE_KEY;
  const dateField = list.find((f) => f?.dataType === 'date' || f?.dataType === 'datetime');
  return dateField?.key || EXAM_DATE_KEY;
};

const resolveMaxDayFieldKey = (fields) => {
  const list = Array.isArray(fields) ? fields : [];
  if (list.some((f) => f?.key === MAX_DAY_N_KEY)) return MAX_DAY_N_KEY;
  const byLabel = list.find((f) => /max\s*day/i.test(String(f?.label || '')));
  return byLabel?.key || '';
};

const fieldHasKey = (fields, key) =>
  (Array.isArray(fields) ? fields : []).some((f) => String(f?.key || '').trim() === key);

const fieldMatchesExamDate = (fields) => {
  if (fieldHasKey(fields, EXAM_DATE_KEY)) {
    return (fields || []).find((f) => f.key === EXAM_DATE_KEY) || null;
  }
  return (
    (fields || []).find((f) => f?.dataType === 'date' || f?.dataType === 'datetime') || null
  );
};

/**
 * Checklist for Exam Day Bulk add: which import columns exist / are missing.
 * Includes per-shift status + Max Status rollup.
 * @returns {{ items: Array, missing: Array, ready: boolean, shiftSuggestions: Array, statusKeys: string[] }}
 */
export const getExamDayImportFieldPlan = ({
  fields = [],
  centerListDateShifts = null,
  hiddenShiftIds = null,
} = {}) => {
  const list = Array.isArray(fields) ? fields : [];
  const hidden = hiddenShiftIds instanceof Set ? hiddenShiftIds : new Set(hiddenShiftIds || []);
  const shiftSuggestions = examDayShiftSuggestions(centerListDateShifts).filter(
    (s) => !hidden.has(String(s.id)),
  );
  const items = [];
  const statusKeys = [];

  const examDateField = fieldMatchesExamDate(list);
  items.push({
    id: 'exam_date',
    role: 'examDate',
    required: true,
    label: 'Exam Date',
    key: EXAM_DATE_KEY,
    dataType: 'date',
    present: Boolean(examDateField),
    matchedKey: examDateField?.key || '',
    hint: 'Filled from each Center list exam date',
  });

  shiftSuggestions.forEach((shift) => {
    const matched = matchExamDayShiftField(list, shift);
    items.push({
      id: `shift_${shift.id}`,
      role: 'shift',
      required: true,
      label: shift.label,
      key: shift.key,
      dataType: 'number',
      examDayShiftId: shift.id,
      present: Boolean(matched),
      matchedKey: matched?.key || '',
      hint: `Requested count from Center list “${shift.label}” for that date`,
    });

    const reachedMatched = matchExamDayShiftReachedField(list, shift);
    items.push({
      id: `shift_reached_${shift.id}`,
      role: 'shiftReached',
      required: true,
      label: `${shift.label} Reached`,
      key: examDayShiftReachedKey(shift),
      dataType: 'number',
      examDayShiftId: shift.id,
      present: Boolean(reachedMatched),
      matchedKey: reachedMatched?.key || '',
      hint: `Actual reached count for ${shift.label} (drives status + First/Last T.)`,
    });

    const statusMatched = matchExamDayShiftStatusField(list, shift);
    const statusKey = statusMatched?.key || examDayShiftStatusKey(shift);
    statusKeys.push(statusKey);
    items.push({
      id: `shift_status_${shift.id}`,
      role: 'shiftStatus',
      required: true,
      label: `${shift.label} status`,
      key: examDayShiftStatusKey(shift),
      dataType: 'status',
      options: [...EXAM_DAY_STATUS_OPTIONS],
      examDayShiftId: shift.id,
      present: Boolean(statusMatched),
      matchedKey: statusMatched?.key || '',
      hint: `Auto · completed when Reached ≥ Requested for ${shift.label}`,
    });

    const firstTMatched = matchExamDayShiftFirstTField(list, shift);
    items.push({
      id: `shift_first_t_${shift.id}`,
      role: 'shiftFirstT',
      required: true,
      label: `${shift.label} First T.`,
      key: examDayShiftFirstTKey(shift),
      dataType: 'datetime',
      examDayShiftId: shift.id,
      present: Boolean(firstTMatched),
      matchedKey: firstTMatched?.key || '',
      hint: `Set once when ${shift.label} Reached is first filled (kept on clear)`,
    });

    const lastTMatched = matchExamDayShiftLastTField(list, shift);
    items.push({
      id: `shift_last_t_${shift.id}`,
      role: 'shiftLastT',
      required: true,
      label: `${shift.label} Last T.`,
      key: examDayShiftLastTKey(shift),
      dataType: 'datetime',
      examDayShiftId: shift.id,
      present: Boolean(lastTMatched),
      matchedKey: lastTMatched?.key || '',
      hint: `Updated every time ${shift.label} Reached changes (including clear)`,
    });
  });

  const maxDayKey = resolveMaxDayFieldKey(list);
  const maxField = maxDayKey ? list.find((f) => f.key === maxDayKey) : null;
  items.push({
    id: 'max_day_n',
    role: 'maxDayN',
    required: false,
    label: 'Max Day N',
    key: MAX_DAY_N_KEY,
    dataType: 'number',
    present: Boolean(maxField),
    matchedKey: maxField?.key || '',
    hint: 'Optional · copied Max Day N (skip import when 0)',
  });

  const maxStatusField = matchMaxStatusField(list);
  const maxStatusFormula = buildMaxStatusFormula(statusKeys);
  items.push({
    id: 'max_status',
    role: 'maxStatus',
    required: true,
    label: 'Max Status',
    key: MAX_STATUS_KEY,
    dataType: 'formula',
    formula: maxStatusFormula,
    present: Boolean(maxStatusField),
    matchedKey: maxStatusField?.key || '',
    hint: 'Read-only · completed / partial / pending from shift status columns',
  });

  const missing = items.filter((it) => it.required && !it.present);
  return {
    items,
    missing,
    ready: missing.length === 0,
    shiftSuggestions,
    statusKeys,
    maxStatusFormula,
  };
};

/** Field defs to insert for missing Exam Day import columns (Reached, status, times, Max Status). */
export const buildMissingExamDayImportFields = ({
  fields = [],
  centerListDateShifts = null,
  hiddenShiftIds = null,
} = {}) => {
  const plan = getExamDayImportFieldPlan({ fields, centerListDateShifts, hiddenShiftIds });
  const usedKeys = new Set(
    (Array.isArray(fields) ? fields : []).map((f) => String(f?.key || '').trim()).filter(Boolean),
  );
  const out = [];
  const statusKeyByShiftId = new Map();

  plan.items.forEach((it) => {
    if (it.role === 'shiftStatus' && it.present && it.matchedKey) {
      statusKeyByShiftId.set(it.examDayShiftId || it.id, it.matchedKey);
    }
  });

  plan.items.forEach((it) => {
    if (it.present) return;
    let key = it.key;
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n += 1;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);
    if (it.role === 'shiftStatus') {
      statusKeyByShiftId.set(it.examDayShiftId || it.id, key);
    }
    out.push({
      label: it.label,
      key,
      dataType: it.dataType,
      required: false,
      layout: 'full',
      autoFill: 'none',
      ...(it.examDayShiftId ? { examDayShiftId: it.examDayShiftId } : {}),
      examDayImportRole: it.role,
      ...(Array.isArray(it.options) && it.options.length
        ? { options: it.options, optionsSource: 'manual', optionsText: it.options.join(', ') }
        : {}),
      ...(it.role === 'maxStatus' ? { formula: '', resultType: 'text' } : {}),
    });
  });

  const statusKeys = plan.items
    .filter((it) => it.role === 'shiftStatus')
    .map((it) => statusKeyByShiftId.get(it.examDayShiftId || it.id) || it.matchedKey || it.key)
    .filter(Boolean);
  const formula = buildMaxStatusFormula(statusKeys);

  const maxInOut = out.find((d) => d.examDayImportRole === 'maxStatus');
  if (maxInOut) {
    maxInOut.formula = formula;
  } else {
    const existingMax = matchMaxStatusField(fields);
    if (existingMax?.key) {
      out.push({
        label: existingMax.label || 'Max Status',
        key: existingMax.key,
        dataType: 'formula',
        formula,
        resultType: 'text',
        required: false,
        layout: 'full',
        autoFill: 'none',
        examDayImportRole: 'maxStatus',
        updateExisting: true,
      });
    }
  }

  return out;
};

/** Shared / identity keys to copy from the center row when present on Exam Day. */
const copyableCenterKeys = (targetFields, dateShiftKeys) => {
  const fields = Array.isArray(targetFields) ? targetFields : [];
  const skip = new Set([
    EXAM_DATE_KEY,
    MAX_DAY_N_KEY,
    MAX_STATUS_KEY,
    EXAM_DAY_META_KEY,
    ...dateShiftKeys,
  ]);
  fields.forEach((f) => {
    if (isExamDayPerDateStoredField(f) && f?.key) skip.add(String(f.key).trim());
  });
  return fields
    .map((f) => String(f?.key || '').trim())
    .filter((k) => k && !skip.has(k) && !k.startsWith('ds_'));
};

/**
 * Live Exam Day view rows from Center list (source of truth).
 * One display row per center × exam date (skip Max Day N = 0).
 * Per-date Reached / First T. / Last T. come from `values.__exam_day[dateId]`;
 * status is derived from Requested (live count) vs Reached when Reached exists.
 *
 * @returns {{ rows: object[], skipped: number, datesUsed: number }}
 */
export const expandCenterRowsToExamDay = ({
  centerRows = [],
  dateShiftsConfig = null,
  targetFields = [],
} = {}) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const dates = cfg.dates || [];
  const shifts = cfg.shifts || [];
  if (!dates.length || !shifts.length) {
    return { rows: [], skipped: 0, datesUsed: 0 };
  }

  const fields = Array.isArray(targetFields) ? targetFields : [];
  const examDateKey = resolveExamDateFieldKey(fields);
  const maxDayKey = resolveMaxDayFieldKey(fields);
  const shiftFieldById = new Map();
  shifts.forEach((shift) => {
    const field = matchExamDayShiftField(fields, shift);
    if (field?.key) shiftFieldById.set(shift.id, field.key);
  });

  const allDateShiftKeys = dates.flatMap((d) => shiftKeysForDate(cfg, d.id));
  const identityKeys = copyableCenterKeys(fields, allDateShiftKeys);
  const perDateFields = fields.filter(isExamDayPerDateStoredField);

  const out = [];
  let skipped = 0;

  (Array.isArray(centerRows) ? centerRows : []).forEach((row) => {
    const sourceRowId = String(row?.id || '').trim();
    const bag = row?.values && typeof row.values === 'object' ? row.values : row || {};
    const centerCode = bag[CENTER_CODE_KEY];
    if (centerCode == null || String(centerCode).trim() === '') return;
    if (!sourceRowId) return;

    dates.forEach((date) => {
      const maxDayN = resolveDayAggregateFromRow(bag, cfg, date.id);
      if (maxDayN == null || maxDayN === 0) {
        skipped += 1;
        return;
      }

      const values = {};
      identityKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(bag, key)) values[key] = bag[key];
      });
      values[CENTER_CODE_KEY] = centerCode;
      values[examDateKey] = date.title || date.id;

      const dayKeys = shiftKeysForDate(cfg, date.id);
      shifts.forEach((shift, i) => {
        const targetKey = shiftFieldById.get(shift.id);
        if (!targetKey) return;
        const sourceKey = dayKeys[i];
        if (!sourceKey) return;
        const num = toShiftNumber(bag[sourceKey]);
        values[targetKey] = num == null ? 0 : num;
      });

      if (maxDayKey) values[maxDayKey] = maxDayN;

      const dateMeta = readExamDayDateMeta(bag, date.id);
      perDateFields.forEach((f) => {
        const key = String(f?.key || '').trim();
        if (!key) return;
        if (Object.prototype.hasOwnProperty.call(dateMeta, key)) values[key] = dateMeta[key];
      });

      // Always derive Status from Requested vs Reached (ignore stale meta status).
      const withStatus = applyExamDayDerivedStatuses(values, fields);

      out.push({
        id: makeExamDayRowId(sourceRowId, date.id),
        values: withStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdByLabel: row.createdByLabel,
        updatedByLabel: row.updatedByLabel,
        __examDaySourceId: sourceRowId,
        __examDayDateId: String(date.id),
      });
    });
  });

  // Default order: exam date (Date shifts order), then center code.
  const dateOrder = new Map(dates.map((d, i) => [String(d.id), i]));
  out.sort((a, b) => {
    const da = dateOrder.get(String(a.__examDayDateId)) ?? Number.MAX_SAFE_INTEGER;
    const db = dateOrder.get(String(b.__examDayDateId)) ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    const ca = String(a.values?.[CENTER_CODE_KEY] ?? '').localeCompare(
      String(b.values?.[CENTER_CODE_KEY] ?? ''),
      undefined,
      { sensitivity: 'base', numeric: true },
    );
    if (ca !== 0) return ca;
    return String(a.__examDaySourceId || '').localeCompare(String(b.__examDaySourceId || ''));
  });

  return { rows: out, skipped, datesUsed: dates.length };
};

/** Live Requested counts for one exam date from Center list date×shift cells. */
export const resolveExamDayLiveCountsForDate = ({
  fields = [],
  dateShiftsConfig = null,
  dateId,
  centerValues = {},
} = {}) => {
  const cfg = normalizeDateShiftsConfig(dateShiftsConfig);
  const bag = centerValues && typeof centerValues === 'object' ? centerValues : {};
  const dayKeys = shiftKeysForDate(cfg, dateId);
  const out = {};
  (cfg.shifts || []).forEach((shift, i) => {
    const field = matchExamDayShiftField(fields, shift);
    if (!field?.key) return;
    const sourceKey = dayKeys[i];
    if (!sourceKey) return;
    const num = toShiftNumber(bag[sourceKey]);
    out[field.key] = num == null ? 0 : num;
  });
  return out;
};

/**
 * Split an Exam Day cell patch into Center list root values vs per-date meta.
 * Live count keys are ignored (always derived from date×shift cells).
 */
export const splitExamDayPersistPatch = ({
  fields = [],
  dateId,
  previousCenterValues = {},
  patch = {},
  dateShiftsConfig = null,
} = {}) => {
  const list = Array.isArray(fields) ? fields : [];
  const fieldByKey = new Map(list.map((f) => [String(f.key || ''), f]));
  const rootPatch = {};
  const datePatch = {};

  Object.entries(patch || {}).forEach(([key, val]) => {
    if (key === EXAM_DAY_META_KEY) return;
    const field = fieldByKey.get(key);
    if (!field) return;
    const role = String(field.examDayImportRole || '');
    // Live counts + derived status/timestamps/max are not user-written here.
    if (isExamDayLiveCountRole(role) || role === 'maxStatus') return;
    if (role === 'shiftStatus' || isExamDayTimestampRole(role)) return;
    if (isExamDayPerDateStoredField(field)) {
      datePatch[key] = val;
      return;
    }
    // Shared / identity fields write through to the Center list row.
    rootPatch[key] = val;
  });

  const prevDateMeta = readExamDayDateMeta(previousCenterValues, dateId);
  const liveCounts = resolveExamDayLiveCountsForDate({
    fields: list,
    dateShiftsConfig,
    dateId,
    centerValues: previousCenterValues,
  });
  // Prefer live Center counts, then full Exam Day patch (includes Requested), then meta.
  const rowValues = {
    ...prevDateMeta,
    ...(patch || {}),
    ...liveCounts,
  };
  const sideEffects = applyExamDayReachedSideEffects({
    fields: list,
    previousValues: prevDateMeta,
    nextPatch: datePatch,
    rowValues,
  });
  Object.assign(datePatch, sideEffects);

  // Always refresh every shift Status from Requested vs Reached (fixes stale “completed”).
  const merged = { ...rowValues, ...datePatch };
  const derived = applyExamDayDerivedStatuses(merged, list);
  list.forEach((f) => {
    const role = String(f?.examDayImportRole || '');
    const key = String(f?.key || '').trim();
    if (!key) return;
    const isStatus =
      role === 'shiftStatus' || (/_status$/i.test(key) && key !== MAX_STATUS_KEY);
    if (!isStatus) return;
    if (Object.prototype.hasOwnProperty.call(derived, key)) {
      datePatch[key] = derived[key];
    }
  });

  let nextMeta = null;
  if (Object.keys(datePatch).length) {
    const meta = readExamDayMeta(previousCenterValues);
    meta[String(dateId)] = {
      ...readExamDayDateMeta(previousCenterValues, dateId),
      ...datePatch,
    };
    nextMeta = meta;
  }

  return { rootPatch, datePatch, nextMeta };
};
