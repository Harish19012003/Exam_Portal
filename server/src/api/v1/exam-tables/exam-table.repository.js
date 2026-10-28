import { getEm } from '../../../database/connection.js';
import { Exam, ExamTable, ExamRow, User } from '../../../database/entities/index.js';
import { encodeCellValue, decodeCellValue } from '../exams/exam.repository.js';

export const SYSTEM_COLUMNS = ['id', 'sys_created_by', 'sys_updated_by', 'sys_created_at', 'sys_updated_at'];

export const isSafeColumnName = (name) => /^[a-z][a-z0-9_]{0,39}$/.test(String(name || ''));
export const isReservedKey = (key) => key === 'id' || String(key).startsWith('sys_');

export const effectiveType = (def) =>
  (def?.dataType === 'dropdown' || def?.dataType === 'status') && def?.allowMultiple
    ? 'multiselect'
    : def?.dataType || 'text';

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
    createdAt: row.created_at,
  };
};

export const createTable = async (examId, userId) => {
  const em = getEm();
  const entity = em.create(ExamTable, {
    exam_id: String(examId),
    fields: [],
    features: null,
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

export const listFields = async (tableId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return [];
  const fields = Array.isArray(table.fields) ? table.fields : [];
  return fields.map((def, i) => ({
    ...def,
    key: def.key,
    label: def.label,
    dataType: def.dataType || 'text',
    order: def.order ?? i + 1,
  }));
};

export const applyFields = async (tableId, fields) => {
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
  em.assign(table, { fields: normalized, updated_at: new Date() });
  await em.flush();
};

export const saveFeatures = async (tableId, features) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  if (!table) return;
  em.assign(table, { features, updated_at: new Date() });
  await em.flush();
};

const ROW_LIMIT = 1000;

const userLabel = (first, last, email) =>
  [first, last].filter(Boolean).join(' ').trim() || email || '';

const loadUsers = async (em, ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await em.find(User, { _id: { $in: unique } });
  return new Map(users.map((u) => [String(u._id), u]));
};

const mapRow = (raw, fields, userMap) => {
  const created = userMap.get(String(raw.sys_created_by || ''));
  const updated = userMap.get(String(raw.sys_updated_by || ''));
  const createdLabel = created
    ? userLabel(created.first_name, created.last_name, created.email)
    : '';
  const values = {};
  fields.forEach((f) => {
    values[f.key] = decodeCellValue(raw.values?.[f.key], effectiveType(f));
  });
  return {
    id: String(raw.id ?? raw._id),
    values,
    createdAt: raw.sys_created_at,
    updatedAt: raw.sys_updated_at,
    createdByLabel: createdLabel,
    updatedByLabel: updated
      ? userLabel(updated.first_name, updated.last_name, updated.email) || createdLabel
      : createdLabel,
  };
};

const resolveExamId = async (tableId) => {
  const em = getEm();
  const table = await em.findOne(ExamTable, { id: String(tableId) });
  return table?.exam_id || null;
};

export const listRows = async (tableId, fields) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return { rows: [], total: 0, limit: ROW_LIMIT };
  const total = await em.count(ExamRow, { exam_id: examId });
  const rows = await em.find(
    ExamRow,
    { exam_id: examId },
    { orderBy: { sys_created_at: 'DESC' }, limit: ROW_LIMIT },
  );
  const userMap = await loadUsers(
    em,
    rows.flatMap((r) => [r.sys_created_by, r.sys_updated_by]),
  );
  return { rows: rows.map((r) => mapRow(r, fields, userMap)), total, limit: ROW_LIMIT };
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

export const insertRow = async (tableId, fields, values, userId) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) throw new Error('Exam table not found');
  const encoded = {};
  fields.forEach((f) => {
    if (!(f.key in values)) return;
    encoded[f.key] = encodeCellValue(values[f.key], effectiveType(f));
  });
  const entity = em.create(ExamRow, {
    exam_id: examId,
    values: encoded,
    sys_created_by: userId || null,
    sys_updated_by: userId || null,
  });
  await em.persist(entity).flush();
  return String(entity.id ?? entity._id);
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
  em.assign(row, {
    values: next,
    sys_updated_by: userId || null,
    sys_updated_at: new Date(),
  });
  await em.flush();
  return true;
};

export const deleteRows = async (tableId, rowIds) => {
  const em = getEm();
  const examId = await resolveExamId(tableId);
  if (!examId) return 0;
  const ids = (rowIds || []).map(String);
  return em.nativeDelete(ExamRow, { exam_id: examId, id: { $in: ids } });
};
