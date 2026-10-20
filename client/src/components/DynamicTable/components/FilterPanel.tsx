import { useEffect, useRef } from 'react';
import type { ColumnConfig, FilterValue } from '../types';
import { FilterUI } from '../filters';

interface FilterPanelProps {
  column: ColumnConfig;
  allColumns: ColumnConfig[];
  currentFilter: FilterValue | undefined;
  anchorRect: DOMRect;
  onFilterChange: (filter: FilterValue | null) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function FilterPanel({
  column,
  allColumns,
  currentFilter,
  anchorRect,
  onFilterChange,
  onClose,
  isDarkMode,
}: FilterPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position below anchor, staying in viewport
  const left = Math.min(anchorRect.left, window.innerWidth - 240);
  const top = anchorRect.bottom + 4;

  const isActive = Boolean(currentFilter);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9998, minWidth: 220 }}
      className={`rounded-xl border shadow-xl p-3 flex flex-col gap-2
        ${isDarkMode ? 'bg-gray-900 border-gray-700 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200'}`}
      role="dialog"
      aria-label={`Filter ${column.label}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-bold uppercase tracking-wider
          ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Filter: {column.label}
        </span>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-[#13C296] flex-shrink-0" aria-label="Filter active" />
        )}
      </div>

      <FilterUI
        column={column}
        allColumns={allColumns}
        currentFilter={currentFilter}
        onFilterChange={onFilterChange}
        onClose={onClose}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
