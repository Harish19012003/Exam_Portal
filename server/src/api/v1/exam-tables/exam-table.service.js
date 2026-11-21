import { AppError } from '../../../core/errors.js';
import {
  CALLING_CENTER_ROW_ID_KEY,
  CALLING_DATE_ID_KEY,
  CALLING_EXPAND_MODES,
  CALLING_HIDDEN_KEY,
  CALLING_SYSTEM_KEYS,
  CENTER_CODE_KEY,
  DEFAULT_EXAM_VIEW,
  ERROR_CODES,
  EXAM_DATE_KEY,
  EXAM_DAY_META_KEY,
  EXAM_DAY_VIEW,
  OPERATOR_GUARD_CALLING_VIEW,
  callingNaturalKeyFromValues,
  isExamViewKey,
  isOperatorGuardCallingView,
  isOwnRowSetView,
  isSharedImportedField,
  normalizeCallingExpand,
  normalizeCallingLabel,
  planCallingTargetsForCenterRow,
  resolveCallingExpandForLabel,
} from '@exam-view/shared';
import * as repo from './exam-table.repository.js';
import * as callingRepo from './exam-calling.repository.js';
import * as presetRepo from '../exam-presets/exam-preset.repository.js';
import { hasActiveQuery, rowMatchesQuery } from './rowFilterMatch.js';

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
  // Exam Day per-date status / timestamps live on the Center list row (same spreadsheet).
  if (Object.prototype.hasOwnProperty.call(source, EXAM_DAY_META_KEY)) {
    const meta = source[EXAM_DAY_META_KEY];
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      out[EXAM_DAY_META_KEY] = meta;
    } else if (meta == null) {
      out[EXAM_DAY_META_KEY] = {};
    } else {
      throw validationError('Exam Day meta must be an object');
    }
  }
  // Op/Guard Calling identity / soft-hide keys (not field defs).
  CALLING_SYSTEM_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
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

const assertUniqueCenterCode = async (tableId, allFields, values, excludeRowId = null, view = DEFAULT_EXAM_VIEW) => {
  if (isOwnRowSetView(view)) return;
  if (!allFields.some((f) => f.key === CENTER_CODE_KEY)) return;
  if (!Object.prototype.hasOwnProperty.call(values || {}, CENTER_CODE_KEY)) return;
  const code = values[CENTER_CODE_KEY];
  if (isEmpty(code)) return;
  const wanted = String(code).trim().toLowerCase();
  const existing = await repo.listCenterCodes(tableId, CENTER_CODE_KEY, { view: DEFAULT_EXAM_VIEW });
  const clash = existing.find((row) => {
    if (excludeRowId && String(row.id) === String(excludeRowId)) return false;
    return String(row.code ?? '').trim().toLowerCase() === wanted;
  });
  if (clash) throw validationError(`Center code "${code}" is already used on this exam`);
};

const pairKey = (code, examDate) =>
  `${String(code ?? '').trim().toLowerCase()}\0${String(examDate ?? '').trim().toLowerCase()}`;

/** Exam Day: unique (center_code + exam_date). */
const assertUniqueCenterDate = async (tableId, fields, values, excludeRowId = null) => {
  if (!fields.some((f) => f.key === CENTER_CODE_KEY)) return;
  if (!Object.prototype.hasOwnProperty.call(values || {}, CENTER_CODE_KEY)) return;
  const code = values[CENTER_CODE_KEY];
  if (isEmpty(code)) return;
  const dateField = fields.find((f) => f.key === EXAM_DATE_KEY) || fields.find((f) => f.dataType === 'date');
  const dateKey = dateField?.key || EXAM_DATE_KEY;
  const examDate = values[dateKey];
  if (isEmpty(examDate)) return;
  const wanted = pairKey(code, examDate);
  const existing = await repo.listCenterDatePairs(tableId, {
    centerKey: CENTER_CODE_KEY,
    dateKey,
    view: EXAM_DAY_VIEW,
  });
  const clash = existing.find((row) => {
    if (excludeRowId && String(row.id) === String(excludeRowId)) return false;
    return pairKey(row.code, row.examDate) === wanted;
  });
  if (clash) {
    throw validationError(
      `Center code "${code}" already has an Exam Day row for ${String(examDate).trim()}`,
    );
  }
};

