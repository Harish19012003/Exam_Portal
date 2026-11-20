/**
 * Client re-exports for Op/Guard Calling expand + auto-label (shared is source of truth).
 */
export {
  CALLING_CENTER_ROW_ID_KEY,
  CALLING_DATE_ID_KEY,
  CALLING_EXPAND_MODES,
  CALLING_HIDDEN_KEY,
  CALLING_LABEL_DEFAULT_TARGET_KEY,
  CALLING_LABEL_MODES,
  CALLING_SHIFT_ID_KEY,
  CALLING_SLOT_KEY,
  CALLING_SYSTEM_KEYS,
  OPERATOR_GUARD_CALLING_VIEW,
  buildCallingLabelsForSlots,
  buildCategoryHeadLabels,
  callingNaturalKey,
  callingNaturalKeyFromValues,
  emptyCallingExpand,
  emptyCallingLabel,
  emptyCallingLabelCategory,
  isCallingSystemKey,
  isOperatorGuardCallingView,
  normalizeCallingExpand,
  normalizeCallingLabel,
  planCallingTargetsForCenterRow,
  resolveCallingExpandForLabel,
  resolveCategoryShiftId,
} from '@exam-view/shared';
