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
  lightSelectedCell: 'bg-[rgba(92,67,250,0.08)]',
  darkHover: 'hover:bg-gray-800/60',
  darkSelected: 'bg-[rgba(124,58,237,0.18)] border-l-2 border-l-[var(--primary-color,#7c3aed)]',
  darkSelectedCell: 'bg-[rgba(124,58,237,0.18)]',
};

export function getTableTheme(isDarkMode: boolean): TableThemeTokens {
  return {
    bgCard: isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200',
    bgRow: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgRowHover: isDarkMode ? ACCENT.darkHover : ACCENT.lightHover,
    bgRowSelected: isDarkMode ? ACCENT.darkSelected : ACCENT.lightSelected,
    bgPinnedLeft: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgPinnedFooter: isDarkMode ? 'bg-gray-900' : 'bg-gray-50/95',
    borderRow: isDarkMode ? 'border-gray-800/70' : 'border-gray-100',
    selectedCellBg: isDarkMode ? ACCENT.darkSelectedCell : ACCENT.lightSelectedCell,
  };
}

export function getStickyCellBackground(
  isDarkMode: boolean,
  options?: { isSubRow?: boolean },
): string {
  if (options?.isSubRow) {
    return isDarkMode ? '#1e1b4b' : '#f5f3ff';
  }
  return isDarkMode ? '#111827' : '#ffffff';
}