export const listRows = (examId, options = {}) =>
  withMeta(async () => {
    const viewKey = normalizeView(options.view);
    const { fields } = await tableAndAllFields(examId);
    const includeHidden =
      options.includeHidden === true ||
      options.includeHidden === 1 ||
      options.includeHidden === '1' ||
      String(options.includeHidden || '').toLowerCase() === 'true';

    if (isOperatorGuardCallingView(viewKey)) {
      return callingRepo.listRows(examId, fields, {
        ...options,
        ...(includeHidden ? {} : { excludeCallingHidden: true }),
      });
    }

    const table = await requireTable(examId);
    return repo.listRows(table.id, fields, { ...options, view: viewKey });
  });

export const getRow = (examId, rowId) =>
  withMeta(async () => {
    const { table, fields } = await tableAndAllFields(examId);
    // Prefer Calling collection when the id lives there.
    const calling = await callingRepo.findRow(examId, fields, rowId);
    if (calling) return calling;
    const row = await repo.findRow(table.id, fields, rowId);
    if (!row) throw notFound('Row not found');
    return row;
  });

const isCombinedField = (field) =>
  field?.dataType === 'combined' && Array.isArray(field?.combine?.keys) && field.combine.keys.length >= 2;

/**
 * Shared imports + combined are display-only on shared tabs.
 * Exam Day is a live Center list view — writes go to center-list rows (+ `__exam_day` meta).
 */
const writableViewFields = (fields, view = DEFAULT_EXAM_VIEW) =>
  (fields || []).filter((f) => {
    if (isCombinedField(f)) return false;
    if (isOwnRowSetView(view)) return true;
    return !isSharedImportedField(f);
  });

export const createRow = (examId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    if (!fields.length) throw validationError('Add at least one column before adding rows');
    const writable = writableViewFields(fields, viewKey);
    if (!writable.length) throw validationError('Add at least one editable column before adding rows');
    const cleaned = cleanRowValues(writable, body?.values);
    if (isOperatorGuardCallingView(viewKey)) {
      const naturalKey =
        callingNaturalKeyFromValues(cleaned, 'max_day_n') ||
        `manual::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`;
      const id = await callingRepo.insertRow(examId, writable, cleaned, userId, {
        naturalKey,
      });
      return callingRepo.findRow(examId, allFields, id);
    }
    if (isOwnRowSetView(viewKey)) {
      await assertUniqueCenterDate(table.id, fields, cleaned);
    } else {
      await assertUniqueCenterCode(table.id, allFields, cleaned, null, viewKey);
    }
    const id = await repo.insertRow(table.id, writable, cleaned, userId, { view: viewKey });
    return repo.findRow(table.id, allFields, id);
  });

