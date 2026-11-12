/**
 * Email (SMTP) configuration: editable in Platform Settings, falling back to the server env.
 *
 * Stored as one document in the SystemSetting store (key `integration_email`) with the password
 * encrypted. Readers never see the password except `getEmailConfig()` (server-side, used to send).
 */
import { ERROR_CODES } from '@exam-view/shared';
import env from '../config/env.js';
import { AppError } from '../core/errors.js';
import { encryptSecret, decryptSecret } from '../core/secret-box.js';
import { getSetting, upsertSetting } from '../api/v1/settings/settings.repository.js';

export const EMAIL_SETTING_KEY = 'integration_email';
export const EMAIL_PROVIDERS = ['smtp', 'google', 'outlook'];

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const envDefaults = () => ({
  provider: EMAIL_PROVIDERS.includes(env.EMAIL_PROVIDER) ? env.EMAIL_PROVIDER : 'smtp',
  host: str(env.SMTP_HOST),
  port: Number(env.SMTP_PORT) || 587,
  secure: env.SMTP_SECURE === 'true' || Number(env.SMTP_PORT) === 465,
  user: str(env.SMTP_USER),
  from: str(env.EMAIL_FROM),
  pass: String(env.SMTP_PASS || '').replace(/\s+/g, ''),
});

const readStored = async () => (await getSetting(EMAIL_SETTING_KEY))?.setting_value || null;

/** Full config used to actually send mail (includes the decrypted password). */
export const getEmailConfig = async () => {
  const fallback = envDefaults();
  const stored = await readStored();
  if (!stored) {return { ...fallback, source: 'environment' };}

  const storedPass = decryptSecret(stored.pass_enc);
  return {
    provider: EMAIL_PROVIDERS.includes(stored.provider) ? stored.provider : fallback.provider,
    host: str(stored.host) || fallback.host,
    port: Number(stored.port) || fallback.port,
    secure: typeof stored.secure === 'boolean' ? stored.secure : fallback.secure,
    user: str(stored.user) || fallback.user,
    from: str(stored.from) || fallback.from,
    // A stored password that cannot be decrypted falls back to the env one rather than breaking mail.
    pass: storedPass ? storedPass.replace(/\s+/g, '') : fallback.pass,
    source: 'database',
  };
};

/** Safe view for the admin UI — never includes the password. */
export const getEmailSettingsView = async () => {
  const cfg = await getEmailConfig();
  const { pass, ...rest } = cfg;
  return { ...rest, has_password: Boolean(pass) };
};

const validateFields = (body) => {
  const out = {};
  if (body.provider !== undefined) {
    if (!EMAIL_PROVIDERS.includes(body.provider)) {throw invalid('Unsupported email provider');}
    out.provider = body.provider;
  }
  if (body.host !== undefined) {
    const host = str(body.host);
    if (host && !HOST_RE.test(host)) {throw invalid('Enter a valid mail server host, e.g. smtp.gmail.com');}
    out.host = host;
  }
  if (body.port !== undefined) {
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {throw invalid('Port must be between 1 and 65535');}
    out.port = port;
  }
  if (body.secure !== undefined) {out.secure = Boolean(body.secure);}
  if (body.user !== undefined) {
    const user = str(body.user);
    if (user.length > 254) {throw invalid('Username is too long');}
    out.user = user;
  }
  if (body.from !== undefined) {
    const from = str(body.from);
    if (from.length > 254) {throw invalid('From address is too long');}
    out.from = from;
  }
  return out;
};

/** Config to test with: saved values overlaid with whatever is currently typed in the form. */
export const resolveForTest = async (body = {}) => {
  const base = await getEmailConfig();
  const merged = { ...base, ...validateFields(body) };
  const typedPass = str(body.password).replace(/\s+/g, '');
  if (typedPass) {merged.pass = typedPass;}
  return merged;
};

export const saveEmailSettings = async (body, updatedBy) => {
  if (!body || typeof body !== 'object') {throw invalid('Invalid email settings');}
  const patch = validateFields(body);
  const stored = (await readStored()) || {};
  const next = {
    provider: stored.provider,
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    from: stored.from,
    pass_enc: stored.pass_enc,
    ...patch,
  };

  const newPass = str(body.password);
  let passwordChanged = false;
  if (body.clear_password === true) {
    next.pass_enc = null;
    passwordChanged = true;
  } else if (newPass) {
    next.pass_enc = encryptSecret(newPass);
    passwordChanged = true;
  }

  await upsertSetting(EMAIL_SETTING_KEY, next, 'Email (SMTP) configuration', updatedBy);
  return { view: await getEmailSettingsView(), changed: Object.keys(patch), passwordChanged };
};

export const isValidEmail = (value) => EMAIL_RE.test(String(value || '').trim());
