import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * Dropdown with optional search when options.length >= searchThreshold (default 4).
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
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
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
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

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

  return (
    <div className="exams-form-group exams-search-select" ref={rootRef}>
      {label && <label htmlFor={selectId}>{label}</label>}
      <button
        id={selectId}
        type="button"
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

      {open && (
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
      )}
    </div>
  );
};
