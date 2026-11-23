import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { fetchSupportSettings, SUPPORT_DEFAULTS } from '../api/supportSettingsApi';

/**
 * Help & Support content (Settings → Support). Cached like platform settings.
 * Pass `{ enabled: false }` to defer loading until the Help modal opens.
 */
export const useSupportSettings = (options = {}) => {
  const query = useQuery({
    queryKey: queryKeys.supportSettings,
    queryFn: fetchSupportSettings,
    ...options,
  });
  return { ...query, settings: query.data || SUPPORT_DEFAULTS };
};

/** After a save: write the result and refresh platform settings (the support email lives there). */
export const useApplySupportSettings = () => {
  const queryClient = useQueryClient();
  return (saved) => {
    queryClient.setQueryData(queryKeys.supportSettings, saved);
    queryClient.setQueryData(queryKeys.platformSettings, (prev) =>
      prev && typeof prev === 'object' ? { ...prev, support_email: saved?.email || '' } : prev,
    );
  };
};

/** True when there is anything to show in the Help modal. */
export const hasSupportContent = (s) =>
  Boolean(s?.email || s?.phone || s?.whatsapp || s?.links?.length || s?.faqs?.length || s?.intro);
