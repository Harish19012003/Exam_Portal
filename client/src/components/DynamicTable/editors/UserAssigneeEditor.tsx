import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CellEditorProps } from '../types';
import { isFieldColumn } from '../types';
import { useAssignablePeople } from '../../../pages/exams/useAssignablePeople';
import {
  findAssigneeIdByLabel,
  getAssigneeLabel,
  seedAssigneeLabels,
} from './assigneeLabels';
import './UserAssigneeEditor.css';

const looksLikeUserId = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  return false;
};

const idsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

/** Coerce cell value to user ids (never keep display names like "Aadarsh · AAD5005"). */
const coerceAssigneeIds = (value: unknown): string[] => {
  const out: string[] = [];
  idsOf(value).forEach((token) => {
    if (looksLikeUserId(token)) {
      if (!out.includes(token)) out.push(token);
      return;
    }
    const fromLabel = findAssigneeIdByLabel(token);
    if (fromLabel && !out.includes(fromLabel)) out.push(fromLabel);
  });
  return out;
};

const menuPosFor = (el: HTMLElement | null) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 300), Math.min(380, window.innerWidth - 16));
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  const below = window.innerHeight - r.bottom - 12;
  const above = r.top - 12;
  const up = below < 280 && above > below;
  return up
    ? {
        left,
        width,
        bottom: window.innerHeight - r.top + 4,
        maxHeight: Math.max(220, Math.min(400, above)),
      }
    : {
        left,
        width,
        top: r.bottom + 4,
        maxHeight: Math.max(220, Math.min(400, below)),
      };
};

/** People filtered by the field's user tags. Dropdown = one id; Multiselect dropdown = id[]. */
export function UserAssigneeEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const tagIds = isFieldColumn(column) ? column.userTags?.tagIds || [] : [];
  // Explicit true only — Dropdown fields must stay single-select.
  const multiple = isFieldColumn(column) && column.userTags?.multiple === true;
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = coerceAssigneeIds(value);
    return multiple ? ids : ids.slice(0, 1);
  });
  // Open immediately when the cell editor mounts (autoFocus) — don't wait for a second click.
  const [active, setActive] = useState(Boolean(autoFocus));
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(
    null,
  );

  // Paginated + server search. Scroll loads more; typing searches after a short debounce.
  const { people, labels, loading, loadingMore, hasMore, loadMore, error, total } = useAssignablePeople(
    tagIds,
    { enabled: true, search: query },
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (!active) {
      setPos(null);
      return;
    }
    setPos(menuPosFor(inputRef.current));
  }, [active]);

  const paintAndSave = useCallback(
    (ids: string[], opts?: { force?: boolean }) => {
      // Clear must always save even if a prior pick in this open already committed.
      if (committedRef.current && !opts?.force) return;
      committedRef.current = true;
      const clean = ids.filter(looksLikeUserId);
      seedAssigneeLabels(
        clean
          .map((id) => {
            const person = people.find((p) => p.id === id);
            const name = person?.name || labels[id] || getAssigneeLabel(id) || '';
            if (!name || name === id) return null;
            return {
              id,
              name,
              email: person?.email,
              user_code: person?.user_code,
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          name: string;
          email?: string;
          user_code?: string | null;
        }>,
      );
      onSave(multiple ? clean : clean[0] || '');
    },
    [labels, people, onSave, multiple],
  );

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setActive(false);
      paintAndSave(selectedRef.current);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active, paintAndSave]);

  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!hasMore || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore();
  };

  const toggle = (id: string) => {
    if (!multiple) {
      setSelected((prev) => (prev.includes(id) ? [] : [id]));
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const commit = () => {
    setActive(false);
    paintAndSave(selected);
  };

  const dark = isDarkMode;
  const border = dark ? '#1f2937' : '#e5e7eb';
  const bg = dark ? '#111827' : '#ffffff';
  const fg = dark ? '#f3f4f6' : '#030712';

  const summary =
    selected.length === 0
      ? ''
      : selected.map((id) => labels[id] || getAssigneeLabel(id) || id).join(', ');

  if (!isFieldColumn(column) || !column.userTags) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={query}
        placeholder={summary || 'Search people…'}
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
          if (e.key === 'Enter') {
            e.preventDefault();
            if (multiple) commit();
            else if (people[0]) {
              const next = [people[0].id];
              setSelected(next);
              setActive(false);
              paintAndSave(next);
            } else {
              commit();
            }
          }
        }}
        aria-label={
          multiple ? `Assign people for ${column.label}` : `Assign person for ${column.label}`
        }
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: 0,
          maxHeight: '100%',
          flex: '1 1 0%',
          alignSelf: 'stretch',
          boxSizing: 'border-box',
          padding: '0 6px',
          margin: 0,
          font: 'inherit',
          fontSize: 13,
          lineHeight: 1.2,
          color: fg,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          outline: 'none',
          boxShadow: 'inset 0 0 0 2px #5c43fa',
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
      {active &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className={`ua-menu${dark ? ' is-dark' : ''}`}
            role="listbox"
            aria-multiselectable={multiple}
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
              background: bg,
              color: fg,
              border: `1px solid ${border}`,
            }}
          >
            <div className="ua-menu__list" onScroll={onListScroll}>
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
                    onMouseDown={(e) => {
                      // mousedown: commit before document outside-handler / blur can cancel.
                      e.preventDefault();
                      e.stopPropagation();
                      if (!multiple) {
                        const next = [p.id];
                        setSelected(next);
                        setActive(false);
                        paintAndSave(next, { force: true });
                        return;
                      }
                      toggle(p.id);
                    }}
                  >
                    <span
                      className={`ua-menu__check${multiple ? '' : ' is-radio'}${on ? ' is-on' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="ua-menu__meta">
                      <span className="ua-menu__name">
                        {p.name}
                        {p.user_code ? (
                          <span className="ua-menu__code" title="User code">
                            {' '}
                            · {p.user_code}
                          </span>
                        ) : null}
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
            <div className={`ua-menu__foot${dark ? ' is-dark' : ''}`}>
              <button
                type="button"
                className="ua-menu__btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected([]);
                  setActive(false);
                  paintAndSave([], { force: true });
                }}
              >
                Clear
              </button>
              {multiple ? (
                <button type="button" className="ua-menu__btn ua-menu__btn--primary" onClick={commit}>
                  Done{selected.length ? ` (${selected.length})` : ''}
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
