import { useEffect, useState } from 'react';
import { CalendarPanel } from './CalendarPanel';
import {
  formatDateDisplay,
  parseDateKey,
  toDateValue,
} from './dateTimeUtils';
import {
  DateTimePortalShell,
  DateTimeTrigger,
  useDateTimePortal,
} from './dateTimeShared';
import type { DynamicDatePickerProps } from './dateTimeTypes';

export const DYNAMIC_DATE_PICKER_PORTAL_CLASS = 'dynamic-date-picker-portal';

/**
 * Custom date picker with calendar popup.
 * Import from `components/DynamicData` or `shared/fields`.
 */
export function DynamicDatePicker({
  value,
  onChange,
  isDarkMode,
  defaultOpen = false,
  variant = 'editor',
  required = false,
  placeholder = 'Select date',
  className = '',
  onCancel,
  commitOnBlur = false,
  disabled = false,
  minMenuWidth = 280,
  min,
  max,
}: DynamicDatePickerProps) {
  const normalized = toDateValue(value);
  const [val, setVal] = useState(normalized);
  const [viewMonth, setViewMonth] = useState(() => parseDateKey(normalized) ?? new Date());
  const { rect, isOpen, containerRef, openMenu, closeMenu, shouldIgnoreBackdrop } = useDateTimePortal(defaultOpen);

  useEffect(() => {
    const next = toDateValue(value);
    setVal(next);
    const parsed = parseDateKey(next);
    if (parsed) setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [value]);

  const commit = (next: string, restoreFocus = false) => {
    const normalizedNext = toDateValue(next);
    if (required && !normalizedNext) return;
    setVal(normalizedNext);
    closeMenu(restoreFocus);
    onChange(normalizedNext || null);
  };

  const handleBackdropClose = () => {
    if (shouldIgnoreBackdrop()) return;
    commit(val, true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (isOpen) return;
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest(`.${DYNAMIC_DATE_PICKER_PORTAL_CLASS}`)) return;
    if (commitOnBlur) onChange(val || null);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative outline-none ${className}`}
      tabIndex={commitOnBlur ? -1 : undefined}
      onBlur={commitOnBlur ? handleBlur : undefined}
    >
      <DateTimeTrigger
        isDarkMode={isDarkMode}
        variant={variant}
        display={formatDateDisplay(val)}
        placeholder={placeholder}
        disabled={disabled}
        isOpen={isOpen}
        onOpen={openMenu}
      />

      {isOpen && rect && (
        <DateTimePortalShell
          portalClass={DYNAMIC_DATE_PICKER_PORTAL_CLASS}
          rect={rect}
          isDarkMode={isDarkMode}
          minMenuWidth={minMenuWidth}
          estimatedHeight={340}
          fitContent
          onBackdropClose={handleBackdropClose}
        >
          <CalendarPanel
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            selectedDate={val}
            onSelectDate={dateKey => {
              setVal(dateKey);
            }}
            isDarkMode={isDarkMode}
            min={min}
            max={max}
          />
          {(variant === 'editor' || variant === 'form') && (
            <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={e => { e.stopPropagation(); commit(val, true); }}
                className="w-full py-1.5 bg-[#13C296] hover:bg-[#10A982] text-white text-[12px] font-semibold rounded-md transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </DateTimePortalShell>
      )}

      {!isOpen && (
        <span className="sr-only" onKeyDown={e => { if (e.key === 'Escape') onCancel?.(); }} />
      )}
    </div>
  );
}
