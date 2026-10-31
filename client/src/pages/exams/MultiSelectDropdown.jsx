import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * Dropdown-style multi-select (same footprint as a normal input / select).
 */
export const MultiSelectDropdown = ({
  id,
  label,
  value = [],
  options = [],
  onChange,
  placeholder = 'Select…',
  required = false,
  searchThreshold = 4,
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

  const selected = Array.isArray(value) ? value : [];
  const showSearch = options.length >= searchThreshold;

  const optionItems = useMemo(
    () =>
      options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return optionItems;
    const q = query.trim().toLowerCase();
    return optionItems.filter((o) => o.label.toLowerCase().includes(q));
  }, [optionItems, query, showSearch]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const inside = rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target);
      if (!inside) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Portal menu: anchor to the trigger; close when anything behind it scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!portal || !open || !triggerRef.current) {
      setMenuPos(null);
      return undefined;
    }
    const r = triggerRef.current.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, Math.min(340, openUp ? spaceAbove : spaceBelow));
    setMenuPos(
      openUp
        ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 3 }
        : { left, width, maxHeight, top: r.bottom + 3 },
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

  const toggle = (optValue) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const labelOf = (v) => optionItems.find((o) => o.value === v)?.label ?? v;
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map(labelOf).join(', ')
        : `${selected.length} selected`;

  const menu = (
      <div
          className="exams-search-select-menu exams-multiselect-menu"
          role="listbox"
          aria-multiselectable="true"
        >
          <div className="exams-multiselect-menu-head">
            <span>
              {selected.length === 0
                ? `${optionItems.length} options`
                : `${selected.length} of ${optionItems.length} selected`}
            </span>
            {selected.length > 0 && (
              <button type="button" className="exams-multiselect-clear-link" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>

          {showSearch && (
            <div className="exams-search-select-search">
              <Search size={13} strokeWidth={2.2} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search options"
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

          <ul className={`exams-search-select-list exams-multiselect-list ${showSearch ? 'has-search' : ''}`}>
            {filtered.length > 0 ? (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`exams-multiselect-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggle(opt.value)}
                    >
                      <span className={`exams-multiselect-box ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="exams-multiselect-option-label">{opt.label}</span>
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
      {label && (
        <label htmlFor={selectId}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        className={`exams-search-select-trigger exams-multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`exams-search-select-value ${selected.length ? '' : 'placeholder'}`}>
          {summary}
        </span>
        <span className="exams-multiselect-trigger-right">
          {selected.length > 0 && (
            <span
              className="exams-multiselect-clear"
              onClick={clearAll}
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`exams-search-select-chevron ${open ? 'rotated' : ''}`} />
        </span>
      </button>

      {/* Keep required validation for forms */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="exams-multiselect-required-mirror"
          value={selected.length ? 'ok' : ''}
          onChange={() => {}}
          required
        />
      )}

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
