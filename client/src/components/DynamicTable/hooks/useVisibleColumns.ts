import { useMemo } from 'react';
import type { ColumnConfig, RowActionsConfig, SelectionColumnConfig } from '../types';

interface UseVisibleColumnsOptions {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  transitioningCols: Record<string, 'show' | 'hide'>;
  columnWidths: Record<string, number>;
  enableRowSelection?: boolean;
  enableActionsColumn?: boolean;
  enableAddColumn?: boolean;
  enableSubRows?: boolean;
  selectionColumn?: SelectionColumnConfig;
  rowActions?: RowActionsConfig;
}

export function useVisibleColumns({
  columns,
  columnOrder,
  columnVisibility,
  transitioningCols,
  columnWidths,
  enableRowSelection = true,
  enableActionsColumn = true,
  enableAddColumn = true,
  enableSubRows = true,
  selectionColumn,
  rowActions,
}: UseVisibleColumnsOptions) {
  const hasSelectionIcon = Boolean(selectionColumn?.iconName || selectionColumn?.renderIcon);
  const hasActiveCustomIcons = Boolean(selectionColumn?.customIconElements?.some(e => e.enabled));
  const selectionMode =
    selectionColumn?.mode ??
    (enableRowSelection
      ? hasSelectionIcon
        ? 'checkbox-and-icon'
        : 'checkbox'
      : hasSelectionIcon
        ? 'icon-only'
        : 'none');

  // Must match TableHeader / TableDataRow first-column render conditions —
  // don't reserve sticky space for a controls column that isn't drawn.
  const isLeftColVisible =
    selectionMode !== 'none' || enableSubRows || hasActiveCustomIcons;

  const defaultCheckboxW = !isLeftColVisible
    ? 0
    : selectionMode === 'checkbox-and-icon'
    ? 76
    : selectionMode === 'icon-only'
    ? 44
    : selectionMode === 'none'
    ? (enableSubRows || hasActiveCustomIcons ? 44 : 0)
    : enableSubRows
    ? 72
    : 44;

  const CHECKBOX_WIDTH = !isLeftColVisible
    ? 0
    : Math.max(32, columnWidths['__checkbox'] ?? selectionColumn?.width ?? defaultCheckboxW);


  const activeBtnCount = rowActions?.customButtons?.filter(b => b.enabled).length ?? 3;
  const defaultActionsW = Math.max(110, activeBtnCount * 32 + 16);

  const ACTIONS_WIDTH =
    enableActionsColumn === false
      ? 0
      : Math.max(40, columnWidths['__actions'] ?? rowActions?.width ?? defaultActionsW);

  const ADD_COLUMN_WIDTH = enableAddColumn ? 44 : 0;

  const visibleColumns = useMemo<ColumnConfig[]>(() => {
    const raw = columnOrder
      .map(key => columns.find(c => c.key === key))
      .filter(Boolean)
      .filter(
        c => columnVisibility[c!.key] !== false || transitioningCols[c!.key] === 'hide',
      ) as ColumnConfig[];

    const leftPinned = raw.filter(c => c.pinned === 'left');
    const rightPinned = raw.filter(c => c.pinned === 'right');
    const unpinned = raw.filter(c => !c.pinned);

    return [...leftPinned, ...unpinned, ...rightPinned];
  }, [columnOrder, columns, columnVisibility, transitioningCols]);

  const stickyOffsets = useMemo<Record<string, { left?: number; right?: number }>>(() => {
    const offsets: Record<string, { left?: number; right?: number }> = {};
    let leftOff = CHECKBOX_WIDTH;
    let rightOff = ACTIONS_WIDTH;

    visibleColumns
      .filter(c => c.pinned === 'left')
      .forEach(c => {
        offsets[c.key] = { left: leftOff };
        if (transitioningCols[c.key] !== 'hide') {
          leftOff += columnWidths[c.key] ?? c.width;
        }
      });

    [...visibleColumns]
      .filter(c => c.pinned === 'right')
      .reverse()
      .forEach(c => {
        offsets[c.key] = { right: rightOff };
        if (transitioningCols[c.key] !== 'hide') {
          rightOff += columnWidths[c.key] ?? c.width;
        }
      });

    return offsets;
  }, [visibleColumns, columnWidths, transitioningCols, CHECKBOX_WIDTH, ACTIONS_WIDTH]);

  const totalWidth = useMemo(
    () =>
      CHECKBOX_WIDTH +
      ACTIONS_WIDTH +
      ADD_COLUMN_WIDTH +
      visibleColumns.reduce((s, c) => {
        if (transitioningCols[c.key] === 'hide') return s;
        return s + (columnWidths[c.key] ?? c.width);
      }, 0),
    [visibleColumns, columnWidths, transitioningCols, CHECKBOX_WIDTH, ACTIONS_WIDTH, ADD_COLUMN_WIDTH],
  );

  return { visibleColumns, stickyOffsets, totalWidth, CHECKBOX_WIDTH, ACTIONS_WIDTH, ADD_COLUMN_WIDTH };
}

