import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { hasAnyPermission } from '@exam-view/shared';
import { Button, IconButton } from '../../components/Button';
import { PermissionSetEditor, cleanPermissionSet } from './PermissionSetEditor';
import './UserGroups.css';

const emptySet = () => ({ pages: {}, tables: {} });

const ROLE_LABELS = { super_admin: 'Super Admin', global_admin: 'Global Admin', admin: 'Admin', user: 'Standard User' };

/** Super Admin only: a person's extra rights / blocks on top of their groups. */
export const UserAccessModal = ({ user, groups, saving, error, onSave, onClose }) => {
  const [view, setView] = useState('summary');
  const [grant, setGrant] = useState(() => user?.access_overrides?.grant || emptySet());
  const [deny, setDeny] = useState(() => user?.access_overrides?.deny || emptySet());

  const memberOf = useMemo(
    () => (groups || []).filter((g) => (g.userIds || []).map(String).includes(String(user?.id))),
    [groups, user],
  );
  const configuredGroups = memberOf.filter((g) => hasAnyPermission(g.permissions));
  const isSuperAdmin = user?.role === 'super_admin';
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email;

  const submit = (e) => {
    e.preventDefault();
    if (saving) return;
    onSave({ grant: cleanPermissionSet(grant), deny: cleanPermissionSet(deny) });
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <form
        className="user-group-modal wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`Access for ${name}`}
      >
        <div className="user-group-modal-head">
          <h2>Access · {name}</h2>
          <IconButton variant="ghost" label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="user-group-modal-body">
          <div className="perm-tabs" role="tablist" aria-label="Access settings">
            {[
              ['summary', 'Where access comes from'],
              ['grant', 'Extra rights'],
              ['deny', 'Blocked'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={`perm-tab${view === id ? ' active' : ''}`}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'summary' && (
            <div className="perm-editor">
              {isSuperAdmin ? (
                <p className="perm-notice">Super Admins can do everything; groups and overrides don&apos;t apply.</p>
              ) : configuredGroups.length ? (
                <p className="perm-notice">
                  Access is everything allowed by these groups together, plus <strong>Extra rights</strong>, minus{' '}
                  <strong>Blocked</strong>.
                </p>
              ) : (
                <p className="perm-notice">
                  Not in any group with permissions yet, so the default access of the{' '}
                  <strong>{ROLE_LABELS[user?.role] || user?.role}</strong> role applies (plus Extra rights, minus
                  Blocked). Add them to a group to control access precisely.
                </p>
              )}
              <section className="perm-section">
                <h3 className="perm-section-title">Groups ({memberOf.length})</h3>
                {memberOf.length === 0 ? (
                  <p className="perm-hint">Not a member of any group.</p>
                ) : (
                  <div className="perm-chip-grid">
                    {memberOf.map((g) => (
                      <span key={g.id} className={`perm-chip${hasAnyPermission(g.permissions) ? ' on' : ''}`}>
                        {g.name}
                        {!hasAnyPermission(g.permissions) && ' (no permissions set)'}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {view === 'grant' && (
            <PermissionSetEditor value={grant} onChange={setGrant} mode="grant" disabled={saving || isSuperAdmin} />
          )}
          {view === 'deny' && (
            <PermissionSetEditor value={deny} onChange={setDeny} mode="deny" disabled={saving || isSuperAdmin} />
          )}

          {error ? <p className="user-group-error" role="alert">{error}</p> : null}
        </div>

        <div className="user-group-modal-foot">
          <span />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving || isSuperAdmin}>
              {saving ? 'Saving…' : 'Save access'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
