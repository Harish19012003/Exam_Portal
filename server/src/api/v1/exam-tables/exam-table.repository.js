import {
  CALLING_HIDDEN_KEY,
  CALLING_SYSTEM_KEYS,
  DEFAULT_EXAM_VIEW,
  EXAM_DAY_META_KEY,
  EXAM_DAY_VIEW,
} from '@exam-view/shared';
import { getEm } from '../../../database/connection.js';
import { Exam, ExamTable, ExamRow, User } from '../../../database/entities/index.js';
import { encodeCellValue, decodeCellValue } from '../exams/exam.repository.js';
import {
  buildValuesMongoMatch,
  combineMongoMatch,
  hasActiveQuery,
  rowMatchesQuery,
} from './rowFilterMatch.js';

export const SYSTEM_COLUMNS = ['id', 'sys_created_by', 'sys_updated_by', 'sys_created_at', 'sys_updated_at'];

/**
 * Excluded from the shared Center spreadsheet:
 * - legacy `exam-day` snapshots
 * Calling lives in `exam_calling_rows` (never `exam_rows.row_view`).
 */
const NON_SHARED_ROW_VIEWS = [EXAM_DAY_VIEW];

/**
 * Mongo filter for shared Center-list rows (and Unique-import / Exam Day live source).
 */
export const rowViewMatch = (view = DEFAULT_EXAM_VIEW) => {
  void view;
  return { row_view: { $nin: NON_SHARED_ROW_VIEWS } };
};

/** Calling no longer persists into exam_rows. */
export const persistRowView = (_view = DEFAULT_EXAM_VIEW) => null;

export const isSafeColumnName = (name) => /^[a-z][a-z0-9_]{0,39}$/.test(String(name || ''));
export const isReservedKey = (key) => key === 'id' || String(key).startsWith('sys_');

/** Merge legacy root fields into view_configs so older exams keep working. */
export const readViewConfigs = (table) => {
  const configs =
    table?.view_configs && typeof table.view_configs === 'object' && !Array.isArray(table.view_configs)
      ? { ...table.view_configs }
      : {};
  if (!configs[DEFAULT_EXAM_VIEW]) {
    configs[DEFAULT_EXAM_VIEW] = {
      fields: Array.isArray(table?.fields) ? table.fields : [],
      features: table?.features ?? null,
    };
  }
  return configs;
};

const normalizeFieldList = (fields) =>
  (Array.isArray(fields) ? fields : []).map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType || 'text',
    order: def.order ?? i + 1,
  }));

export const effectiveType = (def) => {
  // User-tag assignees follow the field type only (ignore stale allowMultiple).
  if (def?.optionsSource === 'userTags') {
    return def.dataType === 'multiselect' || def.dataType === 'tags' ? 'multiselect' : 'text';
  }
  return (def?.dataType === 'dropdown' || def?.dataType === 'status') && def?.allowMultiple
    ? 'multiselect'
    : def?.dataType || 'text';
};

/** @deprecated no SQL column types */
export const columnSqlType = () => 'json';

/** @deprecated physical tables removed — kept for any leftover imports */
export const physicalTableName = (tableId) => `exam_rows:${tableId}`;

export const ensureMetaTables = async () => {};

export const examExists = async (examId) => {
  const em = getEm();
  const exam = await em.findOne(Exam, { _id: String(examId) });
  return Boolean(exam);
};

export const findTableByExamId = async (examId) => {
  const em = getEm();
  const row = await em.findOne(ExamTable, { exam_id: String(examId) });
  if (!row) return null;
  return {
    id: String(row.id ?? row._id),
    examId: row.exam_id,
    tableName: null,
    features: row.features ?? null,
    viewConfigs: readViewConfigs(row),
    createdAt: row.created_at,
  };
};

export const createTable = async (examId, userId) => {
  const em = getEm();
  const entity = em.create(ExamTable, {
    exam_id: String(examId),
    fields: [],
    features: null,
    view_configs: {
      [DEFAULT_EXAM_VIEW]: { fields: [], features: null },
    },
    created_by: userId || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

export const dropTable = async (tableId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) {
    // try by ObjectId string via serialized id already covered; also try _id
    const byPk = await em.findOne(ExamTable, { _id: tableId });
    if (!byPk) return;
    await em.nativeDelete(ExamRow, { exam_id: byPk.exam_id });
    await em.remove(byPk).flush();
    return;
  }
  await em.nativeDelete(ExamRow, { exam_id: table.exam_id });
  await em.remove(table).flush();
};

export const dropTableForExam = async (examId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { exam_id: String(examId) });
  if (table) {
    await em.nativeDelete(ExamRow, { exam_id: String(examId) });
    await em.remove(table).flush();
  } else {
    await em.nativeDelete(ExamRow, { exam_id: String(examId) });
  }
};

export const listFields = async (tableId, view = DEFAULT_EXAM_VIEW) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return [];
  const configs = readViewConfigs(table);
  return normalizeFieldList(configs[view]?.fields);
};

