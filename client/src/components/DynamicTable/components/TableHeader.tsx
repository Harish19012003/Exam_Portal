import { useRef } from 'react';
import { ChevronDown, Filter, Info, Pin, PinOff, GripVertical, X, Layers, Plus } from 'lucide-react';
import { isFieldColumn, isCompositeColumn } from '../types';
import type { ColumnConfig, DataRow, FilterValue, RowActionsConfig, SelectionColumnConfig, SortConfig } from '../types';
import { calculateAutoFitColumnWidth } from '../utils/textWidth';

interface TableHeaderProps {
  columns: ColumnConfig[];
  columnWidths: Record<string, number>;
  stickyOffsets: Record<string, { left?: number; right?: number }>;
  sort: SortConfig[];
  filters: Record<string, FilterValue>;
  allColumnsSelected: boolean;
  someRowsSelected: boolean;
  onSelectAll: () => void;
  onSort: (key: string, shiftKey: boolean) => void;
  onOpenFilter: (key: string, rect: DOMRect) => void;
  onColumnWidthChange: (key: string, width: number) => void;
  onColumnReorder: (fromKey: string, toKey: string) => void;
  onPinColumn: (key: string, pin: 'left' | 'right' | null) => void;
  onDeleteCompositeColumn: (key: string) => void;
  dragColKey: string | null;
  setDragColKey: (k: string | null) => void;
  highlightedColKey?: string | null;
  transitioningCols?: Record<string, 'show' | 'hide'>;
  isDarkMode: boolean;
  enableRowSelection?: boolean;
  enableActionsColumn?: boolean;
  enableAddColumn?: boolean;
  selectionColumn?: SelectionColumnConfig;
  rowActions?: RowActionsConfig;
  checkboxWidth: number;
  actionsWidth: number;
  rows?: DataRow[];
  onAddColumn?: () => void;
  enableSubRows?: boolean;
  isTransposed?: boolean;
}

