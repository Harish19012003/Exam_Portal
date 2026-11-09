import { useState } from 'react';
import { CalendarPanel } from './CalendarPanel';
import { parseDateKey } from './dateTimeUtils';
import { DateTimePortalShell, DateTimeTrigger, useDateTimePortal } from './dateTimeShared';
import type { DynamicDateTimeBaseProps } from './dateTimeTypes';

export const DYNAMIC_MULTI_DATE_PICKER_PORTAL_CLASS = 'dynamic-multi-date-picker-portal';

export interface DynamicMultiDatePickerProps extends DynamicDateTimeBaseProps {
  /** Called once with the chosen yyyy-mm-dd keys (ascending) when the user confirms. */
  onChange: (values: string[]) => void;
  min?: string;
  max?: string;
  /** Label of the confirm button, given the number of picked days. */
  confirmLabel?: (count: number) => string;
}

/**
 * Calendar popup that lets the user tick several days, then confirm them all at once.
 * Same look as DynamicDatePicker.
 */
export function DynamicMultiDatePicker({
  onChange,
  isDarkMode,
  variant = 'form',
  placeholder = 'Select dates',
  className = '',
  disabled = false,
  minMenuWidth = 280,
  min,
  max,
  confirmLabel = (n) => (n ? `Add ${n} date${n === 1 ? '' : 's'}` : 'Done'),
}: DynamicMultiDatePickerProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const { rect, isOpen, containerRef, openMenu, closeMenu, shouldIgnoreBackdrop } = useDateTimePortal(false);

  const commit = (restoreFocus = false) => {
    const list = [...picked].sort();
    setPicked([]);
    closeMenu(restoreFocus);
    if (list.length) onChange(list);
  };

  const toggle = (key: string) => {
    if (!key) {
      setPicked([]);
      return;
    }
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    const parsed = parseDateKey(key);
    if (parsed && (parsed.getMonth() !== viewMonth.getMonth() || parsed.getFullYear() !== viewMonth.getFullYear())) {
      setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  const display = picked.length ? `${picked.length} date${picked.length === 1 ? '' : 's'} selected` : '';

  return (
    <div ref={containerRef} className={`w-full relative outline-none ${className}`}>
      <DateTimeTrigger
        isDarkMode={isDarkMode}
        variant={variant}
        display={display}
        placeholder={placeholder}
        disabled={disabled}
        isOpen={isOpen}
        onOpen={openMenu}
      />

      {isOpen && rect && (
        <DateTimePortalShell
          portalClass={DYNAMIC_MULTI_DATE_PICKER_PORTAL_CLASS}
          rect={rect}
          isDarkMode={isDarkMode}
          minMenuWidth={minMenuWidth}
          estimatedHeight={380}
          fitContent
          onBackdropClose={() => {
            if (shouldIgnoreBackdrop()) return;
            commit(true);
          }}
        >
          <CalendarPanel
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            selectedDate=""
            selectedDates={picked}
            onSelectDate={toggle}
            isDarkMode={isDarkMode}
            min={min}
            max={max}
            showToday={false}
          />
          <div className={`mt-2 pt-2 border-t flex items-center gap-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); setPicked([]); }}
              disabled={!picked.length}
              className={`px-2 py-1.5 text-[12px] font-semibold rounded-md disabled:opacity-40 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Clear
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); commit(true); }}
              className="flex-1 py-1.5 bg-[#13C296] hover:bg-[#10A982] text-white text-[12px] font-semibold rounded-md transition-colors"
            >
              {confirmLabel(picked.length)}
            </button>
          </div>
        </DateTimePortalShell>
      )}
    </div>
  );
}
