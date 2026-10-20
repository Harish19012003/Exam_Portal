import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TooltipItem } from '../types';
import { TooltipContent } from './TooltipContent';

const CURSOR_OFFSET_X = 14;
const CURSOR_OFFSET_Y = 18;
const VIEWPORT_PAD = 8;

interface TooltipHostProps {
  tooltip: TooltipItem | null;
  isDarkMode: boolean;
}

function initialCoords(tooltip: TooltipItem | null): { left: number; top: number } | null {
  if (tooltip?.anchorX == null || tooltip?.anchorY == null) return null;
  return {
    left: tooltip.anchorX + CURSOR_OFFSET_X,
    top: tooltip.anchorY + CURSOR_OFFSET_Y,
  };
}

function useCursorTooltipPosition(tooltip: TooltipItem | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(() =>
    initialCoords(tooltip),
  );

  useLayoutEffect(() => {
    const next = initialCoords(tooltip);
    if (!next) {
      setCoords(null);
      return;
    }

    const el = ref.current;
    if (!el) {
      setCoords(next);
      return;
    }

    const { width, height } = el.getBoundingClientRect();
    const anchorX = tooltip!.anchorX!;
    const anchorY = tooltip!.anchorY!;
    let { left, top } = next;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + width > vw - VIEWPORT_PAD) {
      left = anchorX - width - CURSOR_OFFSET_X;
    }
    if (top + height > vh - VIEWPORT_PAD) {
      top = anchorY - height - CURSOR_OFFSET_Y;
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;

    setCoords({ left, top });
  }, [tooltip?.anchorX, tooltip?.anchorY, tooltip?.name, tooltip?.message, tooltip?.title]);

  return { ref, coords };
}

export function TooltipHost({ tooltip, isDarkMode }: TooltipHostProps) {
  const { ref, coords } = useCursorTooltipPosition(tooltip);

  if (!tooltip || coords == null) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[10070] pointer-events-none max-w-[min(100vw-2rem,320px)]"
      style={{ left: coords.left, top: coords.top }}
    >
      <TooltipContent tooltip={tooltip} isDarkMode={isDarkMode} />
    </div>,
    document.body,
  );
}
