// Shared count footer for List / Card / Kanban / Tree / Calendar.
import type { ReactNode } from 'react';

export interface ViewCountFooterProps {
  isDarkMode: boolean;
  filteredCount: number;
  totalCount: number;
  /** When set, shows "· filtered" if the visible set is narrowed. */
  search?: string;
  extras?: ReactNode;
}

export function formatViewCountLabel(
  filteredCount: number,
  totalCount: number,
  search = '',
): string {
  const q = search.trim();
  if (filteredCount === 0) {
    return q ? 'No matching records' : 'No records';
  }
  if (q || filteredCount !== totalCount) {
    return `Showing ${filteredCount} of ${totalCount} records`;
  }
  return `${totalCount} ${totalCount === 1 ? 'record' : 'records'}`;
}

export function ViewCountFooter({
  isDarkMode,
  filteredCount,
  totalCount,
  search = '',
  extras,
}: ViewCountFooterProps) {
  const isFiltered = Boolean(search.trim()) || filteredCount !== totalCount;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-t flex-shrink-0 ${isDarkMode ? 'border-gray-800 bg-[#0B1E19]' : 'border-gray-100 bg-white'}`}
    >
      <p className={`text-[12px] font-medium min-w-0 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {formatViewCountLabel(filteredCount, totalCount, search)}
        {isFiltered && filteredCount > 0 && (
          <span className={`ml-1.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>· filtered</span>
        )}
      </p>
      {extras && (
        <div className="flex items-center gap-1.5 flex-shrink-0">{extras}</div>
      )}
    </div>
  );
}
