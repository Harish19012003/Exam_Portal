import { getEm } from '../../../database/connection.js';
import { Exam, User, ExamTable, ExamRow } from '../../../database/entities/index.js';

const SYSTEM_COLUMNS = new Set([
  'id',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'values',
  '_id',
]);

const formatUserLabel = (firstName, lastName, email) => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || email || null;
};

/** Field keys must be safe identifiers (API / builder). */
export const isSafeColumnName = (key) => /^[a-z][a-z0-9_]{0,39}$/.test(String(key || ''));

/** @deprecated no SQL types — kept as no-op helper for callers that still import it */
export const sqlTypeForDataType = () => 'json';

export const encodeCellValue = (value, dataType) => {
  if (value === undefined) return null;
  if (value === null || value === '') return null;

  if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.includes('\u001f')) {
      return value.split('\u001f').filter(Boolean);
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return value ? [String(value)] : [];
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'progress' || dataType === 'rating') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return value;
};

export const decodeCellValue = (value, dataType) => {
  if (value == null) {
    if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') return false;
    if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') return [];
    return '';
  }

  if (dataType === 'boolean' || dataType === 'checkbox' || dataType === 'dot') {
    return value === 1 || value === true || value === '1';
  }

  if (dataType === 'multiselect' || dataType === 'tags' || dataType === 'attachment') {
    if (Array.isArray(value)) return value;
    const raw = String(value);
    if (!raw) return [];
    return raw.includes('\u001f')
      ? raw.split('\u001f')
      : raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  if (dataType === 'datetime' && value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  if (dataType === 'datetime' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value)) {
    return value.replace(' ', 'T').slice(0, 16);
  }

  if (dataType === 'date' && value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  return value;
};

let fieldTypeMapCache = new Map();

/** No-op: document store needs no DDL. */
export const ensureExamsTable = async () => {};

/** No-op: field keys live inside `values`, not physical columns. */
export const syncFieldColumns = async (fields = []) => {
  const typeMap = new Map(fieldTypeMapCache);
  for (const field of Array.isArray(fields) ? fields : []) {
    const key = field?.key;
    if (!isSafeColumnName(key) || SYSTEM_COLUMNS.has(key)) continue;
    typeMap.set(key, field.dataType || 'text');
  }
  fieldTypeMapCache = typeMap;
  return { columns: [...typeMap.keys()] };
};

const getFieldTypeMap = async (fieldsHint = []) => {
  if (Array.isArray(fieldsHint) && fieldsHint.length) {
    const map = new Map();
    fieldsHint.forEach((f) => {
      if (f?.key) map.set(f.key, f.dataType || 'text');
    });
    fieldTypeMapCache = map;
    return map;
  }
  return fieldTypeMapCache;
};

const loadUserMap = async (em, ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await em.find(User, { _id: { $in: unique } });
  return new Map(users.map((u) => [String(u._id), u]));
};

const mapExam = (exam, typeMap, userMap) => {
  if (!exam) return null;
  const rawValues = exam.values && typeof exam.values === 'object' ? exam.values : {};
  const values = {};
  Object.entries(rawValues).forEach(([key, value]) => {
    values[key] = decodeCellValue(value, typeMap.get(key) || 'text');
  });

  const created = userMap.get(String(exam.created_by || ''));
  const updated = userMap.get(String(exam.updated_by || ''));

  return {
    id: String(exam._id),
    values,
    fields: [],
    createdBy: exam.created_by || null,
    updatedBy: exam.updated_by || null,
    createdByLabel: created
      ? formatUserLabel(created.first_name, created.last_name, created.email)
      : null,
    updatedByLabel: updated
      ? formatUserLabel(updated.first_name, updated.last_name, updated.email)
      : null,
    createdByEmail: created?.email || null,
    updatedByEmail: updated?.email || null,
    createdAt: exam.created_at ? new Date(exam.created_at).getTime() : null,
    updatedAt: exam.updated_at ? new Date(exam.updated_at).getTime() : null,
  };
};

const encodeValues = (values, fields) => {
  const typeByKey = new Map(
    (Array.isArray(fields) ? fields : []).map((f) => [f.key, f.dataType || 'text']),
  );
  const out = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (!isSafeColumnName(key) || SYSTEM_COLUMNS.has(key)) return;
    out[key] = encodeCellValue(
      value,
      typeByKey.get(key) || fieldTypeMapCache.get(key) || 'text',
    );
  });
  return out;
};

export const findAll = async (fieldsHint = []) => {
  const em = getEm();
  const typeMap = await getFieldTypeMap(fieldsHint);
  const exams = await em.find(Exam, {}, { orderBy: { created_at: 'DESC' } });
  const userMap = await loadUserMap(
    em,
    exams.flatMap((e) => [e.created_by, e.updated_by]),
  );
  return exams.map((e) => mapExam(e, typeMap, userMap));
};

export const findById = async (id, fieldsHint = []) => {
  const em = getEm();
  const typeMap = await getFieldTypeMap(fieldsHint);
  const exam = await em.findOne(Exam, { _id: String(id) });
  if (!exam) return null;
  const userMap = await loadUserMap(em, [exam.created_by, exam.updated_by]);
  return mapExam(exam, typeMap, userMap);
};

export const create = async ({ id, values, fields, createdBy }) => {
  await syncFieldColumns(fields);
  const em = getEm();
  const entity = em.create(Exam, {
    _id: String(id),
    values: encodeValues(values, fields),
    created_by: createdBy || null,
    updated_by: createdBy || null,
  });
  await em.persist(entity).flush();
  return findById(id, fields);
};

export const update = async (id, { values, fields, updatedBy }) => {
  const existing = await findById(id, fields);
  if (!existing) return null;

  if (Array.isArray(fields) && fields.length) {
    await syncFieldColumns(fields);
  }

  const nextValues =
    values && typeof values === 'object' ? { ...existing.values, ...values } : existing.values;

  const em = getEm();
  const entity = await em.findOne(Exam, { _id: String(id) });
  if (!entity) return null;
  em.assign(entity, {
    values: encodeValues(nextValues, fields || []),
    updated_by: updatedBy || entity.updated_by || null,
    updated_at: new Date(),
  });
  await em.flush();
  return findById(id, fields);
};

export const remove = async (id) => {
  const em = getEm();
  const examId = String(id);
  const entity = await em.findOne(Exam, { _id: examId });
  if (!entity) return false;

  // Cascade: explore metadata + all rows for this exam
  const tables = await em.find(ExamTable, { exam_id: examId });
  for (const table of tables) {
    em.remove(table);
  }
  await em.nativeDelete(ExamRow, { exam_id: examId });
  em.remove(entity);
  await em.flush();
  return true;
};

export const upsert = async ({ id, values, fields, createdBy }) => {
  const existing = await findById(id, fields);
  if (existing) {
    return update(id, { values, fields });
  }
  return create({ id, values, fields, createdBy });
};

/** No-op retained for older callers. */
export const migrateLegacyJsonRows = async () => ({ migrated: 0 });
