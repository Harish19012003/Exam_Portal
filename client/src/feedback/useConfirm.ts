import { useCallback, useRef } from 'react';
import { useFeedback } from './FeedbackProvider';

export interface ConfirmOptions {
  title?: string;
  message: string;
  /** Smaller second line, e.g. what is NOT affected or that it cannot be undone. */
  tertiary?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red delete-style dialog and button. Use for anything that removes data or lowers security. */
  destructive?: boolean;
}

/**
 * Promise-based replacement for window.confirm, shown with the app's own confirm dialog.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete group?', message: '…', destructive: true }))) return;
 *
 * Resolves true on confirm; false on Cancel, the X, Escape, a click outside, or when a newer prompt replaces it.
 */
export function useConfirm() {
  const { show } = useFeedback();
  const pending = useRef<((ok: boolean) => void) | null>(null);

  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        pending.current?.(false);
        pending.current = resolve;
        const done = (ok: boolean) => {
          if (pending.current === resolve) pending.current = null;
          resolve(ok);
        };
        show(options.destructive ? 'confirm.delete' : 'confirm.default', {
          title: options.title ?? (options.destructive ? 'Are you sure?' : 'Confirm action'),
          message: options.message,
          // The presets carry generic second lines ("can be reversed later"); only show what the caller says is true.
          tertiary: options.tertiary ?? (options.destructive ? 'This action cannot be undone.' : ''),
          confirmLabel: options.confirmLabel ?? (options.destructive ? 'Delete' : 'Confirm'),
          cancelLabel: options.cancelLabel ?? 'Cancel',
          onConfirm: () => done(true),
          onCancel: () => done(false),
        });
      }),
    [show],
  );
}
