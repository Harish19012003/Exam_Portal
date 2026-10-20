import { useMemo } from 'react';
import type { ColumnConfig } from '../types';

const CHECKBOX_WIDTH = 48;
const ACTIONS_WIDTH = 110;

interface UseVisibleColumnsOptions {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  transitioningCols: Record<string, 'show' | 'hide'>;
  columnWidths: Record<string, number>;
}

export function useVisibleColumns({
  columns,
  columnOrder,
  columnVisibility,
  transitioningCols,
  columnWidths,
}: UseVisibleColumnsOptions) {
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
  }, [visibleColumns, columnWidths, transitioningCols]);

  const totalWidth = useMemo(
    () =>
      CHECKBOX_WIDTH +
      ACTIONS_WIDTH +
      visibleColumns.reduce((s, c) => {
        if (transitioningCols[c.key] === 'hide') return s;
        return s + (columnWidths[c.key] ?? c.width);
      }, 0),
    [visibleColumns, columnWidths, transitioningCols],
  );

  return { visibleColumns, stickyOffsets, totalWidth, CHECKBOX_WIDTH, ACTIONS_WIDTH };
}
