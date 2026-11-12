/**
 * Encrypt / decrypt small secrets (SMTP password, API keys) stored in MongoDB.
 * AES-256-GCM with a random IV per value; the key comes from SETTINGS_ENCRYPTION_KEY, or is
 * derived from JWT_REFRESH_SECRET when that is not set. Format: enc:v1:<iv>:<tag>:<ciphertext> (base64).
 *
 * Changing the key makes previously saved secrets unreadable (decrypt returns null) — the admin
 * simply re-enters them.
 */
import crypto from 'node:crypto';
import env from '../config/env.js';
import { logger } from './logger.js';

const PREFIX = 'enc:v1:';

let cachedKey = null;
const getKey = () => {
  if (cachedKey) {return cachedKey;}
  const secret = env.SETTINGS_ENCRYPTION_KEY || env.JWT_REFRESH_SECRET;
  if (!env.SETTINGS_ENCRYPTION_KEY) {
    logger.warn('[secret-box] SETTINGS_ENCRYPTION_KEY is not set; deriving the key from JWT_REFRESH_SECRET');
  }
  cachedKey = crypto.createHash('sha256').update(`exam-view-settings:${secret}`).digest();
  return cachedKey;
};

export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
};

/** Returns the plain text, or null when the value is missing / not decryptable. */
export const decryptSecret = (payload) => {
  if (!isEncrypted(payload)) {return null;}
  try {
    const [iv, tag, data] = payload.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    logger.warn('[secret-box] Could not decrypt a stored secret (encryption key changed?)');
    return null;
  }
};
