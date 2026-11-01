import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { apiClient } from '../../../api/client';
import type { CellEditorProps } from '../types';
import { isFieldColumn } from '../types';
import { setLookupDisplayOverrides } from './lookupDisplayOverrides';
import { setLookupPick } from './lookupPicks';
import { seedLookupRow } from './lookupSeeds';

interface Item {
  id: string;
  label: string;
  detail: string;
  /** Sibling group / linked column values from the search page (no extra /resolve). */
  values?: Record<string, string>;
}

const PAGE = 20;
const textOf = (it: Item) => (it.detail ? `${it.label} · ${it.detail}` : it.label);

const isAbort = (err: unknown) =>
  Boolean(
    err &&
      typeof err === 'object' &&
      ('code' in err
        ? (err as { code?: string }).code === 'ERR_CANCELED'
        : (err as { name?: string }).name === 'CanceledError' || (err as { name?: string }).name === 'AbortError'),
  );

/** Cell editor for a column that reads its choices live from another table: search, pick a row. */
export function LookupEditor({ value, row, column, onSave, onSaveBatch, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const lookup = isFieldColumn(column) ? column.lookup : undefined;
  const table = lookup?.table || '';
  const colKey = lookup?.column || '';
  const detailKey = lookup?.detailColumn || '';
  const extraCols = (lookup?.resolveColumns || []).filter(Boolean);
  const extraColsKey = extraCols.join(',');
  const syncFields = lookup?.syncFields || [];

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, { items: Item[]; hasMore: boolean }>>(new Map());
  const loadedQueryRef = useRef<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Only the cell being typed in shows its list. When a whole row is in edit mode every lookup cell
  // mounts an editor, so each one waits until it is focused.
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  itemsRef.current = items;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;

  const cacheKey = useCallback(
    (q: string, skip: number) => `${table}|${colKey}|${detailKey}|${extraColsKey}|${q}|${skip}`,
    [table, colKey, detailKey, extraColsKey],
  );

  const load = useCallback(
    async (q: string, skip: number) => {
      if (!table || !colKey) return;
      const key = cacheKey(q, skip);

      // First page: reuse cache so re-focus / parent re-renders don't hit the network again.
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
        const { data } = await apiClient.get(`/table-lookup/${table}/rows`, {
          params: {
            column: colKey,
            detailColumn: detailKey || undefined,
            columns: extraColsKey || undefined,
            q,
            skip,
            limit: PAGE,
          },
          signal: ac.signal,
        });
        const res = data?.data ?? data;
        const page: Item[] = Array.isArray(res?.items) ? res.items : [];
        const more = Boolean(res?.hasMore);
        setItems((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(more);
        if (skip === 0) {
          cacheRef.current.set(key, { items: page, hasMore: more });
          loadedQueryRef.current = q;
        }
      } catch (err) {
        if (isAbort(err)) return;
        const e = err as { response?: { data?: { message?: string } } };
        setError(e?.response?.data?.message || 'Could not load options');
      } finally {
        if (inFlightKeyRef.current === key) inFlightKeyRef.current = null;
        loadingMoreRef.current = false;
        if (abortRef.current === ac) setLoading(false);
      }
    },
    [table, colKey, detailKey, extraColsKey, cacheKey],
  );

  const onMenuScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 48) return;
    if (!hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return;
    void load(query.trim(), itemsRef.current.length);
  };

  useEffect(() => {
    if (!active) return undefined;
    const q = query.trim();
    // Already showing results for this query — don't refetch on focus flicker / re-render.
    if (loadedQueryRef.current === q && cacheRef.current.has(cacheKey(q, 0))) {
      return undefined;
    }
    const timer = setTimeout(() => void load(q, 0), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [active, query, load, cacheKey]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // The cell clips its content, so the menu is drawn on the page and anchored to the input.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!active || !el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 260);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    setPos(
      up
        ? { left, width, bottom: window.innerHeight - r.top + 3, maxHeight: Math.max(160, Math.min(320, above)) }
        : { left, width, top: r.bottom + 3, maxHeight: Math.max(160, Math.min(320, below)) },
    );
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      // Just close the list: cancelling here would also end editing of the other cells in the row.
      setActive(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active]);

  const pick = (item: Item) => {
    const id = item.id;
    const chosen = textOf(item);
    const rowId = String(row.rowId);
    setLookupPick(rowId, column.key, id);
    // Sibling values arrive with the search page — seed everything now, no /resolve wait.
    const instant: Record<string, string> = {
      [colKey]: item.label,
      ...(item.values || {}),
    };
    if (detailKey) instant[detailKey] = item.detail ?? '';
    seedLookupRow(table, id, instant);

    const sourceVal = (sourceCol?: string) => {
      if (!sourceCol) return '';
      if (sourceCol === colKey) return item.label;
      if (sourceCol === detailKey) return item.detail ?? '';
      return item.values?.[sourceCol] ?? instant[sourceCol] ?? '';
    };

    // Paint every group / linked cell in the same tick (local table state).
    const patch: Record<string, unknown> = { [column.key]: chosen };
    syncFields.forEach((sf) => {
      if (sf.key === column.key) return;
      const label = sourceVal(sf.column);
      const detail = sf.detailColumn ? sourceVal(sf.detailColumn) : '';
      patch[sf.key] = detail ? `${label} · ${detail}` : label;
    });

    // Synchronous display overrides so the selected cell never flashes the old value /
    // search text while React closes the editor and syncs parent rows.
    const displayPatch: Record<string, string> = {};
    Object.entries(patch).forEach(([k, v]) => {
      displayPatch[k] = v == null ? '' : String(v);
    });
    setLookupDisplayOverrides(rowId, displayPatch);
    setQuery(chosen);
    setActive(false);

    flushSync(() => {
      if (onSaveBatch && Object.keys(patch).length > 1) onSaveBatch(patch);
      else onSave(chosen);
    });
  };

  const dark = isDarkMode;
  const border = dark ? '#1f2937' : '#e5e7eb';
  const bg = dark ? '#111827' : '#ffffff';
  const fg = dark ? '#f3f4f6' : '#030712';
  const muted = dark ? '#9ca3af' : '#6b7280';

  if (!lookup) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder={String(value ?? '') || 'Search…'}
        onFocus={() => setActive(true)}
        onChange={(e) => {
          setActive(true);
          // New search text invalidates "already loaded" so the debounced effect may fetch.
          if (e.target.value.trim() !== loadedQueryRef.current) {
            loadedQueryRef.current = null;
          }
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
        aria-label={`Search ${column.label}`}
        style={{
          width: '100%',
          minHeight: 32,
          boxSizing: 'border-box',
          padding: '4px 8px',
          font: 'inherit',
          color: fg,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          outline: '2px solid #5c43fa',
        }}
      />
      {active &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            onScroll={onMenuScroll}
            style={{
              position: 'fixed',
              zIndex: 1400,
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              background: bg,
              color: fg,
              border: `1px solid ${border}`,
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(3, 7, 18,0.25)',
              padding: 4,
              boxSizing: 'border-box',
            }}
          >
            {String(value ?? '') && (
              <button
                type="button"
                onClick={() => {
                  setLookupPick(String(row.rowId), column.key, '');
                  setActive(false);
                  onSave('');
                }}
                style={optionStyle(muted)}
              >
                Clear
              </button>
            )}
            {items.map((it) => (
              <button key={it.id} type="button" role="option" aria-selected={false} onClick={() => pick(it)} style={optionStyle(fg)}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label || '—'}</span>
                {it.detail && (
                  <span style={{ display: 'block', fontSize: 12, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.detail}
                  </span>
                )}
              </button>
            ))}
            {loading && <div style={{ padding: 10, fontSize: 13, color: muted }}>Loading…</div>}
            {!loading && error && <div style={{ padding: 10, fontSize: 13, color: '#dc2626' }}>{error}</div>}
            {!loading && !error && items.length === 0 && <div style={{ padding: 10, fontSize: 13, color: muted }}>No matches</div>}
            {!loading && hasMore && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: muted, textAlign: 'center' }}>Scroll for more…</div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const optionStyle = (color: string) => ({
  display: 'block',
  width: '100%',
  minHeight: 40,
  padding: '6px 10px',
  textAlign: 'left' as const,
  font: 'inherit',
  color,
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
});
