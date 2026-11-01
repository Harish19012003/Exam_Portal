/**
 * Group-based access control — single source of truth for server + client.
 *
 * A permission set (stored on a group, or as a user's grant / deny override):
 * {
 *   pages:  { [pageId]: true },
 *   tables: {
 *     [tableId]: {
 *       actions: { view, create, edit, delete, import, export, configure },
 *       columns: { [fieldKey]: 'hidden' | 'view' | 'edit' },
 *       rows:    { rules: [{ field, op, values }] }   // rules are AND-ed; empty = all rows
 *     }
 *   }
 * }
 *
 * Effective access = (union of all group sets + user grant) minus user deny.
 * Super admin bypasses everything.
 */
import { ROLES } from './roles.js';

export const ACCESS_PAGES = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'exams', label: 'Exams', path: '/exams' },
  { id: 'vendors', label: 'Vendor Data', path: '/vendors' },
  { id: 'seq_view', label: 'SeqView', path: '/seq-view' },
  { id: 'tables', label: 'Dynamic Tables', path: '/tables' },
  { id: 'settings', label: 'Settings', path: '/settings' },
  { id: 'users', label: 'User Management', path: '/settings?tab=users' },
]);

export const ACCESS_TABLES = Object.freeze([
  { id: 'exams', label: 'Exams', page: 'exams' },
  { id: 'exam_rows', label: 'Center list', page: 'exams' },
  { id: 'vendors', label: 'Vendors', page: 'vendors' },
  { id: 'seq_views', label: 'SeqView', page: 'seq_view' },
]);

export const TABLE_ACTIONS = Object.freeze([
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
  { id: 'configure', label: 'Configure fields' },
]);

export const COLUMN_LEVELS = Object.freeze(['hidden', 'view', 'edit']);

export const ROW_RULE_OPS = Object.freeze([
  { id: 'in', label: 'is any of', needsValues: true },
  { id: 'not_in', label: 'is none of', needsValues: true },
  { id: 'contains', label: 'contains', needsValues: true },
  { id: 'is_me', label: 'is the signed-in user', needsValues: false },
  { id: 'not_empty', label: 'is not empty', needsValues: false },
  { id: 'is_empty', label: 'is empty', needsValues: false },
]);

/** Pseudo-fields usable in row rules. */
export const ROW_RULE_SYSTEM_FIELDS = Object.freeze({
  ROW_ID: '__id',
  EXAM_ID: '__exam_id',
});

const LEVEL_RANK = { hidden: 0, view: 1, edit: 2 };
const ACTION_IDS = TABLE_ACTIONS.map((a) => a.id);
const PAGE_IDS = ACCESS_PAGES.map((p) => p.id);
const TABLE_IDS = ACCESS_TABLES.map((t) => t.id);
const OP_IDS = new Set(ROW_RULE_OPS.map((o) => o.id));

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Coerce arbitrary input into a clean permission set (drops unknown keys). */
export const normalizePermissionSet = (input) => {
  const src = isObj(input) ? input : {};
  const pages = {};
  if (isObj(src.pages)) {
    PAGE_IDS.forEach((id) => {
      if (src.pages[id] === true) pages[id] = true;
    });
  }
  const tables = {};
  if (isObj(src.tables)) {
    TABLE_IDS.forEach((tid) => {
      const t = src.tables[tid];
      if (!isObj(t)) return;
      const actions = {};
      if (isObj(t.actions)) {
        ACTION_IDS.forEach((a) => {
          if (t.actions[a] === true) actions[a] = true;
        });
      }
      const columns = {};
      if (isObj(t.columns)) {
        Object.entries(t.columns).forEach(([key, level]) => {
          if (typeof key === 'string' && key.length <= 80 && LEVEL_RANK[level] !== undefined) {
            columns[key] = level;
          }
        });
      }
      const rules = [];
      const rawRules = Array.isArray(t.rows?.rules) ? t.rows.rules : [];
      rawRules.slice(0, 20).forEach((r) => {
        if (!isObj(r) || typeof r.field !== 'string' || !r.field || !OP_IDS.has(r.op)) return;
        const values = (Array.isArray(r.values) ? r.values : [])
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .slice(0, 200);
        const needsValues = ROW_RULE_OPS.find((o) => o.id === r.op)?.needsValues;
        if (needsValues && !values.length) return;
        rules.push({ field: r.field.slice(0, 80), op: r.op, values: needsValues ? values : [] });
      });
      const entry = {};
      if (Object.keys(actions).length) entry.actions = actions;
      if (Object.keys(columns).length) entry.columns = columns;
      if (rules.length) entry.rows = { rules };
      if (Object.keys(entry).length) tables[tid] = entry;
    });
  }
  return { pages, tables };
};

