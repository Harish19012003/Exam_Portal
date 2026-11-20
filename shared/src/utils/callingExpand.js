/**
 * Op/Guard Calling expand + auto-label helpers (preset-driven).
 * Pure — used by server sync and client UI.
 */

import {
  CALLING_CENTER_ROW_ID_KEY,
  CALLING_DATE_ID_KEY,
  CALLING_EXPAND_MODES,
  CALLING_HIDDEN_KEY,
  CALLING_LABEL_DEFAULT_TARGET_KEY,
  CALLING_LABEL_MODES,
  CALLING_SHIFT_ID_KEY,
  CALLING_SLOT_KEY,
  CENTER_CODE_KEY,
  EXAM_DATE_KEY,
  MAX_DAY_N_KEY,
} from '../constants/examViews.js';

export const emptyCallingExpand = () => ({
  mode: CALLING_EXPAND_MODES.MAX_DAY_N,
  skipZeroMaxDayN: true,
  skipZeroShiftCount: true,
});

export const normalizeCallingExpand = (input) => {
  const base = emptyCallingExpand();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const rawMode = String(input.mode || '').trim().toLowerCase();
  let mode = CALLING_EXPAND_MODES.MAX_DAY_N;
  if (rawMode === CALLING_EXPAND_MODES.PER_SHIFT) mode = CALLING_EXPAND_MODES.PER_SHIFT;
  else if (rawMode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
    mode = CALLING_EXPAND_MODES.CATEGORY_COUNTS;
  }
  return {
    mode,
    skipZeroMaxDayN:
      input.skipZeroMaxDayN == null ? base.skipZeroMaxDayN : Boolean(input.skipZeroMaxDayN),
    skipZeroShiftCount:
      input.skipZeroShiftCount == null
        ? base.skipZeroShiftCount
        : Boolean(input.skipZeroShiftCount),
  };
};

export const emptyCallingLabelCategory = () => ({
  id: '',
  /** Match Center list shift by id (preferred) or label token. */
  shiftId: '',
  matchLabel: '',
  /** Can receive the single "head" role when this category has count > 0. */
  headCandidate: false,
  headLabel: '',
  itemPrefix: '',
  /** Lower = higher priority for head (Male before Female). */
  priority: 100,
});

export const emptyCallingLabel = () => ({
  mode: CALLING_LABEL_MODES.NONE,
  targetKey: CALLING_LABEL_DEFAULT_TARGET_KEY,
  constantValue: '',
  firstLabel: 'Supervisor',
  restPrefix: 'Bio Opr',
  categories: [],
});

const normalizeCategory = (raw, index = 0) => {
  const base = emptyCallingLabelCategory();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...base, id: `cat_${index + 1}`, priority: (index + 1) * 10 };
  }
  const priority = Number(raw.priority);
  return {
    id: String(raw.id || `cat_${index + 1}`).trim() || `cat_${index + 1}`,
    shiftId: String(raw.shiftId || '').trim(),
    matchLabel: String(raw.matchLabel || raw.label || '').trim(),
    headCandidate: Boolean(raw.headCandidate),
    headLabel: String(raw.headLabel || '').trim(),
    itemPrefix: String(raw.itemPrefix || '').trim(),
    priority: Number.isFinite(priority) && priority > 0 ? priority : (index + 1) * 10,
  };
};

export const normalizeCallingLabel = (input) => {
  const base = emptyCallingLabel();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const rawMode = String(input.mode || '').trim().toLowerCase();
  let mode = CALLING_LABEL_MODES.NONE;
  if (rawMode === CALLING_LABEL_MODES.FIRST_NUMBERED) mode = CALLING_LABEL_MODES.FIRST_NUMBERED;
  else if (rawMode === CALLING_LABEL_MODES.CATEGORY_HEAD) mode = CALLING_LABEL_MODES.CATEGORY_HEAD;
  else if (rawMode === CALLING_LABEL_MODES.CONSTANT) mode = CALLING_LABEL_MODES.CONSTANT;

  const categories = Array.isArray(input.categories)
    ? input.categories.map((c, i) => normalizeCategory(c, i))
    : [];

  return {
    mode,
    targetKey:
      String(input.targetKey || '').trim() || CALLING_LABEL_DEFAULT_TARGET_KEY,
    constantValue: String(input.constantValue ?? base.constantValue),
    firstLabel: String(input.firstLabel ?? base.firstLabel).trim() || base.firstLabel,
    restPrefix: String(input.restPrefix ?? base.restPrefix).trim() || base.restPrefix,
    categories,
  };
};

