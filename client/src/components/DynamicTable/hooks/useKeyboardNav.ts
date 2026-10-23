import { useCallback } from 'react';
import { isFieldColumn } from '../types';
import type { ColumnConfig, DataRow } from '../types';

function isKeyboardEditable(col: ColumnConfig | undefined): boolean {
  return !!col && isFieldColumn(col) && !!col.editable;
}

interface FocusedCell {
  rowId: string;
  colKey: string;
}

interface UseKeyboardNavOptions {
  scrollWrapperRef: React.RefObject<HTMLDivElement | null>;
  focusedCell: FocusedCell | null;
  editingRowIds: Set<string>;
  paginatedRows: DataRow[];
  visibleColumns: ColumnConfig[];
  setFocusedCell: (cell: FocusedCell | null) => void;
  setEditingCell: (cell: FocusedCell | null) => void;
}

export function useKeyboardNav({
  scrollWrapperRef,
  focusedCell,
  editingRowIds,
  paginatedRows,
  visibleColumns,
  setFocusedCell,
  setEditingCell,
}: UseKeyboardNavOptions) {
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCell) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        const row = paginatedRows.find(r => r.rowId === focusedCell.rowId);
        if (row && row.values[focusedCell.colKey] !== undefined) {
          const val = String(row.values[focusedCell.colKey] ?? '');
          navigator.clipboard.writeText(val);
        }
        return;
      }

      const target = e.target as HTMLElement;
      const isTableWrapper = target === scrollWrapperRef.current;
      const isTextInput =
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement &&
          target.type !== 'checkbox' &&
          target.type !== 'radio');

      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target.getAttribute('tabindex') === '0' && !isTableWrapper);

      if (
        isTextInput &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        return;
      }

      if (target.tagName === 'BUTTON') {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') return;
        if (e.key === 'ArrowRight' && target.getAttribute('aria-label') === 'Cancel edit') {
          e.preventDefault();
          const saveBtn = target.nextElementSibling as HTMLElement;
          if (saveBtn) saveBtn.focus();
          return;
        }
        if (e.key === 'ArrowLeft') {
          const { rowId } = focusedCell;
          if (target.getAttribute('aria-label') === 'Save row') {
            e.preventDefault();
            const cancelBtn = target.previousElementSibling as HTMLElement;
            if (cancelBtn) cancelBtn.focus();
            return;
          }
          if (target.getAttribute('aria-label') === 'Cancel edit') {
            e.preventDefault();
            setTimeout(() => {
              const lastCol = visibleColumns[visibleColumns.length - 1];
              const el = document.getElementById(`cell-${rowId}-${lastCol.key}`);
              if (el) {
                const focusable = el.querySelector('input, [tabindex="0"]') as HTMLElement;
                if (focusable) focusable.focus();
              }
            }, 0);
            return;
          }
        }
      }

      const { rowId, colKey } = focusedCell;
      const rowIndex = paginatedRows.findIndex(r => r.rowId === rowId);
      const colIndex = visibleColumns.findIndex(c => c.key === colKey);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIndex < paginatedRows.length - 1) {
          setFocusedCell({ rowId: paginatedRows[rowIndex + 1].rowId, colKey });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ rowId: paginatedRows[rowIndex - 1].rowId, colKey });
        }
      } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();

        let nextColIndex = colIndex + 1;
        const shouldJump = isInput && (e.key === 'Tab' || e.key === 'ArrowRight');

        if (shouldJump) {
          while (
            nextColIndex < visibleColumns.length &&
            !isKeyboardEditable(visibleColumns[nextColIndex])
          ) {
            nextColIndex++;
          }
        }

        if (nextColIndex < visibleColumns.length) {
          const nextCol = visibleColumns[nextColIndex];
          setFocusedCell({ rowId, colKey: nextCol.key });

          if (shouldJump) {
            (e.target as HTMLElement).blur();
            if (editingRowIds.has(rowId)) {
              setTimeout(() => {
                const el = document.getElementById(`cell-${rowId}-${nextCol.key}`);
                if (el) {
                  const focusable = el.querySelector('input, [tabindex="0"]') as HTMLElement;
                  if (focusable) focusable.focus();
                }
              }, 0);
            } else {
              setEditingCell({ rowId, colKey: nextCol.key });
            }
          }
        } else if (shouldJump && editingRowIds.has(rowId)) {
          (e.target as HTMLElement).blur();
          setTimeout(() => {
            const cancelBtn = document.querySelector(
              `tr[data-row-id="${rowId}"] button[aria-label="Cancel edit"]`,
            ) as HTMLElement;
            if (cancelBtn) cancelBtn.focus();
          }, 0);
        }
      } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();

        let prevColIndex = colIndex - 1;
        const shouldJump = isInput && (e.key === 'Tab' || e.key === 'ArrowLeft');

        if (shouldJump) {
          while (prevColIndex >= 0 && !isKeyboardEditable(visibleColumns[prevColIndex])) {
            prevColIndex--;
          }
        }

        if (prevColIndex >= 0) {
          const prevCol = visibleColumns[prevColIndex];
          setFocusedCell({ rowId, colKey: prevCol.key });

          if (shouldJump) {
            (e.target as HTMLElement).blur();
            if (editingRowIds.has(rowId)) {
              setTimeout(() => {
                const el = document.getElementById(`cell-${rowId}-${prevCol.key}`);
                if (el) {
                  const focusable = el.querySelector(
                    'input, button, [tabindex="0"]',
                  ) as HTMLElement;
                  if (focusable) focusable.focus();
                }
              }, 0);
            } else {
              setEditingCell({ rowId, colKey: prevCol.key });
            }
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isInput) {
          const col = visibleColumns[colIndex];
          if (isKeyboardEditable(col)) {
            setEditingCell({ rowId, colKey });
          }
        }
      }
    },
    [
      focusedCell,
      editingRowIds,
      paginatedRows,
      visibleColumns,
      scrollWrapperRef,
      setFocusedCell,
      setEditingCell,
    ],
  );
}
