import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import * as repo from './exam-table.repository.js';
import * as presetRepo from '../exam-presets/exam-preset.repository.js';

const MAX_FIELDS = 100;
const MAX_FEATURES_BYTES = 200000;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 20000;

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = (message) => new AppError(message, 404, ERROR_CODES.NOT_FOUND);

/** Make sure the metadata tables exist before any table/column work. */
const withMeta = async (fn) => {
  await repo.ensureMetaTables();
  return fn();
};

const requireTable = async (examId) => {
  const table = await repo.findTableByExamId(examId);
  if (!table) throw notFound('This exam has no table yet');
  return table;
};

const snapshot = async (examId) => {
  const table = await repo.findTableByExamId(examId);
  if (!table) return { exists: false, table: null, fields: [], features: null };
  return { exists: true, table, fields: await repo.listFields(table.id), features: table.features };
};

export const getTable = (examId) => withMeta(() => snapshot(examId));

/** Copy a preset's fields (and features) into a freshly created, still empty table. */
const applyPreset = async (tableId, preset) => {
  const fields = cleanFields(preset.fields);
  await repo.applyFields(tableId, fields);
  if (preset.features) await repo.saveFeatures(tableId, preset.features);
};

export const createTable = (examId, userId, { presetId } = {}) =>
  withMeta(async () => {
    if (!(await repo.examExists(examId))) throw notFound('Exam not found');
    let preset = null;
    if (presetId != null) {
      await presetRepo.ensurePresetTable();
      preset = await presetRepo.findById(String(presetId));
      if (!preset) throw notFound('Preset not found');
    }
    if (!(await repo.findTableByExamId(examId))) {
      const tableId = await repo.createTable(examId, userId);
      if (preset) {
        try {
          await applyPreset(tableId, preset);
        } catch (error) {
          await repo.dropTable(tableId);
          throw error;
        }
      }
    }
    return snapshot(examId);
  });

/** Keep the builder's definition, but only plain JSON of a sane size. */
const cleanFieldDefinition = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw validationError('Invalid field');
  const key = String(raw.key || '');
  if (!repo.isSafeColumnName(key) || repo.isReservedKey(key)) {
    throw validationError(`Invalid or reserved column key: "${key}"`);
  }
  const label = String(raw.label ?? '').trim();
  if (!label || label.length > 120) throw validationError(`Column "${key}" needs a name (max 120 characters)`);
  const dataType = String(raw.dataType || '');
  // Allow camelCase types (e.g. fromExam) as well as plain lowercase (text, datetime).
  if (!/^[a-z][a-zA-Z]{1,24}$/.test(dataType)) throw validationError(`Column "${key}" has an invalid type`);
  const def = JSON.parse(JSON.stringify({ ...raw, key, label, dataType }));
  if (JSON.stringify(def).length > 20000) throw validationError(`Column "${key}" configuration is too large`);
  return def;
};

/** Validate a whole list of field definitions (used by table config and presets). */
export const cleanFields = (list) => {
  if (!Array.isArray(list)) throw validationError('fields must be a list');
  if (list.length > MAX_FIELDS) throw validationError(`A table can have at most ${MAX_FIELDS} columns`);
  const fields = list.map(cleanFieldDefinition);
  const keys = fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) throw validationError('Column keys must be unique');
  return fields;
};

export const saveConfig = (examId, body = {}) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    const current = await repo.listFields(table.id);

    let fields = current;
    if (body.fields !== undefined) {
      fields = cleanFields(body.fields);
      const keys = fields.map((f) => f.key);

      const removed = current.filter((f) => !keys.includes(f.key)).map((f) => f.key);
      if (removed.length && body.confirmDrops !== true) {
        throw new AppError(
          `Removing columns deletes their data permanently. Confirm to remove: ${removed.join(', ')}`,
          409,
          ERROR_CODES.CONFLICT,
        );
      }
      try {
        await repo.applyFields(table.id, fields);
      } catch (error) {
        throw validationError(`Could not update the table fields: ${error.message}`);
      }
    }

    if (body.features !== undefined) {
      if (!body.features || typeof body.features !== 'object' || Array.isArray(body.features)) {
        throw validationError('features must be an object');
      }
      if (JSON.stringify(body.features).length > MAX_FEATURES_BYTES) throw validationError('Features are too large');
      await repo.saveFeatures(table.id, body.features);
    }
    return snapshot(examId);
  });

/* ---------- Rows ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Light validation so bad input is a 400. Returns the value to store. */
const cleanCell = (field, raw) => {
  const type = repo.effectiveType(field);
  const fail = (msg) => validationError(`${field.label}: ${msg}`);
  if (isEmpty(raw)) return type === 'boolean' || type === 'checkbox' || type === 'dot' ? Boolean(raw) : null;

  switch (type) {
    case 'number':
    case 'currency':
    case 'progress':
    case 'rating':
      if (!Number.isFinite(Number(raw))) throw fail('must be a number');
      return Number(raw);
    case 'date':
      if (!DATE_RE.test(String(raw))) throw fail('must be a valid date');
      return String(raw);
    case 'datetime':
      if (!DATETIME_RE.test(String(raw))) throw fail('must be a valid date and time');
      return String(raw);
    case 'time':
      if (!TIME_RE.test(String(raw))) throw fail('must be a valid time');
      return String(raw);
    case 'boolean':
    case 'checkbox':
    case 'dot':
      return raw;
    case 'multiselect':
    case 'tags':
    case 'attachment': {
      const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      if (list.join('').length > MAX_LONG_TEXT) throw fail('is too long');
      return list;
    }
    case 'formula':
    case 'composite':
    case 'code':
    case 'mono': {
      const v = String(raw);
      if (v.length > MAX_LONG_TEXT) throw fail('is too long');
      return v;
    }
    default: {
      const v = String(raw);
      if (v.length > MAX_TEXT) throw fail(`is too long (max ${MAX_TEXT} characters)`);
      return v;
    }
  }
};

/** Only configured field keys are kept; unknown or system keys are ignored. */
export const cleanRowValues = (fields, input) => {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  fields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(source, f.key)) out[f.key] = cleanCell(f, source[f.key]);
  });
  return out;
};

const tableAndFields = async (examId) => {
  const table = await requireTable(examId);
  return { table, fields: await repo.listFields(table.id) };
};

export const listRows = (examId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndFields(examId);
    return repo.listRows(table.id, fields);
  });

export const getRow = (examId, rowId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndFields(examId);
    const row = await repo.findRow(table.id, fields, rowId);
    if (!row) throw notFound('Row not found');
    return row;
  });

export const createRow = (examId, body, userId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndFields(examId);
    if (!fields.length) throw validationError('Add at least one column before adding rows');
    const id = await repo.insertRow(table.id, fields, cleanRowValues(fields, body?.values), userId);
    return repo.findRow(table.id, fields, id);
  });

export const updateRow = (examId, rowId, body, userId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndFields(examId);
    if (!(await repo.updateRow(table.id, fields, rowId, cleanRowValues(fields, body?.values), userId))) {
      throw notFound('Row not found');
    }
    return repo.findRow(table.id, fields, rowId);
  });

export const deleteRows = (examId, rowIds) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    const ids = (Array.isArray(rowIds) ? rowIds : [rowIds]).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) throw validationError('No rows to delete');
    return { success: true, deleted: await repo.deleteRows(table.id, ids) };
  });

/** Called when an exam is deleted so explore metadata/rows are not left behind. */
export const dropTableForExam = async (examId) => {
  await repo.dropTableForExam(examId);
};
