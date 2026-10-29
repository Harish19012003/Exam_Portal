import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { canAction, canPage, canSeeRow, columnLevel } from '@exam-view/shared';
import { apiClient } from '../api/client';

/**
 * Effective permissions of the signed-in user (groups + personal overrides), resolved by the server.
 * The server enforces everything; this only drives what the UI shows.
 * The last result is cached in localStorage (per user) so menus don't flicker on reload.
 */
const CACHE_KEY = 'accessCache';

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.id ?? null;
  } catch {
    return null;
  }
};

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    const uid = currentUserId();
    return cached && uid !== null && uid !== undefined && String(cached.userId) === String(uid) ? cached.data : null;
  } catch {
    return null;
  }
};

let state = { data: readCache(), loading: false, error: null };
let inflight = null;
const listeners = new Set();

const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export const refreshAccess = () => {
  if (inflight) {return inflight;}
  setState({ loading: true, error: null });
  inflight = apiClient
    .get('/users/me/access')
    .then((res) => {
      const data = res.data?.data ?? null;
      setState({ data, loading: false });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ userId: currentUserId(), data }));
      } catch {
        /* storage full / disabled */
      }
      return data;
    })
    .catch((error) => {
      setState({ loading: false, error });
      return state.data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const clearAccessCache = () => {
  localStorage.removeItem(CACHE_KEY);
  fetchedOnce = false;
  state = { data: null, loading: false, error: null };
  listeners.forEach((fn) => fn());
};

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => state;

let fetchedOnce = false;

export const useAccess = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (fetchedOnce) {return;}
    fetchedOnce = true;
    refreshAccess();
  }, []);

  return useMemo(() => {
    const access = snap.data?.access ?? null;
    const me = snap.data?.me ?? null;
    return {
      access,
      me,
      ready: Boolean(access),
      loading: snap.loading,
      isSuperAdmin: Boolean(access?.superAdmin),
      canPage: (pageId) => canPage(access, pageId),
      can: (tableId, action) => canAction(access, tableId, action),
      columnLevel: (tableId, key) => columnLevel(access, tableId, key),
      canSeeRow: (tableId, values) => canSeeRow(access, tableId, values, me),
      refresh: refreshAccess,
    };
  }, [snap]);
};

const isSystemKey = (key) => String(key || '').startsWith('__');

/** DynamicTable `permissions` prop for one table; null (= everything allowed) until access loads. */
export const tablePermissions = (access, tableId) => {
  if (!access || access.superAdmin) {return null;}
  const can = (action) => canAction(access, tableId, action);
  return {
    create: can('create'),
    edit: can('edit'),
    delete: can('delete'),
    import: can('import'),
    export: can('export'),
  };
};

/**
 * DynamicTable columns after column rights: hidden columns are dropped,
 * view-only columns (or every column without the table's edit right) become read-only.
 * Audit columns (`__*`) are left as they are.
 */
export const applyColumnAccess = (columns, tableId, access) => {
  if (!access || access.superAdmin) {return columns;}
  const canEdit = canAction(access, tableId, 'edit');
  return (columns || []).reduce((out, column) => {
    if (isSystemKey(column.key)) {
      out.push(column);
      return out;
    }
    const level = columnLevel(access, tableId, column.key);
    if (level === 'hidden') {return out;}
    out.push(level === 'view' || !canEdit ? { ...column, editable: false } : column);
    return out;
  }, []);
};

/** Field-builder fields the user may fill in a create form (auto-fill fields are always kept). */
export const creatableFields = (fields, tableId, access) => {
  if (!access || access.superAdmin) {return fields;}
  return (fields || []).filter(
    (f) => (f.autoFill && f.autoFill !== 'none') || columnLevel(access, tableId, f.key) === 'edit',
  );
};