/** Union of field defs across every tab (first occurrence wins for type decode). */
export const listAllFields = async (tableId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return [];
  const configs = readViewConfigs(table);
  const byKey = new Map();
  Object.values(configs).forEach((cfg) => {
    normalizeFieldList(cfg?.fields).forEach((f) => {
      if (!byKey.has(f.key)) byKey.set(f.key, f);
    });
  });
  return [...byKey.values()];
};

/** Field keys used by any tab other than `view`. */
export const keysUsedOutsideView = async (tableId, view) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return new Set();
  const configs = readViewConfigs(table);
  const keys = new Set();
  Object.entries(configs).forEach(([key, cfg]) => {
    if (key === view) return;
    normalizeFieldList(cfg?.fields).forEach((f) => keys.add(f.key));
  });
  return keys;
};

export const applyFields = async (tableId, fields, view = DEFAULT_EXAM_VIEW) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) throw new Error('Exam table not found');
  const normalized = (fields || []).map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType,
    order: i + 1,
  }));
  const configs = readViewConfigs(table);
  const prev = configs[view] || { fields: [], features: null };
  configs[view] = { ...prev, fields: normalized };
  const patch = { view_configs: configs, updated_at: new Date() };
  // Keep legacy root columns in sync for center-list.
  if (view === DEFAULT_EXAM_VIEW) patch.fields = normalized;
  em.assign(table, patch);
  await em.flush();
};

export const saveFeatures = async (tableId, features, view = DEFAULT_EXAM_VIEW) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return;
  const configs = readViewConfigs(table);
  const prev = configs[view] || { fields: [], features: null };
  configs[view] = { ...prev, features };
  const patch = { view_configs: configs, updated_at: new Date() };
  if (view === DEFAULT_EXAM_VIEW) patch.features = features;
  em.assign(table, patch);
  await em.flush();
};

/** Drop stored cell values for keys that are no longer used by any tab. */
export const stripUnusedKeysFromRows = async (examId, keys) => {
  const drop = (keys || []).map(String).filter(Boolean);
  if (!drop.length) return 0;
  const em = getEm();
  const rows = await em.find(ExamRow, { exam_id: String(examId) });
  let touched = 0;
  rows.forEach((row) => {
    const values = { ...(row.values || {}) };
    let changed = false;
    drop.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        delete values[key];
        changed = true;
      }
    });
    if (changed) {
      em.assign(row, { values, sys_updated_at: new Date() });
      touched += 1;
    }
  });
  if (touched) await em.flush();
  return touched;
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

const userLabel = (first, last, email) =>
  [first, last].filter(Boolean).join(' ').trim() || email || '';

const loadUsers = async (em, ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await em.find(User, { _id: { $in: unique } });
  return new Map(users.map((u) => [String(u._id), u]));
};

const decodeRowValues = (raw, fields) => {
  const fieldByKey = new Map((fields || []).map((f) => [f.key, f]));
  const values = {};
  // Decode every known field; also keep any extra stored keys so other tabs' data stays available.
  const keys = new Set([...(fields || []).map((f) => f.key), ...Object.keys(raw.values || {})]);
  keys.forEach((key) => {
    const field = fieldByKey.get(key);
    if (field) values[key] = decodeCellValue(raw.values?.[key], effectiveType(field));
    else if (Object.prototype.hasOwnProperty.call(raw.values || {}, key)) values[key] = raw.values[key];
  });
  return values;
};

const mapRow = (raw, fields, userMap) => {
  const created = userMap.get(String(raw.sys_created_by || ''));
  const updated = userMap.get(String(raw.sys_updated_by || ''));
  const createdLabel = created
    ? userLabel(created.first_name, created.last_name, created.email)
    : '';
  return {
    id: String(raw.id ?? raw._id),
    values: decodeRowValues(raw, fields),
    createdAt: raw.sys_created_at,
    updatedAt: raw.sys_updated_at,
    createdByLabel: createdLabel,
    updatedByLabel: updated
      ? userLabel(updated.first_name, updated.last_name, updated.email) || createdLabel
      : createdLabel,
  };
};

/**
 * Lightweight id + decoded values for server-side filter matching (no user joins).
 */
