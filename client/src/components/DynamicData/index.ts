// ─────────────────────────────────────────────────────────────────────────────
// DynamicData — shared core for the Dynamic* view family (Table, List, Card,
// Kanban, Tree, Calendar). Owns the data model, field rendering/editing UI,
// filter panels, and the search/filter/sort pipeline so every view stays
// visually and behaviorally consistent.
//
// The actual source for field UI still lives under DynamicTable/ (moving it
// would be a large, risky rename with no behavior change to show for it).
// This barrel is the one place other views should import from — it keeps the
// "shared core" boundary real even though the files haven't physically moved.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Schema / data model ───────────────────────────────────────────────────────
export type {
  AttachmentItem,
  Density,
  DataType,
  CompositeRole,
  PinDirection,
  AggregationType,
  FieldColumn,
  CompositeColumnDef,
  ColumnConfig,
  SavedView,
  DataRow,
  RowData,
  SortConfig,
  FilterOp,
  TextFilterValue,
  NumberFilterValue,
  SetFilterValue,
  BooleanFilterValue,
  FilterValue,
  ProcessedResult,
  CellRendererProps,
  CellEditorProps,
  FilterComponentProps,
  PendingDelete,
  PendingEdit,
  FormatScope,
  FormatConditionMode,
  FormatOp,
  FormatFontWeight,
  ConditionalFormatStyle,
  ConditionalFormatRule,
  DetailViewMode,
  SelectionColumnMode,
  CustomIconElement,
  SelectionColumnConfig,
  RowActionType,
  CustomRowActionButton,
  RowActionsConfig,
  TableFeaturesConfig,
  SummaryChipConfig,
  SubRowRenderProps,
  SubRowsConfig,
} from '../DynamicTable/types';
export { isFieldColumn, isCompositeColumn, DEFAULT_FEATURES } from '../DynamicTable/types';

// ─── Field rendering / editing ─────────────────────────────────────────────────
export { CellRenderer, CompositeCell, StatusBadge, evaluateFormulaHelper } from '../DynamicTable/renderers';
export { CellEditor } from '../DynamicTable/editors';
export { FilterUI, TextFilter, NumberFilter, SetFilter, DateFilter, BooleanFilter } from '../DynamicTable/filters';

// ─── Reusable dropdown fields (import anywhere) ──────────────────────────────────
export {
  DynamicDropdown,
  DynamicMultiSelectDropdown,
  resolveDropdownOptions,
  normalizeMultiSelectValue,
  DYNAMIC_DROPDOWN_PORTAL_CLASS,
  DYNAMIC_MULTISELECT_PORTAL_CLASS,
} from './fields';
export type {
  DynamicDropdownProps,
  DynamicMultiSelectDropdownProps,
  DynamicDropdownBaseProps,
  DynamicDropdownVariant,
} from './fields';

// ─── Reusable date/time fields (import anywhere) ───────────────────────────────
export {
  DynamicDatePicker,
  DynamicDateTimePicker,
  DynamicTimePicker,
  CalendarPanel,
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
  DYNAMIC_DATE_PICKER_PORTAL_CLASS,
  DYNAMIC_DATETIME_PICKER_PORTAL_CLASS,
  DYNAMIC_TIME_PICKER_PORTAL_CLASS,
} from './fields';
export type {
  DynamicDatePickerProps,
  DynamicDateTimePickerProps,
  DynamicTimePickerProps,
  DynamicDateTimeBaseProps,
  DynamicDateTimeVariant,
  CalendarPanelProps,
} from './fields';

// ─── Shared record open (Detail) ───────────────────────────────────────────────
export { RecordEditSidebar as RecordDetail } from '../DynamicTable/components/RecordEditSidebar';
export { RecordModal } from '../DynamicTable/components/RecordModal';

// ─── Search / filter / sort pipeline ───────────────────────────────────────────
export {
  matchFilter,
  applyFilters,
  applySearch,
  applySort,
  paginateRows,
  useFilteredRows,
} from './dataProcessing';

