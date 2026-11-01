import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Search, Tag } from 'lucide-react';
import { TagChip } from '../users/UserTagDialogs';
import { listAssignableTags } from './assigneeApi';
import '../users/UserTags.css';
import './TagMultiPicker.css';

const idOf = (t) => String(t.id);

/** Build parent → children map from a flat tag list (display order preserved). */
const childrenMapOf = (tags) => {
  const map = new Map();
  tags.forEach((t) => {
    const pid = t.parentId ? String(t.parentId) : '';
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(t);
  });
  return map;
};

/**
 * Multi-select tags for a userTags field — compact collapsible tree.
 */
export function TagMultiPicker({
  value = [],
  onChange,
  label = 'Show people with these tags',
  hint = 'Only users who have at least one selected tag appear in the center-list dropdown.',
  tags: tagsProp,
  compact = false,
}) {
  const [tagsLocal, setTagsLocal] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!tagsProp);
  const [collapsed, setCollapsed] = useState(() => new Set());

  useEffect(() => {
    if (tagsProp) return undefined;
    let cancelled = false;
    setLoading(true);
    listAssignableTags()
      .then((rows) => {
        if (!cancelled) setTagsLocal(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'Could not load tags');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tagsProp]);

  const tags = tagsProp || tagsLocal;
  const selected = useMemo(() => new Set((value || []).map(String)), [value]);
  const childrenOf = useMemo(() => childrenMapOf(tags), [tags]);

  const q = query.trim().toLowerCase();
  const searching = Boolean(q);

  const rows = useMemo(() => {
    if (searching) {
      return tags
        .filter((t) => String(t.name || '').toLowerCase().includes(q))
        .map((t) => ({ tag: t, depth: 0, hasChildren: false }));
    }
    const out = [];
    const walk = (parentId, depth) => {
      (childrenOf.get(parentId) || []).forEach((t) => {
        const id = idOf(t);
        const kids = childrenOf.get(id) || [];
        out.push({ tag: t, depth, hasChildren: kids.length > 0 });
        if (kids.length && !collapsed.has(id)) walk(id, depth + 1);
      });
    };
    walk('', 0);
    return out;
  }, [tags, childrenOf, collapsed, searching, q]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange?.([...next]);
  };

  const toggleCollapse = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={`exams-tag-pick${compact ? ' exams-tag-pick--compact' : ''}`}>
      {!compact && label ? <span className="exams-audit-label">{label}</span> : null}
      {!compact && hint ? <p className="exams-tag-pick__hint">{hint}</p> : null}

      <div className="exams-tag-pick__search-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tags…"
          aria-label="Search tags"
          className="exams-tag-pick__search"
        />
      </div>

      <div className="exams-tag-pick__list" role="tree" aria-label="Tags">
        {loading && <div className="exams-tag-pick__empty">Loading tags…</div>}
        {!loading && error && (
          <div className="exams-tag-pick__error" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="exams-tag-pick__empty">
            {tags.length ? 'No tags match your search.' : 'No tags yet. Create them in User Management.'}
          </div>
        )}
        {!loading &&
          !error &&
          rows.map(({ tag, depth, hasChildren }) => {
            const id = idOf(tag);
            const on = selected.has(id);
            const open = !collapsed.has(id);
            return (
              <label
                key={id}
                className={`exams-tag-pick__row${on ? ' is-on' : ''}`}
                style={{ paddingLeft: 6 + depth * 16 }}
                role="treeitem"
                aria-selected={on}
                aria-expanded={hasChildren ? open : undefined}
              >
                <button
                  type="button"
                  className={`exams-tag-pick__twist${hasChildren ? '' : ' is-leaf'}`}
                  tabIndex={hasChildren ? 0 : -1}
                  aria-label={open ? `Collapse ${tag.name}` : `Expand ${tag.name}`}
                  onClick={(e) => (hasChildren ? toggleCollapse(e, id) : e.preventDefault())}
                >
                  {hasChildren ? open ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : null}
                </button>
                <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                <span className="exams-tag-pick__chip">
                  <TagChip tag={tag} />
                </span>
              </label>
            );
          })}
      </div>
    </div>
  );
}

/** Compact control for table cells: opens an anchored dropdown (not a modal). */
export function TagPickCellButton({ value = [], tags = [], invalid = false, errorText = '', onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => (value || []).map(String));
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const selected = useMemo(() => new Set((value || []).map(String)), [value]);
  const chosen = useMemo(() => tags.filter((t) => selected.has(String(t.id))), [tags, selected]);
  const summary =
    chosen.length === 0
      ? 'Select tags…'
      : chosen.length <= 2
        ? chosen.map((t) => t.name).join(', ')
        : `${chosen
            .slice(0, 2)
            .map((t) => t.name)
            .join(', ')} +${chosen.length - 2}`;

  useEffect(() => {
    if (open) setDraft((value || []).map(String));
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return undefined;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, 300), Math.min(380, window.innerWidth - 16));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 300 && above > below;
      setPos(
        up
          ? { left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.max(240, Math.min(420, above)) }
          : { left, width, top: r.bottom + 4, maxHeight: Math.max(240, Math.min(420, below)) },
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      onChange?.((draft || []).map(String));
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, draft, onChange]);

  const applyAndClose = () => {
    onChange?.((draft || []).map(String));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`exams-bulk-dep-link${invalid ? ' invalid' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel || 'Select tags'}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={chosen.map((t) => t.name).join(', ') || 'Select tags'}
        style={{ minHeight: 40, width: '100%', justifyContent: 'flex-start' }}
      >
        <Tag size={13} aria-hidden="true" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {summary}
        </span>
        <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>
      {errorText ? <span className="exams-bulk-err">{errorText}</span> : null}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="exams-tag-pick-popover"
            role="dialog"
            aria-label="Select tags"
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
          >
            <div className="exams-tag-pick-popover__body">
              <TagMultiPicker compact value={draft} onChange={setDraft} tags={tags} label="" hint="" />
            </div>
            <div className="exams-tag-pick-popover__foot">
              <button type="button" className="exams-tag-pick-popover__btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="exams-tag-pick-popover__btn exams-tag-pick-popover__btn--primary" onClick={applyAndClose}>
                Done{draft.length ? ` (${draft.length})` : ''}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Full-page style picker for the single-field editor (inline, no modal). */
export function TagPickInline({ value = [], tags, onChange }) {
  return (
    <div className="exams-tag-pick-inline">
      <TagMultiPicker
        value={value}
        onChange={onChange}
        tags={tags}
        label="Show people with these tags"
        hint="People with any of these tags can be assigned on the center list."
      />
    </div>
  );
}