export const hasAnyPermission = (set) =>
  Boolean(set) && (Object.keys(set.pages || {}).length > 0 || Object.keys(set.tables || {}).length > 0);

/** Used only for users who are not in any group that has permissions configured. */
export const ROLE_FALLBACK_PERMISSIONS = Object.freeze({
  [ROLES.GLOBAL_ADMIN]: {
    pages: Object.fromEntries(PAGE_IDS.map((id) => [id, true])),
    tables: Object.fromEntries(
      TABLE_IDS.map((id) => [id, { actions: Object.fromEntries(ACTION_IDS.map((a) => [a, true])) }]),
    ),
  },
  [ROLES.ADMIN]: {
    pages: Object.fromEntries(PAGE_IDS.map((id) => [id, true])),
    tables: Object.fromEntries(
      TABLE_IDS.map((id) => [id, { actions: Object.fromEntries(ACTION_IDS.map((a) => [a, true])) }]),
    ),
  },
  [ROLES.USER]: {
    pages: { dashboard: true, exams: true },
    tables: {
      exams: { actions: { view: true, create: true, edit: true, delete: true, import: true, export: true } },
      exam_rows: { actions: { view: true, create: true, edit: true, delete: true, export: true } },
    },
  },
});

const defaultLevelFor = (actions) => (actions?.edit ? 'edit' : actions?.view ? 'view' : 'hidden');

/**
 * @param {{ role?: string, sets: object[], grant?: object, deny?: object }} input
 *   `sets` are the permission sets of every group the user belongs to.
 */
export const resolveAccess = ({ role, sets = [], grant = null, deny = null }) => {
  if (role === ROLES.SUPER_ADMIN) {
    return {
      superAdmin: true,
      pages: Object.fromEntries(PAGE_IDS.map((id) => [id, true])),
      tables: Object.fromEntries(
        TABLE_IDS.map((id) => [
          id,
          {
            actions: Object.fromEntries(ACTION_IDS.map((a) => [a, true])),
            columnSources: [{ default: 'edit', columns: {} }],
            columnDeny: {},
            rowScopes: null,
            denyRowScopes: [],
          },
        ]),
      ),
    };
  }

  const groupSets = sets.map(normalizePermissionSet).filter(hasAnyPermission);
  const sources = groupSets.length
    ? groupSets
    : [normalizePermissionSet(ROLE_FALLBACK_PERMISSIONS[role] || {})];
  const grantSet = normalizePermissionSet(grant);
  const denySet = normalizePermissionSet(deny);
  const all = [...sources, grantSet];

  const pages = {};
  PAGE_IDS.forEach((id) => {
    pages[id] = all.some((s) => s.pages[id]) && !denySet.pages[id];
  });

  const tables = {};
  ACCESS_TABLES.forEach(({ id: tid, page }) => {
    const actions = {};
    ACTION_IDS.forEach((a) => {
      actions[a] = all.some((s) => s.tables[tid]?.actions?.[a]) && !denySet.tables[tid]?.actions?.[a];
    });
    if (!pages[page]) ACTION_IDS.forEach((a) => (actions[a] = false));
    // Every other action implies being able to see the rows.
    if (!actions.view) ACTION_IDS.forEach((a) => (actions[a] = false));

    const contributing = all.filter((s) => s.tables[tid]?.actions?.view);
    const columnSources = contributing.map((s) => ({
      default: defaultLevelFor(s.tables[tid].actions),
      columns: s.tables[tid].columns || {},
    }));
    const scopes = contributing.map((s) => s.tables[tid].rows?.rules || []);
    const rowScopes = scopes.some((r) => r.length === 0) ? null : scopes;
    const denyRules = denySet.tables[tid]?.rows?.rules || [];

    tables[tid] = {
      actions,
      columnSources,
      columnDeny: denySet.tables[tid]?.columns || {},
      rowScopes,
      denyRowScopes: denyRules.length ? [denyRules] : [],
    };
  });

  return { superAdmin: false, pages, tables };
};

