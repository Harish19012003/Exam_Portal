import { useRef } from 'react';
import { ChevronDown, Filter, Info, Pin, PinOff, GripVertical, X, Layers, Key } from 'lucide-react';
import { isFieldColumn, isCompositeColumn } from '../types';
import type { ColumnConfig, FilterValue, SortConfig } from '../types';

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
}

const CHECKBOX_WIDTH = 48;
const ACTIONS_WIDTH = 56;

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
}: TableHeaderProps) {
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const thBg = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const borderCls = isDarkMode ? 'border-gray-800' : 'border-gray-100';
  const textCls = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  const startResize = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = { key, startX: e.clientX, startW: columnWidths[key] ?? 100 };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { startX, startW, key: k } = resizingRef.current;
      onColumnWidthChange(k, startW + (ev.clientX - startX));
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
    <thead className={`sticky top-0 z-20 ${thBg}`}>
      <tr className="h-[46px]" style={{ height: '46px' }}>
        {/* Checkbox */}
        <th
          style={{ width: CHECKBOX_WIDTH, minWidth: CHECKBOX_WIDTH, height: '46px', position: 'sticky', left: 0, zIndex: 21 }}
          className={`${thBg} border-b ${borderCls} px-3 h-[46px]`}
        >
          <div className="flex items-center justify-center h-full" style={{ height: '100%', minHeight: '46px' }}>
            <IndeterminateCheckbox
              checked={allColumnsSelected}
              indeterminate={someRowsSelected && !allColumnsSelected}
              onChange={onSelectAll}
              isDarkMode={isDarkMode}
              label="Select all rows"
            />
          </div>
        </th>

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
              ? (isDarkMode ? 'bg-[#13C296]/20 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300' : 'bg-[#13C296]/10 shadow-[inset_0_0_15px_rgba(19,194,150,0.2)] transition-all duration-300')
              : 'transition-all duration-1000';

          const actualW = isHiding ? 0 : colWidth;

          return (
            <th
              key={col.key}
              style={{
                width: actualW,
                minWidth: actualW,
                maxWidth: actualW,
                height: '46px',
                paddingLeft: isHiding ? 0 : undefined,
                paddingRight: isHiding ? 0 : undefined,
                opacity: isHiding ? 0 : 1,
                '--target-width': `${colWidth}px`,
                ...(offset?.left !== undefined ? { position: 'sticky', left: offset.left, zIndex: 22 } : {}),
                ...(offset?.right !== undefined ? { position: 'sticky', right: offset.right, zIndex: 22 } : {}),
              } as React.CSSProperties}
              className={`${isHighlighted || isHiding ? '' : thBg} overflow-hidden whitespace-nowrap border-b ${borderCls} select-none relative group/th h-[46px] ${isHiding ? 'transition-all duration-300 ease-in-out' : isShowing ? 'animate-expand' : ''} ${highlightBg}
                ${isDragging ? 'opacity-40' : ''}
                ${isLastLeftPinned ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}
                ${isFirstRightPinned ? 'shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}`}
              draggable
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move';
                setDragColKey(col.key);
              }}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={e => {
                e.preventDefault();
                if (dragColKey && dragColKey !== col.key) onColumnReorder(dragColKey, col.key);
                setDragColKey(null);
              }}
              onDragEnd={() => setDragColKey(null)}
            >
              <div 
                className="flex items-center justify-between px-3.5 py-2 min-w-0 w-full h-full gap-2"
                style={{ height: '100%', minHeight: '46px', boxSizing: 'border-box' }}
              >
                <div className={`flex items-center gap-1 min-w-0 ${col.dataType === 'boolean' || col.dataType === 'checkbox' ? 'w-full justify-center pl-6' : ''}`}>
                  <GripVertical
                    className={`w-3 h-3 flex-shrink-0 opacity-0 group-hover/th:opacity-100 transition-opacity cursor-grab
                      ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                    aria-hidden="true"
                  />
                  <button
                    className={`flex items-center gap-1.5 min-w-0 max-w-full text-left transition-colors group/sort
                      ${isSorted
                        ? (isDarkMode ? 'text-[#13C296]' : 'text-[#0a8066]')
                        : textCls}
                      ${isFieldColumn(col) && col.sortable !== false ? 'cursor-pointer hover:text-[#13C296]' : 'cursor-default'}`}
                    onClick={e => {
                      if (isFieldColumn(col) && col.sortable !== false) onSort(col.key, e.shiftKey);
                    }}
                    title={isFieldColumn(col) && col.sortable !== false ? "Click to sort (Shift+click for multiple)" : undefined}
                    aria-sort={isSorted ? (sort.find(s => s.key === col.key)?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    aria-label={`${col.label}${isFieldColumn(col) && col.sortable !== false ? ' — click to sort, shift+click for multi-sort' : ''}`}
                  >
                    <span className="text-[13.5px] font-bold uppercase tracking-wide truncate">
                      {col.label}
                    </span>
                    {isFieldColumn(col) && col.isPrimaryKey && col.key !== 'vendor_code' && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex-shrink-0"
                        title="Primary Key (Unique Identifier)"
                      >
                        <Key className="w-2.5 h-2.5" />
                        PK
                      </span>
                    )}
                    {col.description && (
                      <span title={col.description}>
                        <Info
                          className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                          aria-label={col.description}
                        />
                      </span>
                    )}
                    {sortIcon && (
                      <span className="text-[12px] font-bold flex-shrink-0 leading-none">
                        {sortIcon}
                        {sortIdx && <sup className="text-[9px]">{sortIdx}</sup>}
                      </span>
                    )}
                    {isFieldColumn(col) && col.sortable !== false && !isSorted && (
                      <ChevronDown
                        className="w-3.5 h-3.5 flex-shrink-0 hidden group-hover/sort:block opacity-60"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Filter icon */}
                  {isFieldColumn(col) && col.filterable !== false && (
                    <button
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onOpenFilter(col.key, rect);
                      }}
                      className={`flex-shrink-0 p-1 rounded transition-colors relative
                        ${isFiltered
                          ? 'flex text-[#13C296]'
                          : (isDarkMode
                            ? 'hidden group-hover/th:flex text-gray-400 hover:text-gray-200'
                            : 'hidden group-hover/th:flex text-gray-400 hover:text-gray-600')}`}
                      aria-label={`Filter ${col.label}${isFiltered ? ' (active)' : ''}`}
                      aria-pressed={isFiltered}
                    >
                      <Filter className="w-3 h-3" aria-hidden="true" />
                      {isFiltered && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#13C296]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )}

                  {/* Pin toggle */}
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
                        ? (isDarkMode ? 'flex text-[#13C296] hover:bg-[#13C296]/10' : 'flex text-[#0a8066] hover:bg-[#13C296]/10') 
                        : (isDarkMode ? 'hidden group-hover/th:flex text-gray-400 hover:text-gray-200' : 'hidden group-hover/th:flex text-gray-400 hover:text-gray-600')}`}
                    title={col.pinned ? "Unpin column" : "Pin column"}
                    aria-label={col.pinned ? "Unpin column" : "Pin column"}
                  >
                    {col.pinned ? (
                      <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>

                  {/* Composite badge + ungroup button */}
                  {isCompositeColumn(col) && (
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
                className={`absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10
                  opacity-0 group-hover/th:opacity-100 transition-opacity
                  ${isDarkMode ? 'bg-[#13C296]/30 hover:bg-[#13C296]' : 'bg-[#13C296]/20 hover:bg-[#13C296]'}`}
                aria-hidden="true"
              />

              {/* Drop indicator */}
              {dragColKey && dragColKey !== col.key && (
                <div className="absolute inset-y-0 right-0 w-0.5 bg-[#13C296] pointer-events-none" aria-hidden="true" />
              )}
            </th>
          );
        })}

        {/* Actions column */}
        <th
          style={{ width: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH, height: '46px', position: 'sticky', right: 0, zIndex: 21 }}
          className={`${thBg} border-b ${borderCls} h-[46px]`}
        />
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
          ? 'bg-[#13C296] border-[#13C296]'
          : (isDarkMode ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-400')}`}
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
