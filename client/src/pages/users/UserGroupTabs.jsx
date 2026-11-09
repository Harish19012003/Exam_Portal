import React, { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Users, X } from 'lucide-react';
import { Button, IconButton } from '../../components/Button';
import { InfoTip } from '../../components/PageHeading';
import { SearchableSelect } from '../exams/SearchableSelect';
import { PermissionSetEditor, cleanPermissionSet } from './PermissionSetEditor';
import './UserGroups.css';

export const ROLE_TABS = [
  { id: 'role:super_admin', label: 'Super Admin' },
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

  const options = [
    { value: 'all', label: `All (${counts.all})` },
    ...ROLE_TABS.map((t) => ({ value: t.id, label: `${t.label} (${counts.role(t.id.slice(5))})` })),
    ...groups.map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${counts.group(g)})` })),
  ];
  const activeGroup = value.startsWith('group:') ? groups.find((g) => `group:${g.id}` === value) : null;

  return (
    <div className="user-group-tabs" aria-label="User groups">
      <div className="user-group-select">
        <SearchableSelect
          ariaLabel="User group"
          value={value}
          options={options}
          onChange={onChange}
          searchThreshold={8}
          portal
        />
      </div>
      {onEdit && activeGroup && (
        <button
          type="button"
          className="user-group-tab user-group-edit-btn"
          title={`Edit ${activeGroup.name}`}
          aria-label={`Edit group ${activeGroup.name}`}
          onClick={() => onEdit(activeGroup)}
        >
          <Pencil size={14} />
          <span>Edit</span>
        </button>
      )}
      {onCreate && (
        <button type="button" className="user-group-tab user-group-add" onClick={onCreate}>
          <Plus size={14} />
          <span>New group</span>
        </button>
      )}
    </div>
  );
};

/** Create / edit one group: a name, its members and what they may access. */
export const UserGroupModal = ({ group, users, saving, error, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(group?.name || '');
  const [members, setMembers] = useState(() => new Set((group?.userIds || []).map(String)));
  const [query, setQuery] = useState('');
  const [view, setView] = useState('members');
  const [permissions, setPermissions] = useState(() => group?.permissions || { pages: {}, tables: {} });

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
    onSave({ name: name.trim(), userIds: [...members], permissions: cleanPermissionSet(permissions) });
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <form className="user-group-modal wide" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-label={group ? 'Edit group' : 'New group'}>
        <div className="user-group-modal-head">
          <div className="user-group-title">
            <h2>{group ? 'Edit group' : 'New group'}</h2>
            <InfoTip title="How group access works" className="user-group-info">
              Choose an access level for each area. Use Fine-tune to protect columns or limit rows. Someone in several
              groups gets everything those groups allow together; Super Admins always have full access.
            </InfoTip>
          </div>
          <div className="perm-tabs perm-tabs--head" role="tablist" aria-label="Group settings">
            {[
              ['members', `Members (${members.size})`, Users, members.size],
              ['permissions', 'Permissions', ShieldCheck, null],
            ].map(([id, label, Icon, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                aria-label={label}
                title={label}
                className={`perm-tab perm-tab--icon${view === id ? ' active' : ''}`}
                onClick={() => setView(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {count !== null && <span className="perm-tab-count">{count}</span>}
              </button>
            ))}
          </div>
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

          {view === 'permissions' ? (
            <PermissionSetEditor value={permissions} onChange={setPermissions} mode="group" disabled={saving} />
          ) : (
          <>
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
          </>
          )}

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
