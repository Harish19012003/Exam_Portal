import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  ListOrdered,
  Pencil,
  Plus,
  Settings,
  SlidersHorizontal,
  TableProperties,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ROW_RULE_OPS, ROW_RULE_SYSTEM_FIELDS, TABLE_ACTIONS } from '@exam-view/shared';
import { apiClient } from '../../api/client';
import './PermissionSetEditor.css';

/* ── What can be granted, grouped the way people think about the portal ─────────────── */

const AREAS = [
  {
    id: 'exams',
    page: 'exams',
    label: 'Exam management',
    description: 'The exam list and the center list of each exam.',
    icon: GraduationCap,
    tables: [
      { id: 'exams', label: 'Exam list' },
      { id: 'exam_rows', label: 'Center list', hint: 'Centers of each exam, opened with Explore.' },
    ],
  },
  {
    id: 'vendors',
    page: 'vendors',
    label: 'Vendor data',
    description: 'Vendor and supplier records.',
    icon: Database,
    tables: [{ id: 'vendors', label: 'Vendors' }],
  },
  {
    id: 'seq_view',
    page: 'seq_view',
    label: 'SeqView',
    description: 'SeqView records synced from the external API.',
    icon: ListOrdered,
    tables: [{ id: 'seq_views', label: 'SeqView records' }],
  },
];

const OTHER_PAGES = [
  { id: 'dashboard', label: 'Dashboard', description: 'Home page with summaries.', icon: LayoutDashboard },
  { id: 'tables', label: 'Dynamic tables', description: 'The dynamic table playground.', icon: TableProperties },
  { id: 'settings', label: 'Settings', description: 'Config lists and the exam table settings tab.', icon: Settings },
  { id: 'users', label: 'User management', description: 'See and edit users (roles stay Super Admin only).', icon: Users },
];

const ACTION_HELP = {
  view: 'See the table',
  create: 'Add new records',
  edit: 'Change existing records',
  delete: 'Remove records',
  import: 'Upload CSV files',
  export: 'Download CSV / Excel / PDF',
  configure: 'Change fields & table features',
};

const ALL_ACTIONS = TABLE_ACTIONS.map((a) => a.id);
const asActions = (ids) => Object.fromEntries(ids.map((id) => [id, true]));

/** Access levels per mode. `actions` is what the level stores; `tone` drives the badge colour. */
const LEVELS = {
  group: [
    { id: 'none', label: 'No access', tone: 'muted', actions: [] },
    { id: 'view', label: 'View only', tone: 'info', actions: ['view'] },
    { id: 'edit', label: 'Can edit', tone: 'good', actions: ['view', 'create', 'edit'] },
    { id: 'full', label: 'Full access', tone: 'strong', actions: ALL_ACTIONS },
  ],
  grant: [
    { id: 'none', label: 'No extra', tone: 'muted', actions: [] },
    { id: 'view', label: '+ View', tone: 'info', actions: ['view'] },
    { id: 'edit', label: '+ Edit', tone: 'good', actions: ['view', 'create', 'edit'] },
    { id: 'full', label: '+ Everything', tone: 'strong', actions: ALL_ACTIONS },
  ],
  deny: [
    { id: 'none', label: 'Not blocked', tone: 'muted', actions: [] },
    { id: 'readonly', label: 'Read-only', tone: 'warn', actions: ['create', 'edit', 'delete', 'import', 'configure'] },
    { id: 'block', label: 'Blocked', tone: 'danger', actions: ALL_ACTIONS },
  ],
};

