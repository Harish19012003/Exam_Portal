import { createPortal } from 'react-dom';
import { getPopupPositionClasses, type PopupPositionSettings } from '../popupPosition';
import type { PopupItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { PopupContent } from './PopupContent';

interface PopupHostProps {
  popup: PopupItem | null;
  isDarkMode: boolean;
  popupPosition: PopupPositionSettings;
  onDismiss: () => void;
}

export function PopupHost({ popup, isDarkMode, popupPosition, onDismiss }: PopupHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? popupPosition.mobile : popupPosition.desktop;
  const positionClasses = getPopupPositionClasses(position);

  if (!popup) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10045] bg-transparent"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className={`fixed z-[10046] pointer-events-none max-w-[min(100vw-2rem,360px)] ${positionClasses}`}
      >
        <div className="pointer-events-auto">
          <PopupContent popup={popup} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      </div>
    </>,
    document.body,
  );
}
