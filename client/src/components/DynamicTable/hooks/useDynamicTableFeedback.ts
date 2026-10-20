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
  showBulkConfirm: boolean;
  setShowBulkConfirm: (value: boolean) => void;
  handleDeleteSelected: () => void;
  selectedRows: Set<string>;
}

export function useDynamicTableFeedback(state: DynamicTableFeedbackState) {
  const feedback = useFeedback();
  const undoDeleteToastRef = useRef<string | null>(null);
  const undoEditToastRef = useRef<string | null>(null);
  const bulkConfirmIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!state.showBulkConfirm) {
      if (bulkConfirmIdRef.current) {
        feedback.dismiss(bulkConfirmIdRef.current);
        bulkConfirmIdRef.current = null;
      }
      return;
    }

    if (bulkConfirmIdRef.current) return;

    const count = state.selectedRows.size;
    const id = feedback.show('confirm.delete', {
      title: `Delete ${count} ${count === 1 ? 'row' : 'rows'}?`,
      message: `This will permanently remove ${count} selected ${count === 1 ? 'row' : 'rows'}.`,
      tertiary: 'This action cannot be undone.',
      confirmLabel: count === 1 ? 'Delete row' : `Delete ${count} rows`,
      onConfirm: () => state.handleDeleteSelected(),
      onCancel: () => state.setShowBulkConfirm(false),
    });
    bulkConfirmIdRef.current = id ?? null;
  }, [
    state.showBulkConfirm,
    state.selectedRows.size,
    feedback,
    state.handleDeleteSelected,
    state.setShowBulkConfirm,
  ]);

  return { showSuccess, showNotice };
}
