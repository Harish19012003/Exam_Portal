import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, dateToKey, isDateInRange, parseDateKey } from './dateTimeUtils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface CalendarPanelProps {
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  isDarkMode: boolean;
  min?: string;
  max?: string;
  showToday?: boolean;
}

export function CalendarPanel({
  viewMonth,
  onViewMonthChange,
  selectedDate,
  onSelectDate,
  isDarkMode,
  min,
  max,
  showToday = true,
}: CalendarPanelProps) {
  const grid = buildMonthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = dateToKey(new Date());

  const goMonth = (delta: number) => {
    onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); goMonth(-1); }}
          className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className={`text-[13px] font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {monthLabel}
        </span>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); goMonth(1); }}
          className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-1">
        {WEEKDAYS.map(d => (
          <div
            key={d}
            className={`text-center text-[10px] font-semibold py-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
        {grid.map(({ date, inMonth }) => {
          const key = dateToKey(date);
          const disabled = !isDateInRange(key, min, max);
          const isSelected = selectedDate === key;
          const isToday = todayKey === key;

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                if (!disabled) onSelectDate(key);
              }}
              className={`h-8 rounded-md text-[12px] font-medium transition-colors
                ${!inMonth ? (isDarkMode ? 'text-gray-600' : 'text-gray-300') : (isDarkMode ? 'text-gray-200' : 'text-gray-700')}
                ${isSelected ? 'bg-[#13C296] text-white font-semibold' : ''}
                ${!isSelected && isToday ? (isDarkMode ? 'ring-1 ring-[#13C296]/60' : 'ring-1 ring-[#13C296]/40') : ''}
                ${!isSelected && !disabled ? (isDarkMode ? 'hover:bg-gray-700/70' : 'hover:bg-gray-100') : ''}
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {showToday && (
        <div className={`flex justify-between px-1 pt-1 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={e => {
              e.stopPropagation();
              const today = dateToKey(new Date());
              if (isDateInRange(today, min, max)) {
                onSelectDate(today);
                const parsed = parseDateKey(today);
                if (parsed) onViewMonthChange(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
              }
            }}
            className="text-[11px] font-semibold text-[#13C296] hover:text-[#10A982] transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); onSelectDate(''); }}
            className={`text-[11px] font-semibold transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
