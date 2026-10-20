import { Bell, X } from 'lucide-react';
import { dismissButtonClass, feedbackToastShell, ICON_VARIANT_TOKENS } from '../feedbackTokens';
import type { NotificationEntry, NotificationItem } from '../types';

interface NotificationPanelProps {
  notification: NotificationItem;
  isDarkMode: boolean;
  onDismiss: (id: string) => void;
}

export function NotificationPanel({ notification, isDarkMode, onDismiss }: NotificationPanelProps) {
  const items = notification.items ?? [];
  const infoStyles = ICON_VARIANT_TOKENS.info;

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className={`w-full min-w-[min(100vw-2rem,340px)] max-w-[380px] rounded-xl border shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out] ${feedbackToastShell(isDarkMode)}`}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <Bell className={`w-4 h-4 ${infoStyles.notificationIconColor}`} strokeWidth={2.5} />
          <h3 className={`text-[14px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {notification.title ?? 'Notifications'}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className={`${dismissButtonClass(isDarkMode)} !p-1`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        {items.map((entry, i) => (
          <StackRow key={i} entry={entry} isDarkMode={isDarkMode} isLast={i === items.length - 1} />
        ))}
      </div>
    </div>
  );
}

function StackRow({
  entry,
  isDarkMode,
  isLast,
}: {
  entry: NotificationEntry;
  isDarkMode: boolean;
  isLast: boolean;
}) {
  const unread = entry.unread === true;
  const border = !isLast ? (isDarkMode ? 'border-b border-gray-700' : 'border-b border-gray-100') : '';
  const titleCls = unread
    ? isDarkMode ? 'text-white font-bold' : 'text-gray-900 font-bold'
    : isDarkMode ? 'text-gray-300 font-medium' : 'text-gray-700 font-medium';

  return (
    <div className={`px-4 py-3 flex gap-3 ${border}`}>
      <div className="pt-1.5 flex-shrink-0">
        {unread ? (
          <span className="block w-2 h-2 rounded-full bg-[#13C296]" />
        ) : (
          <span className={`block w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] ${titleCls}`}>{entry.title}</p>
          {entry.timestamp && (
            <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {entry.timestamp}
            </span>
          )}
        </div>
        {entry.message && (
          <p className={`text-[12px] mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {entry.message}
          </p>
        )}
      </div>
    </div>
  );
}
