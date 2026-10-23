import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock3 } from 'lucide-react';
import { TimeColumnPicker } from './TimeColumnPicker';
import {
  formatTimeDisplay,
  toTimeValue,
} from './dateTimeUtils';
import {
  computePortalPlacement,
  DATETIME_PORTAL_Z,
  dateTimeTriggerClass,
  useDateTimePortal,
} from './dateTimeShared';
import type { DynamicTimePickerProps } from './dateTimeTypes';

export const DYNAMIC_TIME_PICKER_PORTAL_CLASS = 'dynamic-time-picker-portal';

/**
 * Custom time picker — 12-hour scroll columns in a popup.
 */
export function DynamicTimePicker({
  value,
  onChange,
  isDarkMode,
  defaultOpen = false,
  variant = 'editor',
  required = false,
  placeholder = 'Select time',
  className = '',
  onCancel,
  commitOnBlur = false,
  disabled = false,
  minMenuWidth = 240,
  minuteStep = 1,
}: DynamicTimePickerProps) {
  const committed = toTimeValue(value);
  const [draft, setDraft] = useState(committed);

  const { rect, isOpen, containerRef, openMenu, closeMenu, shouldIgnoreBackdrop } = useDateTimePortal(defaultOpen);

  const startEditing = () => {
    setDraft(committed);
    openMenu();
  };

  const commit = (next: string, restoreFocus = false) => {
    const normalizedNext = toTimeValue(next);
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
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest(`.${DYNAMIC_TIME_PICKER_PORTAL_CLASS}`)) return;
    if (commitOnBlur) onChange(draft || null);
  };

  const placement = rect ? computePortalPlacement(rect, minMenuWidth, 175) : null;
  const displayText = isOpen ? formatTimeDisplay(draft) : formatTimeDisplay(committed);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative outline-none ${className}`}
      tabIndex={commitOnBlur ? -1 : undefined}
      onBlur={commitOnBlur ? handleBlur : undefined}
    >
      <div
        data-datetime-trigger
        className={`${dateTimeTriggerClass(isDarkMode, variant)} select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (disabled) return;
          if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
            e.preventDefault();
            e.stopPropagation();
            startEditing();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            closeMenu();
            onCancel?.();
          }
        }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          if (!disabled && !isOpen) startEditing();
        }}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 select-none">
          <Clock3 className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}`} />
          <span className="truncate select-none">{displayText || placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>

      {isOpen && rect && placement && createPortal(
        <div
          className={`${DYNAMIC_TIME_PICKER_PORTAL_CLASS} fixed`}
          style={{
            zIndex: DATETIME_PORTAL_Z,
            left: placement.left,
            width: placement.width,
            ...(placement.top != null ? { top: placement.top } : {}),
            ...(placement.bottom != null ? { bottom: placement.bottom } : {}),
          }}
        >
          <div
            className="fixed inset-0"
            style={{ zIndex: 0 }}
            onMouseDown={e => { e.stopPropagation(); handleBackdropClose(); }}
          />
          <div
            className={`relative rounded-xl border shadow-xl overflow-hidden ${isDarkMode ? 'bg-[#0B1E19] border-gray-700' : 'bg-white border-gray-200'}`}
            style={{ zIndex: 1 }}
            onMouseDown={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
          >
            <div className="px-3 pt-2.5 pb-2">
              <TimeColumnPicker
                value={draft}
                onChange={setDraft}
                isDarkMode={isDarkMode}
                minuteStep={minuteStep}
                showTitle
              />
            </div>
            <div className="px-3 pb-2.5">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={e => { e.stopPropagation(); commit(draft, true); }}
                className="w-full py-1.5 text-[12px] font-semibold rounded-lg transition-colors
                  bg-[#13C296] hover:bg-[#10A982] text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
