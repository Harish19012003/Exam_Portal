import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CellEditorProps } from '../types';
import { isFieldColumn } from '../types';
import { listAssignableUsers } from '../../../pages/exams/assigneeApi';
import { formatAssigneeDisplay, seedAssigneeLabels } from './assigneeLabels';
import './UserAssigneeEditor.css';

type Person = { id: string; name: string; email: string; user_code?: string; tag_ids?: string[] };

const idsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

/** People filtered by the field's user tags. Dropdown = one id; Multiselect dropdown = id[]. */
export function UserAssigneeEditor({ value, column, onSave, onCancel, isDarkMode, autoFocus }: CellEditorProps) {
  const tagIds = isFieldColumn(column) ? column.userTags?.tagIds || [] : [];
  const multiple = !isFieldColumn(column) || column.userTags?.multiple !== false;
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = idsOf(value);
    return multiple ? ids : ids.slice(0, 1);
  });
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!tagIds.length) {
      setPeople([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await listAssignableUsers(tagIds);
      setPeople(rows);
      seedAssigneeLabels(rows);
      setLabels((prev) => {
        const next = { ...prev };
        rows.forEach((p) => {
          next[p.id] = formatAssigneeDisplay(p) || p.id;
        });
        return next;
      });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Could not load people');
    } finally {
      setLoading(false);
    }
  }, [tagIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!active || !el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 300), Math.min(380, window.innerWidth - 16));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 280 && above > below;
    setPos(
      up
        ? { left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.max(220, Math.min(400, above)) }
        : { left, width, top: r.bottom + 4, maxHeight: Math.max(220, Math.min(400, below)) },
    );
  }, [active]);

  const paintAndSave = useCallback(
    (ids: string[]) => {
      seedAssigneeLabels(
        ids.map((id) => {
          const person = people.find((p) => p.id === id);
          return {
            id,
            name: person?.name || labels[id] || id,
            email: person?.email,
            user_code: person?.user_code,
          };
        }),
      );
      onSave(ids);
    },
    [labels, people, onSave],
  );

  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setActive(false);
      paintAndSave(selected);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active, selected, paintAndSave]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        String(p.user_code || '')
          .toLowerCase()
          .includes(q),
    );
  }, [people, query]);

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
  const muted = dark ? '#9ca3af' : '#6b7280';

  const summary =
    selected.length === 0 ? '' : selected.map((id) => labels[id] || id).join(', ');

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
            commit();
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
            <div className="ua-menu__list">
              {!tagIds.length && <div className="ua-menu__empty">No tags configured on this field.</div>}
              {shown.map((p) => {
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
                        setActive(false);
                        paintAndSave(next);
                        return;
                      }
                      toggle(p.id);
                    }}
                  >
                    <span className={`ua-menu__check${on ? ' is-on' : ''}`} aria-hidden="true" />
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
              {loading && <div className="ua-menu__empty">Loading…</div>}
              {!loading && error && (
                <div className="ua-menu__empty is-error" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && tagIds.length > 0 && shown.length === 0 && (
                <div className="ua-menu__empty">No people with those tags</div>
              )}
            </div>
            <div className={`ua-menu__foot${dark ? ' is-dark' : ''}`}>
              <button
                type="button"
                className="ua-menu__btn"
                onClick={() => {
                  setSelected([]);
                  setActive(false);
                  paintAndSave([]);
                }}
              >
                Clear
              </button>
              <button type="button" className="ua-menu__btn ua-menu__btn--primary" onClick={commit}>
                Done{selected.length ? ` (${selected.length})` : ''}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
