/**
 * Help & Support content shown in the app's Help modal (sidebar "?" icon).
 * Stored as one JSON document in the SystemSetting store under SUPPORT_SETTINGS_KEY.
 * The support email itself stays in Platform settings (`support_email`) so the footer and
 * email templates keep one source of truth; it is merged into the response here.
 */
import * as settingsRepository from './settings.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { URL } from 'node:url';
import { getPlatformSettings, savePlatformSettings } from './platform-settings.service.js';

export const SUPPORT_SETTINGS_KEY = 'support_settings';

const LIMITS = Object.freeze({
  intro: 300,
  phone: 30,
  whatsapp: 20,
  hours: 120,
  linkLabel: 60,
  linkUrl: 500,
  links: 8,
  faqQ: 200,
  faqA: 1000,
  faqs: 20,
});

export const SUPPORT_DEFAULTS = Object.freeze({
  intro: '',
  phone: '',
  whatsapp: '',
  hours: '',
  links: [],
  faqs: [],
});

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const invalid = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** Tolerant read: coerce stored data to the current shape. */
const withDefaults = (raw) => {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    intro: str(input.intro),
    phone: str(input.phone),
    whatsapp: str(input.whatsapp),
    hours: str(input.hours),
    links: (Array.isArray(input.links) ? input.links : [])
      .map((l) => ({ label: str(l?.label), url: str(l?.url) }))
      .filter((l) => l.label && l.url),
    faqs: (Array.isArray(input.faqs) ? input.faqs : [])
      .map((f) => ({ q: str(f?.q), a: str(f?.a) }))
      .filter((f) => f.q && f.a),
  };
};

export const getSupportSettings = async () => {
  const [row, platform] = await Promise.all([
    settingsRepository.getSetting(SUPPORT_SETTINGS_KEY),
    getPlatformSettings(),
  ]);
  return { ...withDefaults(row?.setting_value), email: platform.support_email };
};

/** Validate a full update and return the cleaned document (email handled separately). */
export const validateSupportPatch = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Invalid support settings');

  const intro = str(body.intro);
  if (intro.length > LIMITS.intro) throw invalid(`Intro must be ${LIMITS.intro} characters or fewer`);

  const phone = str(body.phone);
  if (phone.length > LIMITS.phone || (phone && !/^[+\d][\d\s()-]*$/.test(phone))) {
    throw invalid('Enter a valid phone number');
  }

  const whatsapp = str(body.whatsapp).replace(/[\s()-]/g, '');
  if (whatsapp && !/^\+?\d{8,15}$/.test(whatsapp)) {
    throw invalid('WhatsApp number must be 8–15 digits, with country code (e.g. +919876543210)');
  }

  const hours = str(body.hours);
  if (hours.length > LIMITS.hours) throw invalid(`Support hours must be ${LIMITS.hours} characters or fewer`);

  const rawLinks = Array.isArray(body.links) ? body.links : [];
  const links = rawLinks
    .map((l) => ({ label: str(l?.label), url: str(l?.url) }))
    .filter((l) => l.label || l.url);
  if (links.length > LIMITS.links) throw invalid(`Use at most ${LIMITS.links} help links`);
  links.forEach((l, i) => {
    if (!l.label || !l.url) throw invalid(`Help link ${i + 1} needs both a label and a URL`);
    if (l.label.length > LIMITS.linkLabel) throw invalid(`Help link ${i + 1}: label is too long`);
    if (l.url.length > LIMITS.linkUrl || !isHttpUrl(l.url)) throw invalid(`Help link ${i + 1}: enter a full https:// URL`);
  });

  const rawFaqs = Array.isArray(body.faqs) ? body.faqs : [];
  const faqs = rawFaqs.map((f) => ({ q: str(f?.q), a: str(f?.a) })).filter((f) => f.q || f.a);
  if (faqs.length > LIMITS.faqs) throw invalid(`Use at most ${LIMITS.faqs} FAQs`);
  faqs.forEach((f, i) => {
    if (!f.q || !f.a) throw invalid(`FAQ ${i + 1} needs both a question and an answer`);
    if (f.q.length > LIMITS.faqQ) throw invalid(`FAQ ${i + 1}: question is too long`);
    if (f.a.length > LIMITS.faqA) throw invalid(`FAQ ${i + 1}: answer is too long`);
  });

  return { intro, phone, whatsapp, hours, links, faqs };
};

export const saveSupportSettings = async (body, updatedBy) => {
  const doc = validateSupportPatch(body);
  // Email lives in Platform settings (validated there) — update it only when it changed.
  if (body.email !== undefined) {
    const platform = await getPlatformSettings();
    if (str(body.email) !== platform.support_email) {
      await savePlatformSettings({ support_email: body.email }, updatedBy);
    }
  }
  await settingsRepository.upsertSetting(SUPPORT_SETTINGS_KEY, doc, 'Help & Support content', updatedBy);
  return getSupportSettings();
};