const COPY = {
  group: {
    otherPages: 'Other pages',
    actionsTitle: 'Exactly what they can do',
    columnsTitle: 'Columns',
    columnsHint: 'Auto follows the access level above. Pick Hidden or View only to protect a column.',
    rowsTitle: 'Which rows they see',
    rowsEmpty: 'All rows. Add a rule to limit them (e.g. only their state or service).',
    rowsLead: 'Only show rows where',
    columnChoices: [
      { id: '', label: 'Auto' },
      { id: 'hidden', label: 'Hidden', icon: EyeOff },
      { id: 'view', label: 'View', icon: Eye },
      { id: 'edit', label: 'Edit', icon: Pencil },
    ],
  },
  grant: {
    otherPages: 'Extra pages',
    actionsTitle: 'Extra actions',
    columnsTitle: 'Extra column access',
    columnsHint: 'Raise a column for this person only. Their groups still decide the rest.',
    rowsTitle: 'Extra rows',
    rowsEmpty: 'No extra rows. Add a rule to also show rows their groups hide.',
    rowsLead: 'Also show rows where',
    columnChoices: [
      { id: '', label: 'No change' },
      { id: 'view', label: 'View', icon: Eye },
      { id: 'edit', label: 'Edit', icon: Pencil },
    ],
  },
  deny: {
    otherPages: 'Block pages',
    actionsTitle: 'Blocked actions',
    columnsTitle: 'Restrict columns',
    columnsHint: 'Caps a column for this person, whatever their groups allow.',
    rowsTitle: 'Hide rows',
    rowsEmpty: 'Nothing hidden. Add a rule to hide specific rows from this person.',
    rowsLead: 'Hide rows where',
    columnChoices: [
      { id: '', label: 'No change' },
      { id: 'view', label: 'View only', icon: Eye },
      { id: 'hidden', label: 'Hidden', icon: EyeOff },
    ],
  },
};

const OP_WORDS = {
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'contains',
  is_me: 'is the person themselves',
  not_empty: 'is filled in',
  is_empty: 'is empty',
};

/* ── Field catalog (columns + option values) per table ─────────────────────────────── */

const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

const optionValues = (options) =>
  (Array.isArray(options) ? options : [])
    .map((o) => (typeof o === 'string' ? o : o?.value ?? o?.label))
    .filter((v) => v !== undefined && v !== null && String(v).trim())
    .map(String);

const toColumns = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .filter((f) => f && f.key)
    .map((f) => ({ key: f.key, label: f.label || f.key, options: optionValues(f.options) }));

const uniqueByKey = (cols) => {
  const seen = new Map();
  cols.forEach((c) => {
    if (!seen.has(c.key)) seen.set(c.key, c);
  });
  return [...seen.values()];
};

let catalogPromise = null;

