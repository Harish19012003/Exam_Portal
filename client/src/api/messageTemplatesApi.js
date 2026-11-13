import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const fetchMessageTemplates = async () => unwrap(await apiClient.get('/settings/message-templates'));

/** patch: { subject?, body?, enabled? } — only the fields that changed. */
export const saveMessageTemplate = async (id, patch) =>
  unwrap(await apiClient.put(`/settings/message-templates/${id}`, patch));

/** Back to the built-in default (also switches the email back on). */
export const resetMessageTemplate = async (id) => unwrap(await apiClient.delete(`/settings/message-templates/${id}`));

/** Sends the SAVED template with sample values to `to`, through the configured mail server. */
export const sendTestMessageTemplate = async (id, to) =>
  unwrap(await apiClient.post(`/settings/message-templates/${id}/test`, { to }));
