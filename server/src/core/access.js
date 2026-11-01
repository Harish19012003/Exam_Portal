import {
  ERROR_CODES,
  ROLES,
  resolveAccess,
  canAction,
  canPage,
  canSeeRow,
  columnLevel,
  assigneeFieldKeys,
  passesAssigneeVisibility,
} from '@exam-view/shared';
import { AppError } from './errors.js';
import { getEm } from '../database/connection.js';
import { User, UserGroup } from '../database/entities/index.js';

const CACHE_TTL_MS = 30_000;
const cache = new Map();

/** Call after any group / override / role change so the next request re-resolves. */
export const invalidateAccessCache = () => cache.clear();

const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(message, 403, ERROR_CODES.FORBIDDEN);

const loadAccess = async (userId) => {
  const em = getEm();
  const user = await em.findOne(User, { _id: String(userId) });
  if (!user) throw new AppError('User not found', 401, ERROR_CODES.UNAUTHORIZED);
  const groups = await em.find(UserGroup, {});
  const sets = groups
    .filter((g) => Array.isArray(g.user_ids) && g.user_ids.map(String).includes(String(userId)))
    .map((g) => g.permissions)
    .filter(Boolean);
  const overrides = user.access_overrides || {};
  const access = resolveAccess({
    role: user.role,
    sets,
    grant: overrides.grant,
    deny: overrides.deny,
  });
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return { access, me: { id: String(user._id), email: user.email, name } };
};

export const getAccessFor = async (userId) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loadAccess(key);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};

/** Attaches req.access and req.me. Use after `authenticate`. */
export const withAccess = async (req, _res, next) => {
  try {
    if (!req.user?.id) throw new AppError('Authentication required', 401, ERROR_CODES.UNAUTHORIZED);
    const { access, me } = await getAccessFor(req.user.id);
    req.access = access;
    req.me = me;
    next();
  } catch (error) {
    next(error);
  }
};

const ensureAccess = async (req) => {
  if (!req.access) {
    const { access, me } = await getAccessFor(req.user.id);
    req.access = access;
    req.me = me;
  }
  return req.access;
};

export const requirePage = (pageId) => async (req, _res, next) => {
  try {
    if (!canPage(await ensureAccess(req), pageId)) throw forbidden();
    next();
  } catch (error) {
    next(error);
  }
};

export const requireTable = (tableId, action) => async (req, _res, next) => {
  try {
    if (!canAction(await ensureAccess(req), tableId, action)) throw forbidden();
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdmin = async (req, _res, next) => {
  try {
    if (req.user?.role !== ROLES.SUPER_ADMIN && !(await ensureAccess(req)).superAdmin) {
      throw forbidden('Only a Super Admin can do this');
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const assertTable = (req, tableId, action) => {
  if (!canAction(req.access, tableId, action)) throw forbidden();
};

/** Copy of `values` without columns this user may not see. */
export const stripHidden = (req, tableId, values) => {
  if (req.access?.superAdmin || !values || typeof values !== 'object') return values;
  const out = {};
  Object.entries(values).forEach(([key, val]) => {
    if (columnLevel(req.access, tableId, key) !== 'hidden') out[key] = val;
  });
  return out;
};

/**
 * Reject writes to columns this user may not edit. Keys the client sent unchanged are allowed
 * when `previous` is given, so a full-row PUT from a view-only column does not fail.
 */
export const assertWritable = (req, tableId, values, previous = null) => {
  if (req.access?.superAdmin || !values || typeof values !== 'object') return;
  const blocked = Object.keys(values).filter((key) => {
    if (columnLevel(req.access, tableId, key) === 'edit') return false;
    if (previous && JSON.stringify(previous[key] ?? null) === JSON.stringify(values[key] ?? null)) return false;
    return true;
  });
  if (blocked.length) throw forbidden(`You cannot edit: ${blocked.join(', ')}`);
};

/**
 * For creates: keep only columns this user may edit (plus auto-fill keys the server/client computes).
 * Create forms send every field with defaults, so unknown/locked keys are dropped, not rejected.
 */
export const writableValues = (req, tableId, values, autoKeys = []) => {
  if (req.access?.superAdmin || !values || typeof values !== 'object') return values || {};
  const auto = new Set(autoKeys);
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => auto.has(key) || columnLevel(req.access, tableId, key) === 'edit',
    ),
  );
};

/** Field keys whose value is filled automatically (currentUser, today, …). */
export const autoFillKeys = (fields = []) =>
  (Array.isArray(fields) ? fields : [])
    .filter((f) => f?.autoFill && f.autoFill !== 'none')
    .map((f) => f.key);

export const rowVisible = (req, tableId, values, fields) => {
  if (!canSeeRow(req.access, tableId, values, req.me)) return false;
  if (!fields) return true;
  return passesAssigneeVisibility(req.me, values, assigneeFieldKeys(fields), {
    superAdmin: Boolean(req.access?.superAdmin),
  });
};

export const assertRowVisible = (req, tableId, values, fields) => {
  if (!rowVisible(req, tableId, values, fields)) throw forbidden('This record is outside your access');
};

export { assigneeFieldKeys, passesAssigneeVisibility };