/**
 * When label mode is category_head, expand must use category_counts.
 */
export const resolveCallingExpandForLabel = (callingExpand, callingLabel) => {
  const expand = normalizeCallingExpand(callingExpand);
  const label = normalizeCallingLabel(callingLabel);
  if (label.mode === CALLING_LABEL_MODES.CATEGORY_HEAD) {
    return { ...expand, mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS };
  }
  return expand;
};

export const callingNaturalKey = ({
  centerRowId,
  dateId,
  mode,
  slot = null,
  shiftId = '',
  categoryId = '',
}) => {
  const center = String(centerRowId || '').trim();
  const date = String(dateId || '').trim();
  if (mode === CALLING_EXPAND_MODES.PER_SHIFT) {
    return `${center}::${date}::shift::${String(shiftId || '').trim()}`;
  }
  if (mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
    return `${center}::${date}::cat::${String(categoryId || shiftId || '').trim()}::slot::${Number(slot) || 0}`;
  }
  return `${center}::${date}::slot::${Number(slot) || 0}`;
};

export const callingNaturalKeyFromValues = (values, mode) => {
  const bag = values && typeof values === 'object' ? values : {};
  const resolvedMode = String(mode || '').trim();
  if (resolvedMode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
    return callingNaturalKey({
      centerRowId: bag[CALLING_CENTER_ROW_ID_KEY],
      dateId: bag[CALLING_DATE_ID_KEY],
      mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
      slot: bag[CALLING_SLOT_KEY],
      shiftId: bag[CALLING_SHIFT_ID_KEY],
      categoryId: bag[CALLING_SHIFT_ID_KEY],
    });
  }
  return callingNaturalKey({
    centerRowId: bag[CALLING_CENTER_ROW_ID_KEY],
    dateId: bag[CALLING_DATE_ID_KEY],
    mode: resolvedMode,
    slot: bag[CALLING_SLOT_KEY],
    shiftId: bag[CALLING_SHIFT_ID_KEY],
  });
};

const toShiftNumber = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const aggregateNums = (type, nums) => {
  const list = (Array.isArray(nums) ? nums : []).filter(
    (n) => typeof n === 'number' && Number.isFinite(n),
  );
  if (!list.length) return null;
  if (type === 'sum') return list.reduce((a, b) => a + b, 0);
  if (type === 'counta') return list.length;
  return Math.max(...list);
};

const normToken = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** Resolve a category to a Center shift id using shiftId or matchLabel. */
export const resolveCategoryShiftId = (category, shifts = []) => {
  const list = Array.isArray(shifts) ? shifts : [];
  const wantId = String(category?.shiftId || '').trim();
  if (wantId && list.some((s) => String(s?.id || '') === wantId)) return wantId;
  const wantLabel = normToken(category?.matchLabel);
  if (wantLabel) {
    const hit = list.find((s) => normToken(s?.label) === wantLabel || normToken(s?.label).includes(wantLabel));
    if (hit?.id) return String(hit.id);
  }
  if (wantId) return wantId;
  return '';
};

/**
 * Build ordered labels for N slots (first_numbered / constant) or return [].
 */
export const buildCallingLabelsForSlots = (count, callingLabel) => {
  const label = normalizeCallingLabel(callingLabel);
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!n || label.mode === CALLING_LABEL_MODES.NONE) return Array(n).fill('');

  if (label.mode === CALLING_LABEL_MODES.CONSTANT) {
    const v = String(label.constantValue || '');
    return Array.from({ length: n }, () => v);
  }

  if (label.mode === CALLING_LABEL_MODES.FIRST_NUMBERED) {
    const out = [];
    for (let i = 1; i <= n; i += 1) {
      if (i === 1) out.push(label.firstLabel);
      else out.push(`${label.restPrefix} ${i - 1}`.trim());
    }
    return out;
  }

  return Array(n).fill('');
};

/**
 * Frisking-style labels for category counts.
 * One head only: highest-priority headCandidate with count > 0.
 * Head category: headLabel + itemPrefix 1..(count-1)
 * Other categories: itemPrefix 1..count (no head)
 */