export function TableHeader({
  columns,
  columnWidths,
  stickyOffsets,
  sort,
  filters,
  allColumnsSelected,
  someRowsSelected,
  onSelectAll,
  onSort,
  onOpenFilter,
  onColumnWidthChange,
  onColumnReorder,
  onPinColumn,
  onDeleteCompositeColumn,
  dragColKey,
  setDragColKey,
  highlightedColKey,
  transitioningCols,
  isDarkMode,
  enableRowSelection = true,
  enableActionsColumn = true,
  enableAddColumn = true,
  selectionColumn,
  rowActions,
  checkboxWidth,
  actionsWidth,
  rows,
  onAddColumn,
  enableSubRows = true,
  isTransposed = false,
}: TableHeaderProps) {
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const hasSelectionIcon = Boolean(selectionColumn?.iconName || selectionColumn?.renderIcon);
  const selectionMode = selectionColumn?.mode ?? (enableRowSelection ? (hasSelectionIcon ? 'checkbox-and-icon' : 'checkbox') : (hasSelectionIcon ? 'icon-only' : 'none'));

  // Portal theme header — solid violet (inline style beats washed Tailwind/CSS fights)
  const thBg = isDarkMode ? 'bg-violet-950' : 'bg-violet-100';
  const thStyleBg = isDarkMode ? '#2e1065' : '#ede9fe';
  const thStyleFg = isDarkMode ? '#ede9fe' : '#4c1d95';
  const borderCls = isDarkMode ? 'border-violet-800' : 'border-violet-200';
  const textCls = isDarkMode ? 'text-violet-100' : 'text-violet-900';
  const resizeCls = isDarkMode
    ? 'bg-violet-500/50 hover:bg-[var(--primary-color,#7c3aed)]'
    : 'bg-violet-400/40 hover:bg-[var(--primary-color,#5c43fa)]';

  const handleAutoFit = (e: React.MouseEvent, col: ColumnConfig) => {
    e.stopPropagation();
    e.preventDefault();
    if (!rows) return;
    const autoW = calculateAutoFitColumnWidth(
      col.key,
      col.label,
      rows as unknown as Array<Record<string, unknown>>,
      columns,
    );
    onColumnWidthChange(col.key, autoW);
  };

  const startResize = (
    e: React.MouseEvent,
    key: string,
    direction: 'right' | 'left' = 'right',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const initialW =
      key === '__checkbox'
        ? checkboxWidth
        : key === '__actions'
        ? actionsWidth
        : (columnWidths[key] ?? 100);

    resizingRef.current = { key, startX: e.clientX, startW: initialW };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { startX, startW, key: k } = resizingRef.current;
      const delta = direction === 'left' ? startX - ev.clientX : ev.clientX - startX;
      const minW = k === '__checkbox' ? 32 : k === '__actions' ? 40 : 50;
      onColumnWidthChange(k, Math.max(minW, startW + delta));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const getSortIcon = (key: string) => {
    const s = sort.find(s => s.key === key);
    if (!s) return null;
    return s.direction === 'asc' ? '↑' : '↓';
  };

  const hasSortIdx = (key: string) => {
    if (sort.length <= 1) return null;
    const idx = sort.findIndex(s => s.key === key);
    return idx === -1 ? null : idx + 1;
  };

  const hasFilter = (key: string) => Boolean(filters[key]);

  return (
    <thead
      className={`${isTransposed ? '' : 'sticky top-0'} z-20 ${thBg}`}
      style={{ backgroundColor: thStyleBg, color: thStyleFg }}
    >
      <tr>
        {/* Checkbox / Leftmost index column */}
        {(selectionMode !== 'none' || enableSubRows || Boolean(selectionColumn?.customIconElements?.some(e => e.enabled))) && checkboxWidth > 0 && (
          <th
            style={{
              width: checkboxWidth,
              minWidth: checkboxWidth,
              position: 'sticky',
              left: 0,
              zIndex: 21,
              backgroundColor: thStyleBg,
              color: thStyleFg,
            }}
            className={`group/th relative ${thBg} border-b ${borderCls} px-2.5`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {enableSubRows && selectionMode !== 'icon-only' && <div className="w-7 flex-shrink-0" />}


              {(selectionMode === 'checkbox' || selectionMode === 'checkbox-and-icon') && (
                <IndeterminateCheckbox
                  checked={allColumnsSelected}
                  indeterminate={someRowsSelected && !allColumnsSelected}
                  onChange={onSelectAll}
                  isDarkMode={isDarkMode}
                  label="Select all rows"
                />
              )}
              {selectionColumn?.renderHeaderIcon && selectionColumn.renderHeaderIcon()}
            </div>


            {/* Resize handle */}
            <div
              onMouseDown={e => startResize(e, '__checkbox')}
              className={`absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30
                opacity-0 group-hover/th:opacity-100 transition-opacity ${resizeCls}`}
              aria-hidden="true"
            />
          </th>
        )}

        {/* Data columns */}
        {columns.map(col => {
          const offset = stickyOffsets[col.key];
          const colWidth = columnWidths[col.key] ?? col.width;
          const sortIcon = isFieldColumn(col) && col.sortable !== false ? getSortIcon(col.key) : null;
          const sortIdx = hasSortIdx(col.key);
          const isSorted = Boolean(sortIcon);
          const isFiltered = hasFilter(col.key);
          const isDragging = dragColKey === col.key;
          const isLastLeftPinned = col.pinned === 'left' && columns.filter(c => c.pinned === 'left').pop()?.key === col.key;
          const isFirstRightPinned = col.pinned === 'right' && columns.find(c => c.pinned === 'right')?.key === col.key;
          
          const isHiding = transitioningCols?.[col.key] === 'hide';
          const isShowing = transitioningCols?.[col.key] === 'show';
          const isHighlighted = highlightedColKey === col.key && !isHiding;
          
          const highlightBg = isHiding 
            ? (isDarkMode ? 'bg-red-900/30 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]' : 'bg-red-50 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]')
            : isHighlighted 
              ? (isDarkMode
                  ? 'bg-[rgba(124,58,237,0.22)] shadow-[inset_0_0_15px_rgba(124,58,237,0.25)] transition-all duration-300'
                  : 'bg-[rgba(92,67,250,0.12)] shadow-[inset_0_0_15px_rgba(92,67,250,0.18)] transition-all duration-300')
              : 'transition-all duration-1000';

          const actualW = isHiding ? 0 : colWidth;

          return (
            <th
              key={col.key}
              style={{
                width: actualW,
                minWidth: actualW,
                maxWidth: actualW,
                paddingLeft: isHiding ? 0 : undefined,
                paddingRight: isHiding ? 0 : undefined,
                opacity: isHiding ? 0 : 1,
                backgroundColor: thStyleBg,
                color: thStyleFg,
                '--target-width': `${colWidth}px`,
                ...(offset?.left !== undefined ? { position: 'sticky', left: offset.left, zIndex: 22 } : {}),
                ...(offset?.right !== undefined ? { position: 'sticky', right: offset.right, zIndex: 22 } : {}),
              } as React.CSSProperties}
              className={`${isHighlighted || isHiding ? '' : thBg} overflow-hidden whitespace-nowrap border-b ${borderCls} select-none relative group/th ${isHiding ? 'transition-all duration-300 ease-in-out' : isShowing ? 'animate-expand' : ''} ${highlightBg}
                ${isDragging ? 'opacity-40' : ''}
                ${isLastLeftPinned ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}
                ${isFirstRightPinned ? 'shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}`}
              draggable={!isTransposed}
              onDragStart={e => {
                if (isTransposed) return;
                e.dataTransfer.effectAllowed = 'move';
                setDragColKey(col.key);
              }}
              onDragOver={e => {
                if (isTransposed) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={e => {
                if (isTransposed) return;
                e.preventDefault();
                if (dragColKey && dragColKey !== col.key) onColumnReorder(dragColKey, col.key);
                setDragColKey(null);
              }}
              onDragEnd={() => setDragColKey(null)}
            >
              <div className="flex items-center justify-between px-3 py-3 min-w-0 w-full h-full gap-2 relative">
                <div className={`flex items-center gap-1 min-w-0 ${col.dataType === 'boolean' || col.dataType === 'checkbox' ? 'w-full justify-center pl-6' : ''}`}>
                  {!isTransposed && (
                    <GripVertical
                      className={`w-3 h-3 absolute left-0.5 opacity-0 group-hover/th:opacity-100 transition-opacity cursor-grab
                        ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    className={`flex items-center gap-1 min-w-0 max-w-full text-left transition-colors group/sort
                      ${isSorted
                        ? (isDarkMode ? 'text-[var(--primary-color,#a78bfa)]' : 'text-[var(--primary-color,#5c43fa)]')
                        : textCls}
                      ${!isTransposed && isFieldColumn(col) && col.sortable !== false ? 'cursor-pointer hover:text-[var(--primary-color,#5c43fa)]' : 'cursor-default'}`}
                    onClick={e => {
                      if (!isTransposed && isFieldColumn(col) && col.sortable !== false) onSort(col.key, e.shiftKey);
                    }}
                    title={!isTransposed && isFieldColumn(col) && col.sortable !== false ? "Click to sort (Shift+click for multiple)" : undefined}
                    aria-sort={isSorted ? (sort.find(s => s.key === col.key)?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    aria-label={`${col.label}${!isTransposed && isFieldColumn(col) && col.sortable !== false ? ' — click to sort, shift-click for multi-sort' : ''}`}
                  >
                    <span className="text-[12px] font-bold uppercase tracking-wide truncate">
                      {col.label}
                    </span>
                    {col.description && (
                      <span title={col.description}>
                        <Info
                          className={`w-3 h-3 flex-shrink-0 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                          aria-label={col.description}
                        />
                      </span>
                    )}
                    {!isTransposed && sortIcon && (
                      <span className="text-[11px] font-bold flex-shrink-0 leading-none">
                        {sortIcon}
                        {sortIdx && <sup className="text-[9px]">{sortIdx}</sup>}
                      </span>
                    )}
                    {!isTransposed && isFieldColumn(col) && col.sortable !== false && !isSorted && (
                      <ChevronDown
                        className="w-3 h-3 flex-shrink-0 hidden group-hover/sort:block opacity-60"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Filter icon */}
                  {!isTransposed && isFieldColumn(col) && col.filterable !== false && (
                    <button
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onOpenFilter(col.key, rect);
                      }}
                      className={`flex-shrink-0 p-1 rounded transition-colors relative
                        ${isFiltered
                          ? 'flex text-[var(--primary-color,#5c43fa)]'
                          : (isDarkMode
                            ? 'hidden group-hover/th:flex text-gray-400 hover:text-violet-200'
                            : 'hidden group-hover/th:flex text-gray-400 hover:text-[var(--primary-color,#5c43fa)]')}`}
                      aria-label={`Filter ${col.label}${isFiltered ? ' (active)' : ''}`}
                      aria-pressed={isFiltered}
                    >
                      <Filter className="w-3 h-3" aria-hidden="true" />
                      {isFiltered && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--primary-color,#5c43fa)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}

                  {/* Pin toggle */}
                  {!isTransposed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (col.pinned) {
                        onPinColumn(col.key, null);
                      } else {
                        onPinColumn(col.key, 'left');
                      }
                    }}
                    className={`flex-shrink-0 p-1 rounded transition-colors
                      ${col.pinned 
                        ? (isDarkMode
                            ? 'flex text-[var(--primary-color,#a78bfa)] hover:bg-[rgba(124,58,237,0.15)]'
                            : 'flex text-[var(--primary-color,#5c43fa)] hover:bg-[rgba(92,67,250,0.1)]') 
                        : (isDarkMode ? 'hidden group-hover/th:flex text-gray-400 hover:text-violet-200' : 'hidden group-hover/th:flex text-gray-400 hover:text-[var(--primary-color,#5c43fa)]')}`}
                    title={col.pinned ? "Unpin column" : "Pin column"}
                    aria-label={col.pinned ? "Unpin column" : "Pin column"}
                  >
                    {col.pinned ? (
                      <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                  )}

                  {/* Composite badge + ungroup button */}
                  {!isTransposed && isCompositeColumn(col) && (
                    <>
                      <span
                        className={`flex-shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded
                          ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                        title={`Group: ${col.composedOf.map(p => p.field).join(', ')}`}
                      >
                        <Layers className="w-2.5 h-2.5" aria-hidden="true" />
                        {col.composedOf.length}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteCompositeColumn(col.key); }}
                        className={`flex-shrink-0 p-1 rounded hidden group-hover/th:flex
                          ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        title="Ungroup — restores individual columns"
                        aria-label={`Ungroup ${col.label}`}
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Resize handle */}
              <div
                onMouseDown={e => startResize(e, col.key)}
                onDoubleClick={e => handleAutoFit(e, col)}
                title="Double-click to auto-fit width"
                className={`absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10
                  opacity-0 group-hover/th:opacity-100 transition-opacity ${resizeCls}`}
                aria-hidden="true"
              />

              {/* Drop indicator */}
              {dragColKey && dragColKey !== col.key && (
                <div className="absolute inset-y-0 right-0 w-0.5 bg-[var(--primary-color,#5c43fa)] pointer-events-none" aria-hidden="true" />
              )}
            </th>
          );
        })}

        {/* Add Column button cell */}
        {enableAddColumn && (
          <th
            style={{
              width: 44,
              minWidth: 44,
              maxWidth: 44,
              backgroundColor: thStyleBg,
              color: thStyleFg,
            }}
            className={`${thBg} border-b ${borderCls} px-1 py-3 text-center`}
          >
            <button
              type="button"
              onClick={onAddColumn}
              className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                isDarkMode
                  ? 'text-gray-400 hover:text-[var(--primary-color,#a78bfa)] hover:bg-gray-800'
                  : 'text-gray-500 hover:text-[var(--primary-color,#5c43fa)] hover:bg-[rgba(92,67,250,0.08)]'
              }`}
              title="Add Column"
              aria-label="Add Column"
            >
              <Plus className="w-4 h-4" />
            </button>
          </th>
        )}

        {/* Actions column */}
        {enableActionsColumn && actionsWidth > 0 && (
          <th
            style={{
              width: actionsWidth,
              minWidth: actionsWidth,
              maxWidth: actionsWidth,
              position: 'sticky',
              right: 0,
              zIndex: 21,
              backgroundColor: thStyleBg,
              color: thStyleFg,
            }}
            className={`group/th relative ${thBg} border-b ${borderCls} px-2 py-3 text-center`}
          >
            {(rowActions?.showLabel !== false && (rowActions?.showLabel || Boolean(rowActions?.label))) && (
              <span className={`text-[12px] font-bold uppercase tracking-wide truncate ${textCls}`}>
                {rowActions?.label ?? 'Actions'}
              </span>
            )}

            {/* Resize handle on left edge of Actions header */}
            <div
              onMouseDown={e => startResize(e, '__actions', 'left')}
              className={`absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30
                opacity-0 group-hover/th:opacity-100 transition-opacity ${resizeCls}`}
              aria-hidden="true"
            />
          </th>
        )}
      </tr>
    </thead>
  );
}

// ─── Indeterminate checkbox ───────────────────────────────────────────────────

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  isDarkMode,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  isDarkMode: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-all duration-300 ease-out active:scale-75 flex-shrink-0
        ${checked || indeterminate
          ? 'bg-[var(--primary-color,#5c43fa)] border-[var(--primary-color,#5c43fa)]'
          : (isDarkMode ? 'border-gray-600 hover:border-violet-300' : 'border-gray-300 hover:border-[var(--primary-color,#5c43fa)]')}`}
      aria-label={label}
      aria-checked={indeterminate ? 'mixed' : checked}
      role="checkbox"
    >
      {(checked || indeterminate) && (
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white" fill="none" aria-hidden="true">
          {indeterminate && !checked
            ? <line x1="2" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            : <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          }
        </svg>
      )}
    </button>
  );
}
