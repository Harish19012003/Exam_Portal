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
  | 'dot'
  | 'code'
  | 'mono';

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
  order: number;
  visible: boolean;
  pinned: PinDirection;
  width: number;
}

export interface FieldColumn extends BaseColumn {
  dataType: Exclude<DataType, 'composite'>;
  filterable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  options?: string[]; // for dropdown | multiselect | status
  allowCustom?: boolean; // Allow custom inputs for dropdown, status, multiselect
  required?: boolean;
  isPrimaryKey?: boolean;
  maxLength?: number;
  aggregation?: AggregationType;
  formula?: string;
  resultType?: DataType;
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
  version?: number;
  values: Record<string, unknown>;
  subRows?: DataRow[];
}

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
