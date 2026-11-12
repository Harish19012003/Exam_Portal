import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import type { FieldColumn } from '../types';
import { DYNAMIC_DROPDOWN_PORTAL_CLASS } from '../../DynamicData/fields';

interface Item {
  id: string;
  label: string;
  detail: string;
  values?: Record<string, string>;
}

const PAGE = 20;

/** Survive remounts when toggling Mass Edit fields — opening Vendor Code again should be instant. */
const lookupPageCache = new Map<string, { items: Item[]; hasMore: boolean; at: number }>();
const LOOKUP_CACHE_MS = 60_000;

/** Cell value = mapped column only. Detail stays in the dropdown secondary line. */
const cellTextOf = (it: Item) => it.label || '';

const isAbort = (err: unknown) =>
  Boolean(
    err &&
      typeof err === 'object' &&
      ('code' in err
        ? (err as { code?: string }).code === 'ERR_CANCELED'
        : (err as { name?: string }).name === 'CanceledError' || (err as { name?: string }).name === 'AbortError'),
  );

const cacheKeyOf = (
  table: string,
  colKey: string,
  detailKey: string,
  extraColsKey: string,
  q: string,
  skip: number,
) => `${table}|${colKey}|${detailKey}|${extraColsKey}|${q}|${skip}`;

/** Build the mass-edit patch for a table-lookup pick (primary column + group siblings). */
export const buildLookupBulkPatch = (column: FieldColumn, item: Item | null): Record<string, unknown> => {
  const lookup = column.lookup;
  if (!lookup) return { [column.key]: '' };
  if (!item) {
    const cleared: Record<string, unknown> = { [column.key]: '' };
    (lookup.syncFields || []).forEach((sf) => {
      cleared[sf.key] = '';
    });
    return cleared;
  }

  const colKey = lookup.column || '';
  const detailKey = lookup.detailColumn || '';
  const instant: Record<string, string> = {
    [colKey]: item.label,
    ...(item.values || {}),
  };
  if (detailKey) instant[detailKey] = item.detail ?? '';

  const sourceVal = (sourceCol?: string) => {
    if (!sourceCol) return '';
    if (sourceCol === colKey) return item.label;
    if (sourceCol === detailKey) return item.detail ?? '';
    return item.values?.[sourceCol] ?? instant[sourceCol] ?? '';
  };

  const patch: Record<string, unknown> = { [column.key]: cellTextOf(item) };
  (lookup.syncFields || []).forEach((sf) => {
    if (sf.key === column.key) return;
    patch[sf.key] = sourceVal(sf.column);
  });
  return patch;
};

export type BulkLookupPickMeta = {
  columnKey: string;
  /** Source row id to persist (or '' to clear). */
  id: string;
  table: string;
  /** Source-table column values for optimistic labels / seeds. */
  seedValues: Record<string, string>;
};

interface BulkLookupPickerProps {
  column: FieldColumn;
  value: string;
  isDarkMode: boolean;
  onPick: (patch: Record<string, unknown>, meta: BulkLookupPickMeta | null) => void;
}

