/**
 * Platform-wide settings (portal name, support contact, default timezone, maintenance banner).
 * Stored as one JSON document in the generic SystemSetting store under PLATFORM_SETTINGS_KEY.
 * Every reader gets a fully-populated object (defaults filled in), so callers never null-check.
 */
import * as settingsRepository from './settings.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { URL } from 'node:url';
import { CLOUDINARY_PATHS } from '../../../integrations/cloudinary.js';
import { getCloudinaryConfig } from '../../../services/cloudinary-config.service.js';

export const PLATFORM_SETTINGS_KEY = 'platform_settings';

export const ALLOWED_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Singapore',
];

export const PLATFORM_DEFAULTS = Object.freeze({
  portal_name: 'Exam View',
  support_email: '',
  logo_url: '',
  favicon_url: '',
  default_timezone: 'Asia/Kolkata',
  maintenance: Object.freeze({ enabled: false, message: '' }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/** Merge stored data over defaults and coerce types (tolerates old / partial documents). */
const withDefaults = (raw) => {
  const input = raw && typeof raw === 'object' ? raw : {};
  const maintenance = input.maintenance && typeof input.maintenance === 'object' ? input.maintenance : {};
  return {
    portal_name: str(input.portal_name) || PLATFORM_DEFAULTS.portal_name,
    support_email: str(input.support_email),
    logo_url: str(input.logo_url),
    favicon_url: str(input.favicon_url),
    default_timezone: ALLOWED_TIMEZONES.includes(input.default_timezone)
      ? input.default_timezone
      : PLATFORM_DEFAULTS.default_timezone,
    maintenance: {
      enabled: Boolean(maintenance.enabled),
      message: str(maintenance.message),
    },
  };
};

export const BRANDING_KINDS = ['logo', 'favicon'];
export const brandingPublicId = (kind) => `${CLOUDINARY_PATHS.BRANDING}/${kind}`;

/** A branding image must be one of OUR Cloudinary uploads for that slot — never an arbitrary link. */
const isOwnBrandingUrl = (rawUrl, kind, cloudName) => {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {return false;}
    const path = decodeURIComponent(url.pathname);
    return path.startsWith(`/${cloudName}/image/upload/`) && path.includes(`/${brandingPublicId(kind)}`);
  } catch {
    return false;
  }
};

export const getPlatformSettings = async () => {
  const row = await settingsRepository.getSetting(PLATFORM_SETTINGS_KEY);
  return withDefaults(row?.setting_value);
};

/** Safe subset for login / pre-auth pages (no support email or maintenance internals). */
export const getPublicBranding = async () => {
  const s = await getPlatformSettings();
  return {
    portal_name: s.portal_name,
    logo_url: s.logo_url,
    favicon_url: s.favicon_url,
  };
};

const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

/** Validate a full or partial update and return the cleaned patch. */
export const validatePlatformPatch = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {throw invalid('Invalid settings payload');}
  const patch = {};

  if (body.portal_name !== undefined) {
    const name = str(body.portal_name);
    if (!name) {throw invalid('Portal name is required');}
    if (name.length > 60) {throw invalid('Portal name must be 60 characters or fewer');}
    patch.portal_name = name;
  }

  if (body.support_email !== undefined) {
    const email = str(body.support_email);
    if (email && (!EMAIL_RE.test(email) || email.length > 120)) {throw invalid('Enter a valid support email');}
    patch.support_email = email;
  }

  for (const kind of BRANDING_KINDS) {
    const field = `${kind}_url`;
    if (body[field] !== undefined) {
      const value = str(body[field]);
      if (value.length > 500) {throw invalid(`The ${kind} link is too long`);}
      patch[field] = value;
    }
  }

  if (body.default_timezone !== undefined) {
    if (!ALLOWED_TIMEZONES.includes(body.default_timezone)) {throw invalid('Unsupported timezone');}
    patch.default_timezone = body.default_timezone;
  }

  if (body.maintenance !== undefined) {
    const m = body.maintenance;
    if (!m || typeof m !== 'object') {throw invalid('Invalid maintenance settings');}
    const message = str(m.message);
    if (message.length > 240) {throw invalid('Maintenance message must be 240 characters or fewer');}
    if (m.enabled && !message) {throw invalid('Add a message before turning the maintenance banner on');}
    patch.maintenance = { enabled: Boolean(m.enabled), message };
  }

  return patch;
};

export const savePlatformSettings = async (body, updatedBy) => {
  const patch = validatePlatformPatch(body);
  for (const kind of BRANDING_KINDS) {
    const value = patch[`${kind}_url`];
    if (value) {
      const config = await getCloudinaryConfig();
      if (!isOwnBrandingUrl(value, kind, config.cloud_name)) {throw invalid(`Invalid ${kind} image`);}
    }
  }
  const current = await getPlatformSettings();
  const next = { ...current, ...patch };
  await settingsRepository.upsertSetting(
    PLATFORM_SETTINGS_KEY,
    next,
    'Platform-wide portal settings',
    updatedBy,
  );
  return next;
};