const loadCatalog = () => {
  if (!catalogPromise) {
    const safe = (p) => p.then(unwrap).catch(() => null);
    catalogPromise = Promise.all([
      safe(apiClient.get('/settings/exam-table-config')),
      safe(apiClient.get('/exam-presets')),
      safe(apiClient.get('/vendors/config')),
      safe(apiClient.get('/seq-views/config')),
    ]).then(([exams, presets, vendors, seqViews]) => ({
      exams: toColumns(exams?.fields),
      exam_rows: uniqueByKey((Array.isArray(presets) ? presets : []).flatMap((p) => toColumns(p.fields))),
      vendors: toColumns(vendors?.fields),
      seq_views: toColumns(seqViews?.fields),
    }));
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
};

const SYSTEM_RULE_FIELDS = {
  exams: [{ key: ROW_RULE_SYSTEM_FIELDS.ROW_ID, label: 'Exam ID', options: [] }],
  exam_rows: [
    { key: ROW_RULE_SYSTEM_FIELDS.EXAM_ID, label: 'Exam ID', options: [] },
    { key: ROW_RULE_SYSTEM_FIELDS.ROW_ID, label: 'Center ID', options: [] },
  ],
  vendors: [{ key: ROW_RULE_SYSTEM_FIELDS.ROW_ID, label: 'Vendor ID', options: [] }],
  seq_views: [{ key: ROW_RULE_SYSTEM_FIELDS.ROW_ID, label: 'Record ID', options: [] }],
};

/* ── Helpers ───────────────────────────────────────────────────────────────────────── */

const levelOf = (mode, actions = {}) => {
  const on = ALL_ACTIONS.filter((a) => actions[a]);
  const match = LEVELS[mode].find(
    (l) => l.actions.length === on.length && l.actions.every((a) => actions[a]),
  );
  return match ? match.id : 'custom';
};

const defaultColumnLevel = (actions = {}) => (actions.edit ? 'edit' : actions.view ? 'view' : 'hidden');

const LEVEL_WORD = { edit: 'Editable', view: 'View only', hidden: 'Hidden' };

/* ── Editor ────────────────────────────────────────────────────────────────────────── */

/**
 * mode 'group' — what the group can do.
 * mode 'grant' — extra rights for one person, on top of their groups.
 * mode 'deny'  — rights taken away from one person, whatever their groups say.
 */
export const PermissionSetEditor = ({ value, onChange, mode = 'group', disabled = false }) => {
  const set = value || { pages: {}, tables: {} };
  const copy = COPY[mode] || COPY.group;
  const levels = LEVELS[mode] || LEVELS.group;
  const [catalog, setCatalog] = useState(null);
  const [openTables, setOpenTables] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    loadCatalog().then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, []);

  /** Pages of the main areas follow their tables: open in group/grant when any table is visible. */
  const syncAreaPage = (next, area) => {
    const has = (tid) => Boolean(next.tables[tid]?.actions?.view);
    const on = mode === 'deny' ? has(area.tables[0].id) : area.tables.some((t) => has(t.id));
    if (on) next.pages[area.page] = true;
    else delete next.pages[area.page];
  };

  const updateTable = (area, tid, fn) => {
    const next = { pages: { ...set.pages }, tables: { ...set.tables } };
    const t = {
      actions: { ...(next.tables[tid]?.actions || {}) },
      columns: { ...(next.tables[tid]?.columns || {}) },
      rows: { rules: [...(next.tables[tid]?.rows?.rules || [])] },
    };
    fn(t);
    next.tables[tid] = t;
    syncAreaPage(next, area);
    onChange(next);
  };

  const setLevel = (area, tid, levelId) =>
    updateTable(area, tid, (t) => {
      const level = levels.find((l) => l.id === levelId);
      t.actions = asActions(level?.actions || []);
    });

  const toggleAction = (area, tid, action) =>
    updateTable(area, tid, (t) => {
      if (t.actions[action]) delete t.actions[action];
      else t.actions[action] = true;
      if (mode !== 'deny') {
        // Every right needs the table to be visible; removing View removes everything.
        if (action === 'view' && !t.actions.view) t.actions = {};
        else if (t.actions[action]) t.actions.view = true;
      }
    });

  const togglePage = (id) => {
    const next = { pages: { ...set.pages }, tables: { ...set.tables } };
    if (next.pages[id]) delete next.pages[id];
    else next.pages[id] = true;
    onChange(next);
  };

  const toggleOpen = (tid) =>
    setOpenTables((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });

  return (
    <div className={`perm-editor perm-editor--${mode}`} aria-disabled={disabled}>
      {AREAS.map((area) => {
        const AreaIcon = area.icon;
        return (
          <section key={area.id} className="perm-area">
            <header className="perm-area-head">
              <span className="perm-area-icon" aria-hidden="true">
                <AreaIcon size={18} />
              </span>
              <div className="perm-area-text">
                <h3>{area.label}</h3>
                <p>{area.description}</p>
              </div>
            </header>

            {area.tables.map((table) => {
              const t = set.tables?.[table.id] || {};
              const levelId = levelOf(mode, t.actions);
              const open = openTables.has(table.id);
              const columns = catalog?.[table.id] || [];
              const columnRules = Object.keys(t.columns || {}).length;
              const rowRules = t.rows?.rules?.length || 0;
              const hasAccess = mode === 'deny' ? levelId !== 'none' : Boolean(t.actions?.view);
              return (
                <div key={table.id} className={`perm-table${open ? ' open' : ''}`}>
                  <div className="perm-table-row">
                    <div className="perm-table-label">
                      <span className="perm-table-name">{table.label}</span>
                      {table.hint && <span className="perm-table-hint">{table.hint}</span>}
                    </div>
                    <div className="perm-levels" role="radiogroup" aria-label={`${table.label} access`}>
                      {levels.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          role="radio"
                          aria-checked={levelId === l.id}
                          disabled={disabled}
                          className={`perm-level tone-${l.tone}${levelId === l.id ? ' on' : ''}`}
                          onClick={() => setLevel(area, table.id, l.id)}
                        >
                          {l.label}
                        </button>
                      ))}
                      {levelId === 'custom' && <span className="perm-level tone-custom on">Custom</span>}
                    </div>
                  </div>

                  {(hasAccess || columnRules > 0 || rowRules > 0) && (
                    <button
                      type="button"
                      className="perm-fine-tune"
                      aria-expanded={open}
                      onClick={() => toggleOpen(table.id)}
                    >
                      <SlidersHorizontal size={14} aria-hidden="true" />
                      <span>Fine-tune</span>
                      <span className="perm-fine-tune-meta">
                        {[
                          columnRules ? `${columnRules} column${columnRules === 1 ? '' : 's'}` : null,
                          rowRules ? `${rowRules} row rule${rowRules === 1 ? '' : 's'}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'actions, columns, rows'}
                      </span>
                      <ChevronDown size={14} className="perm-caret" aria-hidden="true" />
                    </button>
                  )}

                  {open && (
                    <div className="perm-details">
                      <ActionsBlock
                        title={copy.actionsTitle}
                        actions={t.actions || {}}
                        mode={mode}
                        disabled={disabled}
                        onToggle={(a) => toggleAction(area, table.id, a)}
                      />
                      <ColumnsBlock
                        copy={copy}
                        mode={mode}
                        columns={columns}
                        loading={!catalog}
                        values={t.columns || {}}
                        defaultLevel={defaultColumnLevel(t.actions)}
                        disabled={disabled}
                        onChange={(key, level) =>
                          updateTable(area, table.id, (next) => {
                            if (level) next.columns[key] = level;
                            else delete next.columns[key];
                          })
                        }
                      />
                      <RowsBlock
                        copy={copy}
                        rules={t.rows?.rules || []}
                        fields={uniqueByKey([...columns, ...(SYSTEM_RULE_FIELDS[table.id] || [])])}
                        disabled={disabled}
                        onChange={(rules) =>
                          updateTable(area, table.id, (next) => {
                            next.rows.rules = rules;
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <section className="perm-area">
        <header className="perm-area-head">
          <div className="perm-area-text">
            <h3>{copy.otherPages}</h3>
          </div>
        </header>
        <div className="perm-pages">
          {OTHER_PAGES.map((p) => {
            const PageIcon = p.icon;
            const on = Boolean(set.pages?.[p.id]);
            return (
              <label key={p.id} className={`perm-page${on ? ' on' : ''}`}>
                <PageIcon size={16} className="perm-page-icon" aria-hidden="true" />
                <span className="perm-page-text">
                  <strong>{p.label}</strong>
                  <small>{p.description}</small>
                </span>
                <span className="perm-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={on}
                    disabled={disabled}
                    onChange={() => togglePage(p.id)}
                    aria-label={`${mode === 'deny' ? 'Block' : 'Allow'} ${p.label}`}
                  />
                  <span aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const ActionsBlock = ({ title, actions, mode, disabled, onToggle }) => (
  <div className="perm-block">
    <h4>{title}</h4>
    <div className="perm-actions">
      {TABLE_ACTIONS.map((a) => (
        <label key={a.id} className={`perm-action${actions[a.id] ? ' on' : ''}`}>
          <input type="checkbox" checked={Boolean(actions[a.id])} disabled={disabled} onChange={() => onToggle(a.id)} />
          <span>
            <strong>{mode === 'deny' ? `No ${a.label.toLowerCase()}` : a.label}</strong>
            <small>{ACTION_HELP[a.id]}</small>
          </span>
        </label>
      ))}
    </div>
  </div>
);

const ColumnsBlock = ({ copy, mode, columns, loading, values, defaultLevel, disabled, onChange }) => {
  const [query, setQuery] = useState('');
  const extra = Object.keys(values).filter((k) => !columns.some((c) => c.key === k));
  const all = [...columns, ...extra.map((k) => ({ key: k, label: k }))];
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((c) => `${c.label} ${c.key}`.toLowerCase().includes(q)) : all;

  return (
    <div className="perm-block">
      <h4>{copy.columnsTitle}</h4>
      <p className="perm-hint">{copy.columnsHint}</p>
      {loading ? (
        <p className="perm-hint">Loading columns…</p>
      ) : all.length === 0 ? (
        <p className="perm-hint">This table has no fields yet.</p>
      ) : (
        <>
          {all.length > 8 && (
            <input
              type="search"
              className="user-group-input perm-search"
              placeholder="Search columns…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="perm-columns">
            {shown.map((c) => {
              const current = values[c.key] || '';
              return (
                <div key={c.key} className="perm-column">
                  <span className="perm-column-name" title={c.key}>
                    {c.label}
                  </span>
                  <div className="perm-seg" role="radiogroup" aria-label={`${c.label} column`}>
                    {copy.columnChoices.map((choice) => {
                      const Icon = choice.icon;
                      const active = current === choice.id;
                      return (
                        <button
                          key={choice.id || 'auto'}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={disabled}
                          className={`perm-seg-btn${active ? ' on' : ''} level-${choice.id || 'auto'}`}
                          title={
                            choice.id === '' && mode === 'group'
                              ? `Follows the access level: ${LEVEL_WORD[defaultLevel]}`
                              : undefined
                          }
                          onClick={() => onChange(c.key, choice.id)}
                        >
                          {Icon && <Icon size={12} aria-hidden="true" />}
                          <span>
                            {choice.id === '' && mode === 'group' ? `Auto · ${LEVEL_WORD[defaultLevel]}` : choice.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const RowsBlock = ({ copy, rules, fields, disabled, onChange }) => {
  const setRule = (i, patch) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rules.filter((_, idx) => idx !== i));
  const add = () => onChange([...rules, { field: fields[0]?.key || '', op: 'in', values: [] }]);

  return (
    <div className="perm-block">
      <h4>{copy.rowsTitle}</h4>
      {rules.length === 0 ? (
        <p className="perm-hint">{copy.rowsEmpty}</p>
      ) : (
        <div className="perm-rules">
          {rules.map((rule, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="perm-rule-and">and</span>}
              <RuleRow
                lead={i === 0 ? copy.rowsLead : null}
                rule={rule}
                fields={fields}
                disabled={disabled}
                onChange={(patch) => setRule(i, patch)}
                onRemove={() => remove(i)}
              />
            </React.Fragment>
          ))}
        </div>
      )}
      <button type="button" className="perm-add-rule" disabled={disabled || fields.length === 0} onClick={add}>
        <Plus size={14} />
        <span>{rules.length ? 'Add another condition' : 'Add a row rule'}</span>
      </button>
    </div>
  );
};

const RuleRow = ({ lead, rule, fields, disabled, onChange, onRemove }) => {
  const op = ROW_RULE_OPS.find((o) => o.id === rule.op) || ROW_RULE_OPS[0];
  const fieldOptions = useMemo(
    () =>
      fields.some((f) => f.key === rule.field) || !rule.field
        ? fields
        : [...fields, { key: rule.field, label: rule.field, options: [] }],
    [fields, rule.field],
  );
  const field = fieldOptions.find((f) => f.key === rule.field);

  return (
    <div className="perm-rule">
      {lead && <span className="perm-rule-lead">{lead}</span>}
      <select
        className="perm-select"
        value={rule.field}
        disabled={disabled}
        aria-label="Column"
        onChange={(e) => onChange({ field: e.target.value })}
      >
        {fieldOptions.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="perm-select"
        value={op.id}
        disabled={disabled}
        aria-label="Condition"
        onChange={(e) => onChange({ op: e.target.value })}
      >
        {ROW_RULE_OPS.map((o) => (
          <option key={o.id} value={o.id}>
            {OP_WORDS[o.id] || o.label}
          </option>
        ))}
      </select>
      {op.needsValues ? (
        <TagInput
          values={rule.values || []}
          suggestions={field?.options || []}
          disabled={disabled}
          onChange={(values) => onChange({ values })}
        />
      ) : (
        op.id === 'is_me' && <span className="perm-rule-note">matches their user ID, email or full name</span>
      )}
      <button
        type="button"
        className="perm-rule-remove"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove condition"
        title="Remove condition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

let tagListSeq = 0;

/** Values as chips: type and press Enter / comma, or pick a suggestion. */
const TagInput = ({ values, suggestions, disabled, onChange }) => {
  const [text, setText] = useState('');
  const [listId] = useState(() => `perm-tags-${++tagListSeq}`);

  const commit = (raw) => {
    const parts = String(raw || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    parts.forEach((p) => {
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    });
    onChange(next);
    setText('');
  };

  return (
    <div className={`perm-tags${disabled ? ' disabled' : ''}`}>
      {values.map((v) => (
        <span key={v} className="perm-tag">
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            disabled={disabled}
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={text}
        disabled={disabled}
        list={suggestions.length ? listId : undefined}
        placeholder={values.length ? 'Add more…' : 'Type a value, press Enter'}
        aria-label="Values"
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) commit(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(text)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !values.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
};

/** Drops empty table entries / incomplete rules before saving (the server normalizes again). */
export const cleanPermissionSet = (set) => {
  const out = { pages: { ...(set?.pages || {}) }, tables: {} };
  Object.entries(set?.tables || {}).forEach(([tid, t]) => {
    const rules = (t.rows?.rules || []).filter((r) => {
      const op = ROW_RULE_OPS.find((o) => o.id === r.op);
      return r.field && op && (!op.needsValues || (r.values || []).length > 0);
    });
    const entry = {};
    if (Object.keys(t.actions || {}).length) entry.actions = t.actions;
    if (Object.keys(t.columns || {}).length) entry.columns = t.columns;
    if (rules.length) entry.rows = { rules };
    if (Object.keys(entry).length) out.tables[tid] = entry;
  });
  return out;
};
