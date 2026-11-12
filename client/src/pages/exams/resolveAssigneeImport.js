import { listAssignableUsers } from './assigneeApi';
import { seedAssigneeLabels } from '../../components/DynamicTable/editors/assigneeLabels';
import { isUserTagsField } from './tableLookupApi';

const norm = (v) => String(v ?? '').trim().toLowerCase();

const looksLikeUserId = (value) => {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  return false;
};

/**
 * Compact codes like AAD5005 — not an email, not a spaced name, has a digit.
 * These must match `user_code` only; never fall back to name.
 */
const looksLikeUserCode = (value) => {
  const s = String(value || '').trim();
  if (!s || /\s/.test(s) || s.includes('@')) return false;
  if (looksLikeUserId(s)) return false;
  return /[0-9]/.test(s) && /^[A-Za-z0-9._-]+$/.test(s);
};

/**
 * Tokens from paste/CSV: raw id, email, user_code, name, or "Name · CODE" chip text.
 * Returns { code?, name?, raw } so chip text can try code first, then name.
 */
export const parseAssigneeImportParts = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return { raw: '' };
  if (s.includes('·')) {
    const parts = s.split('·').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { raw: s, name: parts.slice(0, -1).join(' · '), code: parts[parts.length - 1] };
    }
  }
  return { raw: s };
};

/** @deprecated use parseAssigneeImportParts — kept for callers that want a single string */
export const parseAssigneeImportToken = (raw) => {
  const p = parseAssigneeImportParts(raw);
  return p.code || p.raw || '';
};

const partsListOf = (value) => {
  if (Array.isArray(value)) {
    return value.map(parseAssigneeImportParts).filter((p) => p.raw || p.code || p.name);
  }
  if (value == null || value === '') return [];
  if (typeof value === 'string' && /[,;|]/.test(value) && !value.includes('·')) {
    return value
      .split(/[,;|]/)
      .map(parseAssigneeImportParts)
      .filter((p) => p.raw || p.code || p.name);
  }
  const one = parseAssigneeImportParts(value);
  return one.raw || one.code || one.name ? [one] : [];
};

/**
 * Index assignable people. Users with a user_code are keyed for code-only import.
 * Name / email still work for people (and pastes) the old way.
 */
const buildAssigneeIndex = (people) => {
  const byCode = new Map();
  const byEmail = new Map();
  const byId = new Map();
  const byName = new Map();
  (people || []).forEach((p) => {
    if (!p?.id) return;
    byId.set(String(p.id), p);
    const code = norm(p.user_code);
    if (code && !byCode.has(code)) byCode.set(code, p);
    const email = norm(p.email);
    if (email && !byEmail.has(email)) byEmail.set(email, p);
    const name = norm(p.name);
    if (name && !byName.has(name)) byName.set(name, p);
  });
  return { byCode, byEmail, byId, byName };
};

/**
 * Resolve one paste token.
 * - user_code match → always OK
 * - code-shaped token with no user_code hit → skip (do not name-match / do not update)
 * - otherwise email → id → name (previous behaviour)
 */
const resolveParts = (parts, index) => {
  const tryCode = (code) => {
    if (!code) return null;
    return index.byCode.get(norm(code)) || null;
  };
  const tryNameEmailId = (token) => {
    const t = String(token || '').trim();
    if (!t) return null;
    if (looksLikeUserId(t) && index.byId.has(t)) return index.byId.get(t);
    const key = norm(t);
    return index.byEmail.get(key) || index.byName.get(key) || null;
  };

  // Chip "Name · CODE" — code first; if that user has no/wrong code, fall back to name.
  if (parts.code) {
    const byCode = tryCode(parts.code);
    if (byCode) return { person: byCode, via: 'code' };
    if (parts.name) {
      const byName = tryNameEmailId(parts.name);
      if (byName) return { person: byName, via: 'name' };
    }
    // Code present but unmatched — do not invent a match.
    return { person: null, via: 'code', skipped: true, token: parts.code };
  }

  const raw = parts.raw || '';
  // Bare user code (AAD5005): only match users who actually have that code.
  if (looksLikeUserCode(raw) || index.byCode.has(norm(raw))) {
    const byCode = tryCode(raw);
    if (byCode) return { person: byCode, via: 'code' };
    return { person: null, via: 'code', skipped: true, token: raw };
  }

  // Name / email / id — same as before.
  const hit = tryNameEmailId(raw);
  if (hit) return { person: hit, via: 'name' };
  return { person: null, via: 'name', skipped: true, token: raw };
};

/**
 * Replace pasted assignee cells with user ids before save.
 * Unmatched **user codes** skip that field (existing value kept on Update).
 * Names / emails still resolve as before.
 */
export const resolveAssigneeFieldsForImport = async (rows, fields) => {
  const assigneeFields = (fields || []).filter(isUserTagsField);
  if (!assigneeFields.length || !rows?.length) {
    return { rows: rows || [], failures: [], skipped: [] };
  }

  const tagIds = [
    ...new Set(assigneeFields.flatMap((f) => (f.userTagIds || []).map(String)).filter(Boolean)),
  ];
  const people = tagIds.length ? await listAssignableUsers(tagIds) : [];
  seedAssigneeLabels(people);
  const index = buildAssigneeIndex(people);

  const failures = [];
  const skipped = [];
  const nextRows = rows.map((row, rowIndex) => {
    const next = { ...row };
    assigneeFields.forEach((f) => {
      if (!(f.key in next)) return;
      const multi = f.dataType === 'multiselect' || Boolean(f.allowMultiple);
      const partsList = partsListOf(next[f.key]);
      if (!partsList.length) {
        // Explicit empty paste — clear.
        next[f.key] = multi ? [] : '';
        return;
      }

      const ids = [];
      let anySkip = false;
      partsList.forEach((parts) => {
        const result = resolveParts(parts, index);
        if (result.person?.id) {
          const id = String(result.person.id);
          if (!ids.includes(id)) ids.push(id);
          return;
        }
        anySkip = true;
        const token = result.token || parts.code || parts.raw || '';
        if (result.via === 'code') {
          skipped.push(
            `row ${rowIndex + 1} · ${f.label || f.key}: user code “${token}” not found — left unchanged`,
          );
        } else {
          failures.push(
            `row ${rowIndex + 1} · ${f.label || f.key}: no user matched “${token}”`,
          );
        }
      });

      if (ids.length) {
        next[f.key] = multi ? ids : ids[0];
      } else if (anySkip) {
        // Nothing resolved — omit field so Update keeps the previous assignee.
        delete next[f.key];
      } else {
        next[f.key] = multi ? [] : '';
      }
    });
    return next;
  });

  return { rows: nextRows, failures, skipped };
};
