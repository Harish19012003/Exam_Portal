import { useCallback, useEffect, useRef } from 'react';
import { useFeedback } from '../../../feedback';
import type { PendingDelete, PendingEdit } from '../types';

export interface DynamicTableFeedbackState {
  pendingDelete: PendingDelete | null;
  setPendingDelete: (value: PendingDelete | null) => void;
  handleUndoDelete: () => void;
  pendingEdit: PendingEdit | null;
  setPendingEdit: (value: PendingEdit | null) => void;
  handleUndoEdit: () => void;
  /** Bulk delete confirm is owned by BulkDeleteModal in DynamicTable (Selected/Filtered/All). */
  showBulkConfirm?: boolean;
  setShowBulkConfirm?: (value: boolean) => void;
  handleDeleteSelected?: (explicitIds?: string[]) => void;
  selectedRows?: Set<string>;
}

export function useDynamicTableFeedback(state: DynamicTableFeedbackState) {
  const feedback = useFeedback();
  const undoDeleteToastRef = useRef<string | null>(null);
  const undoEditToastRef = useRef<string | null>(null);

  const showSuccess = useCallback(
    (message: string, title = 'Success') => {
      feedback.show('toast.success', { title, message, duration: 3000 });
    },
    [feedback],
  );

  const showNotice = useCallback(
    (message: string, title = 'Notice') => {
      feedback.show('toast.warning', { title, message, duration: 4000 });
    },
    [feedback],
  );

  useEffect(() => {
    if (!state.pendingDelete) {
      if (undoDeleteToastRef.current) {
        feedback.dismiss(undoDeleteToastRef.current);
        undoDeleteToastRef.current = null;
      }
      return;
    }

    if (undoDeleteToastRef.current) {
      feedback.dismiss(undoDeleteToastRef.current);
    }

    const id = feedback.show('toast.undo', {
      onUndo: () => state.handleUndoDelete(),
      onDismiss: () => state.setPendingDelete(null),
    });
    undoDeleteToastRef.current = id ?? null;
  }, [state.pendingDelete?.rowId, feedback, state.handleUndoDelete, state.setPendingDelete]);

  useEffect(() => {
    if (!state.pendingEdit) {
      if (undoEditToastRef.current) {
        feedback.dismiss(undoEditToastRef.current);
        undoEditToastRef.current = null;
      }
      return;
    }

    if (undoEditToastRef.current) {
      feedback.dismiss(undoEditToastRef.current);
    }

    const count = state.pendingEdit.originalRows.length;
    const id = feedback.show('toast.undoEdit', {
      title: count === 1 ? 'Row updated' : `${count} rows updated`,
      onUndo: () => state.handleUndoEdit(),
      onDismiss: () => state.setPendingEdit(null),
    });
    undoEditToastRef.current = id ?? null;
  }, [state.pendingEdit?.id, feedback, state.handleUndoEdit, state.setPendingEdit]);

  return { showSuccess, showNotice };
}
