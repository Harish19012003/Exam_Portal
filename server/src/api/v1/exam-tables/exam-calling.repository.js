/**
 * Op/Guard Calling — dedicated Mongo collection `exam_calling_rows`.
 * Linked to Center list via center_row_id (+ date_id / slot / shift_id).
 */

import {
  CALLING_CENTER_ROW_ID_KEY,
  CALLING_DATE_ID_KEY,
  CALLING_HIDDEN_KEY,
  CALLING_SHIFT_ID_KEY,
  CALLING_SLOT_KEY,
  CALLING_SYSTEM_KEYS,
} from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { ExamCallingRow, ExamRow, User } from '../../../database/entities/index.js';
import { encodeCellValue, decodeCellValue } from '../exams/exam.repository.js';
import { hasActiveQuery, rowMatchesQuery } from './rowFilterMatch.js';
import { effectiveType } from './exam-table.repository.js';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

const normalizePage = (page) => Math.max(1, Number(page) || 1);
const normalizeLimit = (limit) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(n));
};

const userLabel = (first, last, email) =>
  [first, last].filter(Boolean).join(' ').trim() || email || '';

const loadUsers = async (em, ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await em.find(User, { _id: { $in: unique } });
  return new Map(users.map((u) => [String(u._id), u]));
};

const decodeValues = (raw, fields) => {
  const fieldByKey = new Map((fields || []).map((f) => [f.key, f]));
  const values = {};
  const keys = new Set([...(fields || []).map((f) => f.key), ...Object.keys(raw.values || {})]);
  keys.forEach((key) => {
    const field = fieldByKey.get(key);
    if (field) values[key] = decodeCellValue(raw.values?.[key], effectiveType(field));
    else if (Object.prototype.hasOwnProperty.call(raw.values || {}, key)) values[key] = raw.values[key];
  });
  // Mirror top-level link fields into values for API/client compatibility.
  if (raw.center_row_id != null && values[CALLING_CENTER_ROW_ID_KEY] == null) {
    values[CALLING_CENTER_ROW_ID_KEY] = raw.center_row_id;
  }
  if (raw.date_id != null && values[CALLING_DATE_ID_KEY] == null) {
    values[CALLING_DATE_ID_KEY] = raw.date_id;
  }
  if (raw.slot != null && values[CALLING_SLOT_KEY] == null) {
    values[CALLING_SLOT_KEY] = raw.slot;
  }
  if (raw.shift_id != null && values[CALLING_SHIFT_ID_KEY] == null) {
    values[CALLING_SHIFT_ID_KEY] = raw.shift_id;
  }
  if (values[CALLING_HIDDEN_KEY] == null) {
    values[CALLING_HIDDEN_KEY] = Boolean(raw.hidden);
  }
  return values;
};

const mapRow = (raw, fields, userMap) => {
  const created = userMap?.get(String(raw.sys_created_by || ''));
  const updated = userMap?.get(String(raw.sys_updated_by || ''));
  const createdLabel = created
    ? userLabel(created.first_name, created.last_name, created.email)
    : '';
  return {
    id: String(raw.id ?? raw._id),
    values: decodeValues(raw, fields),
    createdAt: raw.sys_created_at,
    updatedAt: raw.sys_updated_at,
    createdByLabel: createdLabel,
    updatedByLabel: updated
      ? userLabel(updated.first_name, updated.last_name, updated.email) || createdLabel
      : createdLabel,
    centerRowId: raw.center_row_id || null,
    dateId: raw.date_id || null,
    naturalKey: raw.natural_key || null,
    hidden: Boolean(raw.hidden),
  };
};

const encodeValues = (fields, values) => {
  const encoded = {};
  const source = values && typeof values === 'object' ? values : {};
  (fields || []).forEach((f) => {
    if (!(f.key in source)) return;
    encoded[f.key] = encodeCellValue(source[f.key], effectiveType(f));
  });
  CALLING_SYSTEM_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) encoded[key] = source[key];
  });
  // Persist any other keys already on the bag (labels, shared copies).
  Object.keys(source).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(encoded, key)) return;
    if ((fields || []).some((f) => f.key === key)) return;
    encoded[key] = source[key];
  });
  return encoded;
};

const linkFromValues = (values, naturalKey) => {
  const bag = values && typeof values === 'object' ? values : {};
  const slotRaw = bag[CALLING_SLOT_KEY];
  const slotNum = slotRaw == null || slotRaw === '' ? null : Number(slotRaw);
  return {
    center_row_id: String(bag[CALLING_CENTER_ROW_ID_KEY] || '').trim() || null,
    date_id: String(bag[CALLING_DATE_ID_KEY] || '').trim() || null,
    slot: Number.isFinite(slotNum) ? slotNum : null,
    shift_id: String(bag[CALLING_SHIFT_ID_KEY] || '').trim() || null,
    natural_key: String(naturalKey || '').trim(),
    hidden: Boolean(bag[CALLING_HIDDEN_KEY]),
  };
};