/** Bulk create: validates every row, loads existing center codes once, inserts valid rows in one flush. */
export const createRows = (examId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    if (!fields.length) throw validationError('Add at least one column before adding rows');
    const writable = writableViewFields(fields, viewKey);
    if (!writable.length) throw validationError('Add at least one editable column before adding rows');
    const input = Array.isArray(body?.rows) ? body.rows : [];
    const ownRows = isOwnRowSetView(viewKey);
    const callingRows = isOperatorGuardCallingView(viewKey);

    // Calling allows many rows per center×date — skip center uniqueness.
    const checkCode =
      !callingRows &&
      (allFields.some((f) => f.key === CENTER_CODE_KEY) || fields.some((f) => f.key === CENTER_CODE_KEY));
    const seen = new Set();
    if (checkCode) {
      if (ownRows) {
        const dateField =
          fields.find((f) => f.key === EXAM_DATE_KEY) || fields.find((f) => f.dataType === 'date');
        const dateKey = dateField?.key || EXAM_DATE_KEY;
        const existing = await repo.listCenterDatePairs(table.id, {
          centerKey: CENTER_CODE_KEY,
          dateKey,
          view: EXAM_DAY_VIEW,
        });
        existing.forEach((r) => {
          const k = pairKey(r.code, r.examDate);
          if (k !== '\0') seen.add(k);
        });
      } else {
        const existing = await repo.listCenterCodes(table.id, CENTER_CODE_KEY, {
          view: DEFAULT_EXAM_VIEW,
        });
        existing.forEach((r) => {
          const c = String(r.code ?? '').trim().toLowerCase();
          if (c) seen.add(c);
        });
      }
    }

    const valid = [];
    const failures = [];
    const dateField =
      fields.find((f) => f.key === EXAM_DATE_KEY) || fields.find((f) => f.dataType === 'date');
    const dateKey = dateField?.key || EXAM_DATE_KEY;
    input.forEach((raw, index) => {
      try {
        const cleaned = cleanRowValues(writable, raw);
        if (
          checkCode &&
          Object.prototype.hasOwnProperty.call(cleaned, CENTER_CODE_KEY) &&
          !isEmpty(cleaned[CENTER_CODE_KEY])
        ) {
          if (ownRows) {
            const k = pairKey(cleaned[CENTER_CODE_KEY], cleaned[dateKey]);
            if (seen.has(k)) {
              throw validationError(
                `Center code "${cleaned[CENTER_CODE_KEY]}" already has an Exam Day row for ${String(cleaned[dateKey] ?? '').trim() || '(no date)'}`,
              );
            }
            seen.add(k);
          } else {
            const code = String(cleaned[CENTER_CODE_KEY]).trim().toLowerCase();
            if (seen.has(code)) {
              throw validationError(`Center code "${cleaned[CENTER_CODE_KEY]}" is already used on this exam`);
            }
            seen.add(code);
          }
        }
        valid.push(cleaned);
      } catch (err) {
        failures.push({ index, message: err?.message || 'Invalid row' });
      }
    });

    if (callingRows) {
      const items = valid.map((cleaned, i) => ({
        values: cleaned,
        naturalKey:
          callingNaturalKeyFromValues(cleaned, 'max_day_n') ||
          `manual::${Date.now()}::${i}::${Math.random().toString(36).slice(2, 6)}`,
      }));
      const created = items.length
        ? await callingRepo.insertRowsChunked(examId, writable, items, userId)
        : 0;
      return { created, failures };
    }

    const created = valid.length
      ? await repo.insertRows(table.id, writable, valid, userId, { view: viewKey })
      : 0;
    return { created, failures };
  });

export const updateRow = (examId, rowId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields, allFields } = await tableAndViewFields(examId, viewKey);
    const writableFields = writableViewFields(fields, viewKey);
    const cleaned = cleanRowValues(writableFields, body?.values);
    if (isOperatorGuardCallingView(viewKey)) {
      const existing = await callingRepo.findRow(examId, allFields, rowId);
      if (!existing) throw notFound('Row not found');
      const nextValues = { ...(existing.values || {}), ...cleaned };
      const naturalKey =
        existing.naturalKey ||
        callingNaturalKeyFromValues(nextValues, 'max_day_n') ||
        String(rowId);
      await callingRepo.updateRow(examId, writableFields, rowId, nextValues, userId, {
        naturalKey,
      });
      return callingRepo.findRow(examId, allFields, rowId);
    }
    if (isOwnRowSetView(viewKey)) {
      await assertUniqueCenterDate(table.id, fields, cleaned, rowId);
    } else {
      await assertUniqueCenterCode(table.id, allFields, cleaned, rowId, viewKey);
    }
    if (!(await repo.updateRow(table.id, writableFields, rowId, cleaned, userId))) {
      throw notFound('Row not found');
    }
    return repo.findRow(table.id, allFields, rowId);
  });

