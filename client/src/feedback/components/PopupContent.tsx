import { X } from 'lucide-react';
import {
  actionButtonClass,
  dismissButtonClass,
  feedbackModalShell,
} from '../feedbackTokens';
import { getPopupKind } from '../popupPresets';
import type { PopupItem } from '../types';

interface PopupContentProps {
  popup: PopupItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

export function PopupContent({ popup, isDarkMode, onDismiss }: PopupContentProps) {
  const kind = getPopupKind(popup.name);
  const shell = feedbackModalShell(isDarkMode);

  if (kind === 'menu') {
    return (
      <div
        role="menu"
        className={`min-w-[180px] rounded-xl border overflow-hidden shadow-xl animate-[slideUp_0.15s_ease-out] ${shell}`}
      >
        {popup.title && (
          <div className={`px-3 py-2 border-b text-[11px] font-bold uppercase tracking-wide ${isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
            {popup.title}
          </div>
        )}
        <div className="py-1">
          {popup.menuItems?.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick?.();
                onDismiss();
              }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors
                ${item.variant === 'destructive'
                  ? 'text-red-500 hover:bg-red-500/10'
                  : isDarkMode
                    ? 'text-gray-200 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-50'}
                focus-visible:outline-none focus-visible:bg-[#13C296]/10`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      className={`w-full min-w-[min(100vw-2rem,320px)] max-w-[360px] rounded-2xl border overflow-hidden shadow-xl animate-[slideUp_0.2s_ease-out] ${shell}`}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          {popup.title && (
            <p className={`text-[14px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {popup.title}
            </p>
          )}
          {popup.message && (
            <p className={`text-[13px] mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {popup.message}
            </p>
          )}
          {(popup.tertiary ?? popup.description) && (
            <p className={`text-[11px] mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {popup.tertiary ?? popup.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`${dismissButtonClass(isDarkMode)} !p-1`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {(popup.actions?.length ?? 0) > 0 && (
        <div className={`px-4 pb-4 flex gap-2 justify-end border-t pt-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          {popup.actions!.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick?.();
                onDismiss();
              }}
              className={actionButtonClass(action, isDarkMode)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
