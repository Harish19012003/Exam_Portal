import type {
  AggregationType,
  ColumnConfig,
  ConditionalFormatRule,
  DataRow,
  Density,
  FilterValue,
  PendingDelete,
  PendingEdit,
  SavedView,
  SortConfig,
} from '../../types';

export interface TableStateHandlers {
  // Data
  rows: DataRow[];
  setRows: React.Dispatch<React.SetStateAction<DataRow[]>>;
  columns: ColumnConfig[];
  setColumns: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;

  // Sort / Filter / Search
  sort: SortConfig[];
  filters: Record<string, FilterValue>;
  search: string;
  handleSort: (key: string, shiftKey?: boolean) => void;
  handleFilterChange: (colKey: string, filter: FilterValue | null) => void;
  handleSearch: (s: string) => void;
  handleClearAll: () => void;

  // Pagination
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (ps: number) => void;

  // Row selection
  selectedRows: Set<string>;
  handleToggleRowSelect: (rowId: string) => void;
  handleSelectAll: (allRowIds: string[]) => void;
  handleClearSelection: () => void;

  // Edit / Delete
  editingCell: { rowId: string; colKey: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ rowId: string; colKey: string } | null>>;
  editingRowIds: Set<string>;
  setEditingRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  rowDrafts: Record<string, Record<string, unknown>>;
  focusedCell: { rowId: string; colKey: string } | null;
  setFocusedCell: React.Dispatch<React.SetStateAction<{ rowId: string; colKey: string } | null>>;
  setRowDrafts: React.Dispatch<React.SetStateAction<Record<string, Record<string, unknown>>>>;
  handleRowDraftChange: (rowId: string, colKey: string, newValue: unknown) => void;
  commitRowDraft: (rowId: string) => void;
  cancelRowDraft: (rowId: string) => void;
  handleEditSelectedRows: () => void;
  handleCellSave: (rowId: string, colKey: string, val: unknown) => void;
  handleDeleteRow: (rowId: string) => void;
  handleUndoDelete: () => void;
  handleDeleteSelected: () => void;
  handleAddRow: () => void;

  // Context menu
  contextMenu: { x: number; y: number; rowId: string } | null;
  setContextMenu: (cm: { x: number; y: number; rowId: string } | null) => void;

  // Undo toast
  pendingDelete: PendingDelete | null;
  setPendingDelete: (pd: PendingDelete | null) => void;
  pendingEdit: PendingEdit | null;
  setPendingEdit: (pe: PendingEdit | null) => void;
  handleUndoEdit: () => void;

  // Column management
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  highlightedColKey: string | null;
  transitioningCols: Record<string, 'show' | 'hide'>;
  handleColumnWidthChange: (key: string, width: number) => void;
  handleColumnReorder: (fromKey: string, toKey: string) => void;
  handleToggleColumnVisibility: (key: string) => void;
  handlePinColumn: (key: string, pin: 'left' | 'right' | null) => void;
  handleAddCompositeColumn: (col: ColumnConfig) => void;
  handleAddCompositeColumnAndContinue: (col: ColumnConfig) => void;
  handleDeleteCompositeColumn: (compositeKey: string) => void;
  handleUpdateCompositeColumn: (oldKey: string, newCol: ColumnConfig) => void;

  // Reset
  handleResetPins: () => void;
  handleResetVisibility: () => void;
  handleResetOrder: () => void;
  handleResetWidths: () => void;
  handleFactoryReset: () => void;

  // UI toggles
  density: Density;
  setDensity: (d: Density) => void;
  openFilterKey: string | null;
  setOpenFilterKey: (key: string | null) => void;
  activeSidebar: 'columns' | null;
  setActiveSidebar: (v: 'columns' | null) => void;
  showBulkConfirm: boolean;
  setShowBulkConfirm: (v: boolean) => void;
  showBulkUpdate: boolean;
  setShowBulkUpdate: (v: boolean) => void;
  handleBulkUpdate: (updates: Record<string, unknown>) => void;

  // Drag state for column reorder
  dragColKey: string | null;
  setDragColKey: (k: string | null) => void;

  // Saved Views
  savedViews: SavedView[];
  activeViewId: string | null;
  handleSaveView: (name: string) => void;
  handleLoadView: (id: string) => void;
  handleDeleteView: (id: string) => void;

  // Column Aggregation
  handleUpdateColumnAggregation: (colKey: string, agg: AggregationType | undefined) => void;

  // Custom Column Properties
  handleUpdateColumnProp: (colKey: string, prop: string, value: unknown) => void;
  handleAddFormulaColumn: (col: ColumnConfig) => void;
  handleUpdateFormulaColumn: (oldKey: string, newCol: ColumnConfig) => void;

  // Conditional formatting
  conditionalFormats: ConditionalFormatRule[];
  recentFormatColors: string[];
  handleAddConditionalFormat: (rule: ConditionalFormatRule) => void;
  handleUpdateConditionalFormat: (rule: ConditionalFormatRule) => void;
  handleDeleteConditionalFormat: (id: string) => void;
  handleToggleConditionalFormat: (id: string) => void;
  handlePushRecentFormatColor: (hex: string) => void;
}
