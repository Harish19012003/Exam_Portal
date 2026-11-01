import { memo } from 'react';
import { Edit2, Trash2, X, Check, PanelRightOpen, ExternalLink, Copy } from 'lucide-react';
import { isCompositeColumn, isFieldColumn } from '../types';
import type { ColumnConfig, ConditionalFormatRule, DataRow, RowActionsConfig, SelectionColumnConfig } from '../types';
import type { TableThemeTokens } from '../utils/tableTheme';
import { getStickyCellClassName, getStickyCellBackground } from '../utils/tableTheme';
import '../stickyCells.css';
import {
  getCellFormatStyle,
  getRowFormatStyle,
  mergeFormatStyles,
  styleToCss,
} from '../utils/conditionalFormat';
import { CellRenderer } from '../renderers';
import { CellEditor } from '../editors';

import { DynamicIcon } from './DynamicIcon';
import {
  TRANSPOSE_ATTR_KEY,
  TRANSPOSE_AGG_KEY,
  TRANSPOSE_CHECKBOX_ROW_ID,
  TRANSPOSE_ACTIONS_ROW_ID,
  isTransposedRowId,
  parseTransposedFieldKey,
  parseTransposedSourceRowId,
} from '../utils/transposeTable';

interface TableDataRowProps {
  row: DataRow;
  rowHeight: number;
  /** Odd rows get the alternate colour when Table Colors → Alternate rows is on. */
  stripe?: boolean;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
  columnWidths: Record<string, number>;
  stickyOffsets: Record<string, { left?: number; right?: number }>;
  transitioningCols: Record<string, 'show' | 'hide'>;
  highlightedColKey: string | null;
  checkboxWidth: number;
  actionsWidth: number;
  isSelected: boolean;
  isExpanded?: boolean;
  hasSubRows?: boolean;
  onToggleExpand?: () => void;
  isEditingCellRow: boolean;
  isEditingThisRow: boolean;
  editingCellColKey: string | null;
  focusedCell: { rowId: string; colKey: string } | null;
  rowDraft: Record<string, unknown> | undefined;
  theme: TableThemeTokens;
  isDarkMode: boolean;
  conditionalFormats: ConditionalFormatRule[];
  scrollWrapperRef: React.RefObject<HTMLDivElement | null>;
  onToggleSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onSetFocusedCell: (cell: { rowId: string; colKey: string }) => void;
  onSetEditingCell: (cell: { rowId: string; colKey: string } | null) => void;
  onStartRowEdit: () => void;
  onCancelRowDraft: () => void;
  onCommitRowDraft: () => void;
  onDeleteRow: (targetRowId?: string) => void;
  onCellSave: (colKey: string, value: unknown) => void;
  onRowDraftChange: (colKey: string, value: unknown) => void;
  onSaveBatch: (updates: Record<string, unknown>) => void;
  enableRowSelection?: boolean;
  enableActionsColumn?: boolean;
  enableAddColumn?: boolean;
  selectionColumn?: SelectionColumnConfig;
  rowActions?: RowActionsConfig;
  enableCellEditing?: boolean;
  enableContextMenu?: boolean;
  enableSubRows?: boolean;
  onOpenRecordSidebar?: (row?: DataRow) => void;
  /** Explore action — page decides what opens */
  onExploreRow?: (row: DataRow) => void;
  /** Duplicate action — page creates a copy of the row */
  onDuplicateRow?: (row: DataRow) => void;
  topOffset?: number;
  bottomOffset?: number;
  selectedRowIds?: Set<string>;
  onToggleRowSelectById?: (id: string) => void;
}