export const buildCategoryHeadLabels = (categoryCounts, callingLabel) => {
  const label = normalizeCallingLabel(callingLabel);
  const cats = [...(label.categories || [])].sort((a, b) => a.priority - b.priority);
  const counts = categoryCounts && typeof categoryCounts === 'object' ? categoryCounts : {};

  const headCat = cats.find(
    (c) => c.headCandidate && Math.floor(Number(counts[c.id]) || 0) > 0,
  );

  const out = [];
  cats.forEach((cat) => {
    const n = Math.max(0, Math.floor(Number(counts[cat.id]) || 0));
    if (!n) return;
    if (headCat && cat.id === headCat.id) {
      out.push({
        categoryId: cat.id,
        slot: 1,
        text: cat.headLabel || cat.itemPrefix || cat.matchLabel || cat.id,
        isHead: true,
      });
      for (let i = 1; i <= n - 1; i += 1) {
        out.push({
          categoryId: cat.id,
          slot: i + 1,
          text: `${cat.itemPrefix || cat.matchLabel || cat.id} ${i}`.trim(),
          isHead: false,
        });
      }
      return;
    }
    for (let i = 1; i <= n; i += 1) {
      out.push({
        categoryId: cat.id,
        slot: i,
        text: `${cat.itemPrefix || cat.matchLabel || cat.id} ${i}`.trim(),
        isHead: false,
      });
    }
  });
  return out;
};

/**
 * Build desired Calling slot/shift targets from one Center row + Center date×shift fields.
 * @returns {{ key: string, values: Record<string, unknown>, hidden: boolean }[]}
 */
