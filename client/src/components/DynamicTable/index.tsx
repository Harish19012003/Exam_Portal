import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { COLUMN_CONFIG, MOCK_ROWS } from './tableData';
import type { ColumnConfig, DataRow } from './types';
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
import { getTableTheme } from './utils/tableTheme';
import { TableToolbar } from './components/TableToolbar';
import { TableHeader } from './components/TableHeader';
import { TableFooter } from './components/TableFooter';
import { TableDataRow } from './components/TableDataRow';
import { AggregationFooterCell } from './components/AggregationFooterCell';
import { FilterPanel } from './components/FilterPanel';
import { SidebarManager } from './components/SidebarManager';
import { ContextMenu } from './components/ContextMenu';
import { BulkUpdateModal } from './components/BulkUpdateModal';

interface DynamicTableProps {
  tableId?: string;
  isDarkMode?: boolean;
  initialColumns?: ColumnConfig[];
  initialRows?: DataRow[];
  onRowUpdate?: (rowId: string, updatedValues: Record<string, unknown>, row: DataRow) => Promise<void> | void;
  onRowDelete?: (rowIds: string[]) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  showAddRow?: boolean;
}

export function DynamicTable({
  tableId = 'default_table',
  isDarkMode = false,
  initialColumns = COLUMN_CONFIG,
  initialRows = MOCK_ROWS,
  onRowUpdate,
  onRowDelete,
  onRefresh,
  showAddRow = true,
}: DynamicTableProps) {
  const state = useTableState(initialColumns, initialRows, tableId, { onRowUpdate, onRowDelete, onRefresh });
  const theme = getTableTheme(isDarkMode);
  const { showSuccess, showNotice } = useDynamicTableFeedback(state);

  const { filteredRows, paginatedRows, filteredCount, totalCount, totalPages, aggregations } =
    useProcessedRows(
      state.rows,
      state.columns,
      state.filters,
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

  const { scrollWrapperRef, virtualRows, paddingTop, paddingBottom, handleScroll } =
    useVirtualRows({ paginatedRows, rowHeight, onScrollExtra });

  const { visibleColumns, stickyOffsets, totalWidth, CHECKBOX_WIDTH, ACTIONS_WIDTH } =
    useVisibleColumns({
      columns: state.columns,
      columnOrder: state.columnOrder,
      columnVisibility: state.columnVisibility,
      transitioningCols: state.transitioningCols,
      columnWidths: state.columnWidths,
    });

  const handleOpenFilter = useCallback(
    (key: string, rect: DOMRect) => {
      setFilterAnchorRect(rect);
      state.setOpenFilterKey(key);
    },
    [state.setOpenFilterKey],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      state.setContextMenu({ x: e.clientX, y: e.clientY, rowId });
    },
    [state.setContextMenu],
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
    Object.keys(state.filters).length + (state.search ? 1 : 0) + state.sort.length;
  const hasActiveFilters = activeFilterCount > 0;

  const currentFilterCol = state.openFilterKey
    ? state.columns.find(c => c.key === state.openFilterKey)
    : null;

  const handleKeyDown = useKeyboardNav({
    scrollWrapperRef,
    focusedCell: state.focusedCell,
    editingRowIds: state.editingRowIds,
    paginatedRows,
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

  const colSpan = visibleColumns.length + 2;

  return (
    <div
      className={isFullScreen ? `fixed inset-0 z-[9999] flex flex-col w-full ${isDarkMode ? 'bg-gray-950' : 'bg-[#F9FAFB]'}` : `w-full flex-1 flex flex-col print:overflow-visible print:h-auto print:block ${isDarkMode ? 'bg-gray-950' : 'bg-[#F9FAFB]'}`}
      style={{ width: '100%' }}
    >
      <div
        className={`flex flex-col w-full ${isFullScreen ? 'm-0 rounded-none border-none' : 'm-0 rounded-xl border shadow-sm'} print:overflow-visible print:border-none print:shadow-none print:m-0 flex-1 min-h-0 print:min-h-auto relative print:block ${theme.bgCard}`}
        style={{ width: '100%' }}
      >
        <TableToolbar
          search={state.search}
          onSearch={state.handleSearch}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onClearAll={state.handleClearAll}
          onRefresh={state.handleRefresh}
          onOpenSidebar={() => {
            state.setActiveSidebar('columns');
            state.setOpenFilterKey(null);
          }}
          onAddRow={showAddRow ? state.handleAddRow : undefined}
          showAddRow={showAddRow}
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
          onExportCSV={() => exportToCSV(filteredRows, visibleColumns)}
          onExportExcel={() => exportToExcel(filteredRows, visibleColumns)}
          onExportPDF={() => exportToPDF(filteredRows, visibleColumns)}
          onExportJSON={() => exportToJSON(filteredRows, visibleColumns)}
          onCopyTSV={() => copyToClipboardTSV(filteredRows, visibleColumns)}
          onPrint={handlePrint}
          onPrintAll={() => exportToPDF(filteredRows, visibleColumns, 'print')}
          density={state.density}
          onDensityChange={state.setDensity}
          savedViews={state.savedViews}
          activeViewId={state.activeViewId}
          onSaveView={state.handleSaveView}
          onLoadView={state.handleLoadView}
          onDeleteView={state.handleDeleteView}
        />

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
            <TableHeader
              columns={visibleColumns}
              columnWidths={state.columnWidths}
              stickyOffsets={stickyOffsets}
              sort={state.sort}
              filters={state.filters}
              allColumnsSelected={allSelected}
              someRowsSelected={someSelected}
              onSelectAll={() => state.handleSelectAll(allRowIds)}
              onSort={state.handleSort}
              onOpenFilter={handleOpenFilter}
              onColumnWidthChange={state.handleColumnWidthChange}
              onColumnReorder={state.handleColumnReorder}
              onPinColumn={state.handlePinColumn}
              onDeleteCompositeColumn={state.handleDeleteCompositeColumn}
              dragColKey={state.dragColKey}
              setDragColKey={state.setDragColKey}
              highlightedColKey={state.highlightedColKey}
              transitioningCols={state.transitioningCols}
              isDarkMode={isDarkMode}
            />

            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                </tr>
              )}

              {virtualRows.map(row => (
                <TableDataRow
                  key={row.rowId}
                  row={row}
                  rowHeight={rowHeight}
                  visibleColumns={visibleColumns}
                  allColumns={state.columns}
                  columnWidths={state.columnWidths}
                  stickyOffsets={stickyOffsets}
                  transitioningCols={state.transitioningCols}
                  highlightedColKey={state.highlightedColKey}
                  checkboxWidth={CHECKBOX_WIDTH}
                  actionsWidth={ACTIONS_WIDTH}
                  isSelected={state.selectedRows.has(row.rowId)}
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
                  onDeleteRow={() => state.handleDeleteRow(row.rowId)}
                  onCellSave={(colKey, value) => state.handleCellSave(row.rowId, colKey, value)}
                  onRowDraftChange={(colKey, value) =>
                    state.handleRowDraftChange(row.rowId, colKey, value)
                  }
                  onSaveBatch={updates => {
                    const editingRow = state.editingRowIds.has(row.rowId);
                    Object.entries(updates).forEach(([k, v]) => {
                      if (editingRow) state.handleRowDraftChange(row.rowId, k, v);
                      else state.handleCellSave(row.rowId, k, v);
                    });
                    state.setEditingCell(null);
                  }}
                />
              ))}

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

            {isFooterExpanded && (
              <tfoot
                className={`sticky bottom-0 z-20 ${isDarkMode ? 'bg-gray-900 border-t border-gray-800' : 'bg-gray-50 border-t border-gray-200'} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]`}
              >
                <tr className="group">
                  <td
                    style={{
                      width: CHECKBOX_WIDTH,
                      minWidth: CHECKBOX_WIDTH,
                      maxWidth: CHECKBOX_WIDTH,
                    }}
                    className={`px-3 py-3 border-r ${theme.borderRow}`}
                  />
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>

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
      </div>

      {state.openFilterKey && currentFilterCol && filterAnchorRect && (
        <FilterPanel
          column={currentFilterCol}
          allColumns={state.columns}
          currentFilter={state.filters[state.openFilterKey]}
          anchorRect={filterAnchorRect}
          onFilterChange={filter => state.handleFilterChange(state.openFilterKey!, filter)}
          onClose={() => state.setOpenFilterKey(null)}
          isDarkMode={isDarkMode}
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
    </div>
  );
}

export { VENDOR_COLUMN_CONFIG, VENDOR_ROWS } from './vendorData';

