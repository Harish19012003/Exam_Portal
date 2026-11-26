import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES, isDeviceMasterViewKey } from '@exam-view/shared';
import { getCustomFields } from './device-fields.service.js';
import * as repo from './device-fields.repository.js';
import { logger } from '../../../core/logger.js';
import { isValidTimeZone, nextRunAt } from '../seq-views/seq-view-schedule.js';
import { dropUniqueConflicts } from '../shared/unique-fields.js';
import { deviceRepository } from './device.repository.js';
import { importDevices } from './device.service.js';
import { importDeviceTabRows, listDeviceTabRows } from './device-tab-import.service.js';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_HEADERS = 20;
const MAX_BODY_CHARS = 20000;
const MAX_PROPERTIES = 30;
const MAX_PROPERTY_VALUE = 2000;
export const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 10080;
const SECRET_NAME = /pass|token|secret|key|auth|credential/i;
const SAMPLE_ROWS = 3;
/** Stored header values are never sent back to the browser; the form echoes this instead. */
export const SECRET_MASK = '••••••••';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['192.0.0.0', 24], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([net_, prefix]) => blocked.addSubnet(net_, prefix, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]].forEach(([net_, prefix]) =>
  blocked.addSubnet(net_, prefix, 'ipv6'),
);

const allowPrivate = () => String(process.env.DEVICE_API_ALLOW_PRIVATE || '').toLowerCase() === 'true';

const isBlockedAddress = (address) => {
  const family = net.isIP(address);
  if (!family) return true;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by its IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
};

/** DNS lookup that refuses internal addresses; the connection uses the address that was checked. */
const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses.filter((a) => allowPrivate() || !isBlockedAddress(a.address));
    if (!list.length) return callback(new Error('Requests to internal or private addresses are not allowed'));
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

const cleanHeaders = (list) => {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw validationError('headers must be a list');
  if (list.length > MAX_HEADERS) throw validationError(`Use at most ${MAX_HEADERS} headers`);
  const seen = new Set();
  return list
    .map((h) => ({ name: String(h?.name ?? '').trim(), value: String(h?.value ?? '') }))
    .filter((h) => h.name || h.value)
    .map((h) => {
      if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(h.name)) throw validationError(`Invalid header name "${h.name}"`);
      if (/[\r\n]/.test(h.value)) throw validationError(`Invalid value for header "${h.name}"`);
      const lower = h.name.toLowerCase();
      if (seen.has(lower)) throw validationError(`Header "${h.name}" is listed twice`);
      seen.add(lower);
      return h;
    });
};

const cleanProperties = (list) => {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw validationError('properties must be a list');
  if (list.length > MAX_PROPERTIES) throw validationError(`Use at most ${MAX_PROPERTIES} script properties`);
  const seen = new Set();
  return list
    .map((p) => ({ name: String(p?.name ?? '').trim(), value: String(p?.value ?? '') }))
    .filter((p) => p.name || p.value)
    .map((p) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.name)) throw validationError(`Invalid property name "${p.name}". Use letters, numbers and _`);
      if (p.value.length > MAX_PROPERTY_VALUE) throw validationError(`Value of "${p.name}" is too long`);
      if (seen.has(p.name)) throw validationError(`Property "${p.name}" is listed twice`);
      seen.add(p.name);
      return p;
    });
};

