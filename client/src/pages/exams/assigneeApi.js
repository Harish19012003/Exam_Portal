import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Tag tree for field config (no Users-page permission required). */
export const listAssignableTags = async () => {
  const rows = unwrap(await apiClient.get('/users/assignable/tags'));
  return Array.isArray(rows) ? rows : [];
};

const PAGE_SIZE = 40;

/**
 * Paginated people for the assignee picker.
 * Returns { rows, total, page, limit, hasMore }.
 */
export const listAssignableUsersPage = async (
  tagIds = [],
  { search = '', page = 1, limit = PAGE_SIZE, signal } = {},
) => {
  const ids = [...new Set((tagIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) {
    return { rows: [], total: 0, page: 1, limit: 0, hasMore: false };
  }
  const data = unwrap(
    await apiClient.get('/users/assignable', {
      params: {
        tagIds: ids.join(','),
        search: String(search || '').trim() || undefined,
        page,
        limit,
      },
      signal,
    }),
  );
  // Tolerate older array responses during deploy overlap.
  if (Array.isArray(data)) {
    return { rows: data, total: data.length, page: 1, limit: data.length, hasMore: false };
  }
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    total: Number(data?.total) || 0,
    page: Number(data?.page) || page,
    limit: Number(data?.limit) || limit,
    hasMore: Boolean(data?.hasMore),
  };
};

/**
 * Full matching list (import / form bootstrap). Prefer the paginated API in the UI.
 */
export const listAssignableUsers = async (tagIds = [], { signal, search = '' } = {}) => {
  const ids = [...new Set((tagIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return [];
  const data = unwrap(
    await apiClient.get('/users/assignable', {
      params: {
        tagIds: ids.join(','),
        search: String(search || '').trim() || undefined,
        all: true,
      },
      signal,
    }),
  );
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.rows) ? data.rows : [];
};

/** { [userId]: { id, name, email, tag_ids } } */
export const resolveAssignableUsers = async (ids = []) => {
  const wanted = [...new Set((ids || []).map(String).filter(Boolean))];
  if (wanted.length === 0) return {};
  const map = unwrap(await apiClient.post('/users/assignable/resolve', { ids: wanted }));
  return map && typeof map === 'object' ? map : {};
};

export const ASSIGNABLE_PAGE_SIZE = PAGE_SIZE;
