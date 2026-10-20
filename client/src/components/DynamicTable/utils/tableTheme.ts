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

export function getTableTheme(isDarkMode: boolean): TableThemeTokens {
  return {
    bgCard: isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200',
    bgRow: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgRowHover: isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-[#f0fdf9]/60',
    bgRowSelected: isDarkMode
      ? 'bg-[#0B1E19]/70 border-l-2 border-l-[#13C296]'
      : 'bg-[#f0fdf9] border-l-2 border-l-[#13C296]',
    bgPinnedLeft: isDarkMode ? 'bg-gray-900' : 'bg-white',
    bgPinnedFooter: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    borderRow: isDarkMode ? 'border-gray-800/60' : 'border-gray-100',
    selectedCellBg: isDarkMode ? 'bg-[#0B1E19]/70' : 'bg-[#f0fdf9]',
  };
}