function TableDataRowComponent({
  row,
  rowHeight,
  stripe = false,
  visibleColumns,
  allColumns,
  columnWidths,
  stickyOffsets,
  transitioningCols,
  highlightedColKey,
  checkboxWidth,
  actionsWidth,
  isSelected,
  isExpanded = false,
  hasSubRows = false,
  onToggleExpand,
  isEditingCellRow,
  isEditingThisRow,
  editingCellColKey,
  focusedCell,
  rowDraft,
  theme,
  isDarkMode,
  conditionalFormats,
  scrollWrapperRef,
  onToggleSelect,
  onContextMenu,
  onSetFocusedCell,
  onSetEditingCell,
  onStartRowEdit,
  onCancelRowDraft,
  onCommitRowDraft,
  onDeleteRow,
  onCellSave,
  onRowDraftChange,
  onSaveBatch,
  enableRowSelection = true,
  enableActionsColumn = true,
  enableAddColumn = true,
  selectionColumn,
  rowActions = { showEdit: true, showDelete: true },
  enableCellEditing = true,
  enableContextMenu = true,
  enableSubRows = true,
  onOpenRecordSidebar,
  onExploreRow,
  onDuplicateRow,
  topOffset = 41,
  bottomOffset = 0,
  selectedRowIds,
  onToggleRowSelectById,
}: TableDataRowProps) {
  const hasSelectionIcon = Boolean(selectionColumn?.iconName || selectionColumn?.renderIcon);
  const selectionMode = selectionColumn?.mode ?? (enableRowSelection ? (hasSelectionIcon ? 'checkbox-and-icon' : 'checkbox') : (hasSelectionIcon ? 'icon-only' : 'none'));
  const leftPinnedKeys = visibleColumns.filter(c => c.pinned === 'left');
  const rightPinnedKeys = visibleColumns.filter(c => c.pinned === 'right');
  const lastLeftPinnedKey = leftPinnedKeys[leftPinnedKeys.length - 1]?.key;
  const firstRightPinnedKey = rightPinnedKeys[0]?.key;

  const rowFormatStyle = getRowFormatStyle(row, conditionalFormats, allColumns);
  const rowFormatCss = rowFormatStyle ? styleToCss(rowFormatStyle) : null;

  const isStickyRowTop = row.pinnedDirection === 'top';
  const isStickyRowBottom = row.pinnedDirection === 'bottom';
  const isTransposedGridRow = isTransposedRowId(row.rowId);
  const stickyRowStyle: React.CSSProperties = isStickyRowTop
    ? { position: 'sticky', top: topOffset, zIndex: 12 }
    : isStickyRowBottom
    ? { position: 'sticky', bottom: bottomOffset, zIndex: 12 }
    : {};

  return (
    <tr
      data-row-id={row.rowId}
      data-stripe={stripe ? '1' : '0'}
      style={{ height: rowHeight, ...stickyRowStyle, ...(!isSelected && rowFormatCss ? rowFormatCss : {}) }}
      className={`group cursor-pointer transition-colors duration-150 ${
        isTransposedGridRow ? '' : 'animate-in fade-in slide-in-from-bottom-1'
      }
        ${isSelected ? theme.bgRowSelected : `${theme.bgRow} ${theme.bgRowHover}`}
        ${isStickyRowTop || isStickyRowBottom ? (isDarkMode ? '!bg-gray-900 border-b-2 border-teal-500/40 shadow-sm' : '!bg-white border-b-2 border-teal-500/40 shadow-sm') : ''}`}
      onClick={selectionMode === 'checkbox' || selectionMode === 'checkbox-and-icon' ? onToggleSelect : undefined}
      onContextMenu={enableContextMenu ? onContextMenu : undefined}
      aria-selected={isSelected}
      role="row"
    >
      {/* Selection / Index / Expander Column cell */}
      {(selectionMode !== 'none' || enableSubRows || Boolean(selectionColumn?.customIconElements?.some(e => e.enabled))) && checkboxWidth > 0 && (
        <td
          style={{
            width: checkboxWidth,
            minWidth: checkboxWidth,
            left: 0,
            backgroundColor: !isSelected && rowFormatCss?.backgroundColor
              ? String(rowFormatCss.backgroundColor)
              : getStickyCellBackground(isDarkMode, { isSelected }),
          }}
          className={`px-2 border-b ${theme.borderRow} ${getStickyCellClassName('left', { isSelected })}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            {(selectionColumn?.elementOrder ?? ['checkbox']).map(itemId => {
              if (itemId === 'checkbox' && (selectionMode === 'checkbox' || selectionMode === 'checkbox-and-icon' || selectionMode === 'none')) {
                if (!selectionColumn?.customIconElements || selectionMode !== 'none') {
                  return (
                    <div
                      key="checkbox"
                      className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-all duration-300 ease-out group-active/row:scale-75 flex-shrink-0
                        ${isSelected
                          ? 'bg-[#13C296] border-[#13C296] scale-100'
                          : isDarkMode
                            ? 'border-gray-600 group-hover/row:border-gray-400'
                            : 'border-gray-300 group-hover/row:border-gray-400'}`}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white" fill="none" aria-hidden="true">
                          <polyline
                            points="1.5,5 4,7.5 8.5,2.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  );
                }
              }

              // Check for dynamic custom icon element
              const customElem = selectionColumn?.customIconElements?.find(e => e.id === itemId);
              if (customElem && customElem.enabled) {
                if (customElem.action === 'inline-subtable') {
                  return (
                    <div key={customElem.id} className="w-7 flex items-center justify-center flex-shrink-0">
                      {hasSubRows ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand?.();
                          }}
                          className={`group inline-flex items-center gap-0.5 p-1 rounded-md transition-colors ${
                            isDarkMode
                              ? 'hover:bg-gray-800 text-gray-400 hover:text-teal-300'
                              : 'hover:bg-teal-50 text-gray-500 hover:text-teal-700'
                          }`}
                          title={isExpanded ? `Collapse ${(row.subRows?.length || 0)} sub-items` : `Expand ${(row.subRows?.length || 0)} sub-items`}
                        >
                          <DynamicIcon iconName={customElem.iconName || 'chevron'} className={`w-3.5 h-3.5 transition-colors ${isExpanded ? 'text-[#13C296]' : 'text-gray-400 group-hover:text-[#13C296]'}`} />
                          {customElem.showSubRowCount !== false && (row.subRows?.length || 0) > 0 && (
                            <span className={`text-[11px] font-bold leading-none ${
                              isExpanded ? 'text-[#13C296]' : 'text-gray-500 dark:text-gray-400 group-hover:text-[#13C296]'
                            }`}>
                              {row.subRows?.length}
                            </span>
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={customElem.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (customElem.action === 'sidebar-drawer') {
                        selectionColumn?.onOpenDrawer?.(row);
                      } else if (customElem.action === 'page-redirect') {
                        selectionColumn?.onRedirectPage?.(row);
                      } else if (customElem.action === 'open-modal') {
                        selectionColumn?.onOpenModal?.(row);
                      } else if (customElem.action === 'copy-column-value') {
                        const targetKey = customElem.targetColumnKey || Object.keys(row.values)[0];
                        const val = String(row.values[targetKey] ?? '');
                        navigator.clipboard?.writeText(val);
                        alert(`Copied ${targetKey}: "${val}" to clipboard!`);
                      } else if (customElem.action === 'filter-by-column') {
                        const targetKey = customElem.targetColumnKey || Object.keys(row.values)[0];
                        const val = row.values[targetKey];
                        selectionColumn?.onFilterColumn?.(targetKey, val);
                      } else if (customElem.action === 'toggle-column-vis') {
                        const targetKey = customElem.targetColumnKey || Object.keys(row.values)[0];
                        selectionColumn?.onToggleColumnVis?.(targetKey);
                      } else if (customElem.action === 'sort-column') {
                        const targetKey = customElem.targetColumnKey || Object.keys(row.values)[0];
                        selectionColumn?.onSortColumn?.(targetKey);
                      }
                    }}
                    className="flex items-center justify-center cursor-pointer flex-shrink-0"
                    title={`${customElem.label} (${customElem.targetColumnKey || ''})`}
                  >
                    <DynamicIcon iconName={customElem.iconName || 'external-link'} className="w-3.5 h-3.5 text-gray-400 hover:text-[#13C296] transition-colors" />
                  </div>
                );
              }

              // Fallback legacy expander & icon
              if (itemId === 'expander' && enableSubRows) {
                const expOp = selectionColumn?.expanderOperation || 'inline-subtable';
                const expIconName = selectionColumn?.expanderIcon || 'chevron';
                return (
                  <div key="expander" className="w-7 flex items-center justify-center flex-shrink-0">
                    {hasSubRows ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (expOp === 'sidebar-drawer') {
                            selectionColumn?.onOpenDrawer?.(row);
                          } else if (expOp === 'page-redirect') {
                            selectionColumn?.onRedirectPage?.(row);
                          } else {
                            onToggleExpand?.();
                          }
                        }}
                        className={`group inline-flex items-center gap-0.5 p-1 rounded-md transition-colors ${
                          isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-teal-300' : 'hover:bg-teal-50 text-gray-500 hover:text-teal-700'
                        }`}
                      >
                        <DynamicIcon iconName={expIconName} className={`w-3.5 h-3.5 transition-colors ${isExpanded ? 'text-[#13C296]' : 'text-gray-400 group-hover:text-[#13C296]'}`} />
                      </button>
                    ) : null}
                  </div>
                );
              }

              if (itemId === 'icon' && (selectionColumn?.renderIcon || selectionColumn?.iconName)) {
                return (
                  <div
                    key="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectionColumn?.onOpenDrawer?.(row);
                    }}
                    className="flex items-center justify-center cursor-pointer flex-shrink-0"
                  >
                    <DynamicIcon iconName={selectionColumn.iconName || 'external-link'} className="w-3.5 h-3.5 text-gray-400 hover:text-[#13C296] transition-colors" />
                  </div>
                );
              }

              return null;
            })}
          </div>
        </td>
      )}


      {/* Data cells */}
      {visibleColumns.map(col => {
        const isTransposedRow = isTransposedRowId(row.rowId);
        const originalColKey = isTransposedRow ? parseTransposedFieldKey(row.rowId) : col.key;
        const targetColConfig =
          col.key === TRANSPOSE_ATTR_KEY || col.key === TRANSPOSE_AGG_KEY
            ? col
            : isTransposedRow
              ? allColumns?.find(c => c.key === originalColKey) || col
              : col;

        const isComposite = isCompositeColumn(col);
        const canEdit = isTransposedRow
          ? enableCellEditing &&
            col.key !== TRANSPOSE_ATTR_KEY &&
            col.key !== TRANSPOSE_AGG_KEY &&
            row.rowId !== TRANSPOSE_ACTIONS_ROW_ID &&
            row.rowId !== TRANSPOSE_CHECKBOX_ROW_ID &&
            targetColConfig.editable !== false
          : enableCellEditing && (isComposite || (isFieldColumn(col) && col.editable !== false));

        const colWidth = columnWidths[col.key] ?? col.width;
        const offset = stickyOffsets[col.key];
        const isLastLeftPinned = col.key === lastLeftPinnedKey;
        const isFirstRightPinned = col.key === firstRightPinnedKey;

        const isHiding = transitioningCols?.[col.key] === 'hide';
        const isShowing = transitioningCols?.[col.key] === 'show';
        const isHighlighted = highlightedColKey === col.key && !isHiding;
        const actualW = isHiding ? 0 : colWidth;

        const draftValue = rowDraft?.[col.key];
        const displayValue = isComposite
          ? undefined
          : isEditingThisRow && draftValue !== undefined
            ? draftValue
            : row.values[col.key];

        const isEditingThisCell =
          (isEditingCellRow && editingCellColKey === col.key) ||
          (isEditingThisRow && canEdit && !isComposite);

        const cellFormatStyle = getCellFormatStyle(row, col.key, conditionalFormats, allColumns);
        const mergedFormat = mergeFormatStyles(rowFormatStyle, cellFormatStyle);
        const formatCss =
          !isSelected && !isHighlighted && !isHiding && mergedFormat
            ? styleToCss(mergedFormat)
            : {};

        const highlightBg = isHiding
          ? isDarkMode
            ? 'bg-red-900/30 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]'
            : 'bg-red-50 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]'
          : isHighlighted
            ? isDarkMode
              ? 'bg-[#13C296]/20 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300'
              : 'bg-[#13C296]/10 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300'
            : 'transition-[background-color,box-shadow,color] duration-300';

        const isLeftPinned = offset?.left !== undefined;
        const isRightPinned = offset?.right !== undefined;
        const isPinned = isLeftPinned || isRightPinned;
        const stickyStyle: React.CSSProperties = isLeftPinned
          ? {
              left: offset.left,
              backgroundColor: formatCss.backgroundColor
                ? undefined
                : getStickyCellBackground(isDarkMode, { isSelected }),
            }
          : isRightPinned
            ? {
                right: offset.right,
                backgroundColor: formatCss.backgroundColor
                  ? undefined
                  : getStickyCellBackground(isDarkMode, { isSelected }),
              }
            : {};

        return (
          <td
            id={`cell-${row.rowId}-${col.key}`}
            key={col.key}
            data-col-key={col.key}
            style={
              {
                width: actualW,
                minWidth: actualW,
                maxWidth: actualW,
                paddingLeft: isHiding ? 0 : undefined,
                paddingRight: isHiding ? 0 : undefined,
                opacity: isHiding ? 0 : 1,
                '--target-width': `${colWidth}px`,
                ...stickyStyle,
                ...formatCss,
              } as React.CSSProperties
            }
            className={`px-3 border-b overflow-hidden whitespace-nowrap ${theme.borderRow} ${isHiding ? 'transition-all duration-300 ease-in-out' : isShowing ? 'animate-expand' : ''} ${highlightBg}
              ${isPinned && !isHighlighted && !isHiding && !formatCss.backgroundColor
                ? getStickyCellClassName(isRightPinned ? 'right' : 'left', { isSelected })
                : 'dt-scroll-cell'}
              ${isLastLeftPinned ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}
              ${isFirstRightPinned ? 'shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}`}
            onDoubleClick={e => {
              if (canEdit) {
                e.stopPropagation();
                onSetEditingCell({ rowId: row.rowId, colKey: col.key });
              }
            }}
            role="gridcell"
            aria-readonly={!canEdit}
          >
            <div
              className={`flex items-center outline-none relative
                ${focusedCell?.rowId === row.rowId && focusedCell?.colKey === col.key && !isEditingThisCell
                  ? 'after:content-[""] after:absolute after:right-3 after:top-1/2 after:-translate-y-1/2 after:h-[16px] after:w-[2px] after:bg-[#13C296] after:animate-pulse'
                  : ''}`}
              style={{
                height: rowHeight - 1,
                minHeight: rowHeight - 1,
                color: formatCss.color,
                fontWeight: formatCss.fontWeight,
              }}
              onClick={() => {
                onSetFocusedCell({ rowId: row.rowId, colKey: col.key });
                scrollWrapperRef.current?.focus();
              }}
            >
              {isEditingThisCell ? (
                <div
                  className={isComposite ? 'absolute z-50 mt-1' : 'w-full relative'}
                  onClick={e => e.stopPropagation()}
                  onFocus={() => onSetFocusedCell({ rowId: row.rowId, colKey: col.key })}
                >
                  <CellEditor
                    value={displayValue}
                    row={row}
                    column={targetColConfig}
                    autoFocus={editingCellColKey === col.key}
                    onSave={v =>
                      isEditingThisRow ? onRowDraftChange(col.key, v) : onCellSave(col.key, v)
                    }
                    onCancel={() => (isEditingThisRow ? onCancelRowDraft() : onSetEditingCell(null))}
                    isDarkMode={isDarkMode}
                    onSaveBatch={onSaveBatch}
                  />
                </div>
              ) : (
                <div className="w-full min-w-0 flex items-center">
                  {(() => {
                    if (row.rowId === TRANSPOSE_CHECKBOX_ROW_ID && parseTransposedSourceRowId(col.key)) {
                      const targetRecordId = parseTransposedSourceRowId(col.key)!;
                      const isRecordSelected = selectedRowIds?.has(targetRecordId) ?? false;
                      return (
                        <div className="flex items-center justify-center w-full">
                          <input
                            type="checkbox"
                            checked={isRecordSelected}
                            onChange={e => {
                              e.stopPropagation();
                              onToggleRowSelectById?.(targetRecordId);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#13C296] focus:ring-[#13C296] cursor-pointer"
                          />
                        </div>
                      );
                    }

                    if (row.rowId === TRANSPOSE_ACTIONS_ROW_ID && parseTransposedSourceRowId(col.key)) {
                      const targetRecord = row.values[col.key] as DataRow;
                      if (!targetRecord) return <span className="text-gray-400 text-xs">—</span>;
                      const customBtns = rowActions?.customButtons?.filter(b => b.enabled) || [
                        { id: 'edit', label: 'Edit', action: 'edit', iconName: 'pencil', color: '#13C296', enabled: true },
                        { id: 'delete', label: 'Delete', action: 'delete', iconName: 'trash-2', color: '#f43f5e', enabled: true },
                      ];

                      return (
                        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto py-0.5">
                          {customBtns.map(btn => (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (btn.action === 'edit' || btn.action === 'open-modal' || btn.action === 'sidebar-drawer') {
                                  onOpenRecordSidebar?.(targetRecord);
                                } else if (btn.action === 'delete') {
                                  onDeleteRow(targetRecord.rowId);
                                } else if (btn.action === 'share') {
                                  const title = String(
                                    targetRecord.values.full_name ||
                                      targetRecord.values.name ||
                                      targetRecord.rowId,
                                  );
                                  navigator.clipboard?.writeText(window.location.href);
                                  alert(`Shared record "${title}" (Link copied to clipboard!)`);
                                } else if ((btn.action as string) === 'copy-value') {
                                  navigator.clipboard?.writeText(JSON.stringify(targetRecord.values));
                                }
                              }}
                              style={{ color: btn.color || '#13C296' }}
                              className="px-2 py-0.5 rounded-lg border border-current/20 hover:bg-current/10 transition-all flex items-center gap-1 text-[11px] font-bold flex-shrink-0 cursor-pointer"
                              title={btn.label}
                            >
                              <DynamicIcon iconName={btn.iconName || 'star'} className="w-3 h-3 flex-shrink-0" />
                              <span>{btn.label}</span>
                            </button>
                          ))}
                        </div>
                      );
                    }

                    const fieldKey = isTransposedRowId(row.rowId)
                      ? parseTransposedFieldKey(row.rowId)
                      : col.key;
                    const renderColConfig =
                      col.key === TRANSPOSE_ATTR_KEY || col.key === TRANSPOSE_AGG_KEY
                        ? col
                        : allColumns?.find(c => c.key === fieldKey) || col;
                    return (
                      <CellRenderer
                        value={isComposite ? undefined : row.values[col.key]}
                        row={row}
                        column={renderColConfig}
                        allColumns={allColumns}
                        isDarkMode={isDarkMode}
                        onDirectEdit={
                          canEdit
                            ? val =>
                                isEditingThisRow
                                  ? onRowDraftChange(col.key, val)
                                  : onCellSave(col.key, val)
                            : undefined
                        }
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          </td>
        );
      })}

      {/* Add Column placeholder cell */}
      {enableAddColumn && (
        <td
          style={{ width: 44, minWidth: 44, maxWidth: 44 }}
          className={`border-b ${theme.borderRow}`}
        />
      )}

      {/* Actions cell */}
      {enableActionsColumn && actionsWidth > 0 && (
        <td
          style={{
            width: actionsWidth,
            minWidth: actionsWidth,
            maxWidth: actionsWidth,
            right: 0,
            backgroundColor: !isSelected && rowFormatCss?.backgroundColor
              ? String(rowFormatCss.backgroundColor)
              : getStickyCellBackground(isDarkMode, { isSelected }),
          }}
          className={`border-b ${theme.borderRow} px-1 ${getStickyCellClassName('right', { isSelected })}`}
        >
          <div
            className={`flex items-center justify-center gap-2 transition-opacity ${
              isEditingThisRow
                ? 'opacity-100'
                : rowActions?.showOnHover !== false
                  ? 'opacity-0 group-hover:opacity-100'
                  : 'opacity-100'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {isEditingThisRow ? (
              <>
                <button
                  type="button"
                  onClick={onCancelRowDraft}
                  className={`p-1 rounded-lg transition-colors bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm
                    ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : ''}`}
                  aria-label="Cancel edit"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onCommitRowDraft}
                  className="p-1 rounded-lg transition-colors bg-[#13C296] text-white hover:bg-[#0f9f7a] shadow-sm"
                  aria-label="Save row"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                {rowActions?.renderCustomActions && rowActions.renderCustomActions(row)}

                {rowActions?.showExplore && onExploreRow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExploreRow?.(row);
                    }}
                    className="p-1 rounded-lg transition-colors"
                    aria-label="Explore"
                    title="Explore"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-[#13C296] transition-colors" aria-hidden="true" />
                  </button>
                )}

                {rowActions?.showDuplicate && onDuplicateRow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateRow?.(row);
                    }}
                    className="p-1 rounded-lg transition-colors"
                    aria-label="Duplicate"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-[#13C296] transition-colors" aria-hidden="true" />
                  </button>
                )}

                {(() => {
                  const enabledCustomButtons = rowActions?.customButtons?.filter(b => b.enabled) || [];
                  if (enabledCustomButtons.length > 0) {
                    return enabledCustomButtons.map(btn => {
                      const iconSizeCls = btn.size === 'sm' ? 'w-3 h-3' : btn.size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';
                      const colorStyle = btn.color ? { color: btn.color } : {};

                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (btn.action === 'edit') {
                              onStartRowEdit();
                            } else if (btn.action === 'delete') {
                              onDeleteRow();
                            } else if (btn.action === 'share') {
                              const title = String(row.values.task_name || row.values.full_name || row.values.name || row.rowId);
                              navigator.clipboard?.writeText(window.location.href);
                              alert(`Shared record "${title}" (Link copied to clipboard!)`);
                            } else if (btn.action === 'open-modal') {
                              selectionColumn?.onOpenModal?.(row);
                            } else if (btn.action === 'sidebar-drawer') {
                              onOpenRecordSidebar?.(row);
                            } else if (btn.action === 'copy-column-value') {
                              const targetKey = btn.targetColumnKey || Object.keys(row.values)[0];
                              const val = String(row.values[targetKey] ?? '');
                              navigator.clipboard?.writeText(val);
                              alert(`Copied ${targetKey}: "${val}"`);
                            }
                          }}
                          className={`p-1 rounded-lg transition-all hover:scale-110 ${
                            isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                          }`}
                          aria-label={btn.label}
                          title={btn.label}
                          style={colorStyle}
                        >
                          <DynamicIcon iconName={btn.iconName || 'star'} className={iconSizeCls} />
                        </button>
                      );
                    });
                  }

                  return (
                    <>
                      {onOpenRecordSidebar && rowActions?.showRecordSidebar !== false && (
                        <button
                          type="button"
                          onClick={() => onOpenRecordSidebar(row)}
                          className={`p-1 rounded-lg transition-colors
                            ${isDarkMode ? 'text-teal-400 hover:text-teal-200 hover:bg-teal-900/30' : 'text-teal-600 hover:text-teal-800 hover:bg-teal-50'}`}
                          aria-label="Edit record in sidebar"
                          title="Edit record & sub-items in sidebar"
                        >
                          <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                      {/* Explore already rendered above when showExplore — keep edit/delete here */}
                      {rowActions?.showEdit !== false && (
                        <button
                          type="button"
                          onClick={onStartRowEdit}
                          className={`p-1 rounded-lg transition-colors
                            ${isDarkMode ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                          aria-label="Edit row"
                        >
                          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                      {rowActions?.showDelete !== false && (
                        <button
                          type="button"
                          onClick={() => onDeleteRow()}
                          className={`p-1 rounded-lg transition-colors
                            ${isDarkMode ? 'text-gray-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                          aria-label="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export const TableDataRow = memo(TableDataRowComponent);