/**
 * Mass Edit: same values patch for many rows.
 * body.all === true → every row;
 * else body.filters / body.search → match then update;
 * else body.ids (required non-empty).
 */
export const bulkUpdateRows = (examId, body, userId) =>
  withMeta(async () => {
    const viewKey = normalizeView(body?.view);
    const { table, fields } = await tableAndViewFields(examId, viewKey);
    const writableFields = writableViewFields(fields, viewKey);
    if (!writableFields.length) throw validationError('No editable columns on this tab');
    const cleaned = cleanRowValues(writableFields, body?.values);
    if (!Object.keys(cleaned).length) throw validationError('No field values to update');
    const all = Boolean(body?.all);
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
    const filterQuery = {
      search: body?.search,
      filters: body?.filters,
      searchKeys: body?.searchKeys,
    };
    const useFilter = !all && !ids.length && hasActiveQuery(filterQuery);
    if (!all && !ids.length && !useFilter) {
      throw validationError('Provide row ids, filters/search, or set all: true');
    }
    // Center-code uniqueness across a mass edit is too ambiguous — block that key.
    if (Object.prototype.hasOwnProperty.call(cleaned, CENTER_CODE_KEY)) {
      throw validationError('Center code cannot be mass-edited; update rows individually');
    }

    let targetIds = all ? null : ids;
    if (isOperatorGuardCallingView(viewKey)) {
      const listed = await callingRepo.listAllLite(examId, fields);
      if (useFilter) {
        targetIds = listed
          .filter((row) => rowMatchesQuery(row.values, filterQuery))
          .map((row) => row.id);
        if (!targetIds.length) return { updated: 0, all: false, filtered: true, ids: [] };
      } else if (all) {
        targetIds = listed.map((row) => row.id);
        if (!targetIds.length) return { updated: 0, all: true, filtered: false, ids: [] };
      }
      const patches = (targetIds || []).map((id) => {
        const row = listed.find((r) => String(r.id) === String(id));
        return { id, values: { ...(row?.values || {}), ...cleaned } };
      });
      const updated = await callingRepo.updateRowsIndividual(
        examId,
        writableFields,
        patches,
        userId,
      );
      return {
        updated,
        all,
        filtered: Boolean(useFilter),
        ids: all ? undefined : targetIds,
      };
    }

    if (useFilter || all) {
      // Scope mass-edit to this tab’s row set (Exam Day vs shared centers).
      const listed = await repo.listRowValues(table.id, fields, { view: viewKey });
      if (useFilter) {
        targetIds = listed
          .filter((row) => rowMatchesQuery(row.values, filterQuery))
          .map((row) => row.id);
        if (!targetIds.length) {
          return { updated: 0, all: false, filtered: true, ids: [] };
        }
      } else if (all) {
        targetIds = listed.map((row) => row.id);
        if (!targetIds.length) {
          return { updated: 0, all: true, filtered: false, ids: [] };
        }
      }
    }

    const updated = await repo.updateRowsBulk(
      table.id,
      writableFields,
      cleaned,
      userId,
      targetIds,
    );
    return {
      updated,
      all,
      filtered: Boolean(useFilter),
      ids: all ? undefined : targetIds,
    };
  });

/**
 * Patch multiple rows with individual values in batch (used by Bulk Import / paste update).
 * @param {string} examId
 * @param {Array<{ id: string, values: object }>} patches
 * @param {string} userId
 * @param {object} [options]
 */
