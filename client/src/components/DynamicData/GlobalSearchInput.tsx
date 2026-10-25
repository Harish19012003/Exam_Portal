import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Search, X } from 'lucide-react';

/** Fixed control height so the banner lines up across Table / List / Card / …. */
export const GLOBAL_SEARCH_CONTROL_CLASS =
  'flex h-[34px] w-full items-center gap-2 overflow-hidden rounded-xl border px-3 transition-all duration-300 ease-in-out focus-within:border-[#13C296] focus-within:ring-2 focus-within:ring-[#13C296]/20';

export interface GlobalSearchInputProps {
  isDarkMode: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Wrapper width classes — desktop / always-visible field. */
  className?: string;
  /**
   * When true (default), small screens show an icon that expands the field
   * onto the next toolbar row. Requires a flex-wrap parent.
   */
  compactOnMobile?: boolean;
}

function SearchField({
  isDarkMode,
  value,
  onChange,
  placeholder,
  inputRef,
  autoFocus,
  onKeyDown,
}: {
  isDarkMode: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className={`${GLOBAL_SEARCH_CONTROL_CLASS} ${
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
      }`}
      onClick={() => inputRef.current?.focus()}
    >
      <Search
        className={`h-3.5 w-3.5 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`h-full w-full flex-1 bg-transparent text-[13px] leading-none outline-none transition-all duration-300
          ${isDarkMode ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
        aria-label="Global search"
      />
      {value ? (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onChange('');
            inputRef.current?.focus();
          }}
          className={`flex-shrink-0 ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Shared global search field for every Dynamic* view toolbar.
 * Visual source of truth: Table toolbar (34px search, rounded-xl, green focus ring).
 * On small screens: icon only → expands to a full-width row below (parent must flex-wrap).
 */
export function GlobalSearchInput({
  isDarkMode,
  value,
  onChange,
  placeholder = 'Search all columns…',
  className = 'w-full sm:flex-1 sm:min-w-[200px] sm:max-w-[320px]',
  compactOnMobile = true,
}: GlobalSearchInputProps) {
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(Boolean(value));

  useEffect(() => {
    if (value) setMobileOpen(true);
  }, [value]);

  useEffect(() => {
    if (!compactOnMobile || !mobileOpen) return;
    const id = requestAnimationFrame(() => mobileRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [compactOnMobile, mobileOpen]);

  if (!compactOnMobile) {
    return (
      <div className={`flex items-center ${className}`}>
        <SearchField
          isDarkMode={isDarkMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputRef={desktopRef}
        />
      </div>
    );
  }

  const iconBtnCls = `relative sm:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 duration-200 flex-shrink-0
    ${
      mobileOpen || value
        ? isDarkMode
          ? 'text-[#13C296] bg-white/5'
          : 'text-[#0f9f7a] bg-teal-50'
        : isDarkMode
          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  return (
    <>
      {/* Desktop / tablet: always-visible field */}
      <div className={`hidden sm:flex items-center ${className}`}>
        <SearchField
          isDarkMode={isDarkMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputRef={desktopRef}
        />
      </div>

      {/* Mobile: icon sits in the toolbar row — becomes close while the field is open */}
      <button
        type="button"
        className={iconBtnCls}
        onClick={() => setMobileOpen(o => !o)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Hide search' : 'Show search'}
        title={mobileOpen ? 'Hide search' : 'Search'}
      >
        {mobileOpen ? (
          <X className="w-4 h-4" strokeWidth={2} />
        ) : (
          <Search className="w-4 h-4" strokeWidth={2} />
        )}
        {!mobileOpen && value ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#13C296]" aria-hidden="true" />
        ) : null}
      </button>

      {/* Mobile: full-width field on the next row (order-last + basis-full) */}
      {mobileOpen ? (
        <div className="order-last flex w-full basis-full sm:hidden">
          <SearchField
            isDarkMode={isDarkMode}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            inputRef={mobileRef}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                if (value) onChange('');
                else setMobileOpen(false);
              }
            }}
          />
        </div>
      ) : null}
    </>
  );
}
