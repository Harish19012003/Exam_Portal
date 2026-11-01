import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../../api/client';
import type { CellEditorProps } from '../types';
import { isFieldColumn } from '../types';
import { setLookupPick } from './lookupPicks';

interface Item {
  id: string;
  label: string;
  detail: string;
}

const PAGE = 20;
const textOf = (it: Item) => (it.detail ? `${it.label} · ${it.detail}` : it.label);

/** Cell editor for a column that reads its choices live from another table: search, pick a row. */
export function LookupEditor({ value, row, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const lookup = isFieldColumn(column) ? column.lookup : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Only the cell being typed in shows its list. When a whole row is in edit mode every lookup cell
  // mounts an editor, so each one waits until it is focused.
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const load = useCallback(
    async (q: string, skip: number) => {
      if (!lookup) return;
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get(`/table-lookup/${lookup.table}/rows`, {
          params: { column: lookup.column, detailColumn: lookup.detailColumn || undefined, q, skip, limit: PAGE },
        });
        const res = data?.data ?? data;
        const page: Item[] = Array.isArray(res?.items) ? res.items : [];
        setItems((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(Boolean(res?.hasMore));
      } catch (err) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e?.response?.data?.message || 'Could not load options');
      } finally {
        setLoading(false);
      }
    },
    [lookup],
  );

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => void load(query.trim(), 0), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [active, query, load]);

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

  const pick = (id: string, label: string) => {
    setLookupPick(String(row.rowId), column.key, id);
    setActive(false);
    onSave(label);
  };

  const dark = isDarkMode;
  const border = dark ? '#334155' : '#e2e8f0';
  const bg = dark ? '#1e293b' : '#ffffff';
  const fg = dark ? '#f1f5f9' : '#0f172a';
  const muted = dark ? '#94a3b8' : '#64748b';

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
              boxShadow: '0 10px 30px rgba(15,23,42,0.25)',
              padding: 4,
              boxSizing: 'border-box',
            }}
          >
            {String(value ?? '') && (
              <button type="button" onClick={() => pick('', '')} style={optionStyle(muted)}>
                Clear
              </button>
            )}
            {items.map((it) => (
              <button key={it.id} type="button" role="option" aria-selected={false} onClick={() => pick(it.id, textOf(it))} style={optionStyle(fg)}>
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
              <button type="button" onClick={() => void load(query.trim(), items.length)} style={optionStyle('#5c43fa')}>
                Load more…
              </button>
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
