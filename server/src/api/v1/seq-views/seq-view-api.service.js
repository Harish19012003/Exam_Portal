import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { getCustomFields } from './seq-view-fields.service.js';
import * as repo from './seq-view-fields.repository.js';
import { logger } from '../../../core/logger.js';
import { isValidTimeZone, nextRunAt } from './seq-view-schedule.js';
import { dropUniqueConflicts } from '../shared/unique-fields.js';
import { seqViewRepository } from './seq-view.repository.js';
import { importSeqViews } from './seq-view.service.js';

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

const allowPrivate = () => String(process.env.SEQ_VIEW_API_ALLOW_PRIVATE || '').toLowerCase() === 'true';

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
    schedule: cleanSchedule(input.schedule),
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
      }
    : null;

const withRestored = (body, stored) => ({
  ...body,
  headers: restoreMasked(cleanHeaders(body.headers), stored, 'headers'),
  properties: restoreMasked(cleanProperties(body.properties), stored, 'properties'),
});

const withState = async (config) => (config ? { ...mask(config), status: await repo.getSyncState() } : null);

export const getApiConfig = async () => withState(await repo.getApiConfig());

const nextRunFrom = (schedule, from = Date.now()) => nextRunAt(schedule, from);

export const saveApiConfig = async (body = {}, userId) => {
  const stored = await repo.getApiConfig();
  const config = cleanConfig(withRestored(body, stored));
  await repo.saveApiConfig(config, userId);
  const changed = JSON.stringify(stored?.schedule ?? null) !== JSON.stringify(config.schedule);
  if (changed) await repo.saveSyncState({ next_run_at: nextRunFrom(config.schedule) });
  return withState(config);
};

/** `{{NAME}}` in the URL, header values and body is replaced by the script property of that name. */
const applyProperties = (config) => {
  const props = new Map((config.properties || []).map((p) => [p.name, p.value]));
  const fill = (text, encode = (v) => v) =>
    String(text).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name) => {
      if (!props.has(name)) throw validationError(`Script property "${name}" is used but not defined`);
      return encode(props.get(name));
    });
  return {
    ...config,
    url: fill(decodeURI(config.url), encodeURIComponent),
    headers: config.headers.map((h) => ({ ...h, value: fill(h.value) })),
    body: fill(config.body),
  };
};

const request = (rawConfig) =>
  new Promise((resolve, reject) => {
    const config = applyProperties(rawConfig);
    const url = new URL(config.url);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = config.method === 'POST' && config.body.trim() ? config.body : null;
    const headers = { Accept: 'application/json', ...Object.fromEntries(config.headers.map((h) => [h.name, h.value])) };
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

const callApi = async (config) => {
  let res;
  try {
    res = await request(config);
  } catch (error) {
    throw new AppError(`API request failed: ${error.message}`, 502, ERROR_CODES.VALIDATION_ERROR);
  }
  if (res.status < 200 || res.status >= 300) {
    // Redirects are not followed on purpose: the target could point at an internal address.
    throw new AppError(`The API answered with HTTP ${res.status}`, 502, ERROR_CODES.VALIDATION_ERROR);
  }
  let json;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new AppError('The API response is not valid JSON', 502, ERROR_CODES.VALIDATION_ERROR);
  }
  return { status: res.status, json };
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
/** Identity of a record across all SeqView fields, used to recognise rows that are already stored. */
const signature = (fields, row) => JSON.stringify(fields.map((f) => norm(row[f.key])));

const resolveConfig = async (body) => {
  const stored = await repo.getApiConfig();
  if (body && Object.keys(body).length) {
    return cleanConfig(withRestored(body, stored));
  }
  if (!stored) throw validationError('Set up the API request first');
  return stored;
};

/** Dry run with the form's current values (saved or not); nothing is written. */
export const testApiConfig = async (body) => {
  const config = await resolveConfig(body);
  const { status, json } = await callApi(config);
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
  };
};

/** Pull from the saved API and store the rows. "replace" only removes the old rows after the new ones are saved. */
const runSync = async (config, confirmReplace) => {
  if (config.mode === 'replace' && !confirmReplace) {
    throw new AppError('Replacing removes every existing row. Confirm to continue.', 409, ERROR_CODES.CONFLICT);
  }
  const fields = await getCustomFields();
  if (!fields.length) throw validationError('Add at least one SeqView field before fetching data');

  const { json } = await callApi(config);
  const { rows } = mapItems(pickItems(json, config.dataPath), fields);
  if (!rows.length) throw validationError('No rows matched your SeqView fields. Response keys must match a field label or key.');

  const existing = await seqViewRepository.findAll();
  const replace = config.mode === 'replace';

  // A record whose unique-field value is already stored (or repeats earlier in the response) is skipped, not an error.
  const byUnique = dropUniqueConflicts(fields, rows, existing, { ignoreExisting: replace });
  let toImport = byUnique.rows;
  let skipped = byUnique.skipped;
  if (!replace) {
    // Appending also skips records already in SeqView (and repeats within this response), so repeated or scheduled runs don't pile up copies.
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

  const previousIds = replace ? existing.map((r) => r.id) : [];
  const { count } = toImport.length ? await importSeqViews(toImport, { ignoreExisting: replace }) : { count: 0 };
  const removed = previousIds.length ? await seqViewRepository.deleteMany(previousIds) : 0;
  return { success: true, imported: count, skipped, removed: typeof removed === 'number' ? removed : previousIds.length };
};

let syncing = false;

/** Runs one fetch and records its outcome (shown in the dialog, used to time the next scheduled run). */
export const syncFromApi = async (confirmReplace = false, trigger = 'manual') => {
  if (syncing) throw new AppError('A fetch is already running. Try again in a moment.', 409, ERROR_CODES.CONFLICT);
  syncing = true;
  const config = await resolveConfig();
  const record = (status, message) =>
    repo.saveSyncState({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_message: message,
      last_trigger: trigger,
      next_run_at: nextRunFrom(config.schedule),
    });
  try {
    const result = await runSync(config, confirmReplace);
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
    logger.info('[seq-view] Scheduled fetch finished');
  } catch (error) {
    logger.warn(`[seq-view] Scheduled fetch failed: ${error.message}`);
  }
  return true;
};