const cleanSchedule = (input) => {
  const enabled = input?.enabled === true;
  const type = ['interval', 'daily', 'weekly'].includes(input?.type) ? input.type : 'interval';

  const intervalMinutes = Math.round(Number(input?.intervalMinutes ?? 60));
  if (type === 'interval' && (!Number.isFinite(intervalMinutes) || intervalMinutes < MIN_INTERVAL_MINUTES || intervalMinutes > MAX_INTERVAL_MINUTES)) {
    throw validationError(`Interval must be between ${MIN_INTERVAL_MINUTES} minutes and 7 days`);
  }

  const time = String(input?.time ?? '09:00');
  if (type !== 'interval' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw validationError('Choose a valid time of day');

  const days = [...new Set((Array.isArray(input?.days) ? input.days : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (type === 'weekly' && !days.length) throw validationError('Choose at least one day of the week');

  const timezone = String(input?.timezone || 'UTC');
  if (!isValidTimeZone(timezone)) throw validationError('Unknown time zone');

  return { enabled, type, intervalMinutes: Number.isFinite(intervalMinutes) ? intervalMinutes : 60, time, days, timezone };
};

const emptyAuth = () => ({
  enabled: false,
  url: '',
  method: 'POST',
  headers: [],
  body: '',
  username: '',
  password: '',
  tokenPath: 'token',
  tokenProperty: 'token',
});

/** Optional login call that runs before the data request and fills a script property (usually `token`). */
const cleanAuth = (input) => {
  const enabled = input?.enabled === true;
  if (!enabled) return emptyAuth();

  let url;
  try {
    url = new URL(String(input.url ?? '').trim());
  } catch {
    throw validationError('Enter a valid login URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw validationError('Only http and https login URLs are supported');
  if (url.username || url.password) throw validationError('Put login credentials in the Username / Password fields, not in the URL');

  const method = String(input.method || 'POST').toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw validationError('Login method must be GET or POST');

  const body = String(input.body ?? '');
  if (body.length > MAX_BODY_CHARS) throw validationError('Login body is too large');
  if (method === 'POST' && body.trim()) {
    try {
      JSON.parse(body);
    } catch {
      throw validationError('Login body must be valid JSON');
    }
  }

  const tokenPath = String(input.tokenPath ?? 'token').trim();
  if (!tokenPath || !/^[\w$-]+(\.[\w$-]+)*$/.test(tokenPath)) {
    throw validationError('Token path looks like token or data.token');
  }

  const tokenProperty = String(input.tokenProperty ?? 'token').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokenProperty)) {
    throw validationError(`Invalid token property name "${tokenProperty}"`);
  }

  return {
    enabled: true,
    url: url.toString(),
    method,
    headers: cleanHeaders(input.headers),
    body,
    username: String(input.username ?? ''),
    password: String(input.password ?? ''),
    tokenPath,
    tokenProperty,
  };
};

/** Training modal: TrustView `type` strings for each Aadhaar mode. */
const cleanAadhaarTypes = (input) => {
  const src = input && typeof input === 'object' ? input : {};
  const one = (v) => String(v ?? '').trim().slice(0, 120);
  return {
    aadhaar: one(src.aadhaar),
    non_aadhaar: one(src.non_aadhaar),
  };
};

/** Param: whether this exam is Aadhaar or Non Aadhaar (default Non Aadhaar). */
const cleanExamAadhaar = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'aadhaar' ? 'aadhaar' : 'non_aadhaar';
};

const cleanConfig = (input = {}) => {
  let url;
  try {
    url = new URL(String(input.url ?? '').trim());
  } catch {
    throw validationError('Enter a valid API URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw validationError('Only http and https URLs are supported');
  if (url.username || url.password) throw validationError('Put credentials in a header, not in the URL');

  const method = String(input.method || 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw validationError('Method must be GET or POST');

  const body = String(input.body ?? '');
  if (body.length > MAX_BODY_CHARS) throw validationError('Request body is too large');
  if (method === 'POST' && body.trim()) {
    try {
      JSON.parse(body);
    } catch {
      throw validationError('Request body must be valid JSON');
    }
  }

  const dataPath = String(input.dataPath ?? '').trim();
  if (dataPath && !/^[\w$-]+(\.[\w$-]+)*$/.test(dataPath)) throw validationError('Data path looks like data.items');

  const mode = input.mode === 'replace' ? 'replace' : 'append';
  return {
    url: url.toString(),
    method,
    headers: cleanHeaders(input.headers),
    body,
    dataPath,
    mode,
    properties: cleanProperties(input.properties),
    auth: cleanAuth(input.auth),
    schedule: cleanSchedule(input.schedule),
    /** Param-owned: this exam is Aadhaar or Non Aadhaar. */
    examAadhaar: cleanExamAadhaar(input.examAadhaar),
    /** Training-owned: TrustView `type` per mode (ignored when saving Param). */
    aadhaarTypes: cleanAadhaarTypes(input.aadhaarTypes),
  };
};

/** Masked values keep the secret that is already stored under the same name. */
const restoreMasked = (list, stored, key) => {
  const byName = new Map((stored?.[key] || []).map((h) => [h.name.toLowerCase(), h.value]));
  return list.map((h) => (h.value === SECRET_MASK ? { ...h, value: byName.get(h.name.toLowerCase()) ?? '' } : h));
};

const mask = (config) =>
  config
    ? {
        ...config,
        headers: (config.headers || []).map((h) => ({ ...h, value: h.value ? SECRET_MASK : '' })),
        properties: (config.properties || []).map((p) => (SECRET_NAME.test(p.name) && p.value ? { ...p, value: SECRET_MASK } : p)),
        auth: config.auth
          ? {
              ...config.auth,
              password: config.auth.password ? SECRET_MASK : '',
              headers: (config.auth.headers || []).map((h) => ({ ...h, value: h.value ? SECRET_MASK : '' })),
            }
          : config.auth,
      }
    : null;

const withRestored = (body, stored) => {
  const restored = {
    ...body,
    headers: restoreMasked(cleanHeaders(body.headers), stored, 'headers'),
    properties: restoreMasked(cleanProperties(body.properties), stored, 'properties'),
  };
  if (body.auth) {
    restored.auth = {
      ...body.auth,
      password: body.auth.password === SECRET_MASK ? stored?.auth?.password || '' : body.auth.password,
      headers: restoreMasked(cleanHeaders(body.auth.headers), stored?.auth, 'headers'),
    };
  }
  return restored;
};
const withState = async (config) => (config ? { ...mask(config), status: await repo.getSyncState() } : null);

const normalizeView = (view) => {
  const key = String(view || 'devices').trim() || 'devices';
  if (!isDeviceMasterViewKey(key)) throw validationError(`Unknown Device Master page: "${key}"`);
  return key;
};

/**
 * Report tabs share Param’s connection: url, headers, auth/login, and token.
 * The tab only overrides report variables (type, shift, …) and import/schedule prefs.
 * Report `type` is whatever you set in Variables — not mapped from the tab name.
 */
const mergeSharedConnection = (shared, viewConfig, viewKey) => {
  if (!shared) return viewConfig || null;
  if (!viewConfig || viewKey === 'devices') return shared;

  const byName = new Map();
  for (const p of Array.isArray(shared.properties) ? shared.properties : []) {
    const name = String(p?.name || '').trim();
    if (name) byName.set(name, { ...p, name });
  }
  for (const p of Array.isArray(viewConfig.properties) ? viewConfig.properties : []) {
    const name = String(p?.name || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    // Never let an empty/masked report-tab token wipe Param’s real token.
    if ((lower === 'token' || lower === 'password') && !String(p.value || '').trim()) continue;
    if (String(p.value || '') === '••••••••') continue;
    byName.set(name, { ...p, name });
  }

  return {
    ...shared,
    properties: [...byName.values()],
    dataPath: viewConfig.dataPath ?? shared.dataPath,
    mode: viewConfig.mode ?? shared.mode,
    schedule: viewConfig.schedule ?? shared.schedule,
    // Connection always from Param.
    url: shared.url,
    method: shared.method,
    headers: shared.headers,
    body: shared.body,
    auth: shared.auth,
    examAadhaar: cleanExamAadhaar(shared.examAadhaar),
    // Training (and similar) own the type strings; fall back to anything left on Param.
    aadhaarTypes: cleanAadhaarTypes(viewConfig?.aadhaarTypes ?? shared?.aadhaarTypes),
  };
};

/** Load saved config for a tab, always layered on Param’s shared connection for report tabs. */
const loadStoredConfig = async (viewKey) => {
  const key = normalizeView(viewKey);
  if (key === 'devices') return repo.getApiConfig();
  const [shared, own] = await Promise.all([repo.getApiConfig(), repo.getApiConfigForView(key)]);
  return mergeSharedConnection(shared, own, key);
};

export const getApiConfig = async (view = 'devices') => {
  const key = normalizeView(view);
  const stored = await loadStoredConfig(key);
  return withState(stored || null);
};

const nextRunFrom = (schedule, from = Date.now()) => nextRunAt(schedule, from);

export const saveApiConfig = async (body = {}, userId, view = 'devices') => {
  const key = normalizeView(view);
  if (key === 'devices') {
    const stored = await repo.getApiConfig();
    const config = cleanConfig(withRestored(body, stored));
    // Param owns exam Aadhaar mode only — type strings live on Training.
    config.aadhaarTypes = cleanAadhaarTypes({});
    await repo.saveApiConfig(config, userId);
    const changed = JSON.stringify(stored?.schedule ?? null) !== JSON.stringify(config.schedule);
    if (changed) await repo.saveSyncState({ next_run_at: nextRunFrom(config.schedule) });
    return withState(config);
  }

  const [shared, stored] = await Promise.all([repo.getApiConfig(), repo.getApiConfigForView(key)]);
  const restored = cleanConfig(withRestored(body, stored || shared));
  // Persist report-tab overrides only; connection + examAadhaar stay owned by Param.
  const toSave = {
    url: shared?.url || restored.url,
    method: shared?.method || restored.method,
    headers: shared?.headers || restored.headers,
    body: shared?.body || restored.body,
    auth: shared?.auth || restored.auth,
    properties: restored.properties,
    dataPath: restored.dataPath,
    mode: restored.mode,
    schedule: restored.schedule,
    aadhaarTypes: cleanAadhaarTypes(restored.aadhaarTypes),
  };
  await repo.saveApiConfigForView(key, toSave, userId);
  return withState(mergeSharedConnection(shared, toSave, key));
};

/**
 * TrustView `exceldownload` (same call as the operator-details sheet script):
 * `token` is the HTTP header, query params are the other variables (shift, type, …),
 * and `format=csv` is always sent so the body is CSV.
 */
const isTrustViewExcelDownload = (urlString) => {
  try {
    const u = new URL(urlString);
    return /(^|\.)trustview\.in$/i.test(u.hostname) && /\/exceldownload\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
};

/** `{{NAME}}` in the URL, header values and body is replaced by the script property of that name. */
const applyProperties = (config, { appendQuery = false } = {}) => {
  const props = new Map((config.properties || []).map((p) => [p.name, p.value]));
  const fill = (text, encode = (v) => v) =>
    String(text).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name) => {
      if (!props.has(name)) throw validationError(`Script property "${name}" is used but not defined`);
      return encode(props.get(name));
    });
  let url = fill(decodeURI(config.url), encodeURIComponent);
  let headers = (config.headers || []).map((h) => ({ ...h, value: fill(h.value) }));
  // GET data calls: script properties become query params (type, shift, date, …) unless already in the URL.
  if (appendQuery) {
    const parsed = new URL(url);
    const trustView = isTrustViewExcelDownload(url);
    const headerNames = new Set(headers.map((h) => h.name.toLowerCase()));
    for (const [name, value] of props) {
      if (value === undefined || value === null || String(value) === '') continue;
      // The sheet sends `headers: { token }`. A query-string token is what TrustView answers with 401.
      if (trustView && name.toLowerCase() === 'token') {
        if (!headerNames.has('token')) {
          headers.push({ name: 'token', value: String(value) });
          headerNames.add('token');
        }
        continue;
      }
      if (!parsed.searchParams.has(name)) parsed.searchParams.set(name, String(value));
    }
    if (trustView && !parsed.searchParams.has('format')) parsed.searchParams.set('format', 'csv');
    url = parsed.toString();
  }
  return {
    ...config,
    url,
    headers,
    body: fill(config.body || ''),
  };
};

/** RFC-style CSV (quotes, escaped quotes, CR/LF), same role as Apps Script `Utilities.parseCsv`. */
const parseCsv = (text) => {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || String(r[0] ?? '') !== '');
};

/** Header row + data rows → objects. Returns null when the text is not a CSV table. */
const csvToRecords = (text) => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return null;
  const table = parseCsv(trimmed);
  if (table.length < 1) return null;
  const headers = table[0].map((h) => String(h ?? '').trim());
  if (headers.filter(Boolean).length < 2 || !headers.some((h) => /[A-Za-z]/.test(h))) return null;
  return table.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? '';
    });
    return obj;
  });
};

