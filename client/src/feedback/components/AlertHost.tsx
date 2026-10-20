import { createPortal } from 'react-dom';
import { getAlertPositionClasses, type AlertPositionSettings } from '../alertPosition';
import { MODAL_BACKDROP } from '../feedbackTokens';
import type { AlertItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { AlertModal } from './AlertModal';

interface AlertHostProps {
  alert: AlertItem | null;
  isDarkMode: boolean;
  alertPosition: AlertPositionSettings;
  onDismiss: () => void;
}

export function AlertHost({ alert, isDarkMode, alertPosition, onDismiss }: AlertHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? alertPosition.mobile : alertPosition.desktop;
  const positionClasses = getAlertPositionClasses(position);

  if (!alert) return null;

  return createPortal(
    <>
      <div
        className={MODAL_BACKDROP}
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className={`fixed z-[10051] w-full max-w-[min(100vw-2rem,400px)] pointer-events-none ${positionClasses}`}
      >
        <div className="pointer-events-auto">
          <AlertModal alert={alert} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      </div>
    </>,
    document.body,
  );
}