export const listRows = async (examId, fields, options = {}) => {
  const em = getEm();
  const eid = String(examId || '');
  if (!eid) {
    return { rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 0 };
  }

  const search = typeof options.search === 'string' ? options.search : '';
  const searchKeys = Array.isArray(options.searchKeys) ? options.searchKeys.map(String) : undefined;
  const filters =
    options.filters && typeof options.filters === 'object' && !Array.isArray(options.filters)
      ? options.filters
      : undefined;
  const query = { search, searchKeys, filters };
  const wantsQuery = hasActiveQuery(query);
  const fetchAll = Boolean(options.all);
  const excludeHidden = Boolean(options.excludeCallingHidden);

  const match = { exam_id: eid };
  if (excludeHidden) match.hidden = { $ne: true };

  if (wantsQuery || fetchAll) {
    const raw = await em.find(ExamCallingRow, match, { orderBy: { sys_created_at: 'DESC' } });
    const userMap = await loadUsers(
      em,
      raw.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
    );
    const mapped = raw.map((r) => mapRow(r, fields, userMap));
    const matched = wantsQuery
      ? mapped.filter((r) => rowMatchesQuery(r.values || {}, query))
      : mapped;
    const total = matched.length;
    if (fetchAll) {
      return { rows: matched, total, page: 1, limit: total, totalPages: 1 };
    }
    const page = normalizePage(options.page);
    const limit = normalizeLimit(options.limit);
    const offset = (page - 1) * limit;
    return {
      rows: matched.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  const total = await em.count(ExamCallingRow, match);
  const page = normalizePage(options.page);
  const limit = normalizeLimit(options.limit);
  const rows = await em.find(ExamCallingRow, match, {
    orderBy: { sys_created_at: 'DESC' },
    limit,
    offset: (page - 1) * limit,
  });
  const userMap = await loadUsers(
    em,
    rows.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
  );
  return {
    rows: rows.map((r) => mapRow(r, fields, userMap)),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit) || 1),
  };
};

export const findRow = async (examId, fields, rowId) => {
  const em = getEm();
  const row = await em.findOne(ExamCallingRow, {
    exam_id: String(examId),
    id: String(rowId),
  });
  if (!row) return null;
  const userMap = await loadUsers(em, [row.sys_created_by, row.sys_updated_by]);
  return mapRow(row, fields, userMap);
};

export const findRowsByIds = async (examId, fields, rowIds) => {
  const em = getEm();
  const ids = (rowIds || []).map(String);
  if (!ids.length) return [];
  const rows = await em.find(ExamCallingRow, {
    exam_id: String(examId),
    id: { $in: ids },
  });
  const userMap = await loadUsers(
    em,
    rows.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
  );
  return rows.map((r) => mapRow(r, fields, userMap));
};

/** Lite sync load — id + values / link fields, no user joins. */
export const listAllLite = async (examId, fields) => {
  const em = getEm();
  const raw = await em.find(
    ExamCallingRow,
    { exam_id: String(examId) },
    { orderBy: { sys_created_at: 'DESC' } },
  );
  return raw.map((r) => mapRow(r, fields, null));
};

