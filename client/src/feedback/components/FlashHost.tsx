import { createPortal } from 'react-dom';
import {
  getFlashInnerAlign,
  getFlashPositionClasses,
  type FlashPositionSettings,
} from '../flashPosition';
import type { FlashItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { FlashBanner } from './FlashBanner';

interface FlashHostProps {
  flashes: FlashItem[];
  isDarkMode: boolean;
  flashPosition: FlashPositionSettings;
  onDismiss: (id: string) => void;
}

export function FlashHost({ flashes, isDarkMode, flashPosition, onDismiss }: FlashHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? flashPosition.mobile : flashPosition.desktop;
  const positionClasses = getFlashPositionClasses(position);
  const innerAlign = getFlashInnerAlign(position);

  if (flashes.length === 0) return null;

  return createPortal(
    <div
      className={`fixed z-[10080] flex gap-0 pointer-events-none w-full ${positionClasses}`}
      aria-label="Page banners"
    >
      {flashes.map(flash => (
        <div key={flash.id} className="pointer-events-auto w-full">
          <FlashBanner
            flash={flash}
            innerAlign={innerAlign}
            isDarkMode={isDarkMode}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>,
    document.body,
  );
}
