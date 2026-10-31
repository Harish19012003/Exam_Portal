import { apiClient } from '../../api/client';
import { cacheConfigDropdownLists, loadConfigDropdownLists } from './configStorage';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Lists as { id, name, options: [{ id, label }], createdAt, updatedAt }. Refreshes the local cache. */
export const fetchConfigLists = async () => {
  const rows = unwrap(await apiClient.get('/config-lists'));
  const lists = Array.isArray(rows) ? rows : [];
  cacheConfigDropdownLists(lists);
  return lists;
};

export const createConfigList = async (list) => unwrap(await apiClient.post('/config-lists', list));
export const updateConfigList = async (id, list) =>
  unwrap(await apiClient.patch(`/config-lists/${id}`, list));
export const deleteConfigList = async (id) => unwrap(await apiClient.delete(`/config-lists/${id}`));
export const bulkSaveConfigLists = async (lists) =>
  unwrap(await apiClient.post('/config-lists/bulk', { lists }));

/**
 * Loads lists from the server. If the server has none but this browser still holds lists from
 * before they moved to MongoDB, uploads them once (keeping their ids so exam fields stay linked).
 */
export const loadConfigListsWithImport = async () => {
  const lists = await fetchConfigLists();
  if (lists.length > 0) return lists;
  const legacy = loadConfigDropdownLists();
  if (legacy.length === 0) return lists;
  await bulkSaveConfigLists(legacy);
  return fetchConfigLists();
};
