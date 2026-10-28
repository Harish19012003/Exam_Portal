import React, { useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { Button, IconButton } from '../../components/Button';
import './UserGroups.css';

export const ROLE_TABS = [
  { id: 'role:super_admin', label: 'Super Admin' },
  { id: 'role:global_admin', label: 'Global Admin' },
  { id: 'role:admin', label: 'Admin' },
  { id: 'role:user', label: 'Standard User' },
];

const userName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;

/** All / role tabs / custom group tabs. `value` is 'all' | 'role:<role>' | 'group:<id>'. */
export const UserGroupTabs = ({ users, groups, value, onChange, onCreate, onEdit }) => {
  const counts = useMemo(() => {
    const byRole = {};
    users.forEach((u) => {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });
    const ids = new Set(users.map((u) => String(u.id)));
    return {
      all: users.length,
      role: (r) => byRole[r] || 0,
      group: (g) => g.userIds.filter((id) => ids.has(String(id))).length,
    };
  }, [users, groups]);

  const tab = (id, label, count, extra) => (
    <button
      key={id}
      type="button"
      className={`user-group-tab${value === id ? ' active' : ''}`}
      onClick={() => onChange(id)}
      aria-pressed={value === id}
    >
      <span>{label}</span>
      <span className="user-group-count">{count}</span>
      {extra}
    </button>
  );

  return (
    <div className="user-group-tabs" role="tablist" aria-label="User groups">
      {tab('all', 'All', counts.all)}
      {ROLE_TABS.map((t) => tab(t.id, t.label, counts.role(t.id.slice(5))))}
      {groups.length > 0 && <span className="user-group-divider" aria-hidden="true" />}
      {groups.map((g) =>
        tab(
          `group:${g.id}`,
          g.name,
          counts.group(g),
          <span
            role="button"
            tabIndex={0}
            className="user-group-edit"
            title={`Edit ${g.name}`}
            aria-label={`Edit group ${g.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(g);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onEdit(g);
              }
            }}
          >
            <Pencil size={12} />
          </span>,
        ),
      )}
      <button type="button" className="user-group-tab user-group-add" onClick={onCreate}>
        <Plus size={14} />
        <span>New group</span>
      </button>
    </div>
  );
};

/** Create / edit one group: a name and its members. */
export const UserGroupModal = ({ group, users, saving, error, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(group?.name || '');
  const [members, setMembers] = useState(() => new Set((group?.userIds || []).map(String)));
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${userName(u)} ${u.email}`.toLowerCase().includes(q));
  }, [users, query]);

  const toggle = (id) =>
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShownSelected = shown.length > 0 && shown.every((u) => members.has(String(u.id)));
  const toggleShown = () =>
    setMembers((prev) => {
      const next = new Set(prev);
      shown.forEach((u) => (allShownSelected ? next.delete(String(u.id)) : next.add(String(u.id))));
      return next;
    });

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    onSave({ name: name.trim(), userIds: [...members] });
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <form className="user-group-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-label={group ? 'Edit group' : 'New group'}>
        <div className="user-group-modal-head">
          <h2>{group ? 'Edit group' : 'New group'}</h2>
          <IconButton variant="ghost" label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="user-group-modal-body">
          <div className="user-group-field">
            <label htmlFor="user-group-name">Group name</label>
            <input
              id="user-group-name"
              className="user-group-input"
              value={name}
              maxLength={40}
              autoFocus
              placeholder="e.g. Exam team"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="user-group-field">
            <label htmlFor="user-group-search">Members ({members.size} selected)</label>
            <input
              id="user-group-search"
              className="user-group-input"
              type="search"
              value={query}
              placeholder="Search users…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="user-group-members">
            <label className="user-group-member" style={{ fontWeight: 700 }}>
              <input type="checkbox" checked={allShownSelected} onChange={toggleShown} />
              <span>{query.trim() ? 'Select all matching' : 'Select all'}</span>
            </label>
            {shown.map((u) => (
              <label key={u.id} className="user-group-member">
                <input type="checkbox" checked={members.has(String(u.id))} onChange={() => toggle(String(u.id))} />
                <span>
                  {userName(u)}
                  <small>{u.email}</small>
                </span>
              </label>
            ))}
            {shown.length === 0 && <div className="user-group-member">No users match.</div>}
          </div>

          {error ? <p className="user-group-error" role="alert">{error}</p> : null}
        </div>

        <div className="user-group-modal-foot">
          {group ? (
            <Button variant="ghost" onClick={onDelete} disabled={saving}>Delete group</Button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : group ? 'Save group' : 'Create group'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