export const listRowValues = async (tableId, fields, options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const view = options.view || DEFAULT_EXAM_VIEW;
  const rows = await em.find(
    ExamRow,
    { exam_id: examId, ...rowViewMatch(view) },
    { orderBy: { sys_created_at: 'DESC' } },
  );
  return rows.map((r) => ({
    id: String(r.id ?? r._id),
    values: decodeRowValues(r, fields),
  }));
};

const resolveExamId = async (tableId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  return table?.exam_id || null;
};

const normalizePage = (page) => Math.max(1, Number.parseInt(page, 10) || 1);
const normalizeLimit = (limit) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

/**
 * Paginated center rows for one exam.
 * Pass `{ all: true }` for Unique import (and similar) — every center, no page-size cap.
 * Optional `search` / `searchKeys` / `filters` match across the full exam set, then page
 * (or return every match when `all: true`).
 */
export const listRows = async (tableId, fields, options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) {
    return { rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 0 };
  }

  const view = options.view || DEFAULT_EXAM_VIEW;
  const viewFilter = rowViewMatch(view);
  const search = typeof options.search === 'string' ? options.search : '';
  const searchKeys = Array.isArray(options.searchKeys) ? options.searchKeys.map(String) : undefined;
  const filters =
    options.filters && typeof options.filters === 'object' && !Array.isArray(options.filters)
      ? options.filters
      : undefined;
  const query = { search, searchKeys, filters };
  const wantsQuery = hasActiveQuery(query);
  const fetchAll = Boolean(options.all);
  const match = { exam_id: examId, ...viewFilter };
  // Op/Guard Calling: soft-hidden slots/shifts stay out of the default grid (Mongo-side).
  if (options.excludeCallingHidden) {
    match.$and = [
      ...(Array.isArray(match.$and) ? match.$and : []),
      {
        $or: [
          { 'values.calling_hidden': { $exists: false } },
          { 'values.calling_hidden': false },
          { 'values.calling_hidden': { $ne: true } },
        ],
      },
    ];
  }

  // Prefer Mongo-side filter + page (header filters / search) — avoid hydrating the full exam.
  if (wantsQuery) {
    const mongoExtra = buildValuesMongoMatch(query);
    if (mongoExtra != null) {
      const fullMatch = combineMongoMatch(match, mongoExtra);
      if (fetchAll) {
        const raw = await em.find(ExamRow, fullMatch, { orderBy: { sys_created_at: 'DESC' } });
        const userMap = await loadUsers(
          em,
          raw.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
        );
        const rows = raw.map((r) => mapRow(r, fields, userMap));
        return { rows, total: rows.length, page: 1, limit: rows.length, totalPages: 1 };
      }
      const total = await em.count(ExamRow, fullMatch);
      const page = normalizePage(options.page);
      const limit = normalizeLimit(options.limit);
      const raw = await em.find(ExamRow, fullMatch, {
        orderBy: { sys_created_at: 'DESC' },
        limit,
        offset: (page - 1) * limit,
      });
      const userMap = await loadUsers(
        em,
        raw.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
      );
      return {
        rows: raw.map((r) => mapRow(r, fields, userMap)),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1),
      };
    }
  }

  // Fallback / Unique import `all`: scan in memory; only join users for returned rows.
  if (wantsQuery || fetchAll) {
    const raw = await em.find(ExamRow, match, { orderBy: { sys_created_at: 'DESC' } });
    const matched = wantsQuery
      ? raw.filter((r) => {
          const values = decodeRowValues(r, fields);
          if (options.excludeCallingHidden && values?.[CALLING_HIDDEN_KEY] === true) return false;
          return rowMatchesQuery(values || {}, query);
        })
      : raw;
    const total = matched.length;
    if (fetchAll) {
      const userMap = await loadUsers(
        em,
        matched.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
      );
      const rows = matched.map((r) => mapRow(r, fields, userMap));
      return { rows, total, page: 1, limit: total, totalPages: 1 };
    }
    const page = normalizePage(options.page);
    const limit = normalizeLimit(options.limit);
    const offset = (page - 1) * limit;
    const pageRaw = matched.slice(offset, offset + limit);
    const userMap = await loadUsers(
      em,
      pageRaw.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
    );
    return {
      rows: pageRaw.map((r) => mapRow(r, fields, userMap)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  const total = await em.count(ExamRow, match);
  const page = normalizePage(options.page);
  const limit = normalizeLimit(options.limit);
  const rows = await em.find(
    ExamRow,
    match,
    {
      orderBy: { sys_created_at: 'DESC' },
      limit,
      offset: (page - 1) * limit,
    },
  );
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

/** Lightweight center_code scan for uniqueness (no full row decode). */
export const listCenterCodes = async (tableId, fieldKey = 'center_code', options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const key = String(fieldKey || 'center_code');
  const view = options.view || DEFAULT_EXAM_VIEW;
  const docs = await em.aggregate(ExamRow, [
    { $match: { exam_id: examId, ...rowViewMatch(view) } },
    { $project: { id: 1, code: `$values.${key}` } },
  ]);
  return (docs || []).map((d) => ({
    id: String(d.id ?? d._id),
    code: d.code,
  }));
};

/** Exam Day uniqueness scan: center_code + exam_date pairs. */
export const listCenterDatePairs = async (
  tableId,
  { centerKey = 'center_code', dateKey = 'exam_date', view = EXAM_DAY_VIEW } = {},
) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const docs = await em.aggregate(ExamRow, [
    { $match: { exam_id: examId, ...rowViewMatch(view) } },
    {
      $project: {
        id: 1,
        code: `$values.${centerKey}`,
        examDate: `$values.${dateKey}`,
      },
    },
  ]);
  return (docs || []).map((d) => ({
    id: String(d.id ?? d._id),
    code: d.code,
    examDate: d.examDate,
  }));
};

export const findRow = async (tableId, fields, rowId) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return null;
  const row = await em.findOne(ExamRow, { id: String(rowId), exam_id: examId });
  if (!row) return null;
  const userMap = await loadUsers(em, [row.sys_created_by, row.sys_updated_by]);
  return mapRow(row, fields, userMap);
};

export const findRowsByIds = async (tableId, fields, rowIds) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const ids = (rowIds || []).map(String);
  const rows = await em.find(ExamRow, { exam_id: examId, id: { $in: ids } });
  const userMap = await loadUsers(em, rows.flatMap((r) => [r.sys_created_by, r.sys_updated_by]));
  return rows.map((r) => mapRow(r, fields, userMap));
};

