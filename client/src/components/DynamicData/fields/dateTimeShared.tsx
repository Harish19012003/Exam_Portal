import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { fieldInputClass } from '../../../shared/fields/fieldStyles';
import type { DynamicDateTimeBaseProps } from './dateTimeTypes';

/** Above record sidebar (z-50) and other app overlays */
export const DATETIME_PORTAL_Z = 100050;

export function dateTimeTriggerClass(isDarkMode: boolean, variant: DynamicDateTimeBaseProps['variant']) {
  if (variant === 'form') {
    return `${fieldInputClass(isDarkMode, 'default', { compact: true })} flex items-center justify-between cursor-pointer min-h-[34px] gap-2`;
  }
  return `${fieldInputClass(isDarkMode, 'default', { compact: true, variant: 'editor' })} flex items-center justify-between cursor-pointer min-h-[34px] gap-2`;
}

export function dateTimeSelectClass(isDarkMode: boolean) {
  return `flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-md border outline-none
    ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-800'}`;
}

export interface PortalPlacement {
  left: number;
  width: number;
  /** Anchor popup top edge below the field */
  top?: number;
  /** Anchor popup bottom edge above the field */
  bottom?: number;
  /** When set, caps panel height and may enable scroll */
  maxHeight?: number;
  scrollable: boolean;
}

export interface PortalPlacementOptions {
  /** Size panel to full content; avoid scroll unless viewport is too small */
  fitContent?: boolean;
}

export function computePortalPlacement(
  rect: DOMRect,
  minMenuWidth: number,
  estimatedHeight: number,
  options?: PortalPlacementOptions,
): PortalPlacement {
  const margin = 12;
  const gap = 4;
  const width = Math.max(rect.width, minMenuWidth);
  const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
  const viewportMax = window.innerHeight - margin * 2;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  if (options?.fitContent) {
    const fitsBelow = spaceBelow >= estimatedHeight;
    const fitsAbove = spaceAbove >= estimatedHeight;

    // Prefer opening below the field (standard dropdown)
    if (fitsBelow) {
      return { top: rect.bottom + gap, left, width, scrollable: false };
    }
    // Anchor bottom edge to field top — no gap from overestimated height
    if (fitsAbove) {
      return { bottom: window.innerHeight - rect.top + gap, left, width, scrollable: false };
    }

    // Not enough room on either side — center in viewport
    if (estimatedHeight <= viewportMax) {
      return {
        top: Math.max(margin, (window.innerHeight - estimatedHeight) / 2),
        left,
        width,
        scrollable: false,
      };
    }

    // Very small viewport — only then allow internal scroll
    return {
      top: margin,
      left,
      width,
      maxHeight: viewportMax,
      scrollable: true,
    };
  }

  const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(180, Math.min(estimatedHeight, available));
  const scrollable = maxHeight < estimatedHeight;

  if (openUp) {
    return {
      bottom: window.innerHeight - rect.top + gap,
      left,
      width,
      maxHeight,
      scrollable,
    };
  }

  return { top: rect.bottom + gap, left, width, maxHeight, scrollable };
}

export function useDateTimePortal(defaultOpen: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Never start open without a measured rect — portal renders only when `isOpen && rect`.
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreBackdropUntilRef = useRef(0);
  const didAutoOpenRef = useRef(false);

  const openMenu = () => {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    ignoreBackdropUntilRef.current = Date.now();
    setIsOpen(true);
  };

  // Double-click / autoFocus editors pass defaultOpen — open after layout so rect exists.
  useLayoutEffect(() => {
    if (!defaultOpen || didAutoOpenRef.current) return;
    didAutoOpenRef.current = true;
    openMenu();
  }, [defaultOpen]);

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu(true);
    } else {
      openMenu();
    }
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      setTimeout(() => {
        const trigger = containerRef.current?.querySelector('[data-datetime-trigger]') as HTMLElement | null;
        trigger?.focus();
      }, 0);
    }
  };

  const shouldIgnoreBackdrop = () => Date.now() - ignoreBackdropUntilRef.current < 250;

  return { rect, isOpen, containerRef, openMenu, toggleMenu, closeMenu, shouldIgnoreBackdrop };
}

interface DateTimePortalShellProps {
  portalClass: string;
  rect: DOMRect;
  isDarkMode: boolean;
  minMenuWidth: number;
  estimatedHeight: number;
  fitContent?: boolean;
  onBackdropClose: () => void;
  children: React.ReactNode;
}

export function DateTimePortalShell({
  portalClass,
  rect,
  isDarkMode,
  minMenuWidth,
  estimatedHeight,
  fitContent = false,
  onBackdropClose,
  children,
}: DateTimePortalShellProps) {
  const placement = computePortalPlacement(rect, minMenuWidth, estimatedHeight, { fitContent });
  const panelBg = isDarkMode ? 'bg-[#0B1E19] border-gray-700' : 'bg-white border-gray-200';

  return createPortal(
    <div
      className={`${portalClass} fixed`}
      style={{
        zIndex: DATETIME_PORTAL_Z,
        left: placement.left,
        width: placement.width,
        ...(placement.top != null ? { top: placement.top } : {}),
        ...(placement.bottom != null ? { bottom: placement.bottom } : {}),
      }}
    >
      <div
        className="fixed inset-0"
        style={{ zIndex: 0 }}
        onMouseDown={e => { e.stopPropagation(); onBackdropClose(); }}
      />
      <div
        className={`relative rounded-xl border shadow-xl overflow-hidden ${panelBg}`}
        style={{ zIndex: 1, ...(placement.maxHeight ? { maxHeight: placement.maxHeight } : undefined) }}
        onMouseDown={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        {placement.scrollable ? (
          <div className="overflow-y-auto overscroll-contain max-h-[inherit] custom-scrollbar p-3">
            {children}
          </div>
        ) : (
          <div className="p-3">{children}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface DateTimeTriggerProps {
  isDarkMode: boolean;
  variant: DynamicDateTimeBaseProps['variant'];
  display: string;
  placeholder: string;
  disabled?: boolean;
  isOpen: boolean;
  onOpen: () => void;
}

export function DateTimeTrigger({
  isDarkMode,
  variant,
  display,
  placeholder,
  disabled,
  isOpen,
  onOpen,
}: DateTimeTriggerProps) {
  return (
    <div
      data-datetime-trigger
      className={`${dateTimeTriggerClass(isDarkMode, variant)} select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={isOpen}
      onKeyDown={e => {
        if (disabled) return;
        if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation();
        if (!disabled && !isOpen) onOpen();
      }}
    >
      <span className="flex items-center gap-2 min-w-0 flex-1">
        <CalendarDays className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}`} />
        <span className="truncate select-none">{display || placeholder}</span>
      </span>
      <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
    </div>
  );
}
