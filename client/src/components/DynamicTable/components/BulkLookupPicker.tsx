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

const textOf = (it: Item) => (it.detail ? `${it.label} · ${it.detail}` : it.label);

const isAbort = (err: unknown) =>
  Boolean(
    err &&
      typeof err === 'object' &&
      ('code' in err
        ? (err as { code?: string }).code === 'ERR_CANCELED'
        : (err as { name?: string }).name === 'CanceledError' || (err as { name?: string }).name === 'AbortError'),
  );

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

  const patch: Record<string, unknown> = { [column.key]: textOf(item) };
  (lookup.syncFields || []).forEach((sf) => {
    if (sf.key === column.key) return;
    const label = sourceVal(sf.column);
    const detail = sf.detailColumn ? sourceVal(sf.detailColumn) : '';
    patch[sf.key] = detail ? `${label} · ${detail}` : label;
  });
  return patch;
};

interface BulkLookupPickerProps {
  column: FieldColumn;
  value: string;
  isDarkMode: boolean;
  onPick: (patch: Record<string, unknown>) => void;
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

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);

  const load = useCallback(
    async (q: string, skip: number) => {
      if (!table || !colKey) return;
      if (skip === 0) {
        abortRef.current?.abort();
      }
      const ac = new AbortController();
      abortRef.current = ac;
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
      } catch (e) {
        if (isAbort(e)) return;
        setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not load options');
        if (skip === 0) setItems([]);
        setHasMore(false);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [table, colKey, detailKey, extraColsKey],
  );

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => load(query.trim(), 0), 180);
    return () => window.clearTimeout(t);
  }, [open, query, load]);

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
    if (!hasMore || loading) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      load(query.trim(), items.length);
    }
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
                  onPick(buildLookupBulkPatch(column, null));
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
                  onPick(buildLookupBulkPatch(column, it));
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

            {loading && <div style={{ padding: 10, fontSize: 13, color: muted }}>Loading…</div>}
            {!loading && error && <div style={{ padding: 10, fontSize: 13, color: '#dc2626' }}>{error}</div>}
            {!loading && !error && items.length === 0 && (
              <div style={{ padding: 10, fontSize: 13, color: muted }}>No matches</div>
            )}
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
