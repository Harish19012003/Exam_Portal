import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

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

  const showSearch = options.length >= searchThreshold;

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        String(o.label).toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q)
    );
  }, [options, query, showSearch]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const inside =
        rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target);
      if (!inside) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Portal menu: anchor to the trigger; close when anything behind it scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!portal || !open || !triggerRef.current) {
      setMenuPos(null);
      return undefined;
    }
    const r = triggerRef.current.getBoundingClientRect();
    const width = Math.max(r.width, 200);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));
    setMenuPos(
      openUp
        ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 3 }
        : { left, width, maxHeight, top: r.bottom + 3 }
    );
    const dismiss = (e) => {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [portal, open]);

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
    onChange(nextValue);
    close();
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
    <div className="exams-search-select-menu" role="listbox" onKeyDown={onMenuKeyDown}>
      {showSearch && (
        <div className="exams-search-select-search">
          <Search size={13} strokeWidth={2.2} />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search options"
            onKeyDown={onMenuKeyDown}
          />
          {query && (
            <button
              type="button"
              className="exams-search-select-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
      <ul className="exams-search-select-list">
        {filtered.length > 0 ? (
          filtered.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === highlight;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`exams-search-select-option ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="exams-search-select-option-label">{opt.label}</span>
                  {isSelected && <Check size={13} strokeWidth={2.5} className="exams-search-select-check" />}
                </button>
              </li>
            );
          })
        ) : (
          <li className="exams-search-select-empty">No matches</li>
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
          {selected?.label || placeholder}
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
          document.body
        )}
    </div>
  );
};
