import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, GripVertical, Plus, Tag, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../components/Button';
import { apiClient } from '../../api/client';
import { useConfirm } from '../../feedback';
import { depthsOf, indent, moveNextTo, orderSiblingsBy, outdent } from './tagTree';
import './UserGroups.css';
import './UserTags.css';

export const TAG_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6b7280'];

const errorText = (err, fallback) => err.response?.data?.message || err.message || fallback;

/** Coloured tag chip, the same look the table's Tags column uses. */
export const TagChip = ({ tag }) => (
  <span className="user-tag-chip" style={{ color: tag.color, backgroundColor: `${tag.color}1f`, borderColor: `${tag.color}55` }}>
    {tag.name}
  </span>
);

const SORT_MODES = [
  { value: 'custom', label: 'My order' },
  { value: 'name_asc', label: 'Name A to Z' },
  { value: 'name_desc', label: 'Name Z to A' },
  { value: 'users_desc', label: 'Most users' },
  { value: 'newest', label: 'Newest first' },
];

const sortTags = (tags, mode) => {
  const list = [...tags];
  switch (mode) {
    case 'name_asc':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case 'users_desc':
      return list.sort((a, b) => b.userCount - a.userCount || a.name.localeCompare(b.name));
    case 'newest':
      return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    default:
      return list;
  }
};

