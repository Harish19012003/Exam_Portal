import { AppError } from '../../../core/errors.js';
import {
  CENTER_CODE_KEY,
  DEFAULT_EXAM_VIEW,
  ERROR_CODES,
  isExamViewKey,
  isSharedImportedField,
} from '@exam-view/shared';
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

const normalizeView = (view) => {
  const key = String(view || DEFAULT_EXAM_VIEW).trim() || DEFAULT_EXAM_VIEW;
  if (!isExamViewKey(key)) throw validationError(`Unknown exam view: "${key}"`);
  return key;
};

const requireTable = async (examId) => {
  const table = await repo.findTableByExamId(examId);
  if (!table) throw notFound('This exam has no table yet');
  return table;
};

const snapshot = async (examId, view = DEFAULT_EXAM_VIEW) => {
  const viewKey = normalizeView(view);
  const table = await repo.findTableByExamId(examId);
  if (!table) return { exists: false, table: null, view: viewKey, fields: [], features: null, views: {} };
  const configs = table.viewConfigs || {};
  const viewSummaries = {};
  Object.entries(configs).forEach(([key, cfg]) => {
    viewSummaries[key] = {
      fieldCount: Array.isArray(cfg?.fields) ? cfg.fields.length : 0,
      hasFeatures: Boolean(cfg?.features),
    };
  });
  const fields = await repo.listFields(table.id, viewKey);
  const features = configs[viewKey]?.features ?? (viewKey === DEFAULT_EXAM_VIEW ? table.features : null);
  return {
    exists: true,
    table,
    view: viewKey,
    fields,
    features,
    views: viewSummaries,
  };
};

export const getTable = (examId, view) => withMeta(() => snapshot(examId, view));

export const listAllFields = (examId) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    return repo.listAllFields(table.id);
  });

/** Copy a preset's fields (and features) into one tab's config. */
const applyPreset = async (tableId, preset, view) => {
  const fields = cleanFields(preset.fields);
  await repo.applyFields(tableId, fields, view);
  if (preset.features) await repo.saveFeatures(tableId, preset.features, view);
};

export const createTable = (examId, userId, { presetId, view } = {}) =>
  withMeta(async () => {
    const viewKey = normalizeView(view);
    if (!(await repo.examExists(examId))) throw notFound('Exam not found');
    let preset = null;
    if (presetId != null) {
      await presetRepo.ensurePresetTable();
      preset = await presetRepo.findById(String(presetId));
      if (!preset) throw notFound('Preset not found');
    }
    let table = await repo.findTableByExamId(examId);
    if (!table) {
      const tableId = await repo.createTable(examId, userId);
      if (preset) {
        try {
          await applyPreset(tableId, preset, viewKey);
        } catch (error) {
          await repo.dropTable(tableId);
          throw error;
        }
      } else if (viewKey !== DEFAULT_EXAM_VIEW) {
        // Shell starts with empty center-list; ensure requested view exists too.
        await repo.applyFields(tableId, [], viewKey);
      }
    } else if (preset) {
      const current = await repo.listFields(table.id, viewKey);
      if (current.length) {
        throw validationError('This tab already has fields. Use Load preset or Import from another tab instead.');
      }
      await applyPreset(table.id, preset, viewKey);
    } else {
      // Ensure the view slot exists so the client can start building fields.
      const current = await repo.listFields(table.id, viewKey);
      if (!current.length) await repo.applyFields(table.id, [], viewKey);
    }
    return snapshot(examId, viewKey);
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
    const viewKey = normalizeView(body.view);
    const table = await requireTable(examId);
    const current = await repo.listFields(table.id, viewKey);

    let fields = current;
    if (body.fields !== undefined) {
      fields = cleanFields(body.fields);
      const keys = fields.map((f) => f.key);

      const removed = current.filter((f) => !keys.includes(f.key)).map((f) => f.key);
      const usedElsewhere = await repo.keysUsedOutsideView(table.id, viewKey);
      const unusedRemoved = removed.filter((k) => !usedElsewhere.has(k));
      if (unusedRemoved.length && body.confirmDrops !== true) {
        throw new AppError(
          `Removing columns deletes their data permanently. Confirm to remove: ${unusedRemoved.join(', ')}`,
          409,
          ERROR_CODES.CONFLICT,
        );
      }
      try {
        await repo.applyFields(table.id, fields, viewKey);
      } catch (error) {
        throw validationError(`Could not update the table fields: ${error.message}`);
      }
      if (unusedRemoved.length) {
        await repo.stripUnusedKeysFromRows(examId, unusedRemoved);
      }
    }

    if (body.features !== undefined) {
      if (!body.features || typeof body.features !== 'object' || Array.isArray(body.features)) {
        throw validationError('features must be an object');
      }
      if (JSON.stringify(body.features).length > MAX_FEATURES_BYTES) throw validationError('Features are too large');
      await repo.saveFeatures(table.id, body.features, viewKey);
    }
    return snapshot(examId, viewKey);
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

const tableAndAllFields = async (examId) => {
  const table = await requireTable(examId);
  return { table, fields: await repo.listAllFields(table.id) };
};

const tableAndViewFields = async (examId, view) => {
  const viewKey = normalizeView(view);
  const table = await requireTable(examId);
  return { table, view: viewKey, fields: await repo.listFields(table.id, viewKey), allFields: await repo.listAllFields(table.id) };
};

const assertUniqueCenterCode = async (tableId, allFields, values, excludeRowId = null) => {
  if (!allFields.some((f) => f.key === CENTER_CODE_KEY)) return;
  if (!Object.prototype.hasOwnProperty.call(values || {}, CENTER_CODE_KEY)) return;
  const code = values[CENTER_CODE_KEY];
  if (isEmpty(code)) return;
  const wanted = String(code).trim().toLowerCase();
  const existing = await repo.listCenterCodes(tableId, CENTER_CODE_KEY);
  const clash = existing.find((row) => {
    if (excludeRowId && String(row.id) === String(excludeRowId)) return false;
    return String(row.code ?? '').trim().toLowerCase() === wanted;
  });
  if (clash) throw validationError(`Center code "${code}" is already used on this exam`);
};

export const listRows = (examId, options = {}) =>
  withMeta(async () => {
    const { table, fields } = await tableAndAllFields(examId);
    return repo.listRows(table.id, fields, options);
  });

export const getRow = (examId, rowId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndAllFields(examId);
    const row = await repo.findRow(table.id, fields, rowId);
    if (!row) throw notFound('Row not found');
    return row;
  });

const isCombinedField = (field) =>
  field?.dataType === 'combined' && Array.isArray(field?.combine?.keys) && field.combine.keys.length >= 2;

/** Shared imports + combined (display-only join) are never persisted from this tab. */
const writableViewFields = (fields) =>
  (fields || []).filter((f) => !isSharedImportedField(f) && !isCombinedField(f));

export const createRow = (examId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    if (!fields.length) throw validationError('Add at least one column before adding rows');
    const writable = writableViewFields(fields);
    if (!writable.length) throw validationError('Add at least one editable column before adding rows');
    const cleaned = cleanRowValues(writable, body?.values);
    await assertUniqueCenterCode(table.id, allFields, cleaned);
    const id = await repo.insertRow(table.id, writable, cleaned, userId);
    return repo.findRow(table.id, allFields, id);
  });

