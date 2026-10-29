import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getConfirmPositionClasses, type ConfirmPositionSettings } from '../confirmPosition';
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

  // Escape cancels, like the browser's own confirm.
  useEffect(() => {
    if (!confirm) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      confirm.onCancel?.();
      onDismiss();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [confirm, onDismiss]);

  if (!confirm) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10050] bg-slate-900/55 animate-[fadeIn_0.15s_ease-out]"
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