export const bulkPatchRows = (examId, patches, userId, options = {}) =>
  withMeta(async () => {
    const viewKey = normalizeView(options?.view);
    const { table, fields } = await tableAndViewFields(examId, viewKey);
    const writableFields = writableViewFields(fields, viewKey);
    if (!writableFields.length) throw validationError('No editable columns on this tab');
    const list = Array.isArray(patches) ? patches.filter((p) => p?.id) : [];
    if (!list.length) return { updated: 0 };

    const cleanedPatches = [];
    for (const p of list) {
      const cleaned = cleanRowValues(writableFields, p.values);
      if (Object.keys(cleaned).length > 0) {
        cleanedPatches.push({ id: p.id, values: cleaned });
      }
    }

    if (isOperatorGuardCallingView(viewKey)) {
      const updated = await callingRepo.updateRowsIndividual(
        examId,
        writableFields,
        cleanedPatches,
        userId,
        { chunkSize: 200 },
      );
      return { updated };
    }

    const updated = await repo.updateRowsIndividual(
      table.id,
      writableFields,
      cleanedPatches,
      userId,
      { chunkSize: 200 },
    );
    return { updated };
  });

export const getRowsByIds = (examId, rowIds) =>
  withMeta(async () => {
    const { table, fields } = await tableAndAllFields(examId);
    const ids = (rowIds || []).map(String);
    const fromCalling = await callingRepo.findRowsByIds(examId, fields, ids);
    const found = new Set(fromCalling.map((r) => String(r.id)));
    const rest = ids.filter((id) => !found.has(String(id)));
    const fromShared = rest.length ? await repo.findRowsByIds(table.id, fields, rest) : [];
    return [...fromCalling, ...fromShared];
  });

export const deleteRows = (examId, rowIds) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    const ids = (Array.isArray(rowIds) ? rowIds : [rowIds]).map(String).filter(Boolean);
    if (!ids.length) throw validationError('No rows to delete');
    const callingDeleted = await callingRepo.deleteRows(examId, ids);
    if (callingDeleted) return { success: true, deleted: callingDeleted };
    return { success: true, deleted: await repo.deleteRows(table.id, ids) };
  });

const deletedCount = (res) => {
  if (typeof res === 'number' && Number.isFinite(res)) return res;
  const n = res?.affectedRows ?? res?.deletedCount ?? res?.modifiedCount;
  return Number(n) || 0;
};

/** Bulk delete: `{ all: true, view }` wipes the view's row bag in one Mongo delete. */
export const deleteRowsByScope = (examId, { all = false, view } = {}) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    if (!all) throw validationError('Specify all: true to delete the full table');
    if (isOperatorGuardCallingView(view)) {
      const deleted = deletedCount(await callingRepo.deleteAllForExam(examId));
      return { success: true, deleted, view: OPERATOR_GUARD_CALLING_VIEW };
    }
    const deleted = deletedCount(await repo.deleteAllSharedRows(table.id));
    return { success: true, deleted, view: view || DEFAULT_EXAM_VIEW };
  });

/**
 * Expand / soft-hide Op/Guard Calling rows from Center list (chunked for progress UI).
 * Body/options: { centerOffset, centerLimit } — process a slice of Center rows per request.
 */
