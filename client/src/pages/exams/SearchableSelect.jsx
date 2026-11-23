import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

const matchesQuery = (opt, q) => {
  if (!q) return true;
  const hay = [opt?.label, opt?.value, opt?.triggerLabel, opt?.group]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return hay.includes(q);
};

/**
 * Dropdown with optional search when options.length >= searchThreshold (default 4).
 * `portal` renders the menu on document.body (fixed, flips upward near the bottom edge),
 * for use inside scrolling containers such as the bulk-add grid where an inline menu would be clipped.
 */
export const SearchableSelect = ({
  id,
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select…',
  searchThreshold = 4,
  searchPlaceholder = 'Search…',
  portal = false,
  className = '',
  ariaLabel,
  disabled = false,
  /** Minimum width of the portal menu (px) — wider for compact triggers such as a page-title switcher. */
  menuMinWidth = 220,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  // Duplicate values break React list identity and make search look broken.
  const uniqueOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const opt of options) {
      const v = String(opt?.value ?? '');
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(opt);
    }
    return out;
  }, [options]);

  const showSearch = uniqueOptions.length >= searchThreshold;
  const normalizedQuery = query.trim().toLowerCase();

  const selected = useMemo(
    () => uniqueOptions.find((o) => o.value === value) || null,
    [uniqueOptions, value],
  );

  // Filter in render (not a fragile memo path) so typing always updates the list.
  const filtered =
    !showSearch || !normalizedQuery
      ? uniqueOptions
      : uniqueOptions.filter((o) => matchesQuery(o, normalizedQuery));

  useEffect(() => {
    setHighlight(0);
  }, [normalizedQuery, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const t = e.target;
      const inside =
        rootRef.current?.contains(t) || menuRef.current?.contains(t);
      if (!inside) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Portal: position against the trigger. Do NOT clear search on dialog scroll —
  // that made Calculation filters look broken (typed text stayed, list reset).
  useLayoutEffect(() => {
    if (!portal || !open || !triggerRef.current) {
      setMenuPos(null);
      return undefined;
    }
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, menuMinWidth), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(180, Math.min(360, openUp ? spaceAbove : spaceBelow));
      setMenuPos(
        openUp
          ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 3 }
          : { left, width, maxHeight, top: r.bottom + 3 },
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [portal, open, menuMinWidth]);

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, showSearch]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
  };

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    close();
  };

  const onSearchChange = (e) => {
    e.stopPropagation();
    setQuery(e.target.value);
  };

  const onMenuKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && filtered[highlight]) {
      e.preventDefault();
      handleSelect(filtered[highlight].value);
    }
  };

  const menu = (
    <div
      className="exams-search-select-menu"
      role="listbox"
      onKeyDown={onMenuKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {showSearch && (
        <div className="exams-search-select-search">
          <Search size={13} strokeWidth={2.2} aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label="Search options"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={onMenuKeyDown}
          />
          {query ? (
            <button
              type="button"
              className="exams-search-select-clear"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      )}
      <ul className="exams-search-select-list">
        {filtered.length > 0 ? (
          filtered.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === highlight;
            const showGroup = opt.group && opt.group !== filtered[index - 1]?.group;
            return (
              <React.Fragment key={String(opt.value)}>
                {showGroup && (
                  <li role="presentation" className="exams-search-select-group">
                    {opt.group}
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`exams-search-select-option ${opt.group ? 'is-grouped' : ''} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="exams-search-select-option-label">{opt.label}</span>
                    {isSelected && (
                      <Check size={13} strokeWidth={2.5} className="exams-search-select-check" />
                    )}
                  </button>
                </li>
              </React.Fragment>
            );
          })
        ) : (
          <li className="exams-search-select-empty">
            {normalizedQuery ? `No matches for “${query.trim()}”` : 'No options'}
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className={`exams-form-group exams-search-select ${className}`.trim()} ref={rootRef}>
      {label && <label htmlFor={selectId}>{label}</label>}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className={`exams-search-select-trigger ${open ? 'open' : ''}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`exams-search-select-value ${selected ? '' : 'placeholder'}`}>
          {selected?.triggerLabel || selected?.label || placeholder}
        </span>
        <ChevronDown size={14} className={`exams-search-select-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && !portal && menu}
      {open &&
        portal &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="exams-form-group exams-search-select exams-search-select-portal"
            style={menuPos}
          >
            {menu}
          </div>,
          document.body,
        )}
    </div>
  );
};
