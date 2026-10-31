import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import {
  MISSING_LABEL,
  lookupText,
  resolveLookupRows,
  searchLookupRows,
} from './tableLookupApi';
import './TableLookupSelect.css';

const PAGE = 20;

/**
 * Picker for a field whose options come live from a column of another table (Vendors, SeqView).
 * Searches the server as the user types, so it stays fast on very large tables. The field value is
 * the source row's id (or a list of ids when `multiple`); labels are always read fresh.
 */
export const TableLookupSelect = ({ id, label, required, source, value, onChange, multiple = false }) => {
  const reactId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [labels, setLabels] = useState({}); // id -> text

  const selected = multiple ? (Array.isArray(value) ? value.map(String) : []) : value ? [String(value)] : [];
  const selectedSig = selected.join('|');
  const { table, column, detailColumn } = source;

  // Show current labels for the saved ids (also picks up renames made in the source table).
  useEffect(() => {
    const missing = selected.filter((sid) => !(sid in labels));
    if (missing.length === 0) return undefined;
    let cancelled = false;
    resolveLookupRows({ table, column, detailColumn, ids: missing })
      .then((found) => {
        if (cancelled) return;
        setLabels((prev) => {
          const next = { ...prev };
          missing.forEach((sid) => {
            next[sid] = found?.[sid] ? lookupText(found[sid]) : MISSING_LABEL;
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSig, table, column, detailColumn]);

  const load = useCallback(
    async (q, skip) => {
      setLoading(true);
      setError('');
      try {
        const res = await searchLookupRows({ table, column, detailColumn, q, skip, limit: PAGE });
        const page = Array.isArray(res?.items) ? res.items : [];
        setItems((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(Boolean(res?.hasMore));
        setLabels((prev) => {
          const next = { ...prev };
          page.forEach((it) => {
            next[it.id] = lookupText(it);
          });
          return next;
        });
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not load options');
      } finally {
        setLoading(false);
      }
    },
    [table, column, detailColumn],
  );

  // Debounced search while the menu is open.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => load(query.trim(), 0), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (item) => {
    setLabels((prev) => ({ ...prev, [item.id]: lookupText(item) }));
    if (multiple) {
      onChange(selected.includes(item.id) ? selected.filter((s) => s !== item.id) : [...selected, item.id]);
    } else {
      onChange(item.id);
      setOpen(false);
      setQuery('');
    }
  };

  const remove = (sid) => onChange(multiple ? selected.filter((s) => s !== sid) : '');

  const text = (sid) => labels[sid] ?? '…';

  return (
    <div className="exams-form-group tls" ref={rootRef}>
      <label htmlFor={id || reactId}>
        {label}
        {required ? ' *' : ''}
      </label>

      <button
        id={id || reactId}
        type="button"
        className="tls-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {multiple ? (
          selected.length === 0 ? (
            <span className="tls-placeholder">Search and select…</span>
          ) : (
            <span className="tls-chips">
              {selected.map((sid) => (
                <span key={sid} className="tls-chip">
                  <span className={text(sid) === MISSING_LABEL ? 'tls-missing' : undefined}>{text(sid)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="tls-chip-x"
                    aria-label={`Remove ${text(sid)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(sid);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(sid);
                      }
                    }}
                  >
                    <X size={12} />
                  </span>
                </span>
              ))}
            </span>
          )
        ) : selected[0] ? (
          <span className={text(selected[0]) === MISSING_LABEL ? 'tls-missing' : 'tls-value'}>{text(selected[0])}</span>
        ) : (
          <span className="tls-placeholder">Search and select…</span>
        )}
        <ChevronDown size={14} className="tls-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="tls-menu">
          <input
            ref={inputRef}
            type="search"
            className="tls-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search options"
          />
          <ul className="tls-list" role="listbox" aria-multiselectable={multiple || undefined}>
            {!multiple && selected[0] && (
              <li>
                <button type="button" className="tls-option tls-clear" onClick={() => { remove(selected[0]); setOpen(false); }}>
                  Clear selection
                </button>
              </li>
            )}
            {items.map((it) => {
              const isSelected = selected.includes(it.id);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`tls-option${isSelected ? ' is-selected' : ''}`}
                    onClick={() => pick(it)}
                  >
                    <span className="tls-option-label">{it.label || '—'}</span>
                    {it.detail && <span className="tls-option-detail">{it.detail}</span>}
                  </button>
                </li>
              );
            })}
            {loading && (
              <li className="tls-status">
                <Loader2 size={14} className="tls-spin" /> Loading…
              </li>
            )}
            {!loading && error && <li className="tls-status tls-error">{error}</li>}
            {!loading && !error && items.length === 0 && <li className="tls-status">No matches</li>}
            {!loading && hasMore && (
              <li>
                <button type="button" className="tls-option tls-more" onClick={() => load(query.trim(), items.length)}>
                  Load more…
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
