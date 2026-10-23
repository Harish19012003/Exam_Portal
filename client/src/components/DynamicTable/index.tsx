import { Fragment, useCallback, useEffect, useState, useMemo, useRef } from 'react';
// Dynamic Table Root Component

import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { TransposeIcon } from './icons/TransposeIcon';
import { COLUMN_CONFIG, MOCK_ROWS } from './tableData';
import { useTableState } from './hooks/useTableState';
import { useDynamicTableFeedback } from './hooks/useDynamicTableFeedback';
import { useProcessedRows } from './hooks/useProcessedRows';
import { useVirtualRows } from './hooks/useVirtualRows';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useVisibleColumns } from './hooks/useVisibleColumns';
import { useFocusScroll } from './hooks/useFocusScroll';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboardTSV,
  handlePrint,
} from './export';
import { buildCalculationsClipboardText } from './utils/formatAggregation';
import {
  transposeTable,
  isTransposedRowId,
  parseTransposedFieldKey,
  parseTransposedSourceRowId,
  isTransposedSyntheticRow,
} from './utils/transposeTable';
import { getTableTheme } from './utils/tableTheme';
import { TableToolbar } from './components/TableToolbar';
import { TableHeader } from './components/TableHeader';
import { TableFooter } from './components/TableFooter';
import { TableDataRow } from './components/TableDataRow';
import { AggregationFooterCell } from './components/AggregationFooterCell';
import { FilterPanel } from './components/FilterPanel';
import { ConstructionSidebar } from './components/ConstructionSidebar';
import { SidebarManager } from './components/SidebarManager';
import { TableFloatingSidebarTrigger } from './components/TableFloatingSidebarTrigger';
import { ContextMenu } from './components/ContextMenu';
import { BulkUpdateModal } from './components/BulkUpdateModal';
import { RecordModal } from './components/RecordModal';
import { SubRowNestedPanel } from './components/SubRowNestedPanel';
import { RecordDetail as RecordEditSidebar } from '../DynamicData';
import { useSummaryChipsStore } from '../DynamicData/summaryChipsStore';
import { useQuickFiltersStore } from '../DynamicData/quickFiltersStore';
import {
  isSharedViewFeatureKey,
  toggleSharedViewFeature,
  useSharedViewFeatures,
} from '../DynamicData/sharedViewFeaturesStore';
import { usesNestedSubRowPanel } from './utils/subRowDisplay';
import { IconPickerModal } from '../IconPicker';

import { useTableFeatureConfig } from './hooks/useTableFeatureConfig';


import type { ColumnConfig, RowData, TableFeaturesConfig, DataRow, FilterValue } from './types';
import { DEFAULT_FEATURES } from './types';

interface DynamicTableProps {
  isDarkMode: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: RowData[];
  features?: TableFeaturesConfig;
  enableFeatureBuilder?: boolean;
  /** Prefs namespace — keeps Vendors / Tables / Exams isolated in localStorage */
  tableId?: string;
  /** When false, skip shared Dynamic* store (use for standalone pages like Vendors) */
  shareState?: boolean;
  /**
   * When true with shareState=false, table chrome comes from `features` props
   * (portal-published config) instead of browser-local Feature Builder stores.
   */
  usePortalFeatures?: boolean;
  /** Fired when Feature Builder toggles change (admin publish hook). */
  onFeaturesChange?: (features: TableFeaturesConfig) => void;
  onRowUpdate?: (rowId: string, updatedValues: Record<string, unknown>, row: DataRow) => Promise<void> | void;
  onRowDelete?: (rowIds: string[]) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  /** @deprecated Prefer features.enableAddRow */
  showAddRow?: boolean;
}