const mergeSystemValues = (encoded, values) => {
  if (!values || typeof values !== 'object') return encoded;
  if (Object.prototype.hasOwnProperty.call(values, EXAM_DAY_META_KEY)) {
    encoded[EXAM_DAY_META_KEY] = values[EXAM_DAY_META_KEY];
  }
  CALLING_SYSTEM_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      encoded[key] = values[key];
    }
  });
  return encoded;
};

export const insertRow = async (tableId, fields, values, userId, options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) throw new Error('Exam table not found');
  const encoded = {};
  fields.forEach((f) => {
    if (!(f.key in values)) return;
    encoded[f.key] = encodeCellValue(values[f.key], effectiveType(f));
  });
  mergeSystemValues(encoded, values);
  const entity = em.create(ExamRow, {
    exam_id: examId,
    row_view: persistRowView(options.view),
    values: encoded,
    sys_created_by: userId || null,
    sys_updated_by: userId || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
};

/** Insert many rows with a single flush. */
export const insertRows = async (tableId, fields, valuesList, userId, options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) throw new Error('Exam table not found');
  const rowView = persistRowView(options.view);
  const entities = valuesList.map((values) => {
    const encoded = {};
    fields.forEach((f) => {
      if (!(f.key in values)) return;
      encoded[f.key] = encodeCellValue(values[f.key], effectiveType(f));
    });
    mergeSystemValues(encoded, values);
    return em.create(ExamRow, {
      exam_id: examId,
      row_view: rowView,
      values: encoded,
      sys_created_by: userId || null,
      sys_updated_by: userId || null,
    });
  });
  entities.forEach((e) => em.persist(e));
  await em.flush();
  return entities.length;
};

export const updateRow = async (tableId, fields, rowId, values, userId) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return false;
  const row = await em.findOne(ExamRow, { id: String(rowId), exam_id: examId });
  if (!row) return false;
  const next = { ...(row.values || {}) };
  fields.forEach((f) => {
    if (!(f.key in values)) return;
    next[f.key] = encodeCellValue(values[f.key], effectiveType(f));
  });
  mergeSystemValues(next, values);
  em.assign(row, {
    values: next,
    sys_updated_by: userId || null,
    sys_updated_at: new Date(),
  });
  await em.flush();
  return true;
};

/** Load every row for a view (sync / admin). */
export const listAllRowsForView = async (tableId, fields, view) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const match = { exam_id: examId, ...rowViewMatch(view) };
  const raw = await em.find(ExamRow, match, { orderBy: { sys_created_at: 'DESC' } });
  const userMap = await loadUsers(
    em,
    raw.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
  );
  return raw.map((r) => mapRow(r, fields, userMap));
};

