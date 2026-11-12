import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

/* ── Storage (Cloudinary) ───────────────────────────────────────────────────────────── */
/** Saved storage settings. The API secret is never returned — only `has_secret`. */
export const fetchStorageSettings = async () => unwrap(await apiClient.get('/settings/integrations/storage'));
export const saveStorageSettings = async (payload) =>
  unwrap(await apiClient.put('/settings/integrations/storage', payload));
/** Checks the credentials with Cloudinary, using the form values (saved or not). */
export const testStorageSettings = async (payload) =>
  unwrap(await apiClient.post('/settings/integrations/storage/test', payload));

/* ── Push notifications (Firebase) ──────────────────────────────────────────────────── */
/** Saved Firebase settings. The server key is never returned — only `has_service_account`. */
export const fetchPushSettings = async () => unwrap(await apiClient.get('/settings/integrations/push'));
export const savePushSettings = async (payload) =>
  unwrap(await apiClient.put('/settings/integrations/push', payload));
/** Verifies the server key with Google. Sends no notification. */
export const testPushSettings = async (payload) =>
  unwrap(await apiClient.post('/settings/integrations/push/test', payload));
