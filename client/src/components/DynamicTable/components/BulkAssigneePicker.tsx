import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import type { FieldColumn } from '../types';
import { useAssignablePeople } from '../../../pages/exams/useAssignablePeople';
import { formatAssigneeDisplay, seedAssigneeLabels } from '../editors/assigneeLabels';
import { DYNAMIC_DROPDOWN_PORTAL_CLASS } from '../../DynamicData/fields';
import '../editors/UserAssigneeEditor.css';

const idsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

export type BulkAssigneePickMeta = {
  columnKey: string;
  /** User ids to persist (empty = clear). */
  ids: string[];
  /** id → display label for optimistic table paint. */
  labels: Record<string, string>;
};

type MenuPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

interface BulkAssigneePickerProps {
  column: FieldColumn;
  value: unknown;
  isDarkMode: boolean;
  onPick: (ids: string[], meta: BulkAssigneePickMeta) => void;
}

/** Mass-edit people picker — portal menu overlays sibling fields (same users as cell editor). */
export function BulkAssigneePicker({ column, value, isDarkMode, onPick }: BulkAssigneePickerProps) {
  const tagIds = column.userTags?.tagIds || [];
  // Explicit true only — Dropdown + User tags = one person.
  const multiple = column.userTags?.multiple === true;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = idsOf(value);
    return multiple ? ids : ids.slice(0, 1);
  });
  const [pos, setPos] = useState<MenuPos | null>(null);

  // Paginated + server search (shared cache with cell editor).
  const { people, labels, loading, loadingMore, hasMore, loadMore, error, total } = useAssignablePeople(
    tagIds,
    { enabled: open, search: query },
  );

  useEffect(() => {
    const ids = idsOf(value);
    setSelected(multiple ? ids : ids.slice(0, 1));
  }, [value, multiple]);

  const placeMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 280), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const gap = 6;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const preferUp = below < 260 && above > below;
    if (preferUp) {
      setPos({
        left,
        width,
        bottom: window.innerHeight - r.top + gap,
        maxHeight: Math.max(200, Math.min(320, above)),
      });
    } else {
      setPos({
        left,
        width,
        top: r.bottom + gap,
        maxHeight: Math.max(200, Math.min(320, below)),
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    placeMenu();
    const onReposition = () => placeMenu();
    window.addEventListener('resize', onReposition);
    // Mass Edit list scrolls — keep the menu glued to the trigger.
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!hasMore || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore();
  };

  const commit = (ids: string[]) => {
    const nextLabels: Record<string, string> = {};
    ids.forEach((id) => {
      const person = people.find((p) => p.id === id);
      nextLabels[id] = person ? formatAssigneeDisplay(person) : labels[id] || id;
    });
    seedAssigneeLabels(
      ids.map((id) => ({
        id,
        name: nextLabels[id],
        email: people.find((p) => p.id === id)?.email,
        user_code: people.find((p) => p.id === id)?.user_code,
      })),
    );
    const stored = multiple ? ids : ids.slice(0, 1);
    onPick(stored, { columnKey: column.key, ids: stored, labels: nextLabels });
  };

  const summary =
    selected.length === 0
      ? 'Select people…'
      : selected.map((id) => labels[id] || id).join(', ');

  const dark = isDarkMode;
  const border = dark ? '#374151' : '#e5e7eb';
  const bg = dark ? '#111827' : '#ffffff';
  const fg = dark ? '#f3f4f6' : '#030712';
  const muted = dark ? '#9ca3af' : '#6b7280';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`w-full min-h-[44px] px-3 py-2 text-left text-[13px] font-medium rounded-lg border flex items-center gap-2 transition-colors
          ${open ? 'ring-2 ring-[#13C296]/20 border-[#13C296]' : ''}
          ${dark ? 'bg-gray-900 border-gray-700 text-gray-100 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`flex-1 min-w-0 truncate ${selected.length ? '' : ''}`} style={{ color: selected.length ? undefined : muted }}>
          {summary}
        </span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            className={`p-1 rounded-md ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelected([]);
              commit([]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setSelected([]);
                commit([]);
              }
            }}
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: muted }}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className={`ua-menu ${DYNAMIC_DROPDOWN_PORTAL_CLASS}${dark ? ' is-dark' : ''}`}
            role="listbox"
            aria-multiselectable={multiple}
            style={{
              position: 'fixed',
              zIndex: 10060,
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
              background: bg,
              color: fg,
              border: `1px solid ${border}`,
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(3, 7, 18, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ borderBottom: `1px solid ${dark ? '#374151' : '#f3f4f6'}` }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: muted }} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
              />
            </div>
            <div className="ua-menu__list" style={{ flex: 1, minHeight: 0 }} onScroll={onListScroll}>
              {!tagIds.length && <div className="ua-menu__empty">No tags configured on this field.</div>}
              {people.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ua-menu__row${on ? (dark ? ' is-on-dark' : ' is-on') : ''}`}
                    onClick={() => {
                      if (!multiple) {
                        const next = selected.includes(p.id) ? [] : [p.id];
                        setSelected(next);
                        commit(next);
                        setOpen(false);
                        setQuery('');
                        return;
                      }
                      setSelected((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      );
                    }}
                  >
                    <span
                      className={`ua-menu__check${multiple ? '' : ' is-radio'}${on ? ' is-on' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="ua-menu__meta">
                      <span className="ua-menu__name">
                        {p.name}
                        {p.user_code ? <span className="ua-menu__code"> · {p.user_code}</span> : null}
                      </span>
                      {p.email ? <span className="ua-menu__email">{p.email}</span> : null}
                    </span>
                  </button>
                );
              })}
              {loading && people.length === 0 && <div className="ua-menu__empty">Loading…</div>}
              {loadingMore && <div className="ua-menu__empty">Loading more…</div>}
              {!loading && !loadingMore && hasMore && (
                <button type="button" className="ua-menu__empty ua-menu__more" onClick={loadMore}>
                  Show more{total ? ` (${people.length}/${total})` : ''}
                </button>
              )}
              {!loading && error && (
                <div className="ua-menu__empty is-error" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && tagIds.length > 0 && people.length === 0 && (
                <div className="ua-menu__empty">
                  {query.trim() ? 'No people match that search' : 'No people with those tags'}
                </div>
              )}
            </div>
            {multiple && (
              <div className={`ua-menu__foot${dark ? ' is-dark' : ''} shrink-0`}>
                <button
                  type="button"
                  className="ua-menu__btn"
                  onClick={() => {
                    setSelected([]);
                    commit([]);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="ua-menu__btn"
                  style={{ background: '#13C296', borderColor: '#13C296', color: '#fff' }}
                  onClick={() => {
                    commit(selected);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  Done{selected.length ? ` (${selected.length})` : ''}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
