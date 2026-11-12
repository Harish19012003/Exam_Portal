/* global FormData, fetch */
import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

/** Short-lived signature so the browser can upload straight to Cloudinary. */
export const requestAvatarSignature = async () =>
  unwrap(await apiClient.post('/users/profile/avatar/signature'));

/**
 * Upload the original image directly to Cloudinary (never through our API server).
 * Returns Cloudinary's response, including `secure_url` and `public_id`.
 */
export const uploadAvatarToCloudinary = async (file, signature) => {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.api_key);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('public_id', signature.public_id);
  form.append('overwrite', 'true');
  form.append('invalidate', 'true');
  form.append('allowed_formats', signature.allowed_formats);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || 'Photo upload failed');
  }
  return json;
};

/** Tell our API which Cloudinary image is the user's picture (the server re-validates it). */
export const saveAvatar = async ({ secure_url, public_id }) =>
  unwrap(await apiClient.put('/users/profile/avatar', { secure_url, public_id }));

export const removeAvatar = async () => unwrap(await apiClient.delete('/users/profile/avatar'));
