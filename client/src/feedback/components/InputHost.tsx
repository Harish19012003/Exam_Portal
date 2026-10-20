import { createPortal } from 'react-dom';
import { getInputPositionClasses, type InputPositionSettings } from '../inputPosition';
import { MODAL_BACKDROP } from '../feedbackTokens';
import type { InputItem } from '../types';
import { useIsMobileViewport } from './ToastPositionSettings';
import { InputModal } from './InputModal';

interface InputHostProps {
  input: InputItem | null;
  isDarkMode: boolean;
  inputPosition: InputPositionSettings;
  onDismiss: () => void;
}

export function InputHost({ input, isDarkMode, inputPosition, onDismiss }: InputHostProps) {
  const isMobile = useIsMobileViewport();
  const position = isMobile ? inputPosition.mobile : inputPosition.desktop;
  const positionClasses = getInputPositionClasses(position);

  if (!input) return null;

  return createPortal(
    <>
      <div
        className={MODAL_BACKDROP}
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className={`fixed z-[10051] w-full max-w-[min(100vw-2rem,420px)] pointer-events-none ${positionClasses}`}
      >
        <div className="pointer-events-auto">
          <InputModal input={input} isDarkMode={isDarkMode} onDismiss={onDismiss} />
        </div>
      </div>
    </>,
    document.body,
  );
}
