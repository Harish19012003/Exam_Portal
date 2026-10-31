import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, ArrowRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useConfirm } from '../../feedback';
import { SearchableSelect } from './SearchableSelect';
import { normalizeFieldKey, slugifyKey } from './examFieldTypes';
import { humanizeGroup, isLinkedField, isTableSourceField, listLookupSources } from './tableLookupApi';
import './ColumnGroupsModal.css';

const MODES = [
  { value: 'edit', label: 'Editable (search box)' },
  { value: 'read', label: 'Read-only (follows)' },
];

const newId = () => `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const slugGroup = (name) => normalizeFieldKey(slugifyKey(name)) || 'group';

/** Groups found in the fields. A table-column field with no group counts as a group of its own. */
const deriveGroups = (fields) => {
  const out = new Map();
  fields.filter(isTableSourceField).forEach((f) => {
    const id = f.lookupGroup || `single:${f.key}`;
    if (!out.has(id)) {
      out.set(id, {
        id,
        key: f.lookupGroup || '',
        name: f.lookupGroup ? humanizeGroup(f.lookupGroup) : f.label,
        table: f.tableSource.table,
        editable: [],
        readonly: [],
      });
    }
    out.get(id).editable.push(f);
  });
  fields.filter(isLinkedField).forEach((l) => {
    const src = fields.find((f) => f.key === l.linkedFrom.fieldKey);
    if (!src || !isTableSourceField(src)) return;
    out.get(src.lookupGroup || `single:${src.key}`)?.readonly.push(l);
  });
  return [...out.values()];
};

const memberFromField = (f, mode) => ({
  id: f.id,
  label: f.label,
  column: mode === 'edit' ? f.tableSource.column : f.linkedFrom.column,
  mode,
});

/** Fields with the group's members created / updated / removed. */
const applyGroup = (fields, group, draft) => {
  const next = fields.map((f) => ({ ...f }));
  const taken = new Set(next.map((f) => f.key));
  const groupKey = slugGroup(draft.name);

  const prepared = draft.members.map((m) => {
    if (m.id) return { ...m, key: next.find((f) => f.id === m.id)?.key };
    let key = normalizeFieldKey(slugifyKey(m.label)) || 'field';
    for (let n = 2; taken.has(key); n += 1) key = `${key.replace(/_\d+$/, '')}_${n}`;
    taken.add(key);
    return { ...m, key };
  });
  const primary = prepared.find((m) => m.mode === 'edit');
  const detailFor = (m) =>
    prepared.find((o) => o !== m && o.mode === 'edit' && o.column && o.column !== m.column)?.column ||
    prepared.find((o) => o !== m && o.column && o.column !== m.column)?.column;

  const added = [];
  prepared.forEach((m) => {
    const existing = m.id ? next.find((f) => f.id === m.id) : null;
    const base = existing || {
      id: newId(),
      key: m.key,
      required: false,
      layout: 'full',
      autoFill: 'none',
      sameAsFieldKey: '',
      sameAsDefaultOn: true,
    };
    const common = { ...base, label: m.label.trim(), key: m.key, allowMultiple: false, options: [], configListId: '' };
    const field =
      m.mode === 'edit'
        ? {
            ...common,
            dataType: ['dropdown', 'status'].includes(base.dataType) ? base.dataType : 'dropdown',
            optionsSource: 'table',
            tableSource: { table: draft.table, column: m.column, ...(detailFor(m) ? { detailColumn: detailFor(m) } : {}) },
            lookupGroup: groupKey,
            linkedFrom: undefined,
          }
        : {
            ...common,
            dataType: 'linked',
            optionsSource: 'manual',
            tableSource: undefined,
            lookupGroup: undefined,
            required: false,
            autoFill: 'none',
            linkedFrom: { fieldKey: primary.key, column: m.column },
          };
    if (existing) next[next.findIndex((f) => f.id === existing.id)] = field;
    else added.push(field);
  });

  // Members dropped from the group: a Linked value is removed (it holds no data); a lookup field stays, ungrouped.
  const keep = new Set(draft.members.map((m) => m.id).filter(Boolean));
  const original = group ? [...group.editable, ...group.readonly] : [];
  let result = next.filter((f) => !original.some((o) => o.id === f.id && isLinkedField(o) && !keep.has(o.id)));
  result = result.map((f) =>
    original.some((o) => o.id === f.id && !isLinkedField(o) && !keep.has(o.id)) ? { ...f, lookupGroup: undefined } : f,
  );

  const lastMember = result.reduce((n, f, i) => (keep.has(f.id) || original.some((o) => o.id === f.id) ? i : n), -1);
  const at = lastMember >= 0 ? lastMember + 1 : result.length;
  result = [...result.slice(0, at), ...added, ...result.slice(at)];
  return result.map((f, i) => ({ ...f, order: i + 1 }));
};

const removeGroup = (fields, group) => {
  const linkedIds = new Set(group.readonly.map((l) => l.id));
  const editableIds = new Set(group.editable.map((f) => f.id));
  return fields
    .filter((f) => !linkedIds.has(f.id))
    .map((f) => (editableIds.has(f.id) ? { ...f, lookupGroup: undefined } : f))
    .map((f, i) => ({ ...f, order: i + 1 }));
};

export const ColumnGroupsModal = ({ fields, onClose, onSave }) => {
  const confirm = useConfirm();
  const groups = useMemo(() => deriveGroups(fields), [fields]);
  const [sources, setSources] = useState([]);
  const [editing, setEditing] = useState(null); // { group, draft } while the editor is open
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listLookupSources()
      .then((list) => {
        if (!cancelled) setSources(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (document.querySelector('.exams-search-select-portal')) {
        document.dispatchEvent(new MouseEvent('mousedown'));
        return;
      }
      if (editing) setEditing(null);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [editing, onClose]);

  const tableLabel = (table) => sources.find((t) => t.table === table)?.label || table;
  const columnsOf = (table) => sources.find((t) => t.table === table)?.columns || [];
  const columnLabel = (table, column) => columnsOf(table).find((c) => c.key === column)?.label || column;

  const openNew = () => {
    setShowErrors(false);
    setEditing({
      group: null,
      draft: {
        name: '',
        table: '',
        members: [
          { id: '', label: '', column: '', mode: 'edit' },
          { id: '', label: '', column: '', mode: 'edit' },
        ],
      },
    });
  };

  const openEdit = (group) => {
    setShowErrors(false);
    setEditing({
      group,
      draft: {
        name: group.name,
        table: group.table,
        members: [...group.editable.map((f) => memberFromField(f, 'edit')), ...group.readonly.map((l) => memberFromField(l, 'read'))],
      },
    });
  };

  const draft = editing?.draft;
  const patchDraft = (patch) => setEditing((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  const patchMember = (index, patch) =>
    setEditing((prev) => ({
      ...prev,
      draft: { ...prev.draft, members: prev.draft.members.map((m, i) => (i === index ? { ...m, ...patch } : m)) },
    }));
  const removeMember = (index) =>
    setEditing((prev) => ({ ...prev, draft: { ...prev.draft, members: prev.draft.members.filter((_, i) => i !== index) } }));

  // Existing lookup fields not in a group yet can be pulled in instead of creating a new field.
  const adoptable = fields.filter(
    (f) => isTableSourceField(f) && !f.lookupGroup && !draft?.members.some((m) => m.id === f.id) && (!draft?.table || f.tableSource.table === draft.table),
  );

  const errors = useMemo(() => {
    if (!draft) return [];
    const out = [];
    if (!draft.name.trim()) out.push('Give the group a name.');
    if (!draft.table) out.push('Choose the table the fields come from.');
    if (!draft.members.some((m) => m.mode === 'edit')) out.push('At least one field must be editable.');
    const key = slugGroup(draft.name);
    if (draft.name.trim() && groups.some((g) => g.key === key && g.id !== editing.group?.id)) {
      out.push('A group with this name already exists.');
    }
    const ids = new Set(draft.members.map((m) => m.id).filter(Boolean));
    const labels = new Set();
    const columns = new Set();
    draft.members.forEach((m, i) => {
      const n = i + 1;
      if (!m.label.trim()) out.push(`Field ${n} needs a name.`);
      if (!m.column) out.push(`Field ${n} needs a column.`);
      const l = m.label.trim().toLowerCase();
      if (l && labels.has(l)) out.push(`“${m.label.trim()}” is used twice.`);
      if (l && fields.some((f) => !ids.has(f.id) && String(f.label).trim().toLowerCase() === l)) {
        out.push(`A field named “${m.label.trim()}” already exists.`);
      }
      labels.add(l);
      if (m.column && columns.has(m.column)) out.push(`${columnLabel(draft.table, m.column)} is used by two fields.`);
      columns.add(m.column);
    });
    return out;
  }, [draft, fields, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    setShowErrors(true);
    if (errors.length) return;
    onSave(applyGroup(fields, editing.group, draft));
    setEditing(null);
  };

  const remove = async (group) => {
    const ok = await confirm({
      title: 'Delete this group?',
      message: `“${group.name}” will be removed. Its read-only fields are deleted (they hold no data). Editable fields stay as ordinary table lookups.`,
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (ok) onSave(removeGroup(fields, group));
  };

  const mapOf = (group) => {
    const edit = group.editable.map((f) => f.label);
    const read = group.readonly.map((f) => f.label);
    return (
      <span className="exams-cg-map">
        <span>{edit.join('  ⇄  ') || '—'}</span>
        {read.length > 0 && (
          <>
            <ArrowRight size={13} aria-hidden="true" />
            <span className="exams-cg-map-read">{read.join(', ')}</span>
          </>
        )}
      </span>
    );
  };

  return createPortal(
    <div className="exams-bulk-overlay" onClick={onClose}>
      <div className="exams-bulk-modal exams-cg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Column groups">
        <div className="exams-bulk-header">
          <div>
            <h2 className="exams-bulk-title">
              <ArrowLeftRight size={16} /> {editing ? (editing.group ? 'Edit group' : 'New column group') : 'Column groups'}
            </h2>
            <p className="exams-cg-sub">
              {editing
                ? 'Fields from one table that fill each other in.'
                : 'Fields from the same table. Pick a row in any editable one and the others fill in.'}
            </p>
          </div>
          <button type="button" className="exams-drawer-close compact" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {!editing ? (
          <div className="exams-cg-body">
            {groups.length === 0 ? (
              <div className="exams-cg-empty">
                <ArrowLeftRight size={22} aria-hidden="true" />
                <strong>No groups yet</strong>
                <span>Create one, for example Vendor Code, Vendor Name and Vendor Phone from the Vendors table.</span>
              </div>
            ) : (
              <ul className="exams-cg-list">
                {groups.map((g) => (
                  <li key={g.id} className="exams-cg-card">
                    <div className="exams-cg-card-head">
                      <strong>{g.name}</strong>
                      <span className="exams-cg-table">{tableLabel(g.table)}</span>
                      {!g.key && <span className="exams-cg-table exams-cg-single">single lookup</span>}
                    </div>
                    {mapOf(g)}
                    <div className="exams-cg-card-actions">
                      <button type="button" className="exams-btn secondary compact" onClick={() => openEdit(g)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button type="button" className="exams-btn secondary compact" onClick={() => remove(g)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <button type="button" className="exams-btn primary compact" onClick={openNew}>
                <Plus size={14} /> New group
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="exams-cg-body">
              <div className="exams-cg-grid2">
                <div className="exams-cg-field">
                  <label htmlFor="cg-name">Group name</label>
                  <input id="cg-name" type="text" value={draft.name} placeholder="e.g. Vendor" onChange={(e) => patchDraft({ name: e.target.value })} />
                </div>
                <div className="exams-cg-field">
                  <label>Table</label>
                  <SearchableSelect
                    portal
                    value={draft.table}
                    options={sources.map((t) => ({ value: t.table, label: t.label }))}
                    placeholder={sources.length ? 'Select a table…' : 'No tables available'}
                    searchThreshold={8}
                    ariaLabel="Source table"
                    onChange={(next) =>
                      setEditing((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, table: next, members: prev.draft.members.map((m) => ({ ...m, column: '' })) },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="exams-cg-members" role="group" aria-label="Fields in this group">
                <div className="exams-cg-members-head" aria-hidden="true">
                  <span>Field</span>
                  <span>Column</span>
                  <span>Behaviour</span>
                  <span />
                </div>
                {draft.members.map((m, i) => (
                  <div key={m.id || `new-${i}`} className="exams-cg-member">
                    <div className="exams-cg-field">
                      <input
                        type="text"
                        value={m.label}
                        placeholder="Field name, e.g. Vendor Name"
                        aria-label={`Field ${i + 1} name`}
                        onChange={(e) => patchMember(i, { label: e.target.value })}
                      />
                      {m.id && <span className="exams-cg-existing">existing field</span>}
                    </div>
                    <SearchableSelect
                      portal
                      value={m.column}
                      options={columnsOf(draft.table).map((c) => ({ value: c.key, label: c.label }))}
                      placeholder={draft.table ? 'Select column…' : 'Pick a table first'}
                      searchPlaceholder="Search columns…"
                      searchThreshold={6}
                      disabled={!draft.table}
                      ariaLabel={`Field ${i + 1} column`}
                      onChange={(next) => patchMember(i, { column: next })}
                    />
                    <SearchableSelect
                      portal
                      value={m.mode}
                      options={MODES}
                      searchThreshold={8}
                      ariaLabel={`Field ${i + 1} behaviour`}
                      onChange={(next) => patchMember(i, { mode: next })}
                    />
                    <button type="button" className="exams-cg-remove" onClick={() => removeMember(i)} aria-label={`Remove field ${i + 1}`} title="Remove from group">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="exams-cg-add">
                  <button
                    type="button"
                    className="exams-text-add-btn"
                    onClick={() => setEditing((prev) => ({ ...prev, draft: { ...prev.draft, members: [...prev.draft.members, { id: '', label: '', column: '', mode: 'edit' }] } }))}
                  >
                    <Plus size={13} /> Add field
                  </button>
                  {adoptable.length > 0 && (
                    <SearchableSelect
                      portal
                      className="exams-cg-adopt"
                      value=""
                      options={adoptable.map((f) => ({ value: f.id, label: f.label }))}
                      placeholder="Add an existing lookup field…"
                      searchThreshold={6}
                      ariaLabel="Add an existing lookup field to the group"
                      onChange={(id) => {
                        const f = fields.find((x) => x.id === id);
                        if (!f) return;
                        setEditing((prev) => ({
                          ...prev,
                          draft: {
                            ...prev.draft,
                            table: prev.draft.table || f.tableSource.table,
                            members: [...prev.draft.members, memberFromField(f, 'edit')],
                          },
                        }));
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="exams-cg-preview" aria-live="polite">
                <span className="exams-cg-preview-title">How it behaves</span>
                {draft.members.filter((m) => m.label.trim()).length === 0 ? (
                  <span className="exams-cg-hint">Add fields above to see how they connect.</span>
                ) : (
                  <span className="exams-cg-map">
                    <span>
                      {draft.members
                        .filter((m) => m.mode === 'edit' && m.label.trim())
                        .map((m) => m.label.trim())
                        .join('  ⇄  ') || '—'}
                    </span>
                    {draft.members.some((m) => m.mode === 'read' && m.label.trim()) && (
                      <>
                        <ArrowRight size={13} aria-hidden="true" />
                        <span className="exams-cg-map-read">
                          {draft.members.filter((m) => m.mode === 'read' && m.label.trim()).map((m) => m.label.trim()).join(', ')}
                        </span>
                      </>
                    )}
                  </span>
                )}
                <span className="exams-cg-hint">
                  Pick or search in any editable field and every field in the group fills from the same row. Clearing one clears them
                  all. Read-only fields only follow.
                </span>
              </div>

              {showErrors && errors.length > 0 && (
                <ul className="exams-cg-errors" role="alert">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="exams-bulk-footer">
              <span />
              <div className="exams-bulk-footer-actions">
                <button type="button" className="exams-btn secondary compact" onClick={() => setEditing(null)}>
                  Back
                </button>
                <button type="button" className="exams-btn primary compact" onClick={save}>
                  {editing.group ? 'Save group' : 'Create group'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
