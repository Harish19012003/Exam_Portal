import { Trash2, X } from 'lucide-react';
import { isCustomConfirm } from '../confirmPresets';
import {
  destructiveButtonClass,
  dismissButtonClass,
  feedbackModalShell,
  getConfirmAccentBar,
  getConfirmModalAccent,
  ICON_VARIANT_TOKENS,
  modalActionButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../feedbackTokens';
import type { ConfirmItem } from '../types';

interface ConfirmModalProps {
  confirm: ConfirmItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

export function ConfirmModal({ confirm, isDarkMode, onDismiss }: ConfirmModalProps) {
  const styles = ICON_VARIANT_TOKENS[confirm.variant];
  const Icon = confirm.name === 'confirm.delete' ? Trash2 : styles.icon;
  const isCustom = isCustomConfirm(confirm.name);
  const customActions = confirm.actions?.length ? confirm.actions : null;
  const modalAccent = getConfirmModalAccent(confirm.name, confirm.variant);
  const accentBar = getConfirmAccentBar(confirm.name, confirm.variant);

  const handleCancel = () => {
    confirm.onCancel?.();
    onDismiss();
  };

  const handleConfirm = () => {
    confirm.onConfirm?.();
    onDismiss();
  };

  const confirmBtnClass =
    confirm.confirmVariant === 'destructive'
      ? destructiveButtonClass('flex-1')
      : primaryButtonClass('flex-1');

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`confirm-title-${confirm.id}`}
      className={`w-full rounded-2xl border shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]
        ${feedbackModalShell(isDarkMode, modalAccent)}`}
      onClick={e => e.stopPropagation()}
    >
      {accentBar && <div className={`h-1 ${accentBar}`} />}

      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}
            ${confirm.name === 'confirm.delete' ? 'ring-2 ring-red-500/20' : ''}`}
        >
          <Icon className={`w-5 h-5 ${styles.iconColor}`} strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {confirm.title && (
            <p
              id={`confirm-title-${confirm.id}`}
              className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}
                ${confirm.name === 'confirm.delete' ? (isDarkMode ? 'text-red-100' : 'text-red-950') : ''}`}
            >
              {confirm.title}
            </p>
          )}
          {confirm.message && (
            <p className={`text-[13px] mt-1.5 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {confirm.message}
            </p>
          )}
          {(confirm.tertiary ?? confirm.description) && (
            <p
              className={`text-[12px] mt-2 leading-snug
                ${confirm.name === 'confirm.delete'
                  ? isDarkMode ? 'text-red-300/80' : 'text-red-600/90'
                  : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
            >
              {confirm.tertiary ?? confirm.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className={dismissButtonClass(isDarkMode)}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
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
            <button
              type="button"
              onClick={handleCancel}
              className={secondaryButtonClass(isDarkMode, 'flex-1')}
            >
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
