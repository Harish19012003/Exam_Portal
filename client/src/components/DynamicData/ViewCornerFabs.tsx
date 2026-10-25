import type { ReactNode } from 'react';
import { Palette } from 'lucide-react';

/** Shared circular corner FAB styles (Feature Builder). */
export function cornerFabClass(isDarkMode: boolean, active: boolean): string {
  return `flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-colors duration-200
    active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13C296] focus-visible:ring-offset-2
    ${
      active
        ? isDarkMode
          ? 'border-[#13C296]/50 bg-[#13C296] text-white shadow-[#13C296]/30'
          : 'border-[#13C296] bg-[#13C296] text-white shadow-[#13C296]/25'
        : isDarkMode
          ? 'border-[#13C296]/30 bg-[#0B1E19]/95 text-[#13C296] shadow-black/40 hover:bg-[#13C296]/10 backdrop-blur-sm'
          : 'border-gray-200 bg-white/95 text-[#034033] shadow-gray-300/50 hover:border-[#13C296]/40 hover:bg-[#13C296]/5 backdrop-blur-sm'
    }`;
}

export interface DesignFooterButtonProps {
  isDarkMode: boolean;
  active: boolean;
  onClick: () => void;
  title?: string;
}

/** Design (palette) control for the view count footer. */
export function DesignFooterButton({
  isDarkMode,
  active,
  onClick,
  title = 'Design view',
}: DesignFooterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={active ? 'Close design panel' : 'Open design panel'}
      aria-expanded={active}
      data-tour-id="record-design-button"
      className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
        active
          ? 'text-[#13C296] bg-[#13C296]/10'
          : isDarkMode
            ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Palette className="w-3.5 h-3.5" />
    </button>
  );
}

/** @deprecated Prefer DesignFooterButton. */
export const DesignCornerFab = DesignFooterButton;
export type DesignCornerFabProps = DesignFooterButtonProps;

export interface ViewCornerFabStackProps {
  children: ReactNode;
  /** Keep fully visible while a panel is open. */
  expanded?: boolean;
}

/**
 * Docks Feature Builder on the browser window’s right edge: half-peek by default,
 * slides fully in on hover/focus (stays out while the panel is open).
 */
export function ViewCornerFabStack({ children, expanded = false }: ViewCornerFabStackProps) {
  return (
    <div
      className={`fixed bottom-8 right-0 z-40 flex flex-col-reverse items-center gap-2.5 print:hidden
        transition-transform duration-200 ease-out will-change-transform
        ${
          expanded
            ? 'translate-x-0'
            : 'translate-x-[22%] hover:translate-x-0 focus-within:translate-x-0'
        }`}
    >
      {children}
    </div>
  );
}
