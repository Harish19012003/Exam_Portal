export interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: number;
  addedAt?: number;
}

export type Density = 'extra-compact' | 'compact' | 'standard' | 'comfortable' | 'spacious' | 'extra-spacious';

export type DataType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'dropdown'
  | 'select'
  | 'multiselect'
  | 'image'
  | 'link'
  | 'status'
  | 'composite'
  | 'progress'
  | 'rating'
  | 'tags'
  | 'email'
  | 'phone'
  | 'attachment'
  | 'checkbox'
  | 'formula'
  | 'icon'
  | 'time'
  | (string & {});

export type CompositeRole =
  | 'avatar'
  | 'icon'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'badge'
  | 'prefix'
  | 'suffix';

export type PinDirection = 'left' | 'right' | null;

export type AggregationType =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'earliest'
  | 'latest'
  | 'range'
  | 'countUnique'
  | 'empty'
  | 'filled'
  | 'percentEmpty'
  | 'percentFilled'
  | 'median'
  | 'percentChecked';

interface BaseColumn {
  key: string;
  label: string;
  description?: string;
  order?: number;
  visible?: boolean;
  pinned?: PinDirection;
  width?: number;
  editable?: boolean;
  allowCustom?: boolean;
  aggregation?: AggregationType;
  composedOf?: { field: string; role: CompositeRole }[];
}

export interface FieldColumn extends BaseColumn {
  dataType: Exclude<DataType, 'composite'>;
  filterable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  options?: string[]; // for dropdown | multiselect | status
  selectOptions?: string[]; // Alias for options
  allowCustom?: boolean; // Allow custom inputs for dropdown, status, multiselect
  required?: boolean;
  maxLength?: number;
  aggregation?: AggregationType;
  formula?: string;
  resultType?: DataType;
  parentColumnKey?: string; // Key of parent column in same row for dependent dropdowns
  dependentOptionsMap?: Record<string, string[]>; // Map parent values -> dependent choices
}

export interface CompositeColumnDef extends BaseColumn {
  dataType: 'composite';
  composedOf: { field: string; role: CompositeRole }[];
  filterable?: boolean;
}

export type ColumnConfig = FieldColumn | CompositeColumnDef;

export function isFieldColumn(col: ColumnConfig): col is FieldColumn {
  return col.dataType !== 'composite';
}

export function isCompositeColumn(col: ColumnConfig): col is CompositeColumnDef {
  return col.dataType === 'composite';
}

// ─── Data ─────────────────────────────────────────────────────────────────────

export interface SavedView {
  id: string;
  name: string;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  filters: Record<string, FilterValue>;
  sort: SortConfig[];
}

export interface DataRow {
  rowId: string;
  id?: string;
  version?: number;
  values: Record<string, unknown>;
  subRows?: DataRow[];
  pinnedDirection?: 'top' | 'bottom' | null;
}

export type RowData = {
  rowId?: string;
  id?: string;
  version?: number;
  values: Record<string, unknown>;
  subRows?: DataRow[];
  pinnedDirection?: 'top' | 'bottom' | null;
};

// ─── Table State ──────────────────────────────────────────────────────────────

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export type FilterOp =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'between'
  | 'in'
  | 'gte'
  | 'lte';

export interface TextFilterValue {
  op: 'contains' | 'equals' | 'startsWith';
  value: string;
}

export interface NumberFilterValue {
  op: 'between' | 'equals' | 'gte' | 'lte';
  value: number | null;
  value2?: number | null;
}

export interface SetFilterValue {
  op: 'in';
  value: string[];
}

export interface BooleanFilterValue {
  op: 'equals';
  value: boolean | null;
}

export type FilterValue =
  | TextFilterValue
  | NumberFilterValue
  | SetFilterValue
  | BooleanFilterValue;

// ─── Processed Result ─────────────────────────────────────────────────────────

export interface ProcessedResult {
  paginatedRows: DataRow[];
  filteredCount: number;
  totalCount: number;
  totalPages: number;
}

// ─── Component Props ──────────────────────────────────────────────────────────

export interface CellRendererProps {
  value: unknown;
  row: DataRow;
  column: ColumnConfig;
  allColumns: ColumnConfig[];
  isDarkMode: boolean;
  onDirectEdit?: (value: any) => void;
}

export interface CellEditorProps {
  value: unknown;
  row: DataRow;
  column: ColumnConfig;
  onSave: (newValue: unknown) => void;
  onSaveBatch?: (updates: Record<string, unknown>) => void;
  onCancel: () => void;
  isDarkMode: boolean;
  autoFocus?: boolean;
}

export interface FilterComponentProps {
  column: ColumnConfig;
  allColumns: ColumnConfig[];
  currentFilter: FilterValue | undefined;
  onFilterChange: (filter: FilterValue | null) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

// ─── Pending Delete (for undo toast) ─────────────────────────────────────────

export interface PendingDelete {
  rowId: string;
  row: DataRow;
  timerId: ReturnType<typeof setTimeout>;
  index: number;
}

export interface PendingEdit {
  id: string; // unique ID for the edit batch
  originalRows: DataRow[];
  timerId: ReturnType<typeof setTimeout>;
}

// ─── Conditional Formatting ──────────────────────────────────────────────────

export type FormatScope = 'cell' | 'row';
export type FormatConditionMode = 'simple' | 'formula';
export type FormatOp =
  | 'equals'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'empty'
  | 'notEmpty';
export type FormatFontWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export interface ConditionalFormatStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: FormatFontWeight;
}

