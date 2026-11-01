/**
 * Local cache of the Config dropdown lists (Settings → Config). MongoDB is the source of
 * truth (see configListApi.js); this only lets exam field code read the lists synchronously.
 */

export const CONFIG_DROPDOWNS_KEY = 'portal_config_dropdowns_v1';

export const loadConfigDropdownLists = () => {
  try {
    const raw = localStorage.getItem(CONFIG_DROPDOWNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const CONFIG_LISTS_CHANGED = 'config-lists-changed';

export const cacheConfigDropdownLists = (lists) => {
  try {
    const next = JSON.stringify(lists);
    const changed = localStorage.getItem(CONFIG_DROPDOWNS_KEY) !== next;
    localStorage.setItem(CONFIG_DROPDOWNS_KEY, next);
    // Pages that show Config-list options re-render when the lists actually changed.
    if (changed) window.dispatchEvent(new Event(CONFIG_LISTS_CHANGED));
  } catch {
    // ignore
  }
};

export const getConfigListById = (listId) =>
  loadConfigDropdownLists().find((l) => l.id === listId) || null;

/** Live-resolved option labels for a config list id */
export const getConfigListOptions = (listId) => {
  const list = getConfigListById(listId);
  if (!list) return [];
  return (list.options || []).map((o) => o.label).filter(Boolean);
};
