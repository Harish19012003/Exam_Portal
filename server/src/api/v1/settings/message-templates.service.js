/**
 * Editable email templates (Settings > Message Templates).
 *
 * Built-in defaults live in message-templates.defaults.js; a super admin's edits are stored as ONE JSON document in
 * the generic SystemSetting store ({ [templateId]: { subject, body, enabled } }). Emails are rendered here, so the
 * sign-in / password-reset / welcome / 2FA mails really use what is saved. If a stored template is broken for any
 * reason, the built-in default is used instead, so sign-in mail can never be lost to a bad edit.
 */
import { ERROR_CODES } from '@exam-view/shared';
import * as settingsRepository from './settings.repository.js';
import { AppError } from '../../../core/errors.js';
import { DEFAULT_TEMPLATES } from './message-templates.defaults.js';

export const MESSAGE_TEMPLATES_KEY = 'message_templates';

const SUBJECT_MAX = 200;
const BODY_MAX = 60 * 1024;

const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

const findDefault = (id) => DEFAULT_TEMPLATES.find((t) => t.id === id);

const readOverrides = async () => {
  const row = await settingsRepository.getSetting(MESSAGE_TEMPLATES_KEY);
  const value = row?.setting_value;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

/** Email HTML must never carry active content: strip scripts, embeds, inline handlers and javascript: links. */
export const sanitizeEmailHtml = (html) =>
  String(html)
    .replace(/<\s*(script|iframe|object|embed|form|link|meta|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Replace {variable} placeholders. Only the template's own variables are touched; missing values become empty. */
const fill = (text, variables, values, escape) =>
  String(text).replace(/\{([a-z_]+)\}/g, (match, key) => {
    if (!variables.includes(key)) {return match;}
    const value = values[key] ?? '';
    return escape ? escapeHtml(value) : String(value).replace(/[\r\n]+/g, ' ');
  });

const merge = (def, stored) => ({
  id: def.id,
  name: def.name,
  badge: def.badge,
  required: def.required,
  variables: def.variables,
  sample: def.sample,
  subject: typeof stored?.subject === 'string' && stored.subject.trim() ? stored.subject : def.subject,
  body: typeof stored?.body === 'string' && stored.body.trim() ? stored.body : def.body,
  enabled: stored?.enabled !== false,
  customized: Boolean(stored && (stored.subject || stored.body || stored.enabled === false)),
  default_subject: def.subject,
  default_body: def.body,
});

export const listTemplates = async () => {
  const overrides = await readOverrides();
  return DEFAULT_TEMPLATES.map((def) => merge(def, overrides[def.id]));
};

export const saveTemplate = async (id, patch, updatedBy) => {
  const def = findDefault(id);
  if (!def) {throw new AppError('Unknown template', 404, ERROR_CODES.NOT_FOUND);}
  if (!patch || typeof patch !== 'object') {throw invalid('Invalid template payload');}

  const overrides = await readOverrides();
  const next = { ...(overrides[id] || {}) };

  if (patch.subject !== undefined) {
    const subject = String(patch.subject).replace(/[\r\n]+/g, ' ').trim();
    if (!subject) {throw invalid('Subject is required');}
    if (subject.length > SUBJECT_MAX) {throw invalid(`Subject must be ${SUBJECT_MAX} characters or fewer`);}
    next.subject = subject;
  }

  if (patch.body !== undefined) {
    const body = sanitizeEmailHtml(String(patch.body)).trim();
    if (!body) {throw invalid('The message body is required');}
    if (body.length > BODY_MAX) {throw invalid('The message body is too large (max 60 KB)');}
    // Sign-in and recovery emails are useless without their code / link.
    const must = id === 'otp' ? 'otp_code' : id === 'password_reset' ? 'reset_url' : null;
    if (must && !body.includes(`{${must}}`)) {throw invalid(`This email must contain {${must}}`);}
    next.body = body;
  }

  if (patch.enabled !== undefined) {
    next.enabled = Boolean(patch.enabled);
  }

  await settingsRepository.upsertSetting(
    MESSAGE_TEMPLATES_KEY,
    { ...overrides, [id]: next },
    'Customised email message templates',
    updatedBy,
  );
  return merge(def, next);
};

export const resetTemplate = async (id, updatedBy) => {
  const def = findDefault(id);
  if (!def) {throw new AppError('Unknown template', 404, ERROR_CODES.NOT_FOUND);}
  const overrides = await readOverrides();
  delete overrides[id];
  await settingsRepository.upsertSetting(MESSAGE_TEMPLATES_KEY, overrides, 'Customised email message templates', updatedBy);
  return merge(def, null);
};

/**
 * Render a template for sending. Returns null when the template is switched off.
 * Falls back to the built-in default if the stored version cannot be rendered.
 */
export const renderTemplate = async (id, values = {}) => {
  const def = findDefault(id);
  if (!def) {throw new AppError('Unknown template', 404, ERROR_CODES.NOT_FOUND);}
  let template;
  try {
    template = merge(def, (await readOverrides())[id]);
  } catch {
    template = merge(def, null);
  }
  if (!template.enabled) {return null;}
  const render = (t) => ({
    subject: fill(t.subject, def.variables, values, false),
    html: fill(t.body, def.variables, values, true),
  });
  try {
    return render(template);
  } catch {
    return render(merge(def, null));
  }
};

/** Render with the template's sample values (for the "send test" button). */
export const renderSample = async (id) => {
  const def = findDefault(id);
  if (!def) {throw new AppError('Unknown template', 404, ERROR_CODES.NOT_FOUND);}
  const template = merge(def, (await readOverrides())[id]);
  return {
    subject: `[Test] ${fill(template.subject, def.variables, def.sample, false)}`,
    html: fill(template.body, def.variables, def.sample, true),
  };
};
