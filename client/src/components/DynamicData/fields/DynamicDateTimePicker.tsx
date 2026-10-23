import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { CalendarPanel } from './CalendarPanel';
import { TimeColumnPicker } from './TimeColumnPicker';
import {
  formatDatetimeDisplay,
  joinDatetimeLocal,
  parseDateKey,
  splitDatetimeLocal,
  toDatetimeLocalValue,
  toTimeValue,
} from './dateTimeUtils';
import {
  DateTimePortalShell,
  DateTimeTrigger,
  useDateTimePortal,
} from './dateTimeShared';
import type { DynamicDateTimePickerProps } from './dateTimeTypes';

export const DYNAMIC_DATETIME_PICKER_PORTAL_CLASS = 'dynamic-datetime-picker-portal';

/**
 * Custom datetime picker — calendar + drum time wheel in one opaque popup.
 */
export function DynamicDateTimePicker({
  value,
  onChange,
  isDarkMode,
  defaultOpen = false,
  variant = 'editor',
  required = false,
  placeholder = 'Select date & time',
  className = '',
  onCancel,
  commitOnBlur = false,
  disabled = false,
  minMenuWidth = 300,
  min,
  max,
  minuteStep = 1,
}: DynamicDateTimePickerProps) {
  const committed = toDatetimeLocalValue(value);
  const committedSplit = splitDatetimeLocal(committed);

  const [draft, setDraft] = useState(committed);
  const [datePart, setDatePart] = useState(committedSplit.date);
  const [timePart, setTimePart] = useState(toTimeValue(committedSplit.time));
  const [viewMonth, setViewMonth] = useState(() => parseDateKey(committedSplit.date) ?? new Date());

  const { rect, isOpen, containerRef, openMenu, closeMenu, shouldIgnoreBackdrop } = useDateTimePortal(defaultOpen);

  const startEditing = () => {
    const next = toDatetimeLocalValue(value);
    const parts = splitDatetimeLocal(next);
    setDraft(next);
    setDatePart(parts.date);
    setTimePart(toTimeValue(parts.time));
    const parsed = parseDateKey(parts.date);
    if (parsed) setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    openMenu();
  };

  const syncDraft = (nextDate: string, nextTime: string) => {
    const time = toTimeValue(nextTime);
    const joined = joinDatetimeLocal(nextDate, time);
    setDatePart(nextDate);
    setTimePart(time);
    setDraft(joined);
    return joined;
  };

  const commit = (next: string, restoreFocus = false) => {
    const normalizedNext = toDatetimeLocalValue(next);
    if (required && !normalizedNext) return;
    setDraft(normalizedNext);
    closeMenu(restoreFocus);
    onChange(normalizedNext || null);
  };

  const handleBackdropClose = () => {
    if (shouldIgnoreBackdrop()) return;
    commit(draft, true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (isOpen) return;
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest(`.${DYNAMIC_DATETIME_PICKER_PORTAL_CLASS}`)) return;
    if (commitOnBlur) onChange(draft || null);
  };

  const displayValue = formatDatetimeDisplay(isOpen ? draft : committed);
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-100';

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
        display={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        isOpen={isOpen}
        onOpen={startEditing}
      />

      {isOpen && rect && (
        <DateTimePortalShell
          portalClass={DYNAMIC_DATETIME_PICKER_PORTAL_CLASS}
          rect={rect}
          isDarkMode={isDarkMode}
          minMenuWidth={minMenuWidth}
          estimatedHeight={540}
          fitContent
          onBackdropClose={handleBackdropClose}
        >
          <CalendarPanel
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            selectedDate={datePart}
            onSelectDate={dateKey => syncDraft(dateKey, timePart)}
            isDarkMode={isDarkMode}
            min={min}
            max={max}
          />

          <div className={`mt-2 pt-2 border-t ${borderColor}`}>
            <div className={`flex items-center gap-1.5 mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Clock3 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Time</span>
            </div>
            <TimeColumnPicker
              value={timePart}
              onChange={nextTime => syncDraft(datePart, nextTime)}
              isDarkMode={isDarkMode}
              minuteStep={minuteStep}
              showTitle={false}
            />
          </div>

          <div className={`mt-2 pt-2 border-t ${borderColor}`}>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={e => { e.stopPropagation(); commit(draft, true); }}
              className="w-full py-1.5 text-[12px] font-semibold rounded-md transition-colors bg-[#13C296] hover:bg-[#10A982] text-white"
            >
              Done
            </button>
          </div>
        </DateTimePortalShell>
      )}

      {!isOpen && (
        <span className="sr-only" onKeyDown={e => { if (e.key === 'Escape') onCancel?.(); }} />
      )}
    </div>
  );
}