/**
 * Lightweight rows for sync (id + values only — no user joins).
 * Optional offset/limit for chunked Calling sync progress.
 */
export const listAllRowValuesForView = async (tableId, fields, view, options = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return [];
  const match = { exam_id: examId, ...rowViewMatch(view) };
  const offset = Math.max(0, Number(options.offset) || 0);
  const limitRaw = Number(options.limit);
  const findOpts = { orderBy: { sys_created_at: 'ASC' } };
  if (Number.isFinite(limitRaw) && limitRaw > 0) {
    findOpts.limit = Math.floor(limitRaw);
    findOpts.offset = offset;
  }
  const raw = await em.find(ExamRow, match, findOpts);
  return raw.map((r) => ({
    id: String(r.id ?? r._id),
    values: decodeRowValues(r, fields),
  }));
};

export const countRowsForView = async (tableId, view) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  return em.count(ExamRow, { exam_id: examId, ...rowViewMatch(view) });
};

/**
 * Apply different value bags to many rows in one (or few) flushes.
 * `patches`: [{ id, values }]
 */
export const updateRowsIndividual = async (tableId, fields, patches, userId, { chunkSize = 500 } = {}) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  const list = Array.isArray(patches) ? patches.filter((p) => p?.id) : [];
  if (!list.length) return 0;
  const size = Math.max(50, Math.min(2000, Number(chunkSize) || 500));
  let touched = 0;
  const now = new Date();
  for (let i = 0; i < list.length; i += size) {
    const slice = list.slice(i, i + size);
    const ids = slice.map((p) => String(p.id));
    const rows = await em.find(ExamRow, { exam_id: examId, id: { $in: ids } });
    const byId = new Map(rows.map((r) => [String(r.id ?? r._id), r]));
    slice.forEach((patch) => {
      const row = byId.get(String(patch.id));
      if (!row) return;
      const next = { ...(row.values || {}) };
      const values = patch.values && typeof patch.values === 'object' ? patch.values : {};
      fields.forEach((f) => {
        if (!(f.key in values)) return;
        next[f.key] = encodeCellValue(values[f.key], effectiveType(f));
      });
      mergeSystemValues(next, values);
      // Also copy any extra keys present on the patch (label target, etc.).
      Object.keys(values).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) return;
        if (fields.some((f) => f.key === key)) return;
        next[key] = values[key];
      });
      em.assign(row, {
        values: next,
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

/** Insert many rows in chunks (avoids one huge flush for 5k–200k Calling sync). */
export const insertRowsChunked = async (
  tableId,
  fields,
  valuesList,
  userId,
  options = {},
  { chunkSize = 1000 } = {},
) => {
  const list = Array.isArray(valuesList) ? valuesList : [];
  if (!list.length) return 0;
  const size = Math.max(50, Math.min(2000, Number(chunkSize) || 1000));
  let total = 0;
  for (let i = 0; i < list.length; i += size) {
    total += await insertRows(tableId, fields, list.slice(i, i + size), userId, options);
    // Free identity map between large chunks.
    try {
      getEm().clear();
    } catch {
      /* ignore */
    }
  }
  return total;
};

/**
 * Apply the same values patch to many rows (Mass Edit).
 * `rowIds: null` → every row for this exam; otherwise only those ids.
 */
export const updateRowsBulk = async (tableId, fields, values, userId, rowIds = null) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  const where =
    Array.isArray(rowIds) && rowIds.length
      ? { exam_id: examId, id: { $in: rowIds.map(String) } }
      : { exam_id: examId };
  if (Array.isArray(rowIds) && rowIds.length === 0) return 0;
  const rows = await em.find(ExamRow, where);
  if (!rows.length) return 0;
  const now = new Date();
  rows.forEach((row) => {
    const next = { ...(row.values || {}) };
    fields.forEach((f) => {
      if (!(f.key in values)) return;
      next[f.key] = encodeCellValue(values[f.key], effectiveType(f));
    });
    mergeSystemValues(next, values);
    em.assign(row, {
      values: next,
      sys_updated_by: userId || null,
      sys_updated_at: now,
    });
  });
  await em.flush();
  return rows.length;
};

export const deleteRows = async (tableId, rowIds) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  const ids = (rowIds || []).map(String);
  return em.nativeDelete(ExamRow, { exam_id: examId, id: { $in: ids } });
};

/** Delete every shared Center-list row for this exam (not Exam Day snapshots). */
export const deleteAllSharedRows = async (tableId) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  return em.nativeDelete(ExamRow, { exam_id: examId, ...rowViewMatch() });
};