export const syncCallingRows = (examId, userId, options = {}) =>
  withMeta(async () => {
    const table = await requireTable(examId);
    const callingView = OPERATOR_GUARD_CALLING_VIEW;
    const callingFields = await repo.listFields(table.id, callingView);
    if (!callingFields.length) {
      throw validationError('Add Op/Guard Calling columns before syncing from Center list');
    }

    const configs = table.viewConfigs || {};
    const callingFeatures = configs[callingView]?.features || null;
    const label = normalizeCallingLabel(callingFeatures?.callingLabel);
    const expand = resolveCallingExpandForLabel(
      callingFeatures?.callingExpand,
      label,
    );
    const centerFeatures =
      configs[DEFAULT_EXAM_VIEW]?.features ?? table.features ?? null;
    const dateShifts = centerFeatures?.dateShifts || null;
    if (!dateShifts || !Array.isArray(dateShifts.dates) || !dateShifts.dates.length) {
      throw validationError(
        'Center list has no exam dates configured (Date shifts). Configure dates before syncing Calling.',
      );
    }
    if (
      expand.mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS &&
      (!Array.isArray(label.categories) || !label.categories.length)
    ) {
      throw validationError(
        'Category expand needs Calling label categories (Male / Female / Baggage…). Configure them on the Calling preset.',
      );
    }

    const centerOffset = Math.max(0, Number(options.centerOffset) || 0);
    const centerLimit = Math.min(
      200,
      Math.max(1, Number(options.centerLimit) || 200),
    );
    const isFirstBatch = centerOffset === 0;

    let legacy = { migrated: 0, deleted: 0 };
    let sortBackfilled = 0;
    if (isFirstBatch) {
      legacy = await callingRepo.migrateLegacyFromExamRows(
        examId,
        callingFields,
        userId,
      );
      await callingRepo.purgeLegacyCallingRowView();
      // One-shot: fill sort_center_code so list order works before every row is re-synced.
      sortBackfilled = await callingRepo.backfillSortCenterCodes(examId);
    }

    const centerFields = await repo.listFields(table.id, DEFAULT_EXAM_VIEW);
    const centersTotal = await repo.countRowsForView(table.id, DEFAULT_EXAM_VIEW);
    const centerRows = await repo.listAllRowValuesForView(
      table.id,
      centerFields,
      DEFAULT_EXAM_VIEW,
      { offset: centerOffset, limit: centerLimit },
    );
    const centersProcessed = Math.min(centersTotal, centerOffset + centerRows.length);
    const isLastBatch = centersProcessed >= centersTotal;

    // Mid batches: only load calling rows for this chunk's centers (avoids re-reading 10k+ docs every request).
    // Last batch: full load so orphan soft-hide can see every existing row.
    const existingCalling = isLastBatch
      ? await callingRepo.listAllLite(examId, callingFields)
      : await callingRepo.listLiteByCenterRowIds(
          examId,
          callingFields,
          centerRows.map((r) => r.id),
        );

    const byKey = new Map();
    existingCalling.forEach((row) => {
      const key =
        row.naturalKey || callingNaturalKeyFromValues(row.values, expand.mode);
      if (key) byKey.set(key, row);
    });

    const copyFromCenter = (centerValues, targetValues) => {
      const out = { ...targetValues };
      callingFields.forEach((f) => {
        if (!f?.key) return;
        if (isSharedImportedField(f) && String(f.sharedFromView) === DEFAULT_EXAM_VIEW) {
          if (Object.prototype.hasOwnProperty.call(centerValues, f.key)) {
            out[f.key] = centerValues[f.key];
          }
        }
      });
      return out;
    };

    const valuesChanged = (prev, next) => {
      const a = prev && typeof prev === 'object' ? prev : {};
      const b = next && typeof next === 'object' ? next : {};
      const keys = new Set([...Object.keys(b)]);
      for (const key of keys) {
        if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return true;
      }
      return false;
    };

    const desiredKeys = new Set();
    const managedCenterDates = new Set();
    const toCreate = [];
    const toUpdate = [];
    let hidden = 0;

    const writable = writableViewFields(callingFields, callingView);
    const writeFields = [...writable];
    if (
      label.targetKey &&
      !writeFields.some((f) => f.key === label.targetKey) &&
      callingFields.some((f) => f.key === label.targetKey)
    ) {
      writeFields.push(callingFields.find((f) => f.key === label.targetKey));
    }

    for (const centerRow of centerRows) {
      const centerValues =
        centerRow.values && typeof centerRow.values === 'object' ? centerRow.values : {};
      const targets = planCallingTargetsForCenterRow({
        centerRow,
        centerFields,
        dateShiftsConfig: dateShifts,
        callingExpand: expand,
        callingLabel: label,
      });

      (Array.isArray(dateShifts.dates) ? dateShifts.dates : []).forEach((d) => {
        const dateId = String(d?.id || '').trim();
        if (!dateId) return;
        managedCenterDates.add(`${String(centerRow.id)}::${dateId}`);
      });

      for (const target of targets) {
        desiredKeys.add(target.key);
        const merged = copyFromCenter(centerValues, target.values);
        const existing = byKey.get(target.key);
        if (!existing) {
          toCreate.push({ values: merged, naturalKey: target.key });
          continue;
        }
        const nextValues = { ...(existing.values || {}) };
        Object.entries(merged).forEach(([k, v]) => {
          nextValues[k] = v;
        });
        const wasHidden = Boolean(
          existing.hidden || existing.values?.[CALLING_HIDDEN_KEY],
        );
        if (merged[CALLING_HIDDEN_KEY] && !wasHidden) hidden += 1;
        if (
          !valuesChanged(existing.values, nextValues) &&
          wasHidden === Boolean(merged[CALLING_HIDDEN_KEY])
        ) {
          continue;
        }
        toUpdate.push({
          id: existing.id,
          values: nextValues,
          naturalKey: target.key,
        });
      }
    }

    // Soft-hide orphans only on the final batch (needs full desired set for processed centers).
    // For correctness across chunks: on last batch, rebuild desired keys for ALL centers.
    if (isLastBatch && centersTotal > 0) {
      const allCenters = await repo.listAllRowValuesForView(
        table.id,
        centerFields,
        DEFAULT_EXAM_VIEW,
      );
      const allDesired = new Set();
      const allManaged = new Set();
      allCenters.forEach((centerRow) => {
        const targets = planCallingTargetsForCenterRow({
          centerRow,
          centerFields,
          dateShiftsConfig: dateShifts,
          callingExpand: expand,
          callingLabel: label,
        });
        targets.forEach((t) => allDesired.add(t.key));
        (Array.isArray(dateShifts.dates) ? dateShifts.dates : []).forEach((d) => {
          const dateId = String(d?.id || '').trim();
          if (!dateId) return;
          allManaged.add(`${String(centerRow.id)}::${dateId}`);
        });
      });

      for (const row of existingCalling) {
        const bag = row.values || {};
        const centerRowId = String(
          row.centerRowId || bag[CALLING_CENTER_ROW_ID_KEY] || '',
        ).trim();
        const dateId = String(row.dateId || bag[CALLING_DATE_ID_KEY] || '').trim();
        if (!centerRowId || !dateId) continue;
        if (!allManaged.has(`${centerRowId}::${dateId}`)) continue;
        const key =
          row.naturalKey || callingNaturalKeyFromValues(bag, expand.mode);
        if (allDesired.has(key)) continue;
        if (row.hidden || bag[CALLING_HIDDEN_KEY] === true) continue;
        toUpdate.push({
          id: row.id,
          values: { ...bag, [CALLING_HIDDEN_KEY]: true },
          naturalKey: key,
        });
        hidden += 1;
      }
    }

    const created = toCreate.length
      ? await callingRepo.insertRowsChunked(examId, writeFields, toCreate, userId)
      : 0;
    const updated = toUpdate.length
      ? await callingRepo.updateRowsIndividual(examId, writeFields, toUpdate, userId)
      : 0;

    const progress =
      centersTotal <= 0
        ? 100
        : Math.min(100, Math.round((centersProcessed / centersTotal) * 100));

    return {
      view: callingView,
      collection: 'exam_calling_rows',
      mode: expand.mode,
      labelMode: label.mode,
      labelTargetKey: label.targetKey,
      created,
      updated,
      hidden,
      legacyMigrated: legacy?.migrated || 0,
      legacyDeleted: legacy?.deleted || 0,
      sortBackfilled: sortBackfilled || 0,
      centersTotal,
      centersProcessed,
      centerOffset,
      centerLimit,
      nextOffset: isLastBatch ? null : centersProcessed,
      done: isLastBatch,
      progress,
      callingTotal: existingCalling.length + created,
    };
  });

/** Called when an exam is deleted so explore metadata/rows are not left behind. */
export const dropTableForExam = async (examId) => {
  await callingRepo.deleteAllForExam(examId);
  await repo.dropTableForExam(examId);
};
