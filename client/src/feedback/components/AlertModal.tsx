import { X } from 'lucide-react';
import {
  dismissButtonClass,
  feedbackModalShell,
  ICON_VARIANT_TOKENS,
  primaryButtonClass,
} from '../feedbackTokens';
import type { AlertItem } from '../types';

interface AlertModalProps {
  alert: AlertItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

export function AlertModal({ alert, isDarkMode, onDismiss }: AlertModalProps) {
  const styles = ICON_VARIANT_TOKENS[alert.variant];
  const Icon = styles.icon;

  const handleOk = () => {
    alert.onOk?.();
    onDismiss();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`alert-title-${alert.id}`}
      className={`w-full rounded-2xl border shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]
        ${feedbackModalShell(isDarkMode)}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-5 h-5 ${styles.iconColor}`} strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {alert.title && (
            <p
              id={`alert-title-${alert.id}`}
              className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
            >
              {alert.title}
            </p>
          )}
          {alert.message && (
            <p className={`text-[13px] mt-1.5 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {alert.message}
            </p>
          )}
          {(alert.tertiary ?? alert.description) && (
            <p className={`text-[12px] mt-2 leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {alert.tertiary ?? alert.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className={dismissButtonClass(isDarkMode)}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 pb-5 flex justify-end">
        <button type="button" onClick={handleOk} className={primaryButtonClass('min-w-[88px]')}>
          {alert.okLabel ?? 'OK'}
        </button>
      </div>
    </div>
  );
}
