import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, ChevronDown, Plus } from 'lucide-react';
import { fieldInputClass } from '../../../shared/fields/fieldStyles';
import type { DynamicMultiSelectDropdownProps } from './types';

export const DYNAMIC_MULTISELECT_PORTAL_CLASS = 'dynamic-multiselect-portal';

function triggerClass(isDarkMode: boolean, variant: DynamicMultiSelectDropdownProps['variant']) {
  if (variant === 'form') {
    return `${fieldInputClass(isDarkMode, 'default', { compact: true })} flex items-center justify-between cursor-pointer min-h-[34px]`;
  }
  return `${fieldInputClass(isDarkMode, 'default', { compact: true, variant: 'editor' })} flex items-center justify-between cursor-pointer min-h-[34px]`;
}

/**
 * Shared multi-select dropdown — search, select all/clear, custom values, Done button.
 * Import from `components/DynamicData` anywhere you need the table-style multiselect.
 */
export function DynamicMultiSelectDropdown({
  value,
  onChange,
  options,
  isDarkMode,
  defaultOpen = false,
  variant = 'editor',
  allowCustom = false,
  placeholder = '—',
  className = '',
  onCancel,
  commitOnBlur = false,
  minMenuWidth = 280,
}: DynamicMultiSelectDropdownProps) {
  const [val, setVal] = useState<string[]>(value);
  const [search, setSearch] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreBackdropUntilRef = useRef(0);

  useEffect(() => {
    setVal(value);
  }, [value]);

  useEffect(() => {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = options.some(o => o.toLowerCase() === search.trim().toLowerCase());
  const showCreateOption = allowCustom && search.trim() !== '' && !exactMatch;
  const showSearch = options.length > 5 || allowCustom;

  let displayOptions = [...filteredOptions];
  if (showCreateOption) {
    displayOptions = [search.trim(), ...filteredOptions];
  }

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(prev => (prev >= displayOptions.length ? Math.max(0, displayOptions.length - 1) : prev));
  }, [displayOptions.length]);

  const openMenu = () => {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    ignoreBackdropUntilRef.current = Date.now();
    setIsOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    setSearch('');
    if (restoreFocus) {
      setTimeout(() => {
        const trigger = containerRef.current?.querySelector('[data-dropdown-trigger]') as HTMLElement | null;
        trigger?.focus();
      }, 0);
    }
  };

  const toggleOption = (opt: string) => {
    setVal(prev => (prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]));
  };

  const commit = (next: string[], restoreFocus = false) => {
    setVal(next);
    closeMenu(restoreFocus);
    onChange(next);
  };

  const handleSaveAndClose = (restoreFocus = false) => {
    commit(val, restoreFocus);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeMenu();
      onCancel?.();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex(prev => Math.min(prev + 1, displayOptions.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
        toggleOption(displayOptions[highlightedIndex]);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (isOpen) return;
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest(`.${DYNAMIC_MULTISELECT_PORTAL_CLASS}`)) {
      return;
    }
    if (commitOnBlur) onChange(val);
  };

  const handleBackdropClose = () => {
    if (Date.now() - ignoreBackdropUntilRef.current < 250) return;
    handleSaveAndClose(true);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative outline-none ${className}`}
      tabIndex={commitOnBlur ? -1 : undefined}
      onBlur={commitOnBlur ? handleBlur : undefined}
    >
      <div
        data-dropdown-trigger
        className={triggerClass(isDarkMode, variant)}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
            e.preventDefault();
            e.stopPropagation();
            openMenu();
          }
        }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          if (!isOpen) openMenu();
        }}
      >
        <span className="truncate">{val.length ? val.join(', ') : placeholder}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>

      {isOpen && rect && createPortal(
        <div
          className={`${DYNAMIC_MULTISELECT_PORTAL_CLASS} fixed z-[9999]`}
          style={{
            top: rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, minMenuWidth) - 16),
            width: Math.max(rect.width, minMenuWidth),
          }}
        >
          <div className="fixed inset-0" onMouseDown={e => { e.stopPropagation(); handleBackdropClose(); }} />

          <div className={`relative flex flex-col rounded-xl border shadow-xl overflow-hidden ${isDarkMode ? 'bg-[#0B1E19] border-gray-700' : 'bg-white border-gray-200'}`}>
            {showSearch && (
              <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className={`w-full pl-8 pr-3 py-1.5 text-[13px] rounded-md outline-none
                      ${isDarkMode ? 'bg-gray-800 text-gray-200 placeholder-gray-500' : 'bg-gray-50 text-gray-800 placeholder-gray-400'}`}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>
            )}

            {displayOptions.length > 0 && (
              <div className={`flex items-center justify-between px-3 py-1.5 border-b text-[11px] font-semibold ${isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setVal([...new Set([...val, ...displayOptions])]); }}
                  className="hover:text-[#13C296] transition-colors"
                >
                  Select All
                </button>
                <span className={`font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {val.length} selected
                </span>
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setVal(val.filter(v => !displayOptions.includes(v))); }}
                  className="hover:text-red-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}

            <div
              className="flex flex-col max-h-[200px] overflow-y-auto p-1.5 outline-none"
              tabIndex={showSearch ? -1 : 0}
              ref={el => { if (!showSearch && el) el.focus(); }}
              onKeyDown={handleKeyDown}
            >
              {displayOptions.length === 0 ? (
                <div className={`px-3 py-2 text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No results
                </div>
              ) : (
                displayOptions.map((opt, i) => {
                  const isChecked = val.includes(opt);
                  return (
                    <button
                      key={`${opt}_${i}`}
                      type="button"
                      title={opt}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); toggleOption(opt); }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`flex items-center w-full px-2.5 py-1.5 text-left text-[13px] rounded-md transition-colors gap-2
                        ${highlightedIndex === i ? (isDarkMode ? 'bg-gray-700/70' : 'bg-gray-100') : ''}
                        ${isChecked ? (isDarkMode ? 'text-white' : 'text-gray-900 font-medium') : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}
                      `}
                    >
                      {showCreateOption && opt === search.trim() ? (
                        <span className="flex-1 flex items-center gap-2 truncate italic">
                          <Plus className="w-3.5 h-3.5 text-[#13C296]" />
                          Create "{opt}"
                        </span>
                      ) : (
                        <>
                          <div className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0 ${isChecked ? 'bg-[#13C296] border-[#13C296]' : (isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300')}`}>
                            {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="flex-1 truncate">{opt}</span>
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className={`p-1.5 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <button
                type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); handleSaveAndClose(true); }}
                className="w-full py-1.5 bg-[#13C296] hover:bg-[#10A982] text-white text-[12px] font-semibold rounded-md transition-colors"
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