/** Bulk create: validates every row, loads existing center codes once, inserts valid rows in one flush. */
export const createRows = (examId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    if (!fields.length) throw validationError('Add at least one column before adding rows');
    const writable = writableViewFields(fields);
    if (!writable.length) throw validationError('Add at least one editable column before adding rows');
    const input = Array.isArray(body?.rows) ? body.rows : [];

    const checkCode = allFields.some((f) => f.key === CENTER_CODE_KEY);
    const seen = new Set();
    if (checkCode) {
      const existing = await repo.listCenterCodes(table.id, CENTER_CODE_KEY);
      existing.forEach((r) => {
        const c = String(r.code ?? '').trim().toLowerCase();
        if (c) seen.add(c);
      });
    }

    const valid = [];
    const failures = [];
    input.forEach((raw, index) => {
      try {
        const cleaned = cleanRowValues(writable, raw);
        if (checkCode && Object.prototype.hasOwnProperty.call(cleaned, CENTER_CODE_KEY) && !isEmpty(cleaned[CENTER_CODE_KEY])) {
          const code = String(cleaned[CENTER_CODE_KEY]).trim().toLowerCase();
          if (seen.has(code)) throw validationError(`Center code "${cleaned[CENTER_CODE_KEY]}" is already used on this exam`);
          seen.add(code);
        }
        valid.push(cleaned);
      } catch (err) {
        failures.push({ index, message: err?.message || 'Invalid row' });
      }
    });

    const created = valid.length ? await repo.insertRows(table.id, writable, valid, userId) : 0;
    return { created, failures };
  });

export const updateRow = (examId, rowId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    const writableFields = writableViewFields(fields);
    const cleaned = cleanRowValues(writableFields, body?.values);
    await assertUniqueCenterCode(table.id, allFields, cleaned, rowId);
    if (!(await repo.updateRow(table.id, writableFields, rowId, cleaned, userId))) {
      throw notFound('Row not found');
    }
    return repo.findRow(table.id, allFields, rowId);
  });

export const getRowsByIds = (examId, rowIds) =>
  withMeta(async () => {
    const { table, fields } = await tableAndAllFields(examId);
    return repo.findRowsByIds(table.id, fields, rowIds);
  });

export const deleteRows = (examId, rowIds) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    const ids = (Array.isArray(rowIds) ? rowIds : [rowIds]).map(String).filter(Boolean);
    if (!ids.length) throw validationError('No rows to delete');
    return { success: true, deleted: await repo.deleteRows(table.id, ids) };
  });

/** Called when an exam is deleted so explore metadata/rows are not left behind. */
export const dropTableForExam = async (examId) => {
  await repo.dropTableForExam(examId);
};
