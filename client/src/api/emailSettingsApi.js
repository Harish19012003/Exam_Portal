import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const EMAIL_PROVIDER_OPTIONS = [
  { value: 'smtp', label: 'SMTP (any provider)' },
  { value: 'google', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook / Microsoft 365' },
];

/** Saved email settings. The password is never returned — only `has_password`. */
export const fetchEmailSettings = async () => unwrap(await apiClient.get('/settings/integrations/email'));

/** `password` is optional: leave it out to keep the saved one. */
export const saveEmailSettings = async (payload) =>
  unwrap(await apiClient.put('/settings/integrations/email', payload));

/** Sends a real test email using the values typed in the form (saved or not). */
export const sendTestEmail = async (payload) =>
  unwrap(await apiClient.post('/settings/integrations/email/test', payload));