/** 'hidden' | 'view' | 'edit' for one column of one table. */
export const columnLevel = (access, tableId, key) => {
  const t = access?.tables?.[tableId];
  if (!t || !t.actions?.view) return 'hidden';
  let rank = 0;
  t.columnSources.forEach((src) => {
    const level = src.columns[key] ?? src.default;
    rank = Math.max(rank, LEVEL_RANK[level] ?? 0);
  });
  const cap = t.columnDeny?.[key];
  if (cap !== undefined) rank = Math.min(rank, LEVEL_RANK[cap] ?? 0);
  if (!t.actions.edit && !t.actions.create) rank = Math.min(rank, LEVEL_RANK.view);
  return COLUMN_LEVELS[rank];
};

export const canAction = (access, tableId, action) => Boolean(access?.tables?.[tableId]?.actions?.[action]);

export const canPage = (access, pageId) => Boolean(access?.pages?.[pageId]);

const norm = (v) => String(v ?? '').trim().toLowerCase();

const asList = (v) => {
  if (Array.isArray(v)) return v.map(norm).filter(Boolean);
  if (v === null || v === undefined) return [];
  if (typeof v === 'string' && v.includes(',')) return v.split(',').map(norm).filter(Boolean);
  const s = norm(v);
  return s ? [s] : [];
};

const ruleMatches = (rule, values, me) => {
  const actual = asList(values?.[rule.field]);
  const wanted = (rule.values || []).map(norm);
  switch (rule.op) {
    case 'in':
      return actual.some((a) => wanted.includes(a));
    case 'not_in':
      return !actual.some((a) => wanted.includes(a));
    case 'contains':
      return actual.some((a) => wanted.some((w) => a.includes(w)));
    case 'is_me': {
      const ids = [me?.id, me?.email, me?.name].map(norm).filter(Boolean);
      return actual.some((a) => ids.includes(a));
    }
    case 'not_empty':
      return actual.length > 0;
    case 'is_empty':
      return actual.length === 0;
    default:
      return false;
  }
};

const allMatch = (rules, values, me) => rules.every((r) => ruleMatches(r, values, me));

/**
 * @param values row values keyed by field key (include `__id` / `__exam_id` when relevant)
 * @param me { id, email, name } of the signed-in user
 */
export const canSeeRow = (access, tableId, values, me) => {
  const t = access?.tables?.[tableId];
  if (!t?.actions?.view) return false;
  if (t.rowScopes && !t.rowScopes.some((rules) => allMatch(rules, values, me))) return false;
  if (t.denyRowScopes.some((rules) => allMatch(rules, values, me))) return false;
  return true;
};

/** Field keys whose options come from user tags (assignee multi-pickers). */
export const assigneeFieldKeys = (fields = []) =>
  (Array.isArray(fields) ? fields : [])
    .filter((f) => f?.optionsSource === 'userTags')
    .map((f) => f.key)
    .filter(Boolean);

/**
 * Tag-scoped assignee fields: when any of those cells has user id(s), only those
 * people (and super admins) see the row. Empty assignee cells add no restriction.
 */
export const passesAssigneeVisibility = (me, values, fieldKeys, { superAdmin = false } = {}) => {
  if (superAdmin) return true;
  if (!fieldKeys?.length) return true;
  const myId = String(me?.id || '');
  if (!myId) return false;
  let anyAssigned = false;
  for (const key of fieldKeys) {
    const raw = values?.[key];
    const ids = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).filter(Boolean);
    if (ids.length === 0) continue;
    anyAssigned = true;
    if (ids.includes(myId)) return true;
  }
  return !anyAssigned;
};
