import { useEffect } from 'react';
import type { ColumnConfig } from '../types';

interface FocusedCell {
  rowId: string;
  colKey: string;
}

interface UseFocusScrollOptions {
  focusedCell: FocusedCell | null;
  scrollWrapperRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: ColumnConfig[];
  columnWidths: Record<string, number>;
  checkboxWidth: number;
  actionsWidth: number;
}

/** Keep the focused grid cell inside the scroll viewport (accounting for sticky columns). */
export function useFocusScroll({
  focusedCell,
  scrollWrapperRef,
  visibleColumns,
  columnWidths,
  checkboxWidth,
  actionsWidth,
}: UseFocusScrollOptions) {
  useEffect(() => {
    if (!focusedCell || !scrollWrapperRef.current) return;

    const el = document.getElementById(`cell-${focusedCell.rowId}-${focusedCell.colKey}`);
    if (!el) return;

    const wrapper = scrollWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const stickyLeft =
      checkboxWidth +
      visibleColumns
        .filter(c => c.pinned === 'left')
        .reduce((acc, c) => acc + (columnWidths[c.key] ?? c.width), 0);
    const stickyRight =
      actionsWidth +
      visibleColumns
        .filter(c => c.pinned === 'right')
        .reduce((acc, c) => acc + (columnWidths[c.key] ?? c.width), 0);

    if (elRect.left < wrapperRect.left + stickyLeft) {
      wrapper.scrollLeft -= wrapperRect.left + stickyLeft - elRect.left + 20;
    } else if (elRect.right > wrapperRect.right - stickyRight) {
      wrapper.scrollLeft += elRect.right - (wrapperRect.right - stickyRight) + 20;
    }

    const HEADER_HEIGHT = 45;
    const FOOTER_HEIGHT = 50;
    if (elRect.top < wrapperRect.top + HEADER_HEIGHT) {
      wrapper.scrollTop -= wrapperRect.top + HEADER_HEIGHT - elRect.top + 10;
    } else if (elRect.bottom > wrapperRect.bottom - FOOTER_HEIGHT) {
      wrapper.scrollTop += elRect.bottom - (wrapperRect.bottom - FOOTER_HEIGHT) + 10;
    }
  }, [focusedCell, visibleColumns, columnWidths, scrollWrapperRef, checkboxWidth, actionsWidth]);
}
