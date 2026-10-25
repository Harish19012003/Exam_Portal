import { apiClient } from './client';

/**
 * Portal table layout prefs (SQL).
 * Scoped by `tableId` — each DynamicTable gets its own user + org-default layout.
 * Keys on server:
 *   user  → user_preferences.pref_key = `table:${tableId}`
 *   org   → system_settings.setting_key = `table_layout_default:${tableId}`
 */

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const emptyBundle = () => ({
  layout: null,
  source: 'none',
  hasUserOverride: false,
  hasOrgDefault: false,
  orgDefault: null,
});

/** Current user layout for any table (user → org default → null) */
export const fetchTableLayout = async (tableId) => {
  if (!tableId) return emptyBundle();
  const { data } = await apiClient.get(`/settings/table-layout/${encodeURIComponent(tableId)}`);
  return unwrap(data) || emptyBundle();
};

/** Persist personal layout override for this table */
export const saveUserTableLayout = async (tableId, layout) => {
  const { data } = await apiClient.put(
    `/settings/table-layout/${encodeURIComponent(tableId)}`,
    layout,
  );
  return unwrap(data);
};

/** Drop personal override → fall back to org default for this table */
export const clearUserTableLayout = async (tableId) => {
  const { data } = await apiClient.delete(
    `/settings/table-layout/${encodeURIComponent(tableId)}`,
  );
  return unwrap(data);
};

/** Super admin: set org-wide default layout for this table */
export const saveOrgTableLayoutDefault = async (tableId, layout) => {
  const { data } = await apiClient.put(
    `/settings/table-layout/${encodeURIComponent(tableId)}/default`,
    layout,
  );
  return unwrap(data);
};

export const isSuperAdminUser = (user = null) => {
  let u = user;
  if (!u) {
    try {
      u = JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      u = {};
    }
  }
  return u?.role === 'super_admin';
};
