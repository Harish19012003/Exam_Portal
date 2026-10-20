import { Edit2, Trash2, X, Check } from 'lucide-react';
import { isCompositeColumn, isFieldColumn } from '../types';
import type { ColumnConfig, ConditionalFormatRule, DataRow } from '../types';
import type { TableThemeTokens } from '../utils/tableTheme';
import {
  getCellFormatStyle,
  getRowFormatStyle,
  mergeFormatStyles,
  styleToCss,
} from '../utils/conditionalFormat';
import { CellRenderer } from '../renderers';
import { CellEditor } from '../editors';

interface TableDataRowProps {
  row: DataRow;
  rowHeight: number;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
  columnWidths: Record<string, number>;
  stickyOffsets: Record<string, { left?: number; right?: number }>;
  transitioningCols: Record<string, 'show' | 'hide'>;
  highlightedColKey: string | null;
  checkboxWidth: number;
  actionsWidth: number;
  isSelected: boolean;
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
  onDeleteRow: () => void;
  onCellSave: (colKey: string, value: unknown) => void;
  onRowDraftChange: (colKey: string, value: unknown) => void;
  onSaveBatch: (updates: Record<string, unknown>) => void;
}

export function TableDataRow({
  row,
  rowHeight,
  visibleColumns,
  allColumns,
  columnWidths,
  stickyOffsets,
  transitioningCols,
  highlightedColKey,
  checkboxWidth,
  actionsWidth,
  isSelected,
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
}: TableDataRowProps) {
  const leftPinnedKeys = visibleColumns.filter(c => c.pinned === 'left');
  const rightPinnedKeys = visibleColumns.filter(c => c.pinned === 'right');
  const lastLeftPinnedKey = leftPinnedKeys[leftPinnedKeys.length - 1]?.key;
  const firstRightPinnedKey = rightPinnedKeys[0]?.key;

  const rowFormatStyle = getRowFormatStyle(row, conditionalFormats, allColumns);
  const rowFormatCss = rowFormatStyle ? styleToCss(rowFormatStyle) : null;

  return (
    <tr
      data-row-id={row.rowId}
      style={{ height: rowHeight, ...(!isSelected && rowFormatCss ? rowFormatCss : {}) }}
      className={`group/row transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-1
        ${isSelected ? theme.bgRowSelected : `${theme.bgRow} ${theme.bgRowHover}`}`}
      onClick={onToggleSelect}
      onContextMenu={onContextMenu}
      aria-selected={isSelected}
      role="row"
    >
      <td
        style={{
          width: checkboxWidth,
          minWidth: checkboxWidth,
          position: 'sticky',
          left: 0,
          zIndex: 5,
          ...(!isSelected && rowFormatCss?.backgroundColor
            ? { backgroundColor: rowFormatCss.backgroundColor }
            : {}),
        }}
        className={`px-3 border-b ${theme.borderRow} ${isSelected ? theme.selectedCellBg : theme.bgPinnedLeft} transition-colors`}
      >
        <div className="flex items-center justify-center">
          <div
            className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-all duration-300 ease-out group-active/row:scale-75
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
        </div>
      </td>

      {visibleColumns.map(col => {
        const offset = stickyOffsets[col.key];
        const cellW = columnWidths[col.key] ?? col.width;
        const isComposite = isCompositeColumn(col);
        const canEdit = isComposite || (isFieldColumn(col) && col.editable);
        const isEditingThisCell =
          (isEditingCellRow && editingCellColKey === col.key) ||
          (isEditingThisRow && canEdit && !isComposite);

        const pinnedBg = isSelected ? theme.selectedCellBg : theme.bgPinnedLeft;
        const stickyStyle: React.CSSProperties =
          offset?.left !== undefined
            ? { position: 'sticky', left: offset.left, zIndex: 4 }
            : offset?.right !== undefined
              ? { position: 'sticky', right: offset.right, zIndex: 4 }
              : {};

        const isLastLeftPinned = col.key === lastLeftPinnedKey;
        const isFirstRightPinned = col.key === firstRightPinnedKey;
        const isHiding = transitioningCols[col.key] === 'hide';
        const isShowing = transitioningCols[col.key] === 'show';
        const isHighlighted = highlightedColKey === col.key && !isHiding;

        const highlightBg = isHiding
          ? isDarkMode
            ? 'bg-red-900/30 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]'
            : 'bg-red-50 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]'
          : isHighlighted
            ? isDarkMode
              ? 'bg-[#13C296]/20 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300'
              : 'bg-[#13C296]/10 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300'
            : 'transition-all duration-1000';

        const actualW = isHiding ? 0 : cellW;
        const draftValue = rowDraft?.[col.key];
        const rowVals = (row?.values ?? row ?? {}) as Record<string, unknown>;
        const displayValue = isComposite
          ? undefined
          : isEditingThisRow && draftValue !== undefined
            ? draftValue
            : rowVals[col.key];

        const cellFormatStyle = getCellFormatStyle(row, col.key, conditionalFormats, allColumns);
        const mergedFormat = mergeFormatStyles(rowFormatStyle, cellFormatStyle);
        const formatCss =
          !isSelected && !isHighlighted && !isHiding && mergedFormat
            ? styleToCss(mergedFormat)
            : {};

        return (
          <td
            id={`cell-${row.rowId}-${col.key}`}
            key={col.key}
            style={
              {
                width: actualW,
                minWidth: actualW,
                maxWidth: actualW,
                paddingLeft: isHiding ? 0 : undefined,
                paddingRight: isHiding ? 0 : undefined,
                opacity: isHiding ? 0 : 1,
                '--target-width': `${cellW}px`,
                ...stickyStyle,
                ...formatCss,
              } as React.CSSProperties
            }
            className={`px-3 border-b overflow-hidden whitespace-nowrap ${theme.borderRow} ${isHiding ? 'transition-all duration-300 ease-in-out' : isShowing ? 'animate-expand' : ''} ${highlightBg}
              ${offset && !isHighlighted && !isHiding && !formatCss.backgroundColor ? pinnedBg : ''}
              ${isLastLeftPinned ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}
              ${isFirstRightPinned ? 'shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}`}
            onDoubleClick={e => {
              e.stopPropagation();
              if (canEdit) onSetEditingCell({ rowId: row.rowId, colKey: col.key });
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
                    column={col}
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
                  <CellRenderer
                    value={isComposite ? undefined : rowVals[col.key]}
                    row={row}
                    column={col}
                    allColumns={allColumns}
                    isDarkMode={isDarkMode}
                    onDirectEdit={canEdit ? (val) => (isEditingThisRow ? onRowDraftChange(col.key, val) : onCellSave(col.key, val)) : undefined}
                  />
                </div>
              )}
            </div>
          </td>
        );
      })}

      <td
        style={{
          width: actionsWidth,
          minWidth: actionsWidth,
          maxWidth: actionsWidth,
          position: 'sticky',
          right: 0,
          zIndex: 4,
          ...(!isSelected && rowFormatCss?.backgroundColor
            ? { backgroundColor: rowFormatCss.backgroundColor }
            : {}),
        }}
        className={`border-b ${theme.borderRow} px-1 transition-colors
          ${isSelected ? theme.selectedCellBg : theme.bgPinnedLeft}`}
      >
        <div
          className={`flex items-center justify-center gap-2 transition-opacity ${isEditingThisRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}
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
              <button
                type="button"
                onClick={onStartRowEdit}
                className={`p-1 rounded-lg transition-colors
                  ${isDarkMode ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                aria-label="Edit row"
              >
                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onDeleteRow}
                className={`p-1 rounded-lg transition-colors
                  ${isDarkMode ? 'text-gray-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                aria-label="Delete row"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
