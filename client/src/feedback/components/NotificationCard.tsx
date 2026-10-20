import { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  actionButtonClass,
  dismissButtonClass,
  feedbackToastShell,
  ICON_VARIANT_TOKENS,
} from '../feedbackTokens';
import type { NotificationItem } from '../types';

interface NotificationCardProps {
  notification: NotificationItem;
  isDarkMode: boolean;
  onDismiss: (id: string) => void;
}

export function NotificationCard({ notification, isDarkMode, onDismiss }: NotificationCardProps) {
  const unread = notification.unread === true;
  const variant = notification.variant ?? 'info';
  const styles = ICON_VARIANT_TOKENS[variant];
  const Icon = styles.icon;

  useEffect(() => {
    if (notification.duration == null) return;
    const t = setTimeout(() => onDismiss(notification.id), notification.duration);
    return () => clearTimeout(t);
  }, [notification.id, notification.duration, onDismiss]);

  const titleCls = unread
    ? isDarkMode ? 'text-white font-bold' : 'text-gray-900 font-bold'
    : isDarkMode ? 'text-gray-200 font-semibold' : 'text-gray-800 font-semibold';
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div
      role="status"
      className={`relative w-full min-w-[min(100vw-2rem,340px)] max-w-[380px] rounded-xl border shadow-xl overflow-hidden animate-[slideUp_0.2s_ease-out] ${feedbackToastShell(isDarkMode)}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${styles.notificationAccent}`} />

      <div className="flex items-start gap-3 px-4 py-3 pl-5">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${styles.notificationIconBg}`}>
            <Icon className={`w-4 h-4 ${styles.notificationIconColor}`} strokeWidth={2.5} />
          </div>
          {unread && (
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${styles.notificationAccent}
                ${isDarkMode ? 'border-gray-800' : 'border-white'}`}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {notification.title && (
              <p className={`text-[13px] leading-snug ${titleCls}`}>{notification.title}</p>
            )}
            {notification.timestamp && (
              <span className={`text-[10px] flex-shrink-0 ${muted}`}>{notification.timestamp}</span>
            )}
          </div>
          {notification.message && (
            <p className={`text-[12px] mt-1 leading-relaxed ${muted}`}>{notification.message}</p>
          )}
          {(notification.tertiary ?? notification.description) && (
            <p className={`text-[11px] mt-1 ${muted} opacity-80`}>
              {notification.tertiary ?? notification.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className={`${dismissButtonClass(isDarkMode)} !p-1`}
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {(notification.actions?.length ?? 0) > 0 && (
        <div className={`px-4 pb-3 pl-5 flex flex-wrap gap-2 justify-end border-t pt-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          {notification.actions!.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick?.();
                onDismiss(notification.id);
              }}
              className={`${actionButtonClass(action, isDarkMode)} !px-2.5 !py-1 !text-[11px] !rounded-md`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