export const insertRow = async (examId, fields, values, userId, { naturalKey } = {}) => {
  const em = getEm();
  const encoded = encodeValues(fields, values);
  const link = linkFromValues(values, naturalKey || encoded.natural_key);
  if (!link.natural_key) {
    throw new Error('Calling row requires a natural_key');
  }
  const entity = em.create(ExamCallingRow, {
    exam_id: String(examId),
    ...link,
    values: encoded,
    sys_created_by: userId || null,
    sys_updated_by: userId || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

export const insertRowsChunked = async (
  examId,
  fields,
  items,
  userId,
  { chunkSize = 1000 } = {},
) => {
  const em = getEm();
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 0;
  const size = Math.max(50, Math.min(2000, Number(chunkSize) || 1000));
  let total = 0;
  for (let i = 0; i < list.length; i += size) {
    const slice = list.slice(i, i + size);
    const entities = slice.map((item) => {
      const values = item?.values || item;
      const naturalKey = item?.naturalKey || item?.key;
      const encoded = encodeValues(fields, values);
      const link = linkFromValues(values, naturalKey);
      return em.create(ExamCallingRow, {
        exam_id: String(examId),
        ...link,
        values: encoded,
        sys_created_by: userId || null,
        sys_updated_by: userId || null,
      });
    });
    entities.forEach((e) => em.persist(e));
    await em.flush();
    em.clear();
    total += entities.length;
  }
  return total;
};

export const updateRow = async (examId, fields, rowId, values, userId, { naturalKey } = {}) => {
  const em = getEm();
  const row = await em.findOne(ExamCallingRow, {
    exam_id: String(examId),
    id: String(rowId),
  });
  if (!row) return false;
  const encoded = encodeValues(fields, values);
  const link = linkFromValues(values, naturalKey || row.natural_key);
  em.assign(row, {
    ...link,
    natural_key: link.natural_key || row.natural_key,
    values: encoded,
    sys_updated_by: userId || null,
    sys_updated_at: new Date(),
  });
  await em.flush();
  return true;
};

export const updateRowsIndividual = async (
  examId,
  fields,
  patches,
  userId,
  { chunkSize = 500 } = {},
) => {
  const em = getEm();
  const list = Array.isArray(patches) ? patches.filter((p) => p?.id) : [];
  if (!list.length) return 0;
  const size = Math.max(50, Math.min(2000, Number(chunkSize) || 500));
  let touched = 0;
  const now = new Date();
  for (let i = 0; i < list.length; i += size) {
    const slice = list.slice(i, i + size);
    const ids = slice.map((p) => String(p.id));
    const rows = await em.find(ExamCallingRow, {
      exam_id: String(examId),
      id: { $in: ids },
    });
    const byId = new Map(rows.map((r) => [String(r.id ?? r._id), r]));
    slice.forEach((patch) => {
      const row = byId.get(String(patch.id));
      if (!row) return;
      const encoded = encodeValues(fields, patch.values);
      const link = linkFromValues(patch.values, patch.naturalKey || row.natural_key);
      em.assign(row, {
        ...link,
        natural_key: link.natural_key || row.natural_key,
        values: encoded,
        sys_updated_by: userId || null,
        sys_updated_at: now,
      });
      touched += 1;
    });
    await em.flush();
    em.clear();
  }
  return touched;
};

export const deleteRows = async (examId, rowIds) => {
  const em = getEm();
  const ids = (rowIds || []).map(String).filter(Boolean);
  if (!ids.length) return 0;
  return em.nativeDelete(ExamCallingRow, {
    exam_id: String(examId),
    id: { $in: ids },
  });
};

export const deleteAllForExam = async (examId) => {
  const em = getEm();
  return em.nativeDelete(ExamCallingRow, { exam_id: String(examId) });
};

/**
 * Remove leftover Calling docs from exam_rows (row_view was used before exam_calling_rows).
 * Copies any missing rows into exam_calling_rows, then deletes all exam_rows with that row_view.
 */
export const migrateLegacyFromExamRows = async (examId, fields, userId) => {
  const em = getEm();
  const eid = String(examId);
  const legacyView = 'operator-guard-calling';
  const legacy = await em.find(ExamRow, {
    exam_id: eid,
    row_view: legacyView,
  });
  if (!legacy.length) return { migrated: 0, deleted: 0 };

  const existing = await em.find(ExamCallingRow, { exam_id: eid });
  const have = new Set(existing.map((r) => String(r.natural_key || '')));

  const toInsert = [];
  legacy.forEach((row, index) => {
    const values = decodeValues(row, fields);
    const naturalKey =
      [
        values[CALLING_CENTER_ROW_ID_KEY] || '',
        values[CALLING_DATE_ID_KEY] || '',
        values[CALLING_SHIFT_ID_KEY] || '',
        values[CALLING_SLOT_KEY] ?? '',
      ].join('::') || `legacy::${String(row.id ?? row._id)}::${index}`;
    if (have.has(naturalKey)) return;
    have.add(naturalKey);
    toInsert.push({ values, naturalKey });
  });

  let migrated = 0;
  if (toInsert.length) {
    migrated = await insertRowsChunked(eid, fields, toInsert, userId);
  }
  // Always wipe exam_rows.row_view = operator-guard-calling for this exam.
  const deleted = await em.nativeDelete(ExamRow, {
    exam_id: eid,
    row_view: legacyView,
  });
  return { migrated, deleted };
};

/** Delete every exam_rows doc still tagged row_view=operator-guard-calling (all exams). */
export const purgeLegacyCallingRowView = async () => {
  const em = getEm();
  return em.nativeDelete(ExamRow, { row_view: 'operator-guard-calling' });
};
