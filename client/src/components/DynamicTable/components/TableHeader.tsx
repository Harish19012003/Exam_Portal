import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Filter,
  GripVertical,
  Info,
  Layers,
  MoreVertical,
  Pin,
  Plus,
  X,
} from 'lucide-react';
import { isFieldColumn, isCompositeColumn, resolveHeaderTextWrap } from '../types';
import type { ColumnConfig, DataRow, FilterValue, HeaderTextWrap, RowActionsConfig, SelectionColumnConfig, SortConfig } from '../types';
import { calculateAutoFitColumnWidth } from '../utils/textWidth';
import { opaqueAccentBackground } from '../utils/tableTheme';
import '../stickyCells.css';

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
  /** Explicit sort direction for the column ⋯ menu (avoids toggle cycling). */
  onSetSortDirection?: (key: string, direction: 'asc' | 'desc' | null) => void;
  onOpenFilter: (key: string, rect: DOMRect) => void;
  onColumnWidthChange: (key: string, width: number) => void;
  /** Batch width update when resizing several selected columns at once. */
  onColumnWidthsChange?: (updates: Record<string, number>) => void;
  onColumnReorder: (fromKey: string, toKey: string) => void;
  onPinColumn: (key: string, pin: 'left' | 'right' | null) => void;
  onDeleteCompositeColumn: (key: string) => void;
  /** Hide this column (column picker / shift chips can show it again). */
  onHideColumn?: (key: string) => void;
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
  /** Feature Builder: ellipsis (1 line) or wrap 2 / 3 lines. */
  headerTextWrap?: HeaderTextWrap;
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
  onSetSortDirection,
  onOpenFilter,
  onColumnWidthChange,
  onColumnWidthsChange,
  onColumnReorder,
  onPinColumn,
  onDeleteCompositeColumn,
  onHideColumn,
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
  headerTextWrap: headerTextWrapProp,
}: TableHeaderProps) {
  const headerTextWrap = resolveHeaderTextWrap(headerTextWrapProp);
  const headerWraps = headerTextWrap !== 'ellipsis';
  const headerLabelClass =
    headerTextWrap === 'wrap3'
      ? 'line-clamp-3 whitespace-normal break-words'
      : headerTextWrap === 'wrap2'
        ? 'line-clamp-2 whitespace-normal break-words'
        : 'truncate whitespace-nowrap';
  const resizingRef = useRef<{
    key: string;
    keys: string[];
    startX: number;
    startW: number;
    startSum: number;
    lastW: number;
    pointerId: number;
    table: HTMLTableElement | null;
    colEls: HTMLElement[];
    startMinWidth: number;
  } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Multi-select for batch resize (⌘/Ctrl+click, Shift+click range). */
  const [selectedColKeys, setSelectedColKeys] = useState<string[]>([]);
  const selectAnchorRef = useRef<string | null>(null);
  const selectedColSet = useRef(new Set(selectedColKeys));
  selectedColSet.current = new Set(selectedColKeys);

  useEffect(() => {
    if (!menuKey) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(`[data-col-menu-btn="${menuKey}"]`)) return;
      setMenuKey(null);
      setMenuPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuKey(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuKey]);

  useEffect(() => {
    if (selectedColKeys.length === 0) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedColKeys([]);
        selectAnchorRef.current = null;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedColKeys.length]);

  const clearColSelection = () => {
    setSelectedColKeys([]);
    selectAnchorRef.current = null;
  };

  const handleHeaderSelectClick = (key: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedColKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        selectAnchorRef.current = key;
        return columns.map((c) => c.key).filter((k) => next.has(k));
      });
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const keys = columns.map((c) => c.key);
      const anchor = selectAnchorRef.current ?? key;
      const a = keys.indexOf(anchor);
      const b = keys.indexOf(key);
      if (a < 0 || b < 0) {
        setSelectedColKeys([key]);
        selectAnchorRef.current = key;
        return;
      }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelectedColKeys(keys.slice(lo, hi + 1));
      return;
    }
    if (selectedColKeys.length > 0) clearColSelection();
  };

  const hasSelectionIcon = Boolean(selectionColumn?.iconName || selectionColumn?.renderIcon);
  const selectionMode = selectionColumn?.mode ?? (enableRowSelection ? (hasSelectionIcon ? 'checkbox-and-icon' : 'checkbox') : (hasSelectionIcon ? 'icon-only' : 'none'));

  // Portal theme header — solid violet (inline style beats washed Tailwind/CSS fights)
  const thBg = isDarkMode ? 'bg-gray-800' : 'bg-violet-100';
  const thStyleBg = isDarkMode ? '#1f2937' : '#ede9fe';
  const thStyleFg = isDarkMode ? '#e5e7eb' : '#4c1d95';
  const borderCls = isDarkMode ? 'border-gray-700' : 'border-violet-200';
  const textCls = isDarkMode ? 'text-gray-200' : 'text-violet-900';
  const resizeLineCls = isDarkMode
    ? 'bg-blue-400/70 group-hover/resize:bg-[var(--primary-color,#3b82f6)] group-active/resize:bg-[var(--primary-color,#3b82f6)]'
    : 'bg-violet-500/50 group-hover/resize:bg-[var(--primary-color,#5c43fa)] group-active/resize:bg-[var(--primary-color,#5c43fa)]';

  const resolveAccent = (col: ColumnConfig) => {
    const raw = String(col.accentColor || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(raw)) return null;
    const bg = opaqueAccentBackground(raw, isDarkMode, isDarkMode ? 0.34 : 0.18);
    if (!bg) return null;
    return { fg: raw, bg };
  };

  const resolveColWidth = (k: string) => {
    if (k === '__checkbox') return checkboxWidth;
    if (k === '__actions') return actionsWidth;
    return columnWidths[k] ?? columns.find((c) => c.key === k)?.width ?? 100;
  };

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
    const batch =
      selectedColSet.current.has(col.key) && selectedColKeys.length > 1
        ? selectedColKeys
        : [col.key];
    if (batch.length > 1 && onColumnWidthsChange) {
      const updates: Record<string, number> = {};
      batch.forEach((k) => {
        updates[k] = autoW;
      });
      onColumnWidthsChange(updates);
    } else {
      onColumnWidthChange(col.key, autoW);
    }
  };

  const startResize = (
    e: React.PointerEvent,
    key: string,
    direction: 'right' | 'left' = 'right',
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // HTML5 column-reorder drag on <th> steals the gesture — disable for this drag.
    const hostTh = (e.currentTarget as HTMLElement).closest('th');
    const prevDraggable = hostTh?.getAttribute('draggable');
    if (hostTh) hostTh.setAttribute('draggable', 'false');
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);

    const initialW = resolveColWidth(key);
    const keysToResize =
      selectedColSet.current.has(key) && selectedColKeys.length > 1
        ? selectedColKeys.slice()
        : [key];
    const startSum = keysToResize.reduce((sum, k) => sum + resolveColWidth(k), 0);

    const table = target.closest('table');
    const colEls = keysToResize
      .map(
        (k) =>
          table?.querySelector(
            `colgroup > col[data-col-key="${CSS.escape(k)}"]`,
          ) as HTMLElement | null,
      )
      .filter((el): el is HTMLElement => Boolean(el));

    const startTableW = table
      ? parseFloat(table.style.width || '0') ||
        parseFloat(table.style.minWidth || '0') ||
        table.scrollWidth
      : 0;

    table?.classList.add('dt-is-resizing');
    resizingRef.current = {
      key,
      keys: keysToResize,
      startX: e.clientX,
      startW: initialW,
      startSum,
      lastW: initialW,
      pointerId: e.pointerId,
      table,
      colEls,
      startMinWidth: startTableW,
    };

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const applyDomWidth = (width: number) => {
      const r = resizingRef.current;
      if (!r) return;
      const px = `${width}px`;
      if (r.colEls.length > 0) {
        r.colEls.forEach((el) => {
          el.style.width = px;
        });
      } else if (hostTh) {
        hostTh.style.width = px;
        hostTh.style.minWidth = px;
        hostTh.style.maxWidth = px;
      }
      if (r.table && r.startMinWidth > 0) {
        const endSum = width * r.keys.length;
        const nextTableW = Math.max(0, r.startMinWidth + (endSum - r.startSum));
        const tablePx = `${nextTableW}px`;
        r.table.style.width = tablePx;
        r.table.style.minWidth = tablePx;
      }
      r.lastW = width;
    };

    const flush = () => {
      resizeRafRef.current = null;
      const r = resizingRef.current;
      if (!r) return;
      // DOM-only during drag — React state commits once on pointerup.
      applyDomWidth(r.lastW);
    };

    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const { startX, startW, key: k } = resizingRef.current;
      const delta = direction === 'left' ? startX - ev.clientX : ev.clientX - startX;
      const minW = k === '__checkbox' ? 32 : k === '__actions' ? 40 : 50;
      resizingRef.current.lastW = Math.max(minW, startW + delta);
      if (resizeRafRef.current == null) {
        resizeRafRef.current = requestAnimationFrame(flush);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      const r = resizingRef.current;
      const finalW = r?.lastW ?? initialW;
      const keys = r?.keys ?? [key];
      r?.table?.classList.remove('dt-is-resizing');
      resizingRef.current = null;
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      if (hostTh) {
        if (prevDraggable == null) hostTh.removeAttribute('draggable');
        else hostTh.setAttribute('draggable', prevDraggable);
      }
      try {
        target.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* already released */
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if (keys.length > 1 && onColumnWidthsChange) {
        const updates: Record<string, number> = {};
        keys.forEach((k) => {
          updates[k] = finalW;
        });
        onColumnWidthsChange(updates);
      } else {
        onColumnWidthChange(key, finalW);
      }
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  /** Wide hit strip straddling the column edge; thin visible rail inside. */
  const resizeHandle = (
    key: string,
    opts: {
      direction?: 'right' | 'left';
      onDoubleClick?: (e: React.MouseEvent) => void;
      title?: string;
      /** Keep the strip fully inside the cell (needed for sticky Actions). */
      inset?: boolean;
      /** Always show a faint rail so the edge is discoverable. */
      alwaysVisible?: boolean;
      /** Wider hit target (px classes). */
      wide?: boolean;
    } = {},
  ) => {
    const direction = opts.direction ?? 'right';
    const inset = Boolean(opts.inset);
    const edge = inset
      ? direction === 'left'
        ? 'left-0'
        : 'right-0'
      : direction === 'left'
        ? 'left-0 -ml-1.5'
        : 'right-0 -mr-1.5';
    const hitW = opts.wide ? 'w-5' : 'w-3';
    const railOpacity = opts.alwaysVisible
      ? 'opacity-45 group-hover/th:opacity-90 group-hover/resize:opacity-100'
      : 'opacity-0 group-hover/th:opacity-70 group-hover/resize:opacity-100';
    return (
      <div
        onPointerDown={e => startResize(e, key, direction)}
        onDoubleClick={opts.onDoubleClick}
        title={opts.title}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${key === '__checkbox' ? 'selection' : key === '__actions' ? 'actions' : 'column'}`}
        className={`group/resize absolute ${edge} top-0 bottom-0 ${hitW} cursor-col-resize z-50
          flex items-stretch justify-center touch-none select-none`}
      >
        <span
          className={`w-0.5 my-1.5 rounded-full ${railOpacity}
            transition-opacity ${resizeLineCls}`}
          aria-hidden="true"
        />
      </div>
    );
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

  const menuCol = menuKey ? columns.find((c) => c.key === menuKey) : null;
  const menuSort = menuKey ? sort.find((s) => s.key === menuKey) : null;
  const menuFiltered = menuKey ? hasFilter(menuKey) : false;
  const menuItemCls = `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors w-full text-left min-h-[36px]
    ${isDarkMode
      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`;
  const menuActiveCls = isDarkMode
    ? 'bg-[rgba(59,130,246,0.15)] text-[var(--primary-color,#60a5fa)]'
    : 'bg-[rgba(92,67,250,0.08)] text-[var(--primary-color,#5c43fa)]';
  const closeMenu = () => {
    setMenuKey(null);
    setMenuPos(null);
  };

  return (
    <>
    <thead
      className={`${isTransposed ? '' : 'sticky top-0'} z-20 ${thBg}`}
      style={{ backgroundColor: thStyleBg, color: thStyleFg }}
    >
      <tr>
        {/* Checkbox / Leftmost index column */}
        {(selectionMode !== 'none' || enableSubRows || Boolean(selectionColumn?.customIconElements?.some(e => e.enabled))) && checkboxWidth > 0 && (
          <th
            data-col-key="__checkbox"
            style={{
              width: checkboxWidth,
              minWidth: checkboxWidth,
              position: 'sticky',
              left: 0,
              zIndex: 30,
              backgroundColor: thStyleBg,
              color: thStyleFg,
            }}
            className={`group/th relative dt-sticky-th dt-sticky-th--left ${thBg} border-b ${borderCls} px-2`}
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


            {resizeHandle('__checkbox')}
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
          const isColSelected = selectedColSet.current.has(col.key);
          
          const highlightBg = isHiding 
            ? (isDarkMode ? 'bg-red-900/30 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]' : 'bg-red-50 text-transparent !border-transparent shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]')
            : isColSelected
              ? (isDarkMode
                  ? 'bg-[rgba(59,130,246,0.28)] shadow-[inset_0_-2px_0_0_var(--primary-color,#3b82f6)] transition-all duration-150'
                  : 'bg-[rgba(92,67,250,0.16)] shadow-[inset_0_-2px_0_0_var(--primary-color,#5c43fa)] transition-all duration-150')
            : isHighlighted 
              ? (isDarkMode
                  ? 'bg-[rgba(59,130,246,0.22)] shadow-[inset_0_0_15px_rgba(59,130,246,0.25)] transition-all duration-300'
                  : 'bg-[rgba(92,67,250,0.12)] shadow-[inset_0_0_15px_rgba(92,67,250,0.18)] transition-all duration-300')
              : 'transition-[background-color,box-shadow,color] duration-300';

          const actualW = isHiding ? 0 : colWidth;
          const accent = resolveAccent(col);

          return (
            <th
              key={col.key}
              data-col-key={col.key}
              data-col-accent={accent ? '' : undefined}
              style={{
                width: actualW,
                minWidth: actualW,
                maxWidth: actualW,
                paddingLeft: isHiding ? 0 : undefined,
                paddingRight: isHiding ? 0 : undefined,
                opacity: isHiding ? 0 : 1,
                backgroundColor: accent?.bg || thStyleBg,
                color: accent?.fg || thStyleFg,
                ...(accent
                  ? ({
                      '--dt-col-accent': accent.fg,
                      '--dt-col-accent-bg': accent.bg,
                    } as React.CSSProperties)
                  : null),
                '--target-width': `${colWidth}px`,
                ...(offset?.left !== undefined
                  ? { position: 'sticky', left: offset.left, zIndex: accent ? 31 : 22 }
                  : {}),
                ...(offset?.right !== undefined
                  ? { position: 'sticky', right: offset.right, zIndex: accent ? 31 : 22 }
                  : {}),
              } as React.CSSProperties}
              className={`${isHighlighted || isHiding ? '' : thBg} border-b ${borderCls} select-none relative group/th ${isHiding ? 'transition-all duration-300 ease-in-out' : isShowing ? 'animate-expand' : ''} ${highlightBg}
                ${headerWraps ? 'whitespace-normal' : 'whitespace-nowrap'}
                ${isDragging ? 'opacity-40' : ''}
                ${offset?.left !== undefined ? 'dt-sticky-th dt-sticky-th--left' : ''}
                ${offset?.right !== undefined ? 'dt-sticky-th dt-sticky-th--right' : ''}
                ${isLastLeftPinned && !accent ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}
                ${isFirstRightPinned && !accent ? 'shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]' : ''}`}
              draggable={!isTransposed}
              onDragStart={e => {
                if (isTransposed) return;
                // Multi-select / resize strip — never start a column reorder.
                if (e.metaKey || e.ctrlKey || e.shiftKey) {
                  e.preventDefault();
                  return;
                }
                const t = e.target as HTMLElement | null;
                if (t?.closest?.('[role="separator"]')) {
                  e.preventDefault();
                  return;
                }
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
              onClick={(e) => handleHeaderSelectClick(col.key, e)}
              aria-selected={isColSelected || undefined}
            >
              {/* overflow on inner content only — clipping the th ate the resize hit area (-mr). */}
              <div className={`flex px-1.5 py-3 min-w-0 w-full h-full relative overflow-hidden ${headerWraps ? 'items-start' : 'items-center'} ${!isTransposed ? 'pl-2 pr-3' : ''}`}>
                <div className={`flex gap-0.5 min-w-0 flex-1 ${headerWraps ? 'items-start' : 'items-center'} ${col.dataType === 'boolean' || col.dataType === 'checkbox' ? 'w-full justify-center pl-5' : ''}`}>
                  {!isTransposed && (
                    <GripVertical
                      className={`w-3 h-3 absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/th:opacity-100 transition-opacity cursor-grab
                        ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className={`flex gap-0.5 min-w-0 max-w-full text-left ${headerWraps ? 'items-start' : 'items-center'}
                      ${isSorted || isColSelected
                        ? (isDarkMode ? 'text-[var(--primary-color,#60a5fa)]' : 'text-[var(--primary-color,#5c43fa)]')
                        : textCls}`}
                    title={`${col.label}${isColSelected ? ' (selected for resize)' : ''} — ⌘/Ctrl+click to multi-select`}
                    aria-sort={isSorted ? (sort.find(s => s.key === col.key)?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className={`text-[12px] font-bold uppercase tracking-wide ${headerLabelClass}`}>
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
                      <span className="text-[11px] font-bold flex-shrink-0 leading-none" aria-hidden="true">
                        {sortIcon}
                        {sortIdx && <sup className="text-[9px]">{sortIdx}</sup>}
                      </span>
                    )}
                    {!isTransposed && isCompositeColumn(col) && (
                      <span
                        className={`flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded
                          ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                        title={`Group: ${col.composedOf.map(p => p.field).join(', ')}`}
                      >
                        <Layers className="w-2.5 h-2.5" aria-hidden="true" />
                        {col.composedOf.length}
                      </span>
                    )}
                  </div>
                </div>

                {!isTransposed && (() => {
                  const menuActive = isSorted || isFiltered || Boolean(col.pinned);
                  const menuOpen = menuKey === col.key;
                  return (
                    <button
                      type="button"
                      data-col-menu-btn={col.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuOpen) {
                          setMenuKey(null);
                          setMenuPos(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const width = 200;
                        const left = Math.min(
                          Math.max(8, rect.right - width),
                          window.innerWidth - width - 8,
                        );
                        const top = Math.min(rect.bottom + 4, window.innerHeight - 280);
                        setMenuPos({ top, left });
                        setMenuKey(col.key);
                      }}
                      className={`absolute top-1/2 right-1 -translate-y-1/2 z-[1] flex items-center justify-center w-4 h-4 rounded transition-opacity
                        ${menuOpen || menuActive
                          ? 'opacity-100'
                          : 'opacity-0 group-hover/th:opacity-100 [@media(hover:none)]:opacity-100'}
                        ${menuActive || menuOpen
                          ? (isDarkMode
                              ? 'text-[var(--primary-color,#60a5fa)]'
                              : 'text-[var(--primary-color,#5c43fa)]')
                          : (isDarkMode
                              ? 'text-gray-400 hover:text-blue-300'
                              : 'text-gray-500 hover:text-[var(--primary-color,#5c43fa)]')}`}
                      title={`Column options for ${col.label}`}
                      aria-label={`Column options for ${col.label}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      <MoreVertical className="w-3 h-3" aria-hidden="true" />
                      {menuActive && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-[var(--primary-color,#5c43fa)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })()}
              </div>

              {resizeHandle(col.key, {
                onDoubleClick: e => handleAutoFit(e, col),
                // Keep the last data-col handle out of the sticky Actions hit zone.
                inset: enableActionsColumn && col.key === columns[columns.length - 1]?.key,
                title:
                  isColSelected && selectedColKeys.length > 1
                    ? `Drag to resize ${selectedColKeys.length} selected columns · double-click to auto-fit all`
                    : 'Drag to resize · double-click to auto-fit · ⌘/Ctrl+click headers to multi-select',
              })}

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
                  ? 'text-gray-400 hover:text-[var(--primary-color,#60a5fa)] hover:bg-gray-800'
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
            data-col-key="__actions"
            style={{
              width: actionsWidth,
              minWidth: actionsWidth,
              maxWidth: actionsWidth,
              position: 'sticky',
              right: 0,
              zIndex: 30,
              backgroundColor: thStyleBg,
              color: thStyleFg,
            }}
            className={`group/th relative dt-sticky-th dt-sticky-th--right ${thBg} border-b ${borderCls} px-2 py-3 text-center`}
          >
            {(rowActions?.showLabel !== false && (rowActions?.showLabel || Boolean(rowActions?.label))) && (
              <span className={`text-[11px] font-bold uppercase tracking-wide truncate ${textCls}`}>
                {rowActions?.label ?? 'Actions'}
              </span>
            )}

            {/*
              Inset hit target (rail on hover only) — avoid a permanent left strip
              that looks like padding before the label/icons.
            */}
            {resizeHandle('__actions', {
              direction: 'left',
              inset: true,
              alwaysVisible: false,
              wide: true,
              title: 'Drag to resize Actions column',
            })}
          </th>
        )}
      </tr>
    </thead>
    {selectedColKeys.length > 0 && createPortal(
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] flex flex-wrap items-center justify-center gap-2
          max-w-[min(92vw,420px)] px-3 py-2 rounded-xl border shadow-lg text-[12px] font-medium
          ${isDarkMode
            ? 'bg-gray-900/95 border-gray-700 text-gray-100'
            : 'bg-white/95 border-violet-200 text-violet-950'}`}
      >
        <span>
          {selectedColKeys.length} column{selectedColKeys.length === 1 ? '' : 's'} selected — drag an edge to resize all
        </span>
        <button
          type="button"
          onClick={clearColSelection}
          className={`min-h-[32px] px-2.5 rounded-lg text-[12px] font-semibold
            ${isDarkMode
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-100'
              : 'bg-violet-50 hover:bg-violet-100 text-violet-800'}`}
        >
          Clear (Esc)
        </button>
      </div>,
      document.body,
    )}
    {menuCol && menuPos && createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Options for ${menuCol.label}`}
        style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 10000 }}
        className={`min-w-[200px] max-w-[min(92vw,240px)] rounded-xl border shadow-xl py-1 px-1
          ${isDarkMode ? 'bg-gray-900 border-gray-700/80 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200/80'}`}
      >
        <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider truncate
          ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {menuCol.label}
        </div>

        {isFieldColumn(menuCol) && menuCol.sortable !== false && (
          <>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemCls} ${menuSort?.direction === 'asc' ? menuActiveCls : ''}`}
              onClick={() => {
                closeMenu();
                if (onSetSortDirection) onSetSortDirection(menuCol.key, 'asc');
                else if (menuSort?.direction !== 'asc') onSort(menuCol.key, false);
              }}
            >
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
              Sort ascending
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemCls} ${menuSort?.direction === 'desc' ? menuActiveCls : ''}`}
              onClick={() => {
                closeMenu();
                if (onSetSortDirection) onSetSortDirection(menuCol.key, 'desc');
                else if (menuSort?.direction === 'asc') onSort(menuCol.key, false);
                else if (!menuSort) {
                  onSort(menuCol.key, false);
                  onSort(menuCol.key, false);
                }
              }}
            >
              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
              Sort descending
            </button>
            {menuSort && (
              <button
                type="button"
                role="menuitem"
                className={menuItemCls}
                onClick={() => {
                  closeMenu();
                  if (onSetSortDirection) onSetSortDirection(menuCol.key, null);
                  else onSort(menuCol.key, false);
                }}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Clear sort
              </button>
            )}
          </>
        )}

        {isFieldColumn(menuCol) && menuCol.filterable !== false && (
          <button
            type="button"
            role="menuitem"
            className={`${menuItemCls} ${menuFiltered ? menuActiveCls : ''}`}
            onClick={() => {
              const btn = document.querySelector(`[data-col-menu-btn="${menuCol.key}"]`) as HTMLElement | null;
              const rect = btn?.getBoundingClientRect() || new DOMRect(menuPos.left, menuPos.top, 0, 0);
              closeMenu();
              onOpenFilter(menuCol.key, rect);
            }}
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            {menuFiltered ? 'Edit filter' : 'Filter…'}
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          className={`${menuItemCls} ${selectedColSet.current.has(menuCol.key) ? menuActiveCls : ''}`}
          onClick={() => {
            closeMenu();
            setSelectedColKeys((prev) => {
              const next = new Set(prev);
              if (next.has(menuCol.key)) next.delete(menuCol.key);
              else next.add(menuCol.key);
              selectAnchorRef.current = menuCol.key;
              return columns.map((c) => c.key).filter((k) => next.has(k));
            });
          }}
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          {selectedColSet.current.has(menuCol.key) ? 'Deselect for resize' : 'Select for resize'}
        </button>
        {selectedColKeys.length > 0 && (
          <button
            type="button"
            role="menuitem"
            className={menuItemCls}
            onClick={() => {
              closeMenu();
              clearColSelection();
            }}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear column selection ({selectedColKeys.length})
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          className={`${menuItemCls} ${menuCol.pinned === 'left' ? menuActiveCls : ''}`}
          onClick={() => {
            closeMenu();
            onPinColumn(menuCol.key, menuCol.pinned === 'left' ? null : 'left');
          }}
        >
          <Pin className="w-3.5 h-3.5" aria-hidden="true" />
          {menuCol.pinned === 'left' ? 'Unpin' : 'Pin left'}
        </button>
        {/* Pin right — hidden for now; restore this button when needed again.
        <button
          type="button"
          role="menuitem"
          className={`${menuItemCls} ${menuCol.pinned === 'right' ? menuActiveCls : ''}`}
          onClick={() => {
            closeMenu();
            onPinColumn(menuCol.key, menuCol.pinned === 'right' ? null : 'right');
          }}
        >
          <Pin className="w-3.5 h-3.5 rotate-45" aria-hidden="true" />
          {menuCol.pinned === 'right' ? 'Unpin' : 'Pin right'}
        </button>
        */}

        {isCompositeColumn(menuCol) && (
          <button
            type="button"
            role="menuitem"
            className={menuItemCls}
            onClick={() => {
              closeMenu();
              onDeleteCompositeColumn(menuCol.key);
            }}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Ungroup columns
          </button>
        )}

        {onHideColumn && (
          <button
            type="button"
            role="menuitem"
            className={`${menuItemCls} ${isDarkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'}`}
            onClick={() => {
              closeMenu();
              onHideColumn(menuCol.key);
            }}
          >
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            Hide column
          </button>
        )}
      </div>,
      document.body,
    )}
    </>
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
          : (isDarkMode ? 'border-gray-600 hover:border-blue-400' : 'border-gray-300 hover:border-[var(--primary-color,#5c43fa)]')}`}
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