const request = (rawConfig, opts = {}) =>
  new Promise((resolve, reject) => {
    const config = applyProperties(rawConfig, opts);
    const url = new URL(config.url);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = config.method === 'POST' && config.body.trim() ? config.body : null;
    const headers = { ...Object.fromEntries(config.headers.map((h) => [h.name, h.value])) };
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept')) {
      headers.Accept = 'application/json, text/csv, */*';
    }
    if (payload !== null) {
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(url, { method: config.method, headers, lookup: safeLookup, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error('The API response is larger than 5 MB'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('The API did not respond in time')));
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });

const pickPath = (json, path) => {
  let node = json;
  for (const part of String(path).split('.')) {
    node = node != null && typeof node === 'object' ? node[part] : undefined;
  }
  return node;
};

const upsertProperty = (properties, name, value) => {
  const list = [...(properties || [])];
  const i = list.findIndex((p) => p.name === name);
  if (i >= 0) list[i] = { name, value };
  else list.push({ name, value });
  return list;
};

/** Merge login username/password into script properties so the login body can use {{username}} / {{password}}. */
const withLoginCredentials = (properties, auth) => {
  let list = [...(properties || [])];
  if (String(auth.username || '') !== '') list = upsertProperty(list, 'username', auth.username);
  if (String(auth.password || '') !== '') list = upsertProperty(list, 'password', auth.password);
  return list;
};

/** When login-first is on: call the login URL, read the token, then merge it into script properties. */
const applyAuth = async (config) => {
  const auth = config.auth;
  if (!auth?.enabled) return config;

  let loginRes;
  try {
    loginRes = await request({
      url: auth.url,
      method: auth.method,
      headers: auth.headers || [],
      body: auth.body || '',
      properties: withLoginCredentials(config.properties, auth),
    });
  } catch (error) {
    throw new AppError(`Login request failed: ${error.message}`, 502, ERROR_CODES.VALIDATION_ERROR);
  }
  if (loginRes.status < 200 || loginRes.status >= 300) {
    throw new AppError(`Login answered with HTTP ${loginRes.status}`, 502, ERROR_CODES.VALIDATION_ERROR);
  }

  let json;
  try {
    json = JSON.parse(loginRes.text);
  } catch {
    throw new AppError('Login response is not valid JSON', 502, ERROR_CODES.VALIDATION_ERROR);
  }

  const token = pickPath(json, auth.tokenPath);
  if (token === undefined || token === null || String(token).trim() === '') {
    const hint = json?.message?.text || json?.Message || json?.notify?.text || json?.error || '';
    throw new AppError(
      `Login did not return a token at "${auth.tokenPath}"${hint ? `: ${String(hint).slice(0, 200)}` : ''}`,
      502,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return {
    ...config,
    properties: upsertProperty(config.properties, auth.tokenProperty, String(token)),
  };
};

/** Short human message from an error response body (JSON message fields, else the start of the text). */
const errorReason = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return '';
  try {
    const j = JSON.parse(raw);
    const msg = [j?.message, j?.error?.message, j?.error, j?.notify?.text, j?.detail, j?.msg].find(
      (m) => typeof m === 'string' && m.trim(),
    );
    if (msg) return msg.trim().slice(0, 200);
  } catch {
    // not JSON — fall through to plain text
  }
  return /^\s*</.test(raw) ? '' : raw.replace(/\s+/g, ' ').slice(0, 200);
};

/** One download. `config` must already include a fresh login token when login-first is on. */
const callApiOnce = async (config) => {
  let res;
  try {
    res = await request(config, { appendQuery: config.method === 'GET' });
  } catch (error) {
    throw new AppError(`API request failed: ${error.message}`, 502, ERROR_CODES.VALIDATION_ERROR);
  }
  if (res.status < 200 || res.status >= 300) {
    // Redirects are not followed on purpose: the target could point at an internal address.
    const reason = errorReason(res.text);
    const hint =
      res.status === 401 || res.status === 403
        ? ' Check the token, or open Shared connection (gear) and turn on Login first to get a fresh one.'
        : '';
    throw new AppError(
      `The API answered with HTTP ${res.status}${reason ? `: ${reason}` : ''}.${hint}`,
      502,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
  let json;
  const raw = String(res.text ?? '').trim();
  try {
    json = JSON.parse(raw);
  } catch {
    const records = csvToRecords(res.text);
    if (records) json = records;
    else {
      const plain = raw && raw.length <= 300 && !/^\s*</.test(raw) ? raw.replace(/\s+/g, ' ') : '';
      throw new AppError(
        plain ? `The API answered: ${plain}.` : 'The API response is not valid JSON or CSV',
        502,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  }
  // TrustView sometimes returns JSON { message: "Invalid Request" } instead of plain text.
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const msg = errorReason(raw) || String(json.message || json.error || json.Message || '').trim();
    if (/invalid request/i.test(msg) || /invalid request/i.test(raw)) {
      throw new AppError(`The API answered: ${msg || 'Invalid Request'}.`, 502, ERROR_CODES.VALIDATION_ERROR);
    }
  }
  return { status: res.status, json };
};

/** Query params that carry a shift id to TrustView (`currentshift` is a filter only — see sheet script). */
const isShiftQueryParamName = (name) =>
  /^(shift|shiftid|shift_id|shift_code)$/i.test(String(name || '').trim());

const isCurrentShiftFilterName = (name) =>
  /^(currentshift|current_shift)$/i.test(String(name || '').trim());

/** Sheet: blank or "bank" → process every ES row. */
const CURRENT_SHIFT_ALL_VALUE = 'bank';
/**
 * Sheet Param column A for reports that compile ES rows
 * (Stats Center `centre`, Sync Pending `pending_sync_status`, …).
 */
const ES_PARAM_ROW_KEY = 'ES';
const ES_REPORT_TYPES = new Set(['centre', 'pending_sync_status']);

const propValueByNames = (properties, names) => {
  const want = new Set(names.map((n) => String(n).toLowerCase()));
  for (const p of Array.isArray(properties) ? properties : []) {
    const name = String(p?.name || '').trim().toLowerCase();
    if (want.has(name)) return String(p?.value ?? '').trim();
  }
  return '';
};

const isCurrentShiftAll = (value) => {
  const v = String(value || '').trim();
  return v === '' || v.toLowerCase() === CURRENT_SHIFT_ALL_VALUE;
};

const urlHasFilledShiftQuery = (urlString) => {
  try {
    const params = new URL(urlString).searchParams;
    for (const key of params.keys()) {
      if (isShiftQueryParamName(key) && String(params.get(key) || '').trim()) return true;
    }
  } catch {
    // ignore
  }
  return false;
};

/**
 * Param (`device_param`) shift ids for this exam — same as sheet ES / TS rows.
 * When `rowKey` is set (e.g. "ES" for centre), only those Shift-type rows are used.
 */
const savedParamShiftCodes = async (examId = '', { rowKey = '' } = {}) => {
  const scoped = String(examId || '').trim();
  let rows = scoped ? await deviceRepository.findByExamId(scoped) : await deviceRepository.findAll();
  // Legacy rows without exam_id still sit in the collection — fall back so blank currentshift works.
  if (scoped && !rows.length) rows = await deviceRepository.findAll();
  const wantKey = String(rowKey || '').trim().toUpperCase();
  const codes = [];
  const seen = new Set();
  const pushCode = (row) => {
    const code = String(row.shift_code ?? row.Shift_code ?? row.SHIFT_CODE ?? '').trim();
    if (!code || seen.has(code)) return;
    seen.add(code);
    codes.push(code);
  };
  if (wantKey) {
    for (const row of rows) {
      const type = String(row.currentshift ?? row.Currentshift ?? row.CURRENTSHIFT ?? '').trim().toUpperCase();
      if (type === wantKey) pushCode(row);
    }
    // Older Param imports may lack Shift type — fall back to every shift code.
    if (!codes.length) {
      for (const row of rows) pushCode(row);
    }
  } else {
    for (const row of rows) pushCode(row);
  }
  return codes;
};

/** Drop filter-only vars and any prior shift query; inject `shift=<id>` (sheet URL shape). */
const withShiftProperty = (config, shiftId) => {
  const properties = (config.properties || []).filter(
    (p) => !isShiftQueryParamName(p?.name) && !isCurrentShiftFilterName(p?.name),
  );
  properties.push({ name: 'shift', value: String(shiftId) });
  return { ...config, properties };
};

/** Never send `currentshift` as a TrustView query param — it only filters which Param rows to call. */
const withoutCurrentShiftFilter = (config) => ({
  ...config,
  properties: (config.properties || []).filter((p) => !isCurrentShiftFilterName(p?.name)),
});

const mapPool = async (items, limit, fn) => {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
};

/**
 * Same fetch shape as the Centre Stats sheet script:
 *   GET …/exceldownload?shift=<id>&type=centre&format=csv  + header token
 *
 * `currentshift` (Variables) is a filter only — never a query param:
 *   - blank or "bank" → every Param ES row (for type=centre) / every shift otherwise
 *   - a shift id → only Param rows whose shift_code matches
 * An explicit filled `shift` variable is a single download.
 */
const callApi = async (config, { examId = '' } = {}) => {
  const authed = await applyAuth(config);
  if (String(authed.method || 'GET').toUpperCase() === 'GET' && isTrustViewExcelDownload(authed.url)) {
    const reportType = propValueByNames(authed.properties, ['type']).toLowerCase();
    const usesEsRows = ES_REPORT_TYPES.has(reportType);
    const currentShiftFilter = propValueByNames(authed.properties, ['currentshift', 'current_shift']);
    const explicitShift = propValueByNames(authed.properties, ['shift', 'shiftid', 'shift_id', 'shift_code']);
    const base = withoutCurrentShiftFilter(authed);
    const preview = applyProperties(base, { appendQuery: true });

    // Manual `shift=…` already on the URL or in variables → one call.
    if (explicitShift || urlHasFilledShiftQuery(preview.url)) {
      const one = explicitShift ? withShiftProperty(base, explicitShift) : base;
      return callApiOnce(one);
    }

    const codesAll = await savedParamShiftCodes(examId, {
      rowKey: usesEsRows ? ES_PARAM_ROW_KEY : '',
    });
    let codes = codesAll;
    // Sheet Sync Pending ignores currentshift; Stats Center uses blank/bank = all.
    // Portal: blank/bank = all ES (or all shifts); a filled id still filters.
    if (!isCurrentShiftAll(currentShiftFilter)) {
      codes = codesAll.filter((code) => code === currentShiftFilter);
      if (!codes.length) {
        throw new AppError(
          `currentshift is "${currentShiftFilter}" but no${usesEsRows ? ' ES' : ''} Param row has that shift id. Nothing to fetch.`,
          502,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
    }
    if (!codes.length) {
      throw new AppError(
        usesEsRows
          ? 'No ES rows with a Shift code in Param for this exam. Add Param rows (Shift type ES) first, or set currentshift / shift.'
          : 'There is no shift on the request and no Shift code in Param for this exam. Add Param rows first, or fill shift.',
        502,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const settled = await mapPool(codes, 4, async (code) => {
      try {
        const part = await callApiOnce(withShiftProperty(base, code));
        const rows = Array.isArray(part.json) ? part.json : [];
        return { code, rows, empty: !rows.length };
      } catch (error) {
        // TrustView answers HTTP 200 "Invalid Request" for a shift id that has no report.
        if (/invalid request/i.test(String(error.message || ''))) return { code, rows: [], skipped: true };
        throw error;
      }
    });
    const skippedShifts = settled.filter((part) => part.skipped).map((part) => part.code);
    const emptyShifts = settled.filter((part) => part.empty).map((part) => part.code);
    const json = settled.flatMap((part) => part.rows);
    if (!json.length) {
      const tried = codes.join(', ');
      if (skippedShifts.length) {
        throw new AppError(
          `The API answered: Invalid Request for shift ${skippedShifts.join(', ')}.`,
          502,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
      throw new AppError(
        `No rows returned for shift ${tried || 'codes in Param'}${emptyShifts.length ? ' (empty CSV for each)' : ''}. Check token and type.`,
        502,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    return { status: 200, json, skippedShifts };
  }
  return callApiOnce(authed);
};
const pickItems = (json, dataPath) => {
  let node = json;
  if (dataPath) {
    for (const part of dataPath.split('.')) {
      node = node != null && typeof node === 'object' ? node[part] : undefined;
    }
  }
  if (!Array.isArray(node)) {
    throw validationError(
      dataPath ? `"${dataPath}" in the response is not a list` : 'The response is not a list. Set a data path such as data.items',
    );
  }
  return node.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
};

const toCell = (v) => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object')) return v.join(', ');
  return typeof v === 'object' ? JSON.stringify(v) : v;
};

/** Response objects → rows keyed by field key; headers match a field key or label, case-insensitively. */
const mapItems = (items, fields) => {
  const byHeader = new Map();
  fields.forEach((f) => {
    byHeader.set(String(f.key).toLowerCase(), f.key);
    byHeader.set(String(f.label).toLowerCase(), f.key);
  });
  const matched = new Set();
  const unmatched = new Set();
  const rows = items
    .map((item) => {
      const row = {};
      Object.entries(item).forEach(([k, v]) => {
        const key = byHeader.get(k.toLowerCase());
        if (key) {
          row[key] = toCell(v);
          matched.add(k);
        } else {
          unmatched.add(k);
        }
      });
      return row;
    })
    .filter((row) => Object.values(row).some((x) => String(x ?? '').trim() !== ''));
  return { rows, matched: [...matched], unmatched: [...unmatched].filter((k) => !matched.has(k)) };
};

const norm = (v) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v).trim());
/** Identity of a record across all device fields, used to recognise rows that are already stored. */
const signature = (fields, row) => JSON.stringify(fields.map((f) => norm(row[f.key])));

const resolveConfig = async (body, view = 'devices') => {
  const key = normalizeView(view);
  const stored = await loadStoredConfig(key);
  if (body && Object.keys(body).length) {
    const restored = cleanConfig(withRestored(body, stored));
    if (key === 'devices') return restored;
    const shared = await repo.getApiConfig();
    if (!shared) throw validationError('Set up the shared connection on Param first (gear → Login / token).');
    return mergeSharedConnection(shared, restored, key);
  }
  if (!stored) {
    throw validationError(
      key === 'devices'
        ? 'Set up the API request first'
        : 'Set up the shared connection on Param first (gear → Login / token).',
    );
  }
  return stored;
};

/** Dry run with the form's current values (saved or not); nothing is written. */
export const testApiConfig = async (body, view = 'devices', examId = '') => {
  const config = await resolveConfig(body, view);
  const { status, json, skippedShifts } = await callApi(config, { examId });
  const items = pickItems(json, config.dataPath);
  const fields = await getCustomFields();
  const { rows, matched, unmatched } = mapItems(items, fields);
  return {
    status,
    itemCount: items.length,
    importableRows: rows.length,
    responseKeys: [...new Set(items.slice(0, 50).flatMap((i) => Object.keys(i)))],
    matchedKeys: matched,
    unmatchedKeys: unmatched,
    sample: items.slice(0, SAMPLE_ROWS),
    skippedShifts: skippedShifts || [],
  };
};

/** Pull from the saved API and store the rows. "replace" only removes the old rows after the new ones are saved. */
const runSync = async (config, confirmReplace, examId, viewKey = 'devices') => {
  if (config.mode === 'replace' && !confirmReplace) {
    throw new AppError('Replacing removes every existing row. Confirm to continue.', 409, ERROR_CODES.CONFLICT);
  }
  const scopedExamId = String(examId || '').trim();
  if (!scopedExamId) throw validationError('examId is required');
  const key = normalizeView(viewKey);

  const fields = await getCustomFields();
  if (!fields.length) throw validationError('Add at least one Param field before fetching data (column mapping is shared).');

  const { json } = await callApi(config, { examId: scopedExamId });
  const items = pickItems(json, config.dataPath);
  const { rows } = mapItems(items, fields);
  if (!rows.length) throw validationError('No rows matched your device fields. Response keys must match a field label or key.');

  const operatorDownload = items.some((item) => Object.keys(item).some((k) => /inv id|enrollment count/i.test(k)));
  const filled = new Set();
  rows.forEach((row) => {
    Object.entries(row).forEach(([fieldKey, value]) => {
      if (String(value ?? '').trim()) filled.add(fieldKey);
    });
  });
  if (operatorDownload && [...filled].every((fieldKey) => fieldKey === 'shift')) {
    throw validationError(
      'The download is operator details (INV ID, Name, Phone, Center, Device). Those columns are not on this table, so nothing was saved. Test request can still show the rows.',
    );
  }

  const replace = config.mode === 'replace';
  const existing =
    key === 'devices'
      ? await deviceRepository.findByExamId(scopedExamId)
      : await listDeviceTabRows(key, scopedExamId);

  // A record whose unique-field value is already stored (or repeats earlier in the response) is skipped, not an error.
  const byUnique = dropUniqueConflicts(fields, rows, existing, { ignoreExisting: replace });
  let toImport = byUnique.rows;
  let skipped = byUnique.skipped;
  if (!replace) {
    const seen = new Set(existing.map((r) => signature(fields, r)));
    const before = toImport.length;
    toImport = toImport.filter((row) => {
      const sig = signature(fields, row);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    skipped += before - toImport.length;
  }

  if (key === 'devices') {
    const previousIds = replace ? existing.map((r) => r.id) : [];
    const { count } = toImport.length
      ? await importDevices(toImport, scopedExamId, { ignoreExisting: replace })
      : { count: 0 };
    const removed = previousIds.length ? await deviceRepository.deleteMany(previousIds) : 0;
    return {
      success: true,
      imported: count,
      skipped,
      removed: typeof removed === 'number' ? removed : previousIds.length,
      view: key,
    };
  }

  if (key === 'center-csr-matching') {
    throw validationError(
      'Center-CSR-Matching uses its own fields — import CSV on that page for now, or map fields after the table is wired for API fetch.',
    );
  }

  const { count, removed } = toImport.length
    ? await importDeviceTabRows(key, toImport, scopedExamId, { replace })
    : { count: 0, removed: 0 };
  return { success: true, imported: count, skipped, removed, view: key };
};

let syncing = false;

/** Runs one fetch and records its outcome (shown in the dialog, used to time the next scheduled run). */
export const syncFromApi = async (confirmReplace = false, trigger = 'manual', examId = '', view = 'devices') => {
  if (syncing) throw new AppError('A fetch is already running. Try again in a moment.', 409, ERROR_CODES.CONFLICT);
  syncing = true;
  const viewKey = normalizeView(view);
  const config = await resolveConfig(null, viewKey);
  const record = (status, message) =>
    repo.saveSyncState({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_message: message,
      last_trigger: trigger,
      next_run_at: nextRunFrom(config.schedule),
    });
  try {
    if (!String(examId || '').trim()) {
      if (trigger === 'schedule') {
        await record('skipped', 'Scheduled sync needs a bio exam; run Fetch from Device Master with an exam selected.');
        return { success: true, imported: 0, skipped: 0, removed: 0 };
      }
      throw validationError('examId is required');
    }
    const result = await runSync(config, confirmReplace, examId, viewKey);
    await record(
      'success',
      `Imported ${result.imported} row${result.imported === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped} already there` : ''}${result.removed ? `, removed ${result.removed} old` : ''}`,
    );
    return result;
  } catch (error) {
    await record('error', String(error.message || 'Fetch failed').slice(0, 300)).catch(() => {});
    throw error;
  } finally {
    syncing = false;
  }
};

/** Called by the scheduler tick: runs a fetch when the schedule is on and its time has come. */
export const runScheduledSyncIfDue = async () => {
  const config = await repo.getApiConfig();
  if (!config?.schedule?.enabled) return false;
  const state = await repo.getSyncState();
  const next = state?.next_run_at ? Date.parse(state.next_run_at) : NaN;
  if (Number.isNaN(next)) {
    await repo.saveSyncState({ next_run_at: nextRunFrom(config.schedule) });
    return false;
  }
  if (next > Date.now()) return false;
  try {
    await syncFromApi(true, 'schedule');
    logger.info('[devices] Scheduled fetch finished');
  } catch (error) {
    logger.warn(`[devices] Scheduled fetch failed: ${error.message}`);
  }
  return true;
};
