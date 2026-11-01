import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Tag tree for field config (no Users-page permission required). */
export const listAssignableTags = async () => {
  const rows = unwrap(await apiClient.get('/users/assignable/tags'));
  return Array.isArray(rows) ? rows : [];
};

/** People who have at least one of the given tag ids. */
export const listAssignableUsers = async (tagIds = [], { signal } = {}) => {
  const ids = [...new Set((tagIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = unwrap(
    await apiClient.get('/users/assignable', {
      params: { tagIds: ids.join(',') },
      signal,
    }),
  );
  return Array.isArray(rows) ? rows : [];
};

/** { [userId]: { id, name, email, tag_ids } } */
export const resolveAssignableUsers = async (ids = []) => {
  const wanted = [...new Set((ids || []).map(String).filter(Boolean))];
  if (wanted.length === 0) return {};
  const map = unwrap(await apiClient.post('/users/assignable/resolve', { ids: wanted }));
  return map && typeof map === 'object' ? map : {};
};