export const planCallingTargetsForCenterRow = ({
  centerRow,
  centerFields = [],
  dateShiftsConfig = null,
  callingExpand = null,
  callingLabel = null,
} = {}) => {
  const label = normalizeCallingLabel(callingLabel);
  const expand = resolveCallingExpandForLabel(callingExpand, label);
  const centerRowId = String(centerRow?.id || '').trim();
  if (!centerRowId) return [];

  const bag = centerRow?.values && typeof centerRow.values === 'object' ? centerRow.values : {};
  const centerCode = bag[CENTER_CODE_KEY];

  const cfg =
    dateShiftsConfig && typeof dateShiftsConfig === 'object'
      ? dateShiftsConfig
      : { dates: [], shifts: [] };
  const dates = Array.isArray(cfg.dates) ? cfg.dates : [];
  const shifts = Array.isArray(cfg.shifts) ? cfg.shifts : [];
  const summaryType = String(cfg.summaryColumn?.type || 'max').toLowerCase();

  const shiftFields = (Array.isArray(centerFields) ? centerFields : []).filter(
    (f) => f?.dateShift?.kind === 'shift' && f?.key,
  );

  const out = [];
  const targetKey = label.targetKey;

  const pushLabeled = (target, text) => {
    if (label.mode !== CALLING_LABEL_MODES.NONE && targetKey && text != null && text !== '') {
      target.values[targetKey] = text;
    }
    out.push(target);
  };

  dates.forEach((date) => {
    const dateId = String(date?.id || '').trim();
    if (!dateId) return;
    const dateTitle = String(date?.title || '').trim();

    const dayShiftFields = shiftFields.filter(
      (f) => String(f.dateShift?.dateId || '').trim() === dateId,
    );

    const baseIdentity = {
      [CALLING_CENTER_ROW_ID_KEY]: centerRowId,
      [CALLING_DATE_ID_KEY]: dateId,
      [EXAM_DATE_KEY]: dateTitle || dateId,
      ...(centerCode != null && centerCode !== '' ? { [CENTER_CODE_KEY]: centerCode } : {}),
    };

    // --- category_counts / category_head ---
    if (expand.mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
      const cats = [...(label.categories || [])].sort((a, b) => a.priority - b.priority);
      if (!cats.length) return;

      const counts = {};
      cats.forEach((cat) => {
        const shiftId = resolveCategoryShiftId(cat, shifts);
        const field = dayShiftFields.find(
          (f) => String(f.dateShift?.shiftId || '').trim() === shiftId,
        );
        const count = field ? toShiftNumber(bag[field.key]) : null;
        counts[cat.id] = count != null && count > 0 ? Math.floor(count) : 0;
      });

      const labeled = buildCategoryHeadLabels(counts, label);
      // If label mode isn't category_head, still expand by counts with empty/constant labels.
      if (label.mode === CALLING_LABEL_MODES.CATEGORY_HEAD) {
        labeled.forEach((item) => {
          const cat = cats.find((c) => c.id === item.categoryId);
          const shiftId = resolveCategoryShiftId(cat, shifts) || item.categoryId;
          pushLabeled(
            {
              key: callingNaturalKey({
                centerRowId,
                dateId,
                mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
                categoryId: item.categoryId,
                shiftId,
                slot: item.slot,
              }),
              values: {
                ...baseIdentity,
                [CALLING_SHIFT_ID_KEY]: shiftId || item.categoryId,
                [CALLING_SLOT_KEY]: item.slot,
                [CALLING_HIDDEN_KEY]: false,
              },
              hidden: false,
            },
            item.text,
          );
        });
      } else {
        // Expand only by counts; apply constant / first_numbered across flattened slots.
        const flat = [];
        cats.forEach((cat) => {
          const n = counts[cat.id] || 0;
          const shiftId = resolveCategoryShiftId(cat, shifts) || cat.id;
          for (let slot = 1; slot <= n; slot += 1) {
            flat.push({ categoryId: cat.id, shiftId, slot });
          }
        });
        const texts = buildCallingLabelsForSlots(flat.length, label);
        flat.forEach((item, idx) => {
          pushLabeled(
            {
              key: callingNaturalKey({
                centerRowId,
                dateId,
                mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
                categoryId: item.categoryId,
                shiftId: item.shiftId,
                slot: item.slot,
              }),
              values: {
                ...baseIdentity,
                [CALLING_SHIFT_ID_KEY]: item.shiftId,
                [CALLING_SLOT_KEY]: item.slot,
                [CALLING_HIDDEN_KEY]: false,
              },
              hidden: false,
            },
            texts[idx] || '',
          );
        });
      }
      return;
    }

    if (expand.mode === CALLING_EXPAND_MODES.PER_SHIFT) {
      const shiftList = shifts.length
        ? shifts
        : dayShiftFields.map((f) => ({
            id: f.dateShift?.shiftId,
            label: f.dateShift?.shiftId,
          }));

      const activeTargets = [];
      shiftList.forEach((shift) => {
        const shiftId = String(shift?.id || '').trim();
        if (!shiftId) return;
        const field =
          dayShiftFields.find((f) => String(f.dateShift?.shiftId || '').trim() === shiftId) ||
          null;
        const count = field ? toShiftNumber(bag[field.key]) : null;
        const active = !(expand.skipZeroShiftCount && (count == null || count <= 0));
        activeTargets.push({
          key: callingNaturalKey({
            centerRowId,
            dateId,
            mode: CALLING_EXPAND_MODES.PER_SHIFT,
            shiftId,
          }),
          values: {
            ...baseIdentity,
            [CALLING_SHIFT_ID_KEY]: shiftId,
            [CALLING_SLOT_KEY]: null,
            [CALLING_HIDDEN_KEY]: !active,
          },
          hidden: !active,
          active,
        });
      });
      const visible = activeTargets.filter((t) => t.active);
      const texts = buildCallingLabelsForSlots(visible.length, label);
      let vi = 0;
      activeTargets.forEach((t) => {
        const text = t.active ? texts[vi++] || '' : '';
        pushLabeled(t, text);
      });
      return;
    }

    // max_day_n
    const nums = dayShiftFields.map((f) => toShiftNumber(bag[f.key])).filter((n) => n != null);
    const maxDayN = aggregateNums(summaryType === 'custom' ? 'max' : summaryType, nums);
    const n = maxDayN != null && maxDayN > 0 ? Math.floor(maxDayN) : 0;

    if (expand.skipZeroMaxDayN && n <= 0) return;

    const texts = buildCallingLabelsForSlots(n, label);
    for (let slot = 1; slot <= n; slot += 1) {
      pushLabeled(
        {
          key: callingNaturalKey({
            centerRowId,
            dateId,
            mode: CALLING_EXPAND_MODES.MAX_DAY_N,
            slot,
          }),
          values: {
            ...baseIdentity,
            [CALLING_SLOT_KEY]: slot,
            [CALLING_SHIFT_ID_KEY]: '',
            [CALLING_HIDDEN_KEY]: false,
            [MAX_DAY_N_KEY]: n,
          },
          hidden: false,
        },
        texts[slot - 1] || '',
      );
    }
  });

  return out;
};
