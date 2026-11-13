/* global fetch, AbortSignal, URLSearchParams */
/**
 * Firebase (push notifications) configuration, editable in Platform Settings.
 *
 * Two kinds of values:
 *  - Web app config (apiKey, projectId, senderId, appId, VAPID key): public by design, stored as-is.
 *  - Service-account JSON (server key): secret, stored encrypted and never returned.
 *
 * This only stores and verifies the connection. Sending push notifications is not enabled yet.
 */
import crypto from 'node:crypto';
import { ERROR_CODES } from '@exam-view/shared';
import { AppError } from '../core/errors.js';
import { encryptSecret, decryptSecret } from '../core/secret-box.js';
import { getSetting, upsertSetting } from '../api/v1/settings/settings.repository.js';

export const FIREBASE_SETTING_KEY = 'integration_firebase';

const PROJECT_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const API_KEY_RE = /^AIza[0-9A-Za-z_-]{30,50}$/;
const SENDER_RE = /^\d{6,20}$/;
const APP_ID_RE = /^\d+:\d+:web:[0-9a-f]+$/i;
const VAPID_RE = /^[A-Za-z0-9_-]{60,120}$/;

const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const readStored = async () => (await getSetting(FIREBASE_SETTING_KEY))?.setting_value || null;

/** Parse + sanity-check pasted service-account JSON. Returns the parsed object. */
export const parseServiceAccount = (raw) => {
  let json;
  try {
    json = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw invalid('The server key is not valid JSON. Paste the whole file you downloaded from Firebase.');
  }
  if (
    !json ||
    json.type !== 'service_account' ||
    !str(json.project_id) ||
    !str(json.client_email) ||
    !/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(str(json.private_key))
  ) {
    throw invalid('That does not look like a Firebase service-account key (missing project_id, client_email or private_key).');
  }
  return json;
};

const readServiceAccount = (stored) => {
  const plain = decryptSecret(stored?.service_account_enc);
  if (!plain) {
    return null;
  }
  try {
    return JSON.parse(plain);
  } catch {
    return null;
  }
};

/** Safe view for the admin UI — never includes the private key. */
export const getFirebaseSettingsView = async () => {
  const stored = (await readStored()) || {};
  return {
    project_id: stored.project_id || '',
    api_key: stored.api_key || '',
    messaging_sender_id: stored.messaging_sender_id || '',
    app_id: stored.app_id || '',
    vapid_key: stored.vapid_key || '',
    has_service_account: Boolean(stored.service_account_enc),
    service_account_email: stored.service_account_email || '',
    service_account_project_id: stored.service_account_project_id || '',
  };
};

const validateFields = (body) => {
  const out = {};
  const check = (key, re, message) => {
    if (body[key] !== undefined) {
      const value = str(body[key]);
      if (value && !re.test(value)) {
        throw invalid(message);
      }
      out[key] = value;
    }
  };
  check('project_id', PROJECT_RE, 'Project ID looks wrong (lowercase letters, numbers and dashes)');
  check('api_key', API_KEY_RE, 'Web API key should start with "AIza"');
  check('messaging_sender_id', SENDER_RE, 'Sender ID should be a number');
  check('app_id', APP_ID_RE, 'App ID should look like 1:1234567890:web:abc123');
  check('vapid_key', VAPID_RE, 'The web push (VAPID) key looks wrong');
  return out;
};

export const saveFirebaseSettings = async (body, updatedBy) => {
  if (!body || typeof body !== 'object') {
    throw invalid('Invalid push notification settings');
  }
  const patch = validateFields(body);
  const stored = (await readStored()) || {};
  const next = {
    project_id: stored.project_id,
    api_key: stored.api_key,
    messaging_sender_id: stored.messaging_sender_id,
    app_id: stored.app_id,
    vapid_key: stored.vapid_key,
    service_account_enc: stored.service_account_enc,
    service_account_email: stored.service_account_email,
    service_account_project_id: stored.service_account_project_id,
    ...patch,
  };

  let keyChanged = false;
  if (body.clear_service_account === true) {
    next.service_account_enc = null;
    next.service_account_email = null;
    next.service_account_project_id = null;
    keyChanged = true;
  } else if (str(body.service_account)) {
    const account = parseServiceAccount(body.service_account);
    next.service_account_enc = encryptSecret(JSON.stringify(account));
    next.service_account_email = account.client_email;
    next.service_account_project_id = account.project_id;
    keyChanged = true;
    // Convenience: if no project id was typed, use the key's.
    if (!next.project_id) {
      next.project_id = account.project_id;
    }
  }

  await upsertSetting(FIREBASE_SETTING_KEY, next, 'Firebase (push notifications) configuration', updatedBy);
  return { view: await getFirebaseSettingsView(), changed: Object.keys(patch), keyChanged };
};

const b64url = (input) => Buffer.from(input).toString('base64url');

/**
 * Prove the server key works by exchanging a signed token with Google. Sends nothing to any device.
 * Uses the key typed in the form when present, otherwise the saved one.
 */
export const verifyFirebaseServerKey = async (typedServiceAccount) => {
  let account;
  if (str(typedServiceAccount)) {
    account = parseServiceAccount(typedServiceAccount);
  } else {
    account = readServiceAccount(await readStored());
    if (!account) {
      throw invalid('Add the server key (service-account JSON) first');
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    b64url(JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');

  let assertion;
  try {
    assertion = `${unsigned}.${crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url')}`;
  } catch {
    throw invalid('The private key in that file could not be read. Download a fresh key from Firebase.');
  }

  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AppError('Could not reach Google. Check your internet connection and try again.', 502, ERROR_CODES.SERVICE_UNAVAILABLE);
  }

  if (!response.ok) {
    throw invalid('Google rejected this server key. It may be revoked, expired or for a different project.');
  }
  return { project_id: account.project_id, client_email: account.client_email };
};
