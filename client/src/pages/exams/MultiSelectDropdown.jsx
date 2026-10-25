import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
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
      if (rootRef.current && !rootRef.current.contains(e.target)) {
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

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.join(', ')
        : `${selected.length} selected`;

  return (
    <div className="exams-form-group exams-search-select" ref={rootRef}>
      {label && (
        <label htmlFor={selectId}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <button
        id={selectId}
        type="button"
        className={`exams-search-select-trigger exams-multiselect-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
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

      {open && (
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
      )}
    </div>
  );
};
