export interface TableThemeTokens {
  bgCard: string;
  bgRow: string;
  bgRowHover: string;
  bgRowSelected: string;
  bgPinnedLeft: string;
  bgPinnedFooter: string;
  borderRow: string;
  selectedCellBg: string;
}

/** Exam Portal brand accents (purple) — replaces Option A teal defaults */
const ACCENT = {
  lightHover: 'hover:bg-[rgba(92,67,250,0.06)]',
  lightSelected: 'bg-[rgba(92,67,250,0.08)] border-l-2 border-l-[var(--primary-color,#5c43fa)]',
  // Opaque selected cell paints (sticky columns cannot use rgba — text bleeds through)
  lightSelectedCell: 'bg-[#ebe4ff]',
  darkHover: 'hover:bg-gray-800/60',
  darkSelected: 'bg-[rgba(124,58,237,0.18)] border-l-2 border-l-[var(--primary-color,#7c3aed)]',
  darkSelectedCell: 'bg-[#2e1065]',
};

const STICKY_BG = {
  light: '#ffffff',
  lightHover: '#f3f0ff',
  lightSelected: '#ebe4ff',
  lightSubRow: '#f5f3ff',
  dark: '#111827',
  darkHover: '#1f2937',
  darkSelected: '#2e1065',
  darkSubRow: '#1e1b4b',
};

export function getTableTheme(isDarkMode: boolean): TableThemeTokens {
  return {
    bgCard: isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200',
    bgRow: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgRowHover: isDarkMode ? ACCENT.darkHover : ACCENT.lightHover,
    bgRowSelected: isDarkMode ? ACCENT.darkSelected : ACCENT.lightSelected,
    bgPinnedLeft: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgPinnedFooter: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    borderRow: isDarkMode ? 'border-gray-800/70' : 'border-gray-100',
    selectedCellBg: isDarkMode ? ACCENT.darkSelectedCell : ACCENT.lightSelectedCell,
  };
}

export function getStickyCellBackground(
  isDarkMode: boolean,
  options?: { isSubRow?: boolean; isSelected?: boolean },
): string {
  if (options?.isSubRow) {
    return isDarkMode ? STICKY_BG.darkSubRow : STICKY_BG.lightSubRow;
  }
  if (options?.isSelected) {
    return isDarkMode ? STICKY_BG.darkSelected : STICKY_BG.lightSelected;
  }
  return isDarkMode ? STICKY_BG.dark : STICKY_BG.light;
}

export type StickySide = 'left' | 'right';

/** Class names from stickyCells.css — opaque fills + curtain shadows */
export function getStickyCellClassName(
  side: StickySide,
  options?: { isSelected?: boolean },
): string {
  return [
    'dt-sticky-cell',
    side === 'right' ? 'dt-sticky-cell--right' : 'dt-sticky-cell--left',
    options?.isSelected ? 'dt-sticky-cell--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