// ─── Record identity (avatar/primary/secondary/badge/status) ─────────────────
export { getRecordIdentity, getSecondaryFields, getIdentityColumnKeys } from './recordIdentity';
export type { RecordIdentity } from './recordIdentity';

// ─── Shared view chrome ────────────────────────────────────────────────────────
export { DynamicViewShell } from './DynamicViewShell';
export type { DynamicViewShellProps } from './DynamicViewShell';
export { GlobalSearchInput } from './GlobalSearchInput';
export type { GlobalSearchInputProps } from './GlobalSearchInput';
export {
  VIEW_TOOLBAR_BANNER_CLASS,
  VIEW_TOOLBAR_STACK_CLASS,
  VIEW_TOOLBAR_PAD_CLASS,
  viewToolbarBorderClass,
} from './viewToolbarChrome';
export { ViewToolbarActions } from './ViewToolbarActions';
export type { ViewToolbarActionsProps } from './ViewToolbarActions';
export { LayoutMenuDropdown } from './LayoutMenuDropdown';
export type { LayoutMenuOption } from './LayoutMenuDropdown';
export { ViewCountFooter, formatViewCountLabel } from './ViewCountFooter';
export type { ViewCountFooterProps } from './ViewCountFooter';
export { RecordAvatar } from './RecordAvatar';
export type { RecordAvatarProps, RecordAvatarShape } from './RecordAvatar';
export { ViewFeatureBuilder } from './ViewFeatureBuilder';
export type { ViewFeatureBuilderProps } from './ViewFeatureBuilder';
export { FeatureBuilderPanel, SectionLabel, ScopeBadge, ToggleRow } from './FeatureBuilderParts';
export type { FeatureBuilderPanelProps } from './FeatureBuilderParts';
export { DesignCornerFab, DesignFooterButton, ViewCornerFabStack, cornerFabClass } from './ViewCornerFabs';
export type { DesignCornerFabProps, DesignFooterButtonProps } from './ViewCornerFabs';
export { useViewFeatures } from './useViewFeatures';
export { useDefaultLayout } from './useDefaultLayout';
export {
  LIST_FEATURE_ITEMS,
  CARD_FEATURE_ITEMS,
  KANBAN_FEATURE_ITEMS,
  TREE_FEATURE_ITEMS,
  CALENDAR_FEATURE_ITEMS,
  SHARED_TOOLBAR_FEATURES,
  SHARED_INTERACTION_FEATURES,
  SHARED_DATA_FEATURES,
  SHARED_FIND_FEATURES,
  SHARED_SUMMARIZE_FEATURES,
  SHARED_CHROME_FEATURES,
  SHARED_INTERACT_FEATURES,
  SHARED_STRUCTURE_FEATURES,
  getFeatureItemsForView,
  getTableToolbarFeatureItems,
  getTableFeatureItemsForSection,
  groupFeaturesBySection,
  LIST_FEATURES_STORAGE_KEY,
  CARD_FEATURES_STORAGE_KEY,
  KANBAN_FEATURES_STORAGE_KEY,
  TREE_FEATURES_STORAGE_KEY,
  CALENDAR_FEATURES_STORAGE_KEY,
  FEATURE_SECTION_TOOLBAR,
  FEATURE_SECTION_INTERACTION,
  FEATURE_SECTION_DATA,
  FEATURE_SECTION_FIND,
  FEATURE_SECTION_SUMMARIZE,
  FEATURE_SECTION_CHROME,
  FEATURE_SECTION_INTERACT,
  FEATURE_SECTION_STRUCTURE,
  FEATURE_SECTION_ORDER,
} from './viewFeatures';
export type { ViewFeatureItem, DynamicViewKind, FeatureScope } from './viewFeatures';