/** Super Admin: create, rename, recolour, reorder and delete the central tag list. */
export const ManageTagsDialog = ({ tags, onClose, onChanged }) => {
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [openColor, setOpenColor] = useState(null);
  const [sortMode, setSortMode] = useState('custom');
  // The saved tree, kept locally so changes feel instant; the server copy replaces it after each save.
  const toItems = (list) => list.map((t) => ({ id: t.id, parentId: t.parentId || null }));
  const [items, setItems] = useState(() => toItems(tags));
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    setItems(toItems(tags));
  }, [tags]);

  const custom = sortMode === 'custom';
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const depth = useMemo(() => depthsOf(items), [items]);
  const rows = useMemo(() => {
    if (custom) return items.map((i) => byId.get(i.id)).filter(Boolean);
    return sortTags(tags, sortMode);
  }, [items, byId, tags, sortMode, custom]);
  const childCount = (id) => items.filter((i) => i.parentId === id).length;

  const saveItems = async (next) => {
    if (next === items) return;
    setItems(next);
    setError('');
    try {
      await apiClient.put('/users/tags/order', { items: next });
      await onChanged();
    } catch (err) {
      setItems(toItems(tags));
      setError(errorText(err, 'Could not save the change.'));
    }
  };

  // Neighbour in the list as shown, for the arrow keys.
  const neighbour = (id, step) => rows[rows.findIndex((t) => t.id === id) + step];
  const moveBy = (id, step) => {
    const target = neighbour(id, step);
    if (target) saveItems(moveNextTo(items, id, target.id));
  };

  const dropOn = (targetId) => {
    if (dragId && dragId !== targetId) saveItems(moveNextTo(items, dragId, targetId));
    setDragId(null);
    setOverId(null);
  };

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(errorText(err, 'Something went wrong.'));
    } finally {
      setBusy('');
    }
  };

  const add = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run('add', async () => {
      await apiClient.post('/users/tags', { name });
      setNewName('');
    });
  };

  const rename = (tag, name) => {
    const next = name.trim();
    if (!next || next === tag.name) return;
    run(tag.id, () => apiClient.put(`/users/tags/${tag.id}`, { name: next, color: tag.color }));
  };

  const recolor = (tag, color) => {
    setOpenColor(null);
    if (color !== tag.color) run(tag.id, () => apiClient.put(`/users/tags/${tag.id}`, { name: tag.name, color }));
  };

  const remove = async (tag) => {
    const ok = await confirm({
      title: 'Delete tag?',
      message: `Delete the tag "${tag.name}"?`,
      tertiary: [
        tag.userCount ? `It will be taken off ${tag.userCount} user${tag.userCount === 1 ? '' : 's'}.` : 'No users have this tag.',
        childCount(tag.id) ? `Its ${childCount(tag.id)} sub-tag${childCount(tag.id) === 1 ? '' : 's'} move up one level.` : '',
        'This cannot be undone.',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Delete tag',
      destructive: true,
    });
    if (ok) run(tag.id, () => apiClient.delete(`/users/tags/${tag.id}`));
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <div className="user-group-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Manage tags">
        <div className="user-group-modal-head">
          <div className="user-group-title">
            <h2>Manage tags</h2>
          </div>
          <IconButton variant="ghost" label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="user-group-modal-body">
          <form className="user-tag-add" onSubmit={add}>
            <input
              className="user-group-input"
              value={newName}
              maxLength={30}
              autoFocus
              placeholder="New tag, e.g. Centre A"
              aria-label="New tag name"
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button variant="primary" type="submit" icon={<Plus size={16} />} disabled={!newName.trim() || busy === 'add'}>
              Add
            </Button>
          </form>

          {tags.length > 1 && (
            <div className="user-tag-sortbar">
              <label htmlFor="user-tag-sort">Sort</label>
              <select id="user-tag-sort" className="user-group-input user-tag-sort" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                {SORT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {custom ? (
                <span className="user-tag-sort-hint">
                  Drag the handle to move a tag with its sub-tags. Use the arrows to nest a tag under the one above it, or bring it back out.
                </span>
              ) : (
                <Button
                  onClick={async () => {
                    await saveItems(orderSiblingsBy(items, rows.map((t) => t.id)));
                    setSortMode('custom');
                  }}
                >
                  Use as my order
                </Button>
              )}
            </div>
          )}

          <div className="user-tag-list">
            {tags.length === 0 ? (
              <div className="user-tag-empty">No tags yet. Add the first one above.</div>
            ) : (
              rows.map((tag, index) => {
                const level = custom ? depth.get(tag.id) || 0 : 0;
                return (
                <div
                  className={`user-tag-row${dragId === tag.id ? ' dragging' : ''}${overId === tag.id && dragId !== tag.id ? ' drop-target' : ''}${level ? ' nested' : ''}`}
                  key={tag.id}
                  style={{ paddingLeft: 10 + level * 24 }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOverId(tag.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOn(tag.id);
                  }}
                >
                  {custom && (
                    <div className="user-tag-reorder">
                      <span
                        className="user-tag-grip"
                        draggable
                        tabIndex={0}
                        role="button"
                        aria-label={`Move ${tag.name}. Up and down arrows move it, right arrow nests it, left arrow brings it out.`}
                        title="Drag to move. Arrow keys: up/down move, right nests, left brings out"
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(tag.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        onKeyDown={(e) => {
                          const act = { ArrowUp: () => moveBy(tag.id, -1), ArrowDown: () => moveBy(tag.id, 1), ArrowRight: () => saveItems(indent(items, tag.id)), ArrowLeft: () => saveItems(outdent(items, tag.id)) }[e.key];
                          if (act) {
                            e.preventDefault();
                            act();
                          }
                        }}
                      >
                        <GripVertical size={16} aria-hidden="true" />
                      </span>
                      <span className="user-tag-levels">
                        <button type="button" onClick={() => saveItems(outdent(items, tag.id))} disabled={!level} aria-label={`Bring ${tag.name} out one level`} title="Bring out one level">
                          <ChevronLeft size={16} strokeWidth={2.4} />
                        </button>
                        <button type="button" onClick={() => saveItems(indent(items, tag.id))} aria-label={`Nest ${tag.name} under the tag above`} title="Nest under the tag above">
                          <ChevronRight size={16} strokeWidth={2.4} />
                        </button>
                      </span>
                      <span className="user-tag-steps">
                        <button type="button" onClick={() => moveBy(tag.id, -1)} disabled={index === 0} aria-label={`Move ${tag.name} up`}>
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveBy(tag.id, 1)} disabled={index === rows.length - 1} aria-label={`Move ${tag.name} down`}>
                          <ArrowDown size={14} />
                        </button>
                      </span>
                    </div>
                  )}
                  <div className="user-tag-color-wrap">
                    <button
                      type="button"
                      className="user-tag-color"
                      style={{ backgroundColor: tag.color }}
                      onClick={() => setOpenColor(openColor === tag.id ? null : tag.id)}
                      aria-label={`Colour of ${tag.name}`}
                      aria-expanded={openColor === tag.id}
                    />
                    {openColor === tag.id && (
                      <div className="user-tag-palette" role="listbox" aria-label="Choose a colour">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="option"
                            aria-selected={c === tag.color}
                            className="user-tag-swatch"
                            style={{ backgroundColor: c }}
                            onClick={() => recolor(tag, c)}
                            aria-label={c}
                          >
                            {c === tag.color && <Check size={12} color="#fff" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    className="user-group-input user-tag-name"
                    defaultValue={tag.name}
                    key={`${tag.id}-${tag.name}`}
                    maxLength={30}
                    aria-label={`Name of ${tag.name}`}
                    onBlur={(e) => rename(tag, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <span className="user-tag-count" title="Users with this tag">
                    {tag.userCount}
                  </span>
                  <IconButton variant="ghost" label={`Delete ${tag.name}`} onClick={() => remove(tag)} disabled={busy === tag.id}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
                );
              })
            )}
          </div>

          {error ? <p className="user-group-error" role="alert">{error}</p> : null}
        </div>

        <div className="user-group-modal-foot">
          <span />
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

/** Super Admin: choose which tags one user has. Typing a new name offers to create it. */
export const AssignTagsDialog = ({ user, tags, onClose, onSaved, onTagsChanged }) => {
  const [selected, setSelected] = useState(() => new Set((user.tag_ids || []).map(String)));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, query]);
  const trimmed = query.trim();
  const canCreate = trimmed && !tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await apiClient.post('/users/tags', { name: trimmed });
      const tag = res.data?.data || res.data;
      await onTagsChanged();
      setSelected((prev) => new Set(prev).add(String(tag.id)));
      setQuery('');
    } catch (err) {
      setError(errorText(err, 'Could not create the tag.'));
    } finally {
      setCreating(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/users/${encodeURIComponent(user.id)}/tags`, { tagIds: [...selected] });
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save the tags.'));
      setSaving(false);
    }
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <form className="user-group-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-modal="true" aria-label={`Tags for ${name}`}>
        <div className="user-group-modal-head">
          <div className="user-group-title">
            <h2>Tags for {name}</h2>
          </div>
          <IconButton variant="ghost" label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="user-group-modal-body">
          <div className="user-group-field">
            <label htmlFor="user-tag-search">Tags ({selected.size} selected)</label>
            <input
              id="user-tag-search"
              className="user-group-input"
              type="search"
              value={query}
              maxLength={30}
              autoFocus
              placeholder="Search, or type a new tag name…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="user-group-members">
            {canCreate && (
              <button type="button" className="user-tag-create" onClick={create} disabled={creating}>
                <Plus size={15} aria-hidden="true" />
                <span>Create tag “{trimmed}”</span>
              </button>
            )}
            {shown.map((tag) => (
              <label key={tag.id} className="user-group-member" style={trimmed ? undefined : { paddingLeft: 12 + (tag.depth || 0) * 20 }}>
                <input type="checkbox" checked={selected.has(tag.id)} onChange={() => toggle(tag.id)} />
                <TagChip tag={tag} />
              </label>
            ))}
            {shown.length === 0 && !canCreate && (
              <div className="user-group-member">{tags.length ? 'No tags match.' : 'No tags yet. Type a name to create one.'}</div>
            )}
          </div>

          {error ? <p className="user-group-error" role="alert">{error}</p> : null}
        </div>

        <div className="user-group-modal-foot">
          <span />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" icon={<Tag size={16} />} disabled={saving}>
              {saving ? 'Saving…' : 'Save tags'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
