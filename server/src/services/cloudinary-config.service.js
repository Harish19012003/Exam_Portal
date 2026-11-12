/* global fetch, AbortSignal */
/**
 * Cloudinary (storage) configuration: editable in Platform Settings, falling back to the server env.
 * The API secret is stored encrypted and never leaves the server.
 */
import { ERROR_CODES } from '@exam-view/shared';
import env from '../config/env.js';
import { AppError } from '../core/errors.js';
import { encryptSecret, decryptSecret } from '../core/secret-box.js';
import { getSetting, upsertSetting } from '../api/v1/settings/settings.repository.js';

export const CLOUDINARY_SETTING_KEY = 'integration_cloudinary';

const NAME_RE = /^[a-z0-9][a-z0-9_-]{1,59}$/i;
const KEY_RE = /^\d{6,20}$/;

const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const envDefaults = () => ({
  cloud_name: str(env.CLOUDINARY_CLOUD_NAME),
  api_key: str(env.CLOUDINARY_API_KEY),
  api_secret: str(env.CLOUDINARY_API_SECRET),
});

const readStored = async () => (await getSetting(CLOUDINARY_SETTING_KEY))?.setting_value || null;

/** Full config used to talk to Cloudinary (includes the decrypted secret). */
export const getCloudinaryConfig = async () => {
  const fallback = envDefaults();
  const stored = await readStored();
  if (!stored) {
    return { ...fallback, source: 'environment' };
  }
  const secret = decryptSecret(stored.api_secret_enc);
  return {
    cloud_name: str(stored.cloud_name) || fallback.cloud_name,
    api_key: str(stored.api_key) || fallback.api_key,
    api_secret: secret || fallback.api_secret,
    source: 'database',
  };
};

export const isCloudinaryConfigured = (cfg) => Boolean(cfg?.cloud_name && cfg?.api_key && cfg?.api_secret);

/** Safe view for the admin UI — never includes the secret. */
export const getCloudinarySettingsView = async () => {
  const cfg = await getCloudinaryConfig();
  return {
    cloud_name: cfg.cloud_name,
    api_key: cfg.api_key,
    has_secret: Boolean(cfg.api_secret),
    source: cfg.source,
  };
};

const validateFields = (body) => {
  const out = {};
  if (body.cloud_name !== undefined) {
    const name = str(body.cloud_name);
    if (name && !NAME_RE.test(name)) {
      throw invalid('Cloud name can only contain letters, numbers, dashes and underscores');
    }
    out.cloud_name = name;
  }
  if (body.api_key !== undefined) {
    const key = str(body.api_key);
    if (key && !KEY_RE.test(key)) {
      throw invalid('API key should be the numeric key from your Cloudinary dashboard');
    }
    out.api_key = key;
  }
  return out;
};

const validateSecret = (value) => {
  const secret = str(value);
  if (secret && (secret.length < 10 || secret.length > 120 || /\s/.test(secret))) {
    throw invalid('That API secret does not look right');
  }
  return secret;
};

export const resolveCloudinaryForTest = async (body = {}) => {
  const base = await getCloudinaryConfig();
  const merged = { ...base, ...validateFields(body) };
  const typedSecret = validateSecret(body.api_secret);
  if (typedSecret) {
    merged.api_secret = typedSecret;
  }
  return merged;
};

export const saveCloudinarySettings = async (body, updatedBy) => {
  if (!body || typeof body !== 'object') {
    throw invalid('Invalid storage settings');
  }
  const patch = validateFields(body);
  const stored = (await readStored()) || {};
  const next = {
    cloud_name: stored.cloud_name,
    api_key: stored.api_key,
    api_secret_enc: stored.api_secret_enc,
    ...patch,
  };

  const newSecret = validateSecret(body.api_secret);
  let secretChanged = false;
  if (newSecret) {
    next.api_secret_enc = encryptSecret(newSecret);
    secretChanged = true;
  }

  await upsertSetting(CLOUDINARY_SETTING_KEY, next, 'Cloudinary (storage) configuration', updatedBy);
  return { view: await getCloudinarySettingsView(), changed: Object.keys(patch), secretChanged };
};

/** Ask Cloudinary's API to confirm the credentials. Throws an AppError with a plain-language reason. */
export const pingCloudinary = async ({ cloud_name: cloud, api_key: key, api_secret: secret }) => {
  if (!cloud || !key || !secret) {
    throw invalid('Enter the cloud name, API key and API secret first');
  }
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/ping`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AppError(
      'Could not reach Cloudinary. Check your internet connection and try again.',
      502,
      ERROR_CODES.SERVICE_UNAVAILABLE,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new AppError('Cloudinary rejected these credentials. Check the cloud name, API key and secret.', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  if (response.status === 404) {
    throw new AppError('That cloud name was not found on Cloudinary.', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  if (!response.ok) {
    throw new AppError('Cloudinary could not confirm the credentials right now.', 502, ERROR_CODES.SERVICE_UNAVAILABLE);
  }
  return true;
};
