import { createPortal } from 'react-dom';
import { useIsMobileViewport } from './ToastPositionSettings';
import { getToastPositionClasses, type ToastPositionSettings } from '../toastPosition';
import type { ToastItem } from '../types';
import { ToastCard } from './ToastCard';

interface ToastHostProps {
  toasts: ToastItem[];
  isDarkMode: boolean;
  toastPosition: ToastPositionSettings;
  onDismiss: (id: string) => void;
}

export function ToastHost({ toasts, isDarkMode, toastPosition, onDismiss }: ToastHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? toastPosition.mobile : toastPosition.desktop;
  const positionClasses = getToastPositionClasses(position);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className={`fixed z-[10060] flex gap-3 pointer-events-none max-w-[min(100vw-2rem,420px)] ${positionClasses}`}
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto w-full">
          <ToastCard toast={toast} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
