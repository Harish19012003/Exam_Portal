import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { DEFAULT_EXAM_VIEW, examViewLabel } from '@exam-view/shared';
import { Highlight } from '../../layouts/ExamSwitcher';
import { serviceHue } from '../../utils/serviceTone';

/**
 * Preset editor title: shows the full preset name and opens a searchable list of every preset
 * (same look as the exam switcher). `value` is the current preset id, or 'new' while creating.
 */
export const PresetSwitcher = ({ value, title, presets = [], onSelect, disabled = false }) => {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo(
    () =>
      [...presets]
        .map((p) => ({
          id: String(p.id),
          name: String(p.name || 'Untitled preset'),
          service: String(p.serviceValue || ''),
          page: examViewLabel(p.view || DEFAULT_EXAM_VIEW),
          fields: Array.isArray(p.fields) ? p.fields.length : p.fieldCount ?? 0,
        }))
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
            a.service.localeCompare(b.service),
        ),
    [presets],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => `${it.name} ${it.service} ${it.page}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const idx = items.findIndex((it) => it.id === String(value));
    setActive(idx >= 0 ? idx : 0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const choose = (id) => {
    setOpen(false);
    if (id !== String(value)) onSelect?.(id);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && visible[active]) {
      e.preventDefault();
      choose(visible[active].id);
    }
  };

  return (
    <div className="exam-switcher fpe-preset-switcher" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`fpe-switch-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${title} — switch preset`}
      >
        <span className="fpe-switch-name">{title}</span>
        <ChevronDown size={18} className="fpe-switch-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="exam-switcher-menu" role="presentation">
          <div className="exam-switcher-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, service or page…"
              aria-label="Search presets"
              aria-controls={listId}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                className="exam-switcher-clear"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="exam-switcher-list" role="listbox" id={listId} aria-label="Field presets">
            {value === 'new' && !query && (
              <div className="fpe-switch-new" aria-hidden="true">
                <span className="fpe-switch-new-dot" />
                Creating a new preset — pick one below to edit it instead
              </div>
            )}
            {visible.length === 0 ? (
              <div className="exam-switcher-empty">
                {query ? 'No presets match your search.' : 'No presets yet.'}
              </div>
            ) : (
              visible.map((it, i) => {
                const current = it.id === String(value);
                return (
                  <button
                    key={it.id}
                    id={`${listId}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={current}
                    className={`exam-switcher-item${current ? ' current' : ''}${i === active ? ' active' : ''}`}
                    style={{ '--svc-h': serviceHue(it.service) }}
                    title={`${it.name} · ${it.service || 'No service'} · ${it.page}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(it.id)}
                  >
                    <span className="exam-switcher-item-text">
                      <span className="exam-switcher-item-top">
                        <span className="exam-switcher-item-name">
                          <Highlight text={it.name} query={query} />
                        </span>
                        {it.service ? (
                          <span className="exam-switcher-svc">
                            <Highlight text={it.service} query={query} />
                          </span>
                        ) : null}
                      </span>
                      <span className="exam-switcher-item-code fpe-switch-meta">
                        <Highlight text={it.page} query={query} /> · {it.fields} field{it.fields === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="exam-switcher-check" aria-hidden="true">
                      {current ? <Check size={16} strokeWidth={2.5} /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="exam-switcher-foot">
              <span>
                {query ? `${visible.length} of ${items.length}` : items.length} preset{items.length === 1 ? '' : 's'}
              </span>
              <span className="exam-switcher-keys" aria-hidden="true">
                <kbd>↑</kbd>
                <kbd>↓</kbd> move · <kbd>↵</kbd> open
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
