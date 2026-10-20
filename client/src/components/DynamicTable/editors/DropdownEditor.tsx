import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, ChevronDown, Plus } from 'lucide-react';
import type { CellEditorProps } from '../types';
import { editorBase, asFieldColumn } from './shared';

export function DropdownEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const field = asFieldColumn(column);
  const [val, setVal] = useState(String(value ?? ''));
  const [search, setSearch] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(!!autoFocus);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync val if value prop changes (e.g. from row drafts)
  useEffect(() => {
    setVal(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (containerRef.current) {
      setRect(containerRef.current.getBoundingClientRect());
    }
  }, []);

  const options: string[] = field?.options ?? [];
  const filteredOptions = options.filter((o: string) => o.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = options.some((o: string) => o.toLowerCase() === search.trim().toLowerCase());
  const showCreateOption = field?.allowCustom && search.trim() !== '' && !exactMatch;
  const showSearch = options.length > 5 || field?.allowCustom;
  
  let displayOptions = field?.required ? [...filteredOptions] : ['', ...filteredOptions];
  if (showCreateOption) {
    displayOptions = field?.required ? [search.trim(), ...filteredOptions] : ['', search.trim(), ...filteredOptions];
  }

  const [highlightedIndex, setHighlightedIndex] = useState(() => {
    return displayOptions.findIndex((o: string) => o === val);
  });

  // Keep highlight in bounds if search changes
  useEffect(() => {
    setHighlightedIndex((prev: number) => (prev >= displayOptions.length ? Math.max(0, displayOptions.length - 1) : prev));
  }, [displayOptions.length]);

  const handleSave = (opt: string, restoreFocus = false) => {
    setIsOpen(false);
    onSave(opt);
    if (restoreFocus) {
      setTimeout(() => {
        if (containerRef.current) {
          const trigger = containerRef.current.querySelector('[tabindex="0"]') as HTMLElement;
          if (trigger) trigger.focus();
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); setIsOpen(false); onCancel(); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev: number) => Math.min(prev + 1, displayOptions.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev: number) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
        handleSave(displayOptions[highlightedIndex], true);
      } else {
        handleSave(val, true);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.dropdown-portal')) {
      return;
    }
    handleSave(val, false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative outline-none" tabIndex={-1} onBlur={handleBlur}>
      <div 
        className={`${editorBase(isDarkMode)} flex items-center justify-between cursor-pointer`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
            if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
          }
        }}
        onMouseDown={(e) => {
           e.stopPropagation();
           e.preventDefault();
           setIsOpen(true);
           if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
        }}
      >
        <span className="truncate">{val || '—'}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>

      {isOpen && rect && createPortal(
        <div 
          className="dropdown-portal fixed z-[9999]" 
          style={{ 
            top: rect.bottom + 4, 
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 16), 
            width: Math.max(rect.width, 160) 
          }}
        >
          {/* Backdrop */}
          <div className="fixed inset-0" onClick={(e) => { e.stopPropagation(); handleSave(val, true); }} />
          
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
            
            <div className="flex flex-col max-h-[200px] overflow-y-auto p-1.5 outline-none"
                 tabIndex={showSearch ? -1 : 0}
                 ref={el => { if (!showSearch && el) el.focus(); }}
                 onKeyDown={handleKeyDown}
            >
              {displayOptions.length === 0 ? (
                <div className={`px-3 py-2 text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No results
                </div>
              ) : (
                displayOptions.map((opt, i) => (
                  <button
                    key={opt}
                    title={opt}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSave(opt, true); }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`flex items-center w-full px-2.5 py-1.5 text-left text-[13px] rounded-md transition-colors
                      ${highlightedIndex === i ? (isDarkMode ? 'bg-gray-700/70' : 'bg-gray-100') : ''}
                      ${val === opt && highlightedIndex !== i ? (isDarkMode ? 'bg-[#13C296]/10 text-[#13C296]' : 'bg-[#13C296]/5 text-[#13C296]') : ''}
                      ${val === opt && highlightedIndex === i ? (isDarkMode ? 'bg-[#13C296]/20 font-medium text-[#13C296]' : 'bg-[#13C296]/10 font-medium text-[#13C296]') : ''}
                      ${val !== opt ? (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900') : ''}
                    `}
                  >
                    {showCreateOption && opt === search.trim() ? (
                      <span className="flex-1 flex items-center gap-2 truncate italic">
                        <Plus className="w-3.5 h-3.5 text-[#13C296]" />
                        Create "{opt}"
                      </span>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{opt || '—'}</span>
                        {val === opt && <Check className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-[#13C296]' : 'text-[#13C296]'}`} />}
                      </>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── MultiSelect Dropdown Editor ──────────────────────────────────────────────────