export function DynamicTable({
  isDarkMode,
  initialColumns,
  initialRows,
  features,
  enableFeatureBuilder = true,
  tableId,
  shareState = true,
  usePortalFeatures = false,
  onFeaturesChange,
  onRowUpdate,
  onRowDelete,
  onRefresh,
  showAddRow,
}: DynamicTableProps) {
  const resolvedFeatures = useMemo(() => {
    const base = { ...DEFAULT_FEATURES, ...(features || {}) };
    if (typeof showAddRow === 'boolean') {
      base.enableAddRow = showAddRow;
    }
    return base;
  }, [features, showAddRow]);

  const state = useTableState(
    initialColumns ?? COLUMN_CONFIG,
    (initialRows as DataRow[]) ?? MOCK_ROWS,
    { tableId, shareState, onRowUpdate, onRowDelete, onRefresh },
  );
  const [editingRecordSidebarRow, setEditingRecordSidebarRow] = useState<DataRow | null>(null);
  const [detailModalRow, setDetailModalRow] = useState<DataRow | null>(null);

  const handleOpenRecordSidebar = useCallback((row: DataRow) => {
    setEditingRecordSidebarRow(row);
  }, []);

  const handleOpenRecordModal = useCallback((row: DataRow) => {
    setDetailModalRow(row);
  }, []);

  const summaryChipsStore = useSummaryChipsStore();
  const quickFiltersStore = useQuickFiltersStore();
  const sharedViewFeatures = useSharedViewFeatures();

  const quickFieldKeySet = useMemo(
    () => new Set(quickFiltersStore.enabled ? quickFiltersStore.fieldKeys : []),
    [quickFiltersStore.enabled, quickFiltersStore.fieldKeys],
  );

  /** One filter value per field: quick-bar fields are owned by the quick-filters store. */
  const handleSyncedFilterChange = useCallback(
    (colKey: string, filter: FilterValue | null) => {
      if (quickFieldKeySet.has(colKey)) {
        quickFiltersStore.setValue(colKey, filter);
        if (state.filters[colKey]) state.handleFilterChange(colKey, null);
      } else {
        state.handleFilterChange(colKey, filter);
      }
    },
    [quickFieldKeySet, quickFiltersStore, state.filters, state.handleFilterChange],
  );

  const handleFilterColumn = useCallback(
    (key: string, value: any) => {
      if (value !== undefined && value !== null) {
        handleSyncedFilterChange(key, { op: 'equals', value });
      }
    },
    [handleSyncedFilterChange],
  );

  const handleToggleColumnVis = useCallback((key: string) => {
    state.handleToggleColumnVisibility(key);
  }, [state.handleToggleColumnVisibility]);

  const handleSortColumn = useCallback((key: string) => {
    state.handleSort(key, false);
  }, [state.handleSort]);

  const featureConfig = useTableFeatureConfig({
    isDarkMode,
    initialFeatures: resolvedFeatures,
    onOpenRecordSidebar: handleOpenRecordSidebar,
    onOpenRecordModal: handleOpenRecordModal,
    onFilterColumn: handleFilterColumn,
    onToggleColumnVis: handleToggleColumnVis,
    onSortColumn: handleSortColumn,
  });

  const sharedToolbarFlags = {
    enableSearch: sharedViewFeatures.flags.enableSearch,
    enableRefresh: sharedViewFeatures.flags.enableRefresh,
    enableExport: sharedViewFeatures.flags.enableExport,
    enableFullScreen: sharedViewFeatures.flags.enableFullScreen,
    enableDensity: sharedViewFeatures.flags.enableDensity,
  };

  /** Portal pages (Exams): published `features` win. Feature Builder still edits live stores. */
  const lockToPortalProps = usePortalFeatures && !enableFeatureBuilder;

  const activeFeatures = useMemo(
    () => {
      const source = enableFeatureBuilder ? featureConfig.resolvedFeatures : resolvedFeatures;
      if (lockToPortalProps) {
        return {
          ...DEFAULT_FEATURES,
          ...source,
          enableSearch: Boolean(source.enableSearch),
          enableRefresh: Boolean(source.enableRefresh),
          enableExport: Boolean(source.enableExport),
          enableFullScreen: Boolean(source.enableFullScreen),
          enableDensity: Boolean(source.enableDensity),
          enableSummaryChips: Boolean(source.enableSummaryChips),
          enableQuickFilters: Boolean(source.enableQuickFilters),
          summaryChips: Array.isArray(source.summaryChips) ? source.summaryChips : [],
          selectionColumn: {
            ...DEFAULT_FEATURES.selectionColumn,
            ...source?.selectionColumn,
          },
          rowActions: {
            ...DEFAULT_FEATURES.rowActions,
            ...source?.rowActions,
          },
        };
      }
      return {
        ...DEFAULT_FEATURES,
        ...source,
        // Shared stores are canonical across every Dynamic* view.
        ...sharedToolbarFlags,
        enableSummaryChips: summaryChipsStore.enabled,
        enableQuickFilters: quickFiltersStore.enabled,
        summaryChips: summaryChipsStore.chips,
        selectionColumn: {
          ...DEFAULT_FEATURES.selectionColumn,
          ...source?.selectionColumn,
        },
        rowActions: {
          ...DEFAULT_FEATURES.rowActions,
          ...source?.rowActions,
        },
      };
    },
    [
      enableFeatureBuilder,
      lockToPortalProps,
      featureConfig.resolvedFeatures,
      resolvedFeatures,
      sharedToolbarFlags.enableSearch,
      sharedToolbarFlags.enableRefresh,
      sharedToolbarFlags.enableExport,
      sharedToolbarFlags.enableFullScreen,
      sharedToolbarFlags.enableDensity,
      summaryChipsStore.enabled,
      summaryChipsStore.chips,
      quickFiltersStore.enabled,
    ],
  );

  useEffect(() => {
    if (!onFeaturesChange || !enableFeatureBuilder) return undefined;
    const timer = window.setTimeout(() => {
      onFeaturesChange({
        ...activeFeatures,
        quickFilterFieldKeys: quickFiltersStore.fieldKeys,
      } as TableFeaturesConfig);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    enableFeatureBuilder,
    onFeaturesChange,
    activeFeatures,
    quickFiltersStore.fieldKeys,
  ]);

  const theme = getTableTheme(isDarkMode);
  const { showSuccess, showNotice } = useDynamicTableFeedback(state);

  // When a field joins/leaves the quick-filter bar, migrate its value so both UIs stay in sync.
  const prevQuickKeysRef = useRef<string[]>([]);
  useEffect(() => {
    if (!quickFiltersStore.enabled) {
      prevQuickKeysRef.current = [];
      return;
    }
    const keys = quickFiltersStore.fieldKeys;
    const prev = prevQuickKeysRef.current;
    const added = keys.filter(k => !prev.includes(k));
    const removed = prev.filter(k => !keys.includes(k));
    added.forEach(key => {
      const tv = state.filters[key];
      if (tv) {
        quickFiltersStore.setValue(key, tv);
        state.handleFilterChange(key, null);
      }
    });
    removed.forEach(key => {
      const qv = quickFiltersStore.values[key];
      if (qv) {
        state.handleFilterChange(key, qv);
        quickFiltersStore.setValue(key, null);
      }
    });
    prevQuickKeysRef.current = keys;
  }, [quickFiltersStore.enabled, quickFiltersStore.fieldKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Header + panels: table filters ∪ quick-bar values for shared fields. */
  const displayFilters = useMemo(() => {
    const result = { ...state.filters };
    if (quickFiltersStore.enabled) {
      quickFiltersStore.fieldKeys.forEach(key => {
        delete result[key];
        const v = quickFiltersStore.values[key];
        if (v) result[key] = v;
      });
    }
    return result;
  }, [
    state.filters,
    quickFiltersStore.enabled,
    quickFiltersStore.fieldKeys,
    quickFiltersStore.values,
  ]);

  const mergedFilters = useMemo(() => {
    const result = { ...state.filters };
    if (quickFiltersStore.enabled) {
      quickFiltersStore.fieldKeys.forEach(key => {
        delete result[key];
      });
      Object.assign(result, quickFiltersStore.activeFilters);
    }
    return result;
  }, [
    state.filters,
    quickFiltersStore.enabled,
    quickFiltersStore.fieldKeys,
    quickFiltersStore.activeFilters,
  ]);

  const handleClearAllSynced = useCallback(() => {
    state.handleClearAll();
    if (quickFiltersStore.enabled) quickFiltersStore.clearValues();
  }, [state.handleClearAll, quickFiltersStore]);

  const { filteredRows, paginatedRows, filteredCount, totalCount, totalPages, aggregations } =
    useProcessedRows(
      state.rows,
      state.columns,
      mergedFilters,
      state.sort,
      state.search,
      state.page,
      state.pageSize,
      state.columnVisibility,
    );

  const rowHeight =
    state.density === 'extra-compact' ? 32 : state.density === 'compact' ? 48 : state.density === 'comfortable' ? 80 : state.density === 'spacious' ? 96 : state.density === 'extra-spacious' ? 120 : 64;

  const [isFooterExpanded, setIsFooterExpanded] = useState(true);
  const [activeFooterDropdown, setActiveFooterDropdown] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterAnchorRect, setFilterAnchorRect] = useState<DOMRect | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFooterDropdown) return;
    const handleClickOutside = () => setActiveFooterDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeFooterDropdown]);

  const onScrollExtra = useCallback(() => {
    state.setOpenFilterKey(null);
    state.setContextMenu(null);
  }, [state.setOpenFilterKey, state.setContextMenu]);

  // Transpose the current page: each record becomes a column (keeps wide tables usable).
  const { transposedColumns, transposedRows } = useMemo(() => {
    if (!featureConfig.isTransposed) {
      return { transposedColumns: [], transposedRows: [] };
    }
    return transposeTable(state.columns, paginatedRows, {
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      // View-only: no selection/actions rows, no summary column.
      enableActionsColumn: false,
      enableRowSelection: false,
      includeSummaryColumn: false,
    });
  }, [
    featureConfig.isTransposed,
    state.columns,
    paginatedRows,
    state.columnVisibility,
    state.columnOrder,
  ]);

  const activePaginatedRows = useMemo(() => {
    return featureConfig.isTransposed ? transposedRows : paginatedRows;
  }, [featureConfig.isTransposed, transposedRows, paginatedRows]);

  const topStickyOffsets = useMemo(() => {
    if (!featureConfig.isTransposed) return {};
    // No sticky thead in transpose — offsets start at 0.
    const offsets: Record<string, number> = {};
    let currentTop = 0;
    transposedRows.forEach(r => {
      if (r.pinnedDirection === 'top') {
        offsets[r.rowId] = currentTop;
        currentTop += rowHeight;
      }
    });
    return offsets;
  }, [featureConfig.isTransposed, transposedRows, rowHeight]);

  // Export always uses original (filtered) records — not the transposed grid shape.
  const activeExportRows = filteredRows;

  const { scrollWrapperRef, virtualRows, paddingTop, paddingBottom, handleScroll } =
    useVirtualRows({ paginatedRows: activePaginatedRows, rowHeight, onScrollExtra });

  const targetColumns = featureConfig.isTransposed ? transposedColumns : state.columns;
  const targetColumnOrder = useMemo(() => {
    return featureConfig.isTransposed ? transposedColumns.map(c => c.key) : state.columnOrder;
  }, [featureConfig.isTransposed, transposedColumns, state.columnOrder]);

  const { visibleColumns, stickyOffsets, totalWidth, CHECKBOX_WIDTH, ACTIONS_WIDTH } =
    useVisibleColumns({
      columns: targetColumns,
      columnOrder: targetColumnOrder,
      columnVisibility: featureConfig.isTransposed ? {} : state.columnVisibility,
      transitioningCols: state.transitioningCols,
      columnWidths: state.columnWidths,
      enableRowSelection: featureConfig.isTransposed ? false : activeFeatures.enableRowSelection,
      enableActionsColumn: featureConfig.isTransposed ? false : activeFeatures.enableActionsColumn,
      enableAddColumn: featureConfig.isTransposed ? false : activeFeatures.enableAddColumn,
      enableSubRows: featureConfig.isTransposed ? false : activeFeatures.enableSubRows,
      selectionColumn: featureConfig.isTransposed ? { mode: 'none' } : activeFeatures.selectionColumn,
      rowActions: featureConfig.isTransposed ? undefined : activeFeatures.rowActions,
    });

  const displayColumns = visibleColumns;
  const displayRows = virtualRows;

  const exportColumns = useMemo(() => {
    return state.columnOrder
      .map(key => state.columns.find(c => c.key === key))
      .filter((c): c is NonNullable<typeof c> => Boolean(c) && state.columnVisibility[c!.key] !== false);
  }, [state.columnOrder, state.columns, state.columnVisibility]);

  const handleOpenFilter = useCallback(
    (key: string, rect: DOMRect) => {
      setFilterAnchorRect(rect);
      state.setOpenFilterKey(key);
    },
    [state.setOpenFilterKey],
  );


  const handlePinColumn = useCallback((key: string, pin: 'left' | 'right' | null) => {
    if (featureConfig.isTransposed) return;
    state.handlePinColumn(key, pin);
  }, [featureConfig.isTransposed, state.handlePinColumn]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      if (featureConfig.isTransposed) return;
      if (activeFeatures.enableContextMenu !== false) {
        state.setContextMenu({ x: e.clientX, y: e.clientY, rowId });
      }
    },
    [featureConfig.isTransposed, activeFeatures.enableContextMenu, state.setContextMenu],
  );

  const handleContextEdit = useCallback(() => {
    if (!state.contextMenu) return;
    const rowId = state.contextMenu.rowId;
    state.setEditingRowIds(prev => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });
    state.setEditingCell(null);
    state.setContextMenu(null);
  }, [state.contextMenu, state.setEditingRowIds, state.setEditingCell, state.setContextMenu]);

  const handleCopyCalculations = () => {
    const text = buildCalculationsClipboardText(state.columns, aggregations);
    if (text) {
      navigator.clipboard.writeText(text);
      showSuccess('Calculations copied to clipboard!');
    } else {
      showNotice('No calculations to copy');
    }
  };

  const allRowIds = paginatedRows.map(r => r.rowId);
  const allSelected = allRowIds.length > 0 && allRowIds.every(id => state.selectedRows.has(id));
  const someSelected = allRowIds.some(id => state.selectedRows.has(id));
  const activeFilterCount =
    Object.keys(displayFilters).length + (state.search ? 1 : 0) + state.sort.length;
  const hasActiveFilters = activeFilterCount > 0;

  const currentFilterCol = state.openFilterKey
    ? state.columns.find(c => c.key === state.openFilterKey)
    : null;

  const handleKeyDown = useKeyboardNav({
    scrollWrapperRef,
    focusedCell: state.focusedCell,
    editingRowIds: state.editingRowIds,
    paginatedRows: activePaginatedRows,
    visibleColumns,
    setFocusedCell: state.setFocusedCell,
    setEditingCell: state.setEditingCell,
  });

  useFocusScroll({
    focusedCell: state.focusedCell,
    scrollWrapperRef,
    visibleColumns,
    columnWidths: state.columnWidths,
    checkboxWidth: CHECKBOX_WIDTH,
    actionsWidth: ACTIONS_WIDTH,
  });

  useEffect(() => {
    if (!state.editingCell && scrollWrapperRef.current) {
      if (document.activeElement === document.body) {
        scrollWrapperRef.current.focus();
      }
    }
  }, [state.editingCell, scrollWrapperRef]);

  const hasFirstCol = Boolean(activeFeatures.enableRowSelection || activeFeatures.enableSubRows || activeFeatures.selectionColumn?.customIconElements?.some(e => e.enabled));

  const colSpan = featureConfig.isTransposed
    ? displayColumns.length
    : visibleColumns.length +
      (hasFirstCol ? 1 : 0) +
      (activeFeatures.enableActionsColumn ? 1 : 0) +
      (activeFeatures.enableAddColumn ? 1 : 0);

  return (
    <div
      className={isFullScreen ? `fixed inset-0 z-[9999] flex flex-col ${isDarkMode ? 'bg-gray-950' : 'bg-transparent'}` : `flex-1 flex flex-col overflow-hidden print:overflow-visible print:h-auto print:block bg-transparent gap-2 sm:gap-3`}
    >
      <div
        className={`flex flex-col ${isFullScreen ? 'm-0 rounded-none border-none' : 'm-0 rounded-2xl border shadow-sm'} overflow-hidden print:overflow-visible print:border-none print:shadow-none print:m-0 flex-1 min-h-0 print:min-h-auto relative print:block ${theme.bgCard}`}
      >
        <TableToolbar
          search={state.search}
          onSearch={state.handleSearch}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onClearAll={handleClearAllSynced}
          onRefresh={() => state.setRows([...MOCK_ROWS])}
          onOpenSidebar={() => {
            state.setActiveSidebar('columns');
            state.setOpenFilterKey(null);
          }}
          onAddRow={state.handleAddRow}
          onResetPins={state.handleResetPins}
          onResetVisibility={state.handleResetVisibility}
          onResetOrder={state.handleResetOrder}
          onResetWidths={state.handleResetWidths}
          onFactoryReset={state.handleFactoryReset}
          selectedCount={state.selectedRows.size}
          onDeleteSelected={() => state.setShowBulkConfirm(true)}
          totalCount={totalCount}
          filteredCount={filteredCount}
          isDarkMode={isDarkMode}
          editingCount={state.editingRowIds.size}
          isSaving={isSaving}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen(p => !p)}
          onSaveAllEdits={() => {
            setIsSaving(true);
            setTimeout(() => {
              state.editingRowIds.forEach(id => state.commitRowDraft(id));
              setIsSaving(false);
              showSuccess('Rows saved successfully');
            }, 600);
          }}
          onCancelAllEdits={() => state.editingRowIds.forEach(id => state.cancelRowDraft(id))}
          onBulkUpdate={() => state.setShowBulkUpdate(true)}
          onEditSelected={() => state.handleEditSelectedRows()}
          onCancelSelection={state.handleClearSelection}
          onExportCSV={() => exportToCSV(activeExportRows, exportColumns)}
          onExportExcel={() => exportToExcel(activeExportRows, exportColumns)}
          onExportPDF={() => exportToPDF(activeExportRows, exportColumns)}
          onExportJSON={() => exportToJSON(activeExportRows, exportColumns)}
          onCopyTSV={() => copyToClipboardTSV(activeExportRows, exportColumns)}
          onPrint={handlePrint}
          onPrintAll={() => exportToPDF(activeExportRows, exportColumns, 'print')}
          density={state.density}
          onDensityChange={state.setDensity}
          savedViews={state.savedViews}
          activeViewId={state.activeViewId}
          onSaveView={state.handleSaveView}
          onLoadView={state.handleLoadView}
          onDeleteView={state.handleDeleteView}
          features={activeFeatures}
          isTransposed={featureConfig.isTransposed}
          onToggleTranspose={featureConfig.toggleTranspose}
        />

        {featureConfig.isTransposed && (
          <div className={`mx-4 mt-3 px-4 py-2 rounded-lg border flex items-center justify-between gap-3 ${
            isDarkMode ? 'bg-[#182d27]/80 border-[#13C296]/30 text-[#13C296]' : 'bg-teal-50/80 border-[#13C296]/25 text-teal-900'
          }`}>
            <div className="flex items-center gap-2 text-xs">
              <TransposeIcon className="w-3.5 h-3.5 text-[#13C296] flex-shrink-0" />
              <span>
                Transposed view (read-only) — fields as rows, current page records as columns
                {paginatedRows.length > 0 ? ` (${paginatedRows.length} shown)` : ''}.
              </span>
            </div>
            <button
              type="button"
              onClick={featureConfig.toggleTranspose}
              className="px-2.5 py-1 rounded-md bg-[#13C296] text-white text-xs font-medium hover:bg-[#0f9f7a] transition-colors cursor-pointer flex-shrink-0"
            >
              Exit
            </button>
          </div>
        )}

        <div
          ref={scrollWrapperRef}
          className="flex-1 overflow-auto print:overflow-visible min-h-0 print:min-h-auto relative outline-none print:block"
          onScroll={handleScroll}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <table
            style={{
              minWidth: totalWidth,
              width: '100%',
              height: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              tableLayout: 'fixed',
            }}
            role="grid"
            aria-label="Data table"
          >
            {!featureConfig.isTransposed && (
              <TableHeader
                columns={displayColumns}
                columnWidths={state.columnWidths}
                stickyOffsets={stickyOffsets}
                sort={state.sort}
                filters={displayFilters}
                allColumnsSelected={allSelected}
                someRowsSelected={someSelected}
                onSelectAll={() => state.handleSelectAll(allRowIds)}
                onSort={state.handleSort}
                onOpenFilter={handleOpenFilter}
                onColumnWidthChange={state.handleColumnWidthChange}
                onColumnReorder={state.handleColumnReorder}
                onPinColumn={handlePinColumn}
                onDeleteCompositeColumn={state.handleDeleteCompositeColumn}
                dragColKey={state.dragColKey}
                setDragColKey={state.setDragColKey}
                highlightedColKey={state.highlightedColKey}
                transitioningCols={state.transitioningCols}
                isDarkMode={isDarkMode}
                enableRowSelection={activeFeatures.enableRowSelection}
                enableActionsColumn={activeFeatures.enableActionsColumn}
                enableAddColumn={activeFeatures.enableAddColumn}
                enableSubRows={activeFeatures.enableSubRows}
                selectionColumn={activeFeatures.selectionColumn}
                rowActions={activeFeatures.rowActions}
                checkboxWidth={CHECKBOX_WIDTH}
                actionsWidth={ACTIONS_WIDTH}
                rows={state.rows}
                onAddColumn={() => {
                  state.setActiveSidebar('columns');
                  state.setOpenFilterKey(null);
                }}
              />
            )}

            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                </tr>
              )}

              {displayRows.map(row => {
                const rowHasSubRows = usesNestedSubRowPanel(row, activeFeatures.subRowsConfig);

                const isExpanded = state.expandedRowIds.has(row.rowId);

                return (
                  <Fragment key={row.rowId}>
                    <TableDataRow
                      row={row}
                      rowHeight={rowHeight}
                      visibleColumns={displayColumns}
                      allColumns={state.columns}
                      columnWidths={state.columnWidths}
                      stickyOffsets={stickyOffsets}
                      transitioningCols={state.transitioningCols}
                      highlightedColKey={state.highlightedColKey}
                      checkboxWidth={CHECKBOX_WIDTH}
                      actionsWidth={ACTIONS_WIDTH}
                      isSelected={state.selectedRows.has(row.rowId)}
                      hasSubRows={rowHasSubRows}
                      isExpanded={isExpanded}
                      onToggleExpand={() => state.handleToggleExpandRow(row.rowId)}
                      isEditingCellRow={state.editingCell?.rowId === row.rowId}
                      isEditingThisRow={state.editingRowIds.has(row.rowId)}
                      editingCellColKey={state.editingCell?.colKey ?? null}
                      focusedCell={state.focusedCell}
                      rowDraft={state.rowDrafts[row.rowId]}
                      theme={theme}
                      isDarkMode={isDarkMode}
                      conditionalFormats={state.conditionalFormats}
                      scrollWrapperRef={scrollWrapperRef}
                      onToggleSelect={() => state.handleToggleRowSelect(row.rowId)}
                      onContextMenu={e => handleContextMenu(e, row.rowId)}
                      onSetFocusedCell={state.setFocusedCell}
                      onSetEditingCell={state.setEditingCell}
                      onOpenRecordSidebar={target => setEditingRecordSidebarRow(target ?? row)}
                      onStartRowEdit={() => {
                        state.setEditingRowIds(prev => {
                          const next = new Set(prev);
                          next.add(row.rowId);
                          return next;
                        });
                        state.setEditingCell(null);
                      }}
                      onCancelRowDraft={() => state.cancelRowDraft(row.rowId)}
                      onCommitRowDraft={() => state.commitRowDraft(row.rowId)}
                      onDeleteRow={(targetRowId) => {
                        if (targetRowId) {
                          state.handleDeleteRow(targetRowId);
                          return;
                        }
                        // In transpose, field-rows are attributes — never delete a column via row delete.
                        if (featureConfig.isTransposed && isTransposedRowId(row.rowId)) return;
                        state.handleDeleteRow(row.rowId);
                      }}
                      onCellSave={(colKey, value) => {
                        if (
                          featureConfig.isTransposed &&
                          isTransposedRowId(row.rowId) &&
                          !isTransposedSyntheticRow(row.rowId)
                        ) {
                          const realRowId = parseTransposedSourceRowId(colKey);
                          const realColKey = parseTransposedFieldKey(row.rowId);
                          if (realRowId) {
                            state.handleCellSave(realRowId, realColKey, value);
                            return;
                          }
                        }
                        state.handleCellSave(row.rowId, colKey, value);
                      }}
                      onRowDraftChange={(colKey, value) => {
                        if (
                          featureConfig.isTransposed &&
                          isTransposedRowId(row.rowId) &&
                          !isTransposedSyntheticRow(row.rowId)
                        ) {
                          const realRowId = parseTransposedSourceRowId(colKey);
                          const realColKey = parseTransposedFieldKey(row.rowId);
                          if (realRowId) {
                            state.handleRowDraftChange(realRowId, realColKey, value);
                            return;
                          }
                        }
                        state.handleRowDraftChange(row.rowId, colKey, value);
                      }}
                      onSaveBatch={updates => {
                        const editingRow = state.editingRowIds.has(row.rowId);
                        Object.entries(updates).forEach(([k, v]) => {
                          if (
                            featureConfig.isTransposed &&
                            isTransposedRowId(row.rowId) &&
                            !isTransposedSyntheticRow(row.rowId)
                          ) {
                            const realRowId = parseTransposedSourceRowId(k);
                            const realColKey = parseTransposedFieldKey(row.rowId);
                            if (realRowId) {
                              state.handleCellSave(realRowId, realColKey, v);
                              return;
                            }
                          }
                          if (editingRow) state.handleRowDraftChange(row.rowId, k, v);
                          else state.handleCellSave(row.rowId, k, v);
                        });
                        state.setEditingCell(null);
                      }}
                      enableRowSelection={featureConfig.isTransposed ? false : activeFeatures.enableRowSelection}
                      enableActionsColumn={featureConfig.isTransposed ? false : activeFeatures.enableActionsColumn}
                      enableAddColumn={featureConfig.isTransposed ? false : activeFeatures.enableAddColumn}
                      enableSubRows={featureConfig.isTransposed ? false : activeFeatures.enableSubRows}
                      selectedRowIds={state.selectedRows}
                      onToggleRowSelectById={state.handleToggleRowSelect}
                      topOffset={topStickyOffsets[row.rowId] ?? (featureConfig.isTransposed ? 0 : 41)}
                      selectionColumn={activeFeatures.selectionColumn}
                      rowActions={activeFeatures.rowActions}
                      enableCellEditing={featureConfig.isTransposed ? false : activeFeatures.enableCellEditing}
                      enableContextMenu={featureConfig.isTransposed ? false : activeFeatures.enableContextMenu}
                    />
                    {isExpanded && rowHasSubRows && (
                      <SubRowNestedPanel
                        parentRow={row}
                        subRows={row.subRows || []}
                        colSpan={colSpan}
                        subRowsConfig={activeFeatures.subRowsConfig}
                        isDarkMode={isDarkMode}
                        allColumns={state.columns}
                        checkboxWidth={CHECKBOX_WIDTH}
                        rowHeight={rowHeight}
                        enableRowSelection={activeFeatures.enableRowSelection}
                        scrollWrapperRef={scrollWrapperRef}
                      />
                    )}

                  </Fragment>
                );
              })}

              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={colSpan}
                    style={{ height: paddingBottom, padding: 0, border: 'none' }}
                  />
                </tr>
              )}

              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="p-0 border-none">
                    <div className="py-24 w-full">
                      <div className="sticky left-1/2 -translate-x-1/2 w-max flex flex-col items-center gap-3">
                        <div
                          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
                        >
                          <svg
                            className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                        </div>
                        <p
                          className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                        >
                          No results found
                        </p>
                        <p
                          className={`text-[13px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                        >
                          Try adjusting your search or filter criteria
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {paginatedRows.length > 0 && (
                <tr className="h-full">
                  <td
                    colSpan={colSpan}
                    className="border-0 bg-transparent p-0 m-0 pointer-events-none"
                  />
                </tr>
              )}
            </tbody>

            {activeFeatures.enableFooter && isFooterExpanded && !featureConfig.isTransposed && (
              <tfoot
                className={`sticky bottom-0 z-20 ${isDarkMode ? 'bg-gray-900 border-t border-gray-800' : 'bg-gray-50 border-t border-gray-200'} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]`}
              >
                <tr className="group">
                  {activeFeatures.enableRowSelection && (
                    <td
                      style={{
                        width: CHECKBOX_WIDTH,
                        minWidth: CHECKBOX_WIDTH,
                        maxWidth: CHECKBOX_WIDTH,
                      }}
                      className={`px-3 py-3 border-r ${theme.borderRow}`}
                    />
                  )}
                  {visibleColumns.map(col => {
                    const isLeftPinned = col.pinned === 'left';
                    const isRightPinned = col.pinned === 'right';
                    const offset = stickyOffsets[col.key];
                    const stickyStyle: React.CSSProperties = isLeftPinned
                      ? { left: offset?.left, position: 'sticky', zIndex: 21 }
                      : isRightPinned
                        ? { right: offset?.right, position: 'sticky', zIndex: 21 }
                        : {};

                    return (
                      <AggregationFooterCell
                        key={`footer-${col.key}`}
                        col={col}
                        columnWidth={state.columnWidths[col.key] ?? col.width}
                        stickyStyle={stickyStyle}
                        pinnedBg={theme.bgPinnedFooter}
                        isPinned={isLeftPinned || isRightPinned}
                        isDarkMode={isDarkMode}
                        aggValue={aggregations[col.key]}
                        isDropdownOpen={activeFooterDropdown === col.key}
                        onToggleDropdown={() =>
                          setActiveFooterDropdown(
                            activeFooterDropdown === col.key ? null : col.key,
                          )
                        }
                        onSelectAggregation={agg => {
                          state.handleUpdateColumnAggregation(col.key, agg);
                          setActiveFooterDropdown(null);
                        }}
                      />
                    );
                  })}
                  {activeFeatures.enableAddColumn && (
                    <td
                      style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                      className={`px-3 py-3 border-r ${theme.borderRow}`}
                    />
                  )}
                  {activeFeatures.enableActionsColumn && (
                    <td
                      style={{
                        width: ACTIONS_WIDTH,
                        minWidth: ACTIONS_WIDTH,
                        maxWidth: ACTIONS_WIDTH,
                        right: 0,
                        position: 'sticky',
                        zIndex: 21,
                      }}
                      className={`px-1 py-3 ${theme.bgPinnedFooter}`}
                    >
                      {Object.keys(aggregations).length > 0 && (
                        <div className="flex items-center justify-center w-full h-full">
                          <button
                            type="button"
                            onClick={handleCopyCalculations}
                            className={`p-1.5 rounded transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                            title="Copy all calculations"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {activeFeatures.enableFooter && !featureConfig.isTransposed && (
          <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 translate-y-1/2 z-30 pointer-events-none">
            <button
              type="button"
              onClick={() => setIsFooterExpanded(v => !v)}
              className={`pointer-events-auto p-1 rounded-full shadow-sm transition-all opacity-50 hover:opacity-100 ${isDarkMode ? 'bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-700 hover:shadow-md' : 'bg-white border border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 hover:shadow-md'}`}
              aria-label={isFooterExpanded ? 'Collapse Footer' : 'Expand Footer'}
              title={isFooterExpanded ? 'Collapse Footer' : 'Expand Footer'}
            >
              {isFooterExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        <TableFooter
          page={state.page}
          pageSize={state.pageSize}
          totalPages={totalPages}
          filteredCount={filteredCount}
          totalCount={totalCount}
          onPageChange={state.setPage}
          onPageSizeChange={state.setPageSize}
          isDarkMode={isDarkMode}
          selectedCount={state.selectedRows.size}
        />

        {enableFeatureBuilder && activeFeatures.enableSidebar && (
          <TableFloatingSidebarTrigger
            isOpen={state.activeSidebar === 'construction'}
            onToggle={() => {
              if (state.activeSidebar === 'construction') {
                state.setActiveSidebar(null);
              } else {
                state.setActiveSidebar('construction');
                state.setOpenFilterKey(null);
              }
            }}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      {state.openFilterKey && currentFilterCol && filterAnchorRect && (
        <FilterPanel
          column={currentFilterCol}
          allColumns={state.columns}
          currentFilter={displayFilters[state.openFilterKey]}
          anchorRect={filterAnchorRect}
          onFilterChange={filter => handleSyncedFilterChange(state.openFilterKey!, filter)}
          onClose={() => state.setOpenFilterKey(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {enableFeatureBuilder && state.activeSidebar === 'construction' && (
        <ConstructionSidebar
          onClose={() => state.setActiveSidebar(null)}
          isDarkMode={isDarkMode}
          columns={state.columns}
          customIconElements={featureConfig.customIconElements}
          onAddCustomIconElement={featureConfig.addCustomIconElement}
          onRemoveCustomIconElement={featureConfig.removeCustomIconElement}
          onUpdateCustomIconElement={featureConfig.updateCustomIconElement}
          firstColOrder={featureConfig.firstColOrder}
          onReorderFirstCol={featureConfig.setFirstColOrder}
          onOpenIconPickerForElement={(id) => setIconPickerTarget(id)}
          enableTriggerIcon={featureConfig.enableTriggerIcon}
          onToggleTriggerIcon={featureConfig.toggleTriggerIcon}
          orderedElementKeys={featureConfig.orderedElementKeys}
          onReorderFirstColumnElements={featureConfig.reorderFirstColumnElements}
          customFeatures={{
            ...featureConfig.customFeatures,
            ...sharedToolbarFlags,
            enableSummaryChips: summaryChipsStore.enabled,
            enableQuickFilters: quickFiltersStore.enabled,
            summaryChips: summaryChipsStore.chips,
          }}
          onToggleFeature={key => {
            if (key === 'enableSummaryChips') {
              summaryChipsStore.toggleEnabled();
              return;
            }
            if (key === 'enableQuickFilters') {
              quickFiltersStore.toggleEnabled();
              return;
            }
            if (isSharedViewFeatureKey(key)) {
              toggleSharedViewFeature(key);
              return;
            }
            featureConfig.toggleFeature(key);
          }}
          onUpdateSummaryChips={summaryChipsStore.setChips}
          actionsAlwaysVisible={featureConfig.actionsAlwaysVisible}
          onToggleActionsAlwaysVisible={featureConfig.toggleActionsAlwaysVisible}
          onOpenIconPicker={() => setIconPickerTarget('trigger')}
          detailViewMode={featureConfig.detailViewMode}
          onDetailViewModeChange={featureConfig.changeDetailViewMode}
          customDetailIcon={featureConfig.customDetailIcon}
          expanderIcon={featureConfig.expanderIcon}
          onOpenExpanderIconPicker={() => setIconPickerTarget('expander')}
          expanderOperation={featureConfig.expanderOperation}
          onExpanderOperationChange={featureConfig.setExpanderOperation}
          showSubRowCount={featureConfig.showSubRowCount}
          onToggleSubRowCount={featureConfig.toggleSubRowCount}
          customRowActionButtons={featureConfig.customRowActionButtons}
          onAddCustomRowActionButton={featureConfig.addCustomRowActionButton}
          onRemoveCustomRowActionButton={featureConfig.removeCustomRowActionButton}
          onUpdateCustomRowActionButton={featureConfig.updateCustomRowActionButton}
          onOpenIconPickerForActionButton={(id) => setIconPickerTarget(`btn_${id}`)}
          isTransposed={featureConfig.isTransposed}
          onToggleTranspose={featureConfig.toggleTranspose}
        />
      )}

      {enableFeatureBuilder && (
        <IconPickerModal
          isOpen={Boolean(iconPickerTarget)}
          currentIconName={
            iconPickerTarget
              ? iconPickerTarget.startsWith('btn_')
                ? featureConfig.customRowActionButtons?.find(b => b.id === iconPickerTarget.replace('btn_', ''))?.iconName || 'star'
                : featureConfig.customIconElements?.find(e => e.id === iconPickerTarget)?.iconName ||
                  (iconPickerTarget === 'expander' ? featureConfig.expanderIcon : featureConfig.chosenIconName)
              : 'external-link'
          }
          isDarkMode={isDarkMode}
          title="Choose Action Icon"
          onClose={() => setIconPickerTarget(null)}
          onSelectIcon={iconName => {
            if (iconPickerTarget) {
              if (iconPickerTarget.startsWith('btn_')) {
                const btnId = iconPickerTarget.replace('btn_', '');
                featureConfig.updateCustomRowActionButton(btnId, { iconName });
              } else {
                const customElem = featureConfig.customIconElements?.find(e => e.id === iconPickerTarget);
                if (customElem) {
                  featureConfig.updateCustomIconElement(customElem.id, { iconName });
                } else if (iconPickerTarget === 'expander') {
                  featureConfig.selectExpanderIcon(iconName);
                } else {
                  featureConfig.selectIcon(iconName);
                }
              }
            }
            setIconPickerTarget(null);
          }}
        />
      )}

      {detailModalRow && (
        <RecordModal
          row={detailModalRow}
          columns={state.columns}
          isDarkMode={isDarkMode}
          onSave={updatedRow => {
            state.setRows(prev => prev.map(r => (r.rowId === updatedRow.rowId ? updatedRow : r)));
            setDetailModalRow(null);
          }}
          onClose={() => setDetailModalRow(null)}
        />
      )}

      {state.activeSidebar === 'columns' && (
        <SidebarManager
          columns={state.columns}
          columnOrder={state.columnOrder}
          columnVisibility={state.columnVisibility}
          rows={state.rows}
          onUpdateColumnProp={state.handleUpdateColumnProp}
          onToggleVisibility={state.handleToggleColumnVisibility}
          onReorderColumn={state.handleColumnReorder}
          onAddComposite={col => {
            state.handleAddCompositeColumn(col);
            showSuccess('Group created successfully');
          }}
          onAddFormula={col => {
            state.handleAddFormulaColumn(col);
            showSuccess('Formula created successfully');
          }}
          onUpdateFormula={(oldKey, col) => {
            state.handleUpdateFormulaColumn(oldKey, col);
            showSuccess('Formula updated successfully');
          }}
          onUpdateComposite={(oldKey, col) => {
            state.handleUpdateCompositeColumn(oldKey, col);
            showSuccess('Group updated successfully');
          }}
          conditionalFormats={state.conditionalFormats}
          recentFormatColors={state.recentFormatColors}
          onAddConditionalFormat={rule => {
            state.handleAddConditionalFormat(rule);
            showSuccess('Format rule created');
          }}
          onUpdateConditionalFormat={rule => {
            state.handleUpdateConditionalFormat(rule);
            showSuccess('Format rule updated');
          }}
          onDeleteConditionalFormat={state.handleDeleteConditionalFormat}
          onToggleConditionalFormat={state.handleToggleConditionalFormat}
          onPushRecentFormatColor={state.handlePushRecentFormatColor}
          onClose={() => state.setActiveSidebar(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {state.contextMenu && (
        <ContextMenu
          x={state.contextMenu.x}
          y={state.contextMenu.y}
          rowId={state.contextMenu.rowId}
          hasMultipleSelected={state.selectedRows.size > 1}
          selectedCount={state.selectedRows.size}
          isDarkMode={isDarkMode}
          onEdit={handleContextEdit}
          onEditSelected={() => {
            state.handleEditSelectedRows();
            state.setContextMenu(null);
          }}
          onBulkUpdate={() => {
            state.setContextMenu(null);
            state.setShowBulkUpdate(true);
          }}
          onDelete={() => state.handleDeleteRow(state.contextMenu!.rowId)}
          onDeleteSelected={() => state.setShowBulkConfirm(true)}
          onClose={() => state.setContextMenu(null)}
        />
      )}

      {state.showBulkUpdate && (
        <BulkUpdateModal
          columns={state.columns}
          selectedCount={state.selectedRows.size}
          onApply={state.handleBulkUpdate}
          onClose={() => state.setShowBulkUpdate(false)}
          isDarkMode={isDarkMode}
        />
      )}


      {editingRecordSidebarRow && (
        <RecordEditSidebar
          row={editingRecordSidebarRow}
          columns={state.columns}
          isDarkMode={isDarkMode}
          enableSubRows={activeFeatures.enableSubRows}
          subRowsConfig={activeFeatures.subRowsConfig}
          onSave={updatedRow => {
            state.setRows(prev => prev.map(r => (r.rowId === updatedRow.rowId ? updatedRow : r)));
            setEditingRecordSidebarRow(null);
          }}
          onClose={() => setEditingRecordSidebarRow(null)}
        />
      )}
    </div>
  );
}

export { VENDOR_COLUMN_CONFIG, VENDOR_ROWS } from './vendorData';
