import { Trash2, X } from 'lucide-react';
import { isCustomConfirm } from '../confirmPresets';
import { ICON_VARIANT_TOKENS, modalActionButtonClass } from '../feedbackTokens';
import type { ConfirmItem } from '../types';

interface ConfirmModalProps {
  confirm: ConfirmItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

// Confirm dialogs follow the portal theme (CSS variables from index.css) so they match the other modals in light and dark.
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#5c43fa)]/40 focus-visible:ring-offset-1';
const BUTTON = `min-h-[44px] flex-1 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${FOCUS}`;
const CANCEL_BUTTON = `${BUTTON} border border-[var(--border-color,#e6e8eb)] bg-[var(--bg-card,#ffffff)] text-[var(--text-primary,#1e2022)] hover:bg-[var(--primary-light,#f0edff)]`;
const PRIMARY_BUTTON = `${BUTTON} bg-[var(--primary-color,#5c43fa)] text-white hover:bg-[var(--primary-hover,#4e39d4)]`;
const DANGER_BUTTON = `${BUTTON} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40`;

export function ConfirmModal({ confirm, isDarkMode, onDismiss }: ConfirmModalProps) {
  const styles = ICON_VARIANT_TOKENS[confirm.variant];
  const isDelete = confirm.name === 'confirm.delete';
  const Icon = isDelete ? Trash2 : styles.icon;
  const isCustom = isCustomConfirm(confirm.name);
  const customActions = confirm.actions?.length ? confirm.actions : null;

  const handleCancel = () => {
    confirm.onCancel?.();
    onDismiss();
  };

  const handleConfirm = () => {
    confirm.onConfirm?.();
    onDismiss();
  };

  const confirmBtnClass = confirm.confirmVariant === 'destructive' ? DANGER_BUTTON : PRIMARY_BUTTON;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`confirm-title-${confirm.id}`}
      className="w-full overflow-hidden rounded-[14px] border border-[var(--border-color,#e6e8eb)] bg-[var(--bg-card,#ffffff)] text-[var(--text-primary,#1e2022)] shadow-[0_24px_60px_rgba(15,23,42,0.35)] animate-[slideUp_0.2s_ease-out]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start gap-3.5 px-5 pt-5 pb-4">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl
            ${isDelete ? 'bg-red-500/10' : confirm.variant === 'info' ? 'bg-[var(--primary-light,#f0edff)]' : styles.iconBg}`}
        >
          <Icon
            className={`h-5 w-5 ${isDelete ? 'text-red-600' : confirm.variant === 'info' ? 'text-[var(--primary-color,#5c43fa)]' : styles.iconColor}`}
            strokeWidth={2.25}
          />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          {confirm.title && (
            <p id={`confirm-title-${confirm.id}`} className="text-[15px] font-semibold leading-snug">
              {confirm.title}
            </p>
          )}
          {confirm.message && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary,#747980)]">{confirm.message}</p>
          )}
          {(confirm.tertiary ?? confirm.description) && (
            <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary,#747980)] opacity-80">
              {confirm.tertiary ?? confirm.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className={`-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary,#747980)] transition-colors hover:bg-[var(--primary-light,#f0edff)] hover:text-[var(--text-primary,#1e2022)] ${FOCUS}`}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={`px-5 pb-5 flex gap-2 ${isCustom && customActions ? 'flex-wrap justify-end' : 'gap-3'}`}>
        {isCustom && customActions ? (
          customActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick?.();
                onDismiss();
              }}
              className={modalActionButtonClass(action, isDarkMode)}
            >
              {action.label}
            </button>
          ))
        ) : (
          <>
            <button type="button" autoFocus onClick={handleCancel} className={CANCEL_BUTTON}>
              {confirm.cancelLabel ?? 'Cancel'}
            </button>
            <button type="button" onClick={handleConfirm} className={confirmBtnClass}>
              {confirm.confirmLabel ?? 'Confirm'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
