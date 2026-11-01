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

const isAbort = (err) =>
  Boolean(err && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError'));

/**
 * Picker for a field whose options come live from a column of another table (Vendors, SeqView).
 * Searches the server as the user types, so it stays fast on very large tables. The field value is
 * the source row's id (or a list of ids when `multiple`); labels are always read fresh.
 */
export const TableLookupSelect = ({ id, label, required, source, value, onChange, multiple = false }) => {
  const reactId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const inFlightKeyRef = useRef(null);
  const cacheRef = useRef(new Map());
  const loadedQueryRef = useRef(null);
  const itemsRef = useRef([]);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [labels, setLabels] = useState({}); // id -> text

  itemsRef.current = items;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;

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

  const cacheKey = useCallback(
    (q, skip) => `${table}|${column}|${detailColumn || ''}|${q}|${skip}`,
    [table, column, detailColumn],
  );

  const load = useCallback(
    async (q, skip) => {
      const key = cacheKey(q, skip);
      if (skip === 0) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          setItems(cached.items);
          setHasMore(cached.hasMore);
          loadedQueryRef.current = q;
          setError('');
          setLoading(false);
          loadingMoreRef.current = false;
          return;
        }
        if (inFlightKeyRef.current === key) return;
        abortRef.current?.abort();
      } else if (loadingMoreRef.current || loadingRef.current) {
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;
      if (skip === 0) inFlightKeyRef.current = key;
      else loadingMoreRef.current = true;

      setLoading(true);
      setError('');
      try {
        const res = await searchLookupRows({
          table,
          column,
          detailColumn,
          q,
          skip,
          limit: PAGE,
          signal: ac.signal,
        });
        const page = Array.isArray(res?.items) ? res.items : [];
        const more = Boolean(res?.hasMore);
        setItems((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(more);
        if (skip === 0) {
          cacheRef.current.set(key, { items: page, hasMore: more });
          loadedQueryRef.current = q;
        }
        setLabels((prev) => {
          const next = { ...prev };
          page.forEach((it) => {
            next[it.id] = lookupText(it);
          });
          return next;
        });
      } catch (err) {
        if (isAbort(err)) return;
        setError(err?.response?.data?.message || 'Could not load options');
      } finally {
        if (inFlightKeyRef.current === key) inFlightKeyRef.current = null;
        loadingMoreRef.current = false;
        if (abortRef.current === ac) setLoading(false);
      }
    },
    [table, column, detailColumn, cacheKey],
  );

  const onListScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 48) return;
    if (!hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return;
    void load(query.trim(), itemsRef.current.length);
  };

  // Debounced search while the menu is open — skip if this query is already cached/loaded.
  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (loadedQueryRef.current === q && cacheRef.current.has(cacheKey(q, 0))) return undefined;
    const timer = setTimeout(() => load(q, 0), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, load, cacheKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

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
            onChange={(e) => {
              if (e.target.value.trim() !== loadedQueryRef.current) loadedQueryRef.current = null;
              setQuery(e.target.value);
            }}
            placeholder="Type to search…"
            aria-label="Search options"
          />
          <ul
            ref={listRef}
            className="tls-list"
            role="listbox"
            aria-multiselectable={multiple || undefined}
            onScroll={onListScroll}
          >
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
            {!loading && hasMore && <li className="tls-status">Scroll for more…</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