export interface ConditionalFormatRule {
  id: string;
  name?: string;
  scope: FormatScope;
  conditionMode: FormatConditionMode;
  whenColumnKey?: string;
  op?: FormatOp;
  value?: string | number | boolean;
  conditionFormula?: string;
  /** Columns to style when scope === 'cell' (one or many). */
  targetColumnKeys?: string[];
  /** @deprecated Prefer targetColumnKeys; kept for prefs migration. */
  targetColumnKey?: string;
  style: ConditionalFormatStyle;
  enabled: boolean;
}

// ─── Feature Flags & Modular Configuration ─────────────────────────────────────

export type DetailViewMode =
  | 'inline-subtable'
  | 'sidebar-drawer'
  | 'page-redirect'
  | 'open-modal'
  | 'copy-column-value'
  | 'filter-by-column'
  | 'toggle-column-vis'
  | 'sort-column';

export type SelectionColumnMode = 'checkbox' | 'checkbox-and-icon' | 'icon-only' | 'none';

export interface CustomIconElement {
  id: string;
  label: string;
  iconName: string;
  action: DetailViewMode;
  targetColumnKey?: string;
  showSubRowCount?: boolean;
  enabled: boolean;
}

export interface SelectionColumnConfig {
  mode?: SelectionColumnMode;
  width?: number;
  iconName?: string;
  renderIcon?: (row: DataRow, isExpanded?: boolean) => React.ReactNode;
  onIconClick?: (row: DataRow, e: React.MouseEvent) => void;
  renderHeaderIcon?: () => React.ReactNode;
  elementOrder?: string[];
  showSubRowCount?: boolean;
  expanderIcon?: string;
  expanderOperation?: DetailViewMode;
  detailViewMode?: DetailViewMode;
  customIconElements?: CustomIconElement[];
  onOpenDrawer?: (row: DataRow) => void;
  onRedirectPage?: (row: DataRow) => void;
  onOpenModal?: (row: DataRow) => void;
  onFilterColumn?: (key: string, value: any) => void;
  onToggleColumnVis?: (key: string) => void;
  onSortColumn?: (key: string) => void;
}

export type RowActionType = 'edit' | 'delete' | 'share' | 'open-modal' | 'sidebar-drawer' | 'copy-column-value';

export interface CustomRowActionButton {
  id: string;
  label: string;
  action: RowActionType;
  iconName: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  enabled: boolean;
  targetColumnKey?: string;
}

export interface RowActionsConfig {
  width?: number;
  label?: string;
  showLabel?: boolean;
  showOnHover?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  iconName?: string;
  customButtons?: CustomRowActionButton[];
  renderCustomActions?: (row: DataRow) => React.ReactNode;
}

export interface SummaryChipConfig {
  id: string;
  fieldKey: string;
  aggregations: AggregationType[];
}

export const MAX_AGGREGATIONS_PER_CHIP = 3;

export interface TableFeaturesConfig {
  enableRowSelection?: boolean;
  enableActionsColumn?: boolean;
  selectionColumn?: SelectionColumnConfig;
  rowActions?: RowActionsConfig;
  enableSearch?: boolean;
  enableAddRow?: boolean;
  enableRefresh?: boolean;
  enableDensity?: boolean;
  enableExport?: boolean;
  enableSavedViews?: boolean;
  enableFullScreen?: boolean;
  enableTranspose?: boolean;
  enableSettings?: boolean;
  enableBulkActions?: boolean;
  enableColumnPinning?: boolean;
  enableColumnSorting?: boolean;
  enableColumnFiltering?: boolean;
  enableColumnResizing?: boolean;
  enableColumnReorder?: boolean;
  enableAddColumn?: boolean;
  enableCellEditing?: boolean;
  enableContextMenu?: boolean;
  enableFooter?: boolean;
  enableSummaryChips?: boolean;
  enableQuickFilters?: boolean;
  summaryChips?: SummaryChipConfig[];
  enableSidebar?: boolean;
  enableSubRows?: boolean;
  subRowsConfig?: SubRowsConfig;
}

export interface SubRowRenderProps {
  parentRow: DataRow;
  subRows: DataRow[];
  subRowColumns: ColumnConfig[];
  isDarkMode: boolean;
}

export interface SubRowsConfig {
  mode?: 'nested' | 'tree';
  subRowColumns?: ColumnConfig[];
  getSubRowColumns?: (parentRow: DataRow) => ColumnConfig[];
  renderSubRows?: (props: SubRowRenderProps) => React.ReactNode;
  getRenderSubRows?: (parentRow: DataRow) => ((props: SubRowRenderProps) => React.ReactNode) | undefined;
}

export const DEFAULT_FEATURES: Required<Omit<TableFeaturesConfig, 'rowActions' | 'selectionColumn' | 'subRowsConfig' | 'summaryChips'>> & {
  selectionColumn: SelectionColumnConfig;
  rowActions: RowActionsConfig;
  subRowsConfig?: SubRowsConfig;
  summaryChips?: SummaryChipConfig[];
} = {
  enableRowSelection: true,
  enableActionsColumn: true,
  selectionColumn: {
    mode: 'checkbox',
    renderIcon: undefined,
    onIconClick: undefined,
    renderHeaderIcon: undefined,
  },
  rowActions: {
    showOnHover: true,
    showEdit: true,
    showDelete: true,
    renderCustomActions: undefined,
  },
  enableSearch: false,
  enableAddRow: true,
  enableRefresh: false,
  enableDensity: false,
  enableExport: false,
  enableSavedViews: true,
  enableFullScreen: false,
  enableTranspose: true,
  enableSettings: true,
  enableBulkActions: true,
  enableColumnPinning: true,
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnResizing: true,
  enableColumnReorder: true,
  enableAddColumn: true,
  enableCellEditing: true,
  enableContextMenu: true,
  enableFooter: true,
  enableSummaryChips: false,
  enableQuickFilters: false,
  summaryChips: [],
  enableSidebar: true,
  enableSubRows: true,
  subRowsConfig: undefined,
};