/** Mass-edit control for group / table-source columns — same search API as the cell LookupEditor. */
export function BulkLookupPicker({ column, value, isDarkMode, onPick }: BulkLookupPickerProps) {
  const lookup = column.lookup;
  const table = lookup?.table || '';
  const colKey = lookup?.column || '';
  const detailKey = lookup?.detailColumn || '';
  const extraCols = (lookup?.resolveColumns || []).filter(Boolean);
  const extraColsKey = extraCols.join(',');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);

  itemsRef.current = items;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;

  const load = useCallback(
    async (q: string, skip: number) => {
      if (!table || !colKey) return;
      const key = cacheKeyOf(table, colKey, detailKey, extraColsKey, q, skip);

      if (skip === 0) {
        const cached = lookupPageCache.get(key);
        if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) {
          setItems(cached.items);
          setHasMore(cached.hasMore);
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
          lookupPageCache.set(key, { items: page, hasMore: more, at: Date.now() });
        }
      } catch (e) {
        if (isAbort(e)) return;
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Could not load options',
        );
        if (skip === 0) setItems([]);
        setHasMore(false);
      } finally {
        if (inFlightKeyRef.current === key) inFlightKeyRef.current = null;
        loadingMoreRef.current = false;
        if (abortRef.current === ac) setLoading(false);
      }
    },
    [table, colKey, detailKey, extraColsKey],
  );

  // Prefetch first page as soon as the field is enabled (before the user opens the menu).
  useEffect(() => {
    if (!table || !colKey) return undefined;
    const key = cacheKeyOf(table, colKey, detailKey, extraColsKey, '', 0);
    const cached = lookupPageCache.get(key);
    if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) {
      setItems(cached.items);
      setHasMore(cached.hasMore);
      return undefined;
    }
    void load('', 0);
    return undefined;
  }, [table, colKey, detailKey, extraColsKey, load]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    const key = cacheKeyOf(table, colKey, detailKey, extraColsKey, q, 0);
    const cached = lookupPageCache.get(key);
    if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) {
      setItems(cached.items);
      setHasMore(cached.hasMore);
      setLoading(false);
      setError('');
      return undefined;
    }
    // Empty query: load immediately. Typed search: short debounce.
    const delay = q ? 180 : 0;
    const t = window.setTimeout(() => void load(q, 0), delay);
    return () => window.clearTimeout(t);
  }, [open, query, load, table, colKey, detailKey, extraColsKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!lookup) return null;

  const dark = isDarkMode;
  const border = dark ? '#374151' : '#e5e7eb';
  const bg = dark ? '#111827' : '#ffffff';
  const fg = dark ? '#f3f4f6' : '#111827';
  const muted = dark ? '#9ca3af' : '#6b7280';

  const openMenu = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const onMenuScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 48) return;
    if (!hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return;
    void load(query.trim(), itemsRef.current.length);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium rounded-lg border min-h-[34px] text-left transition-all
          ${dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'}
          focus:outline-none focus:ring-2 focus:ring-[#13C296]/20 focus:border-[#13C296]`}
      >
        <span className={`truncate ${value ? '' : dark ? 'text-gray-500' : 'text-gray-400'}`}>
          {value || 'Search…'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            className={DYNAMIC_DROPDOWN_PORTAL_CLASS}
            role="listbox"
            onScroll={onMenuScroll}
            style={{
              position: 'fixed',
              zIndex: 10050,
              left: rect.left,
              width: Math.max(rect.width, 240),
              top: Math.min(rect.bottom + 4, window.innerHeight - 12 - 280),
              maxHeight: 280,
              overflowY: 'auto',
              background: bg,
              color: fg,
              border: `1px solid ${border}`,
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(3, 7, 18, 0.25)',
              padding: 4,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                marginBottom: 4,
                borderBottom: `1px solid ${border}`,
                position: 'sticky',
                top: 0,
                background: bg,
                zIndex: 1,
              }}
            >
              <Search size={14} color={muted} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${column.label.toLowerCase()}…`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: 0,
                  background: 'transparent',
                  color: fg,
                  font: 'inherit',
                  fontSize: 13,
                }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ border: 0, background: 'transparent', color: muted, cursor: 'pointer', padding: 2 }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {value ? (
              <button
                type="button"
                onClick={() => {
                  onPick(buildLookupBulkPatch(column, null), {
                    columnKey: column.key,
                    id: '',
                    table,
                    seedValues: {},
                  });
                  setOpen(false);
                  setQuery('');
                }}
                style={optionStyle(muted)}
              >
                Clear
              </button>
            ) : null}

            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                role="option"
                onClick={() => {
                  const col = lookup?.column || '';
                  const detail = lookup?.detailColumn || '';
                  const seedValues: Record<string, string> = {
                    ...(it.values || {}),
                    ...(col ? { [col]: it.label } : {}),
                    ...(detail ? { [detail]: it.detail ?? '' } : {}),
                  };
                  onPick(buildLookupBulkPatch(column, it), {
                    columnKey: column.key,
                    id: it.id,
                    table,
                    seedValues,
                  });
                  setOpen(false);
                  setQuery('');
                }}
                style={optionStyle(fg)}
              >
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.label || '—'}
                </span>
                {it.detail ? (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.detail}
                  </span>
                ) : null}
              </button>
            ))}

            {loading && items.length === 0 && (
              <div style={{ padding: 10, fontSize: 13, color: muted }}>Loading…</div>
            )}
            {loading && items.length > 0 && (
              <div style={{ padding: '6px 10px', fontSize: 12, color: muted, textAlign: 'center' }}>Updating…</div>
            )}
            {!loading && error && <div style={{ padding: 10, fontSize: 13, color: '#dc2626' }}>{error}</div>}
            {!loading && !error && items.length === 0 && (
              <div style={{ padding: 10, fontSize: 13, color: muted }}>No matches</div>
            )}
            {!loading && hasMore && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: muted, textAlign: 'center' }}>
                Scroll for more…
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const optionStyle = (color: string) => ({
  display: 'block' as const,
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
