import { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import {
  actionButtonClass,
  dismissButtonClass,
  feedbackToastShell,
  ICON_VARIANT_TOKENS,
} from '../feedbackTokens';
import type { ToastItem } from '../types';

interface ToastCardProps {
  toast: ToastItem;
  isDarkMode: boolean;
  onDismiss: (id: string) => void;
}

export function ToastCard({ toast, isDarkMode, onDismiss }: ToastCardProps) {
  const styles = ICON_VARIANT_TOKENS[toast.variant];
  const Icon = styles.icon;
  const isUndo = toast.name === 'toast.undo' || toast.name === 'toast.undoEdit';
  const undoMs = toast.undoDuration ?? 15000;

  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isUndo) return;
    const interval = 50;
    const step = (interval / undoMs) * 100;
    const id = setInterval(() => setProgress(p => Math.max(0, p - step)), interval);
    return () => clearInterval(id);
  }, [isUndo, undoMs, toast.id]);

  useEffect(() => {
    if (toast.duration == null) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  const hasActions = (toast.actions?.length ?? 0) > 0 || isUndo;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col overflow-hidden rounded-xl border shadow-2xl min-w-[min(100vw-2rem,320px)] max-w-[420px]
        animate-[slideUp_0.25s_ease-out] ${feedbackToastShell(isDarkMode)}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-4 h-4 ${styles.iconColor}`} strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {toast.title && (
            <p className={`text-[13px] font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {toast.title}
            </p>
          )}
          {toast.message && (
            <p className={`text-[12px] mt-0.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {toast.message}
            </p>
          )}
          {(toast.tertiary ?? toast.description) && (
            <p className={`text-[11px] mt-1 leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {toast.tertiary ?? toast.description}
            </p>
          )}
        </div>

        {!hasActions && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className={dismissButtonClass(isDarkMode)}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {hasActions && (
        <div className={`flex items-center gap-2 px-4 pb-3 ${toast.actions?.length ? 'justify-end' : 'justify-between'}`}>
          {isUndo ? (
            <>
              <button
                type="button"
                onClick={() => {
                  toast.onUndo?.();
                  onDismiss(toast.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold
                  bg-[#13C296] hover:bg-[#0f9f7a] text-white transition-colors focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-[#13C296]/45`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className={dismissButtonClass(isDarkMode)}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            toast.actions?.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  action.onClick?.();
                  if (action.variant === 'secondary' || action.variant === 'primary') {
                    onDismiss(toast.id);
                  }
                }}
                className={actionButtonClass(action, isDarkMode)}
              >
                {action.label}
              </button>
            ))
          )}
        </div>
      )}

      {(isUndo || (toast.duration != null && toast.duration > 0)) && (
        <div className={`h-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div
            className={`h-full transition-all duration-50 ${styles.progress}`}
            style={{ width: isUndo ? `${progress}%` : '100%' }}
          />
        </div>
      )}
    </div>
  );
}