export {
  SummaryChipsChromeProvider,
  SummaryChipsEyeToggle,
  useSummaryChipsChrome,
} from './SummaryChipsChrome';
export { SummaryChipsEditor } from './SummaryChipsEditor';
export type { SummaryChipsEditorProps } from './SummaryChipsEditor';
export { QuickFiltersEditor } from './QuickFiltersEditor';
export type { QuickFiltersEditorProps } from './QuickFiltersEditor';
export { QuickFiltersBar, QuickFiltersVisibilityToggle } from './QuickFiltersBar';
export type { QuickFiltersBarProps } from './QuickFiltersBar';
export {
  useQuickFiltersStore,
  toggleQuickFiltersEnabled,
  setQuickFilterFields,
  pruneQuickFilterFieldsToColumnKeys,
} from './quickFiltersStore';
export {
  useSummaryChipsStore,
  getSummaryChipsState,
  subscribeSummaryChips,
  setSummaryChipsEnabled,
  setSummaryChips,
  setSummaryChipsVisible,
  toggleSummaryChipsVisible,
  toggleSummaryChipsEnabled,
  pruneSummaryChipsToColumnKeys,
} from './summaryChipsStore';
export type { SummaryChipsStoreState } from './summaryChipsStore';

export {
  useSharedViewFeatures,
  isSharedViewFeatureKey,
  getSharedViewFeatures,
  toggleSharedViewFeature,
  setSharedViewFeature,
} from './sharedViewFeaturesStore';
export type { SharedViewFeatureKey } from './sharedViewFeaturesStore';

// ─── Designable records (shared slot model + renderer + designer) ─────────────
export {
  resolveRecordSlots,
  createDefaultRecordDesign,
  computeAutoFieldLimit,
  loadRecordDesign,
  saveRecordDesign,
} from './recordDesign';
export type {
  RecordDesignConfig,
  RecordSlotAssignment,
  RecordFieldEntry,
  RecordMediaConfig,
  RecordMediaKind,
  ResolvedRecordSlots,
  ResolveRecordSlotsOptions,
  ViewLayoutDefinition,
} from './recordDesign';
export { useRecordDesign } from './useRecordDesign';
export { RecordItem, hexToRgba } from './RecordItem';
export type { RecordItemProps, RecordItemLayout, RecordArrangement } from './RecordItem';
export {
  RecordDesignSidebar,
  SoftRangeSlider,
  LabelWithInfo,
  InfoTip,
  SettingRow,
  SettingToggle,
  DesignSectionLabel,
} from './RecordDesignSidebar';
export type { RecordDesignSidebarProps } from './RecordDesignSidebar';

// ─── Cross-view schema sharing (Table publishes, other views subscribe) ───────
export { useSharedColumns, publishSharedColumns, getSharedColumns, subscribeSharedColumns } from './schemaStore';
export {
  useSharedRows,
  useSharedRowsSnapshot,
  publishSharedRows,
  getSharedRows,
  subscribeSharedRows,
} from './rowsStore';

// ─── Formatting helpers ────────────────────────────────────────────────────────
export {
  countryToFlag,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDatetime,
  formatTime,
  STATUS_COLORS,
  getInitials,
  avatarColor,
} from '../DynamicTable/utils';
export { formatAggregationLabel, formatAggregationValue, formatSummaryCardValue, formatSummaryChipParts, getSummaryAggregationUnit, AGGREGATION_LABELS } from '../DynamicTable/utils/formatAggregation';
export {
  getEffectiveDataType,
  isNumericDataType,
  isBooleanDataType,
  isTemporalDataType,
} from '../DynamicTable/utils/evaluateFormula';
export { hasSubRows } from '../DynamicTable/utils/flattenRows';
export { resolveSubRowColumns } from '../DynamicTable/utils/subRowDisplay';

// ─── Shared mock schema (demo data for the whole family) ─────────────────────
export { COLUMN_CONFIG, MOCK_ROWS } from '../DynamicTable/tableData';

// ─── Guided tour (Feature Builder + Record Designer) ───────────────────────
export {
  CustomizationTourProvider,
  useCustomizationTour,
  useCustomizationTourOptional,
  useRegisterCustomizationTour,
  useDesignPanelTourHandlers,
  getCustomizationTourStatus,
  resetCustomizationTourStatus,
  setCustomizationTourStatus,
  CUSTOMIZATION_TOUR_STEPS,
} from './customizationTour';
export type {
  CustomizationTourHandlers,
  CustomizationTourProviderProps,
  CustomizationTourStatus,
  CustomizationTourStep,
} from './customizationTour';
