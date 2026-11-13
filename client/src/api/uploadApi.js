/* global FormData, fetch */
import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Upload any attachment (image or document) straight to Cloudinary; nothing is stored on our server.
 * Resolves to { url, public_id, name, size, type } — save the `url` in the field.
 */
export const uploadAttachment = async (file) => {
  if (!file) {throw new Error('No file selected');}
  if (file.size > MAX_ATTACHMENT_BYTES) {throw new Error('That file is too large (max 10 MB)');}

  const sig = unwrap(await apiClient.post('/uploads/signature'));
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('allowed_formats', sig.allowed_formats);

  // "auto" lets Cloudinary pick image / raw (documents) by file type.
  const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`, {
    method: 'POST',
    body: form,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || 'File upload failed');
  }
  return {
    url: json.secure_url,
    public_id: json.public_id,
    name: file.name,
    size: file.size,
    type: file.type.startsWith('image/') ? 'image' : 'file',
  };
};
