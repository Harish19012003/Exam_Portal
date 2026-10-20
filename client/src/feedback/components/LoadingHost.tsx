import { createPortal } from 'react-dom';
import { isLoadingOverlay } from '../loadingPresets';
import { getLoadingPositionClasses, type LoadingPositionSettings } from '../loadingPosition';
import { OVERLAY_BACKDROP } from '../feedbackTokens';
import type { LoadingItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { LoadingIndicator } from './LoadingIndicator';

interface LoadingHostProps {
  loading: LoadingItem | null;
  isDarkMode: boolean;
  loadingPosition: LoadingPositionSettings;
  onDismiss: () => void;
}

export function LoadingHost({ loading, isDarkMode, loadingPosition, onDismiss }: LoadingHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? loadingPosition.mobile : loadingPosition.desktop;
  const positionClasses = getLoadingPositionClasses(position);

  if (!loading) return null;

  const overlay = isLoadingOverlay(loading.name);

  if (overlay) {
    return createPortal(
      <div className="fixed inset-0 z-[10090] flex items-center justify-center p-4">
        <div
          className={OVERLAY_BACKDROP}
          onClick={onDismiss}
          aria-hidden="true"
        />
        <div className="relative z-10 pointer-events-auto">
          <LoadingIndicator loading={loading} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed z-[10055] pointer-events-none max-w-[min(100vw-2rem,360px)] ${positionClasses}`}
    >
      <div className="pointer-events-auto">
        <LoadingIndicator loading={loading} isDarkMode={isDarkMode} onDismiss={onDismiss} />
      </div>
    </div>,
    document.body,
  );
}
