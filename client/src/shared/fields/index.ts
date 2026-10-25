// ─── Shared field styling ────────────────────────────────────────────────────
export {
  fieldInputClass,
  editorInputClass,
  type FieldState,
  type FieldInputOptions,
} from './fieldStyles';

// ─── Reusable field components (import anywhere) ─────────────────────────────
export {
  DynamicDropdown,
  DynamicMultiSelectDropdown,
  DynamicDatePicker,
  DynamicDateTimePicker,
  DynamicTimePicker,
  CalendarPanel,
  resolveDropdownOptions,
  normalizeMultiSelectValue,
  toDateValue,
  toDatetimeLocalValue,
  toTimeValue,
  formatDateDisplay,
  formatDatetimeDisplay,
  formatTimeDisplay,
  buildMonthGrid,
  dateToKey,
  parseDateKey,
  isDateInRange,
  DYNAMIC_DROPDOWN_PORTAL_CLASS,
  DYNAMIC_MULTISELECT_PORTAL_CLASS,
  DYNAMIC_DATE_PICKER_PORTAL_CLASS,
  DYNAMIC_DATETIME_PICKER_PORTAL_CLASS,
  DYNAMIC_TIME_PICKER_PORTAL_CLASS,
} from '../../components/DynamicData/fields';

export type {
  DynamicDropdownProps,
  DynamicMultiSelectDropdownProps,
  DynamicDropdownBaseProps,
  DynamicDropdownVariant,
  DynamicDatePickerProps,
  DynamicDateTimePickerProps,
  DynamicTimePickerProps,
  DynamicDateTimeBaseProps,
  DynamicDateTimeVariant,
  CalendarPanelProps,
} from '../../components/DynamicData/fields';
