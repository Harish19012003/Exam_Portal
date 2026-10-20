import { createPortal } from 'react-dom';
import { getConfirmPositionClasses, type ConfirmPositionSettings } from '../confirmPosition';
import { MODAL_BACKDROP } from '../feedbackTokens';
import type { ConfirmItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { ConfirmModal } from './ConfirmModal';

interface ConfirmHostProps {
  confirm: ConfirmItem | null;
  isDarkMode: boolean;
  confirmPosition: ConfirmPositionSettings;
  onDismiss: () => void;
}

export function ConfirmHost({ confirm, isDarkMode, confirmPosition, onDismiss }: ConfirmHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? confirmPosition.mobile : confirmPosition.desktop;
  const positionClasses = getConfirmPositionClasses(position);

  if (!confirm) return null;

  return createPortal(
    <>
      <div
        className={MODAL_BACKDROP}
        onClick={() => {
          confirm.onCancel?.();
          onDismiss();
        }}
        aria-hidden="true"
      />
      <div
        className={`fixed z-[10051] w-full max-w-[min(100vw-2rem,400px)] pointer-events-none ${positionClasses}`}
      >
        <div className="pointer-events-auto">
          <ConfirmModal confirm={confirm} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      </div>
    </>,
    document.body,
  );
}
