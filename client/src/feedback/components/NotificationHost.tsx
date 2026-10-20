import { createPortal } from 'react-dom';
import { isNotificationStack } from '../notificationPresets';
import { getNotificationPositionClasses, type NotificationPositionSettings } from '../notificationPosition';
import type { NotificationItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { NotificationCard } from './NotificationCard';
import { NotificationPanel } from './NotificationPanel';

interface NotificationHostProps {
  notifications: NotificationItem[];
  isDarkMode: boolean;
  notificationPosition: NotificationPositionSettings;
  onDismiss: (id: string) => void;
}

export function NotificationHost({
  notifications,
  isDarkMode,
  notificationPosition,
  onDismiss,
}: NotificationHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? notificationPosition.mobile : notificationPosition.desktop;
  const positionClasses = getNotificationPositionClasses(position);

  if (notifications.length === 0) return null;

  return createPortal(
    <div
      className={`fixed z-[10055] flex gap-3 pointer-events-none max-w-[min(100vw-2rem,380px)] ${positionClasses}`}
      aria-label="Notification feed"
    >
      {notifications.map(item => (
        <div key={item.id} className="pointer-events-auto w-full">
          {isNotificationStack(item.name) ? (
            <NotificationPanel notification={item} isDarkMode={isDarkMode} onDismiss={onDismiss} />
          ) : (
            <NotificationCard notification={item} isDarkMode={isDarkMode} onDismiss={onDismiss} />
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
