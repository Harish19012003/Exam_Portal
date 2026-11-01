import { useEffect, useState } from 'react';
import { fetchConfigLists } from './configListApi';
import { CONFIG_LISTS_CHANGED } from './configStorage';

/**
 * Keeps the local Config-list cache fresh for a page that shows fields with Config-list options.
 * Fetches once on mount; returns a number that changes when the lists change, for use as a
 * dependency so columns and inputs pick up the options.
 */
export const useConfigLists = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(CONFIG_LISTS_CHANGED, onChange);
    fetchConfigLists().catch(() => {});
    return () => window.removeEventListener(CONFIG_LISTS_CHANGED, onChange);
  }, []);
  return version;
};
