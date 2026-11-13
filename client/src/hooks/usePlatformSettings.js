import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { fetchPlatformSettings, PLATFORM_DEFAULTS } from '../api/platformSettingsApi';

/**
 * Platform-wide settings (portal name, support email, default timezone, maintenance banner).
 * Cached for the session (default staleTime), so every page and tab switch reuses it.
 * `settings` is always fully populated — falls back to defaults while loading or on error.
 */
export const usePlatformSettings = () => {
  const query = useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: fetchPlatformSettings,
  });
  return { ...query, settings: query.data || PLATFORM_DEFAULTS };
};

/** Write a saved value straight into the cache so the sidebar / banner / footer / tab icon update at once. */
export const useSetPlatformSettingsCache = () => {
  const queryClient = useQueryClient();
  return (next) => {
    queryClient.setQueryData(queryKeys.platformSettings, next);
    queryClient.setQueryData(queryKeys.platformBranding, {
      portal_name: next?.portal_name || PLATFORM_DEFAULTS.portal_name,
      logo_url: next?.logo_url || '',
      favicon_url: next?.favicon_url || '',
      heading_font: next?.heading_font || '',
    });
  };
};
