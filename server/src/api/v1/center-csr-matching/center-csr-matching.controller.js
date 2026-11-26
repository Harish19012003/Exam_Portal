import { successResponse } from '../../../core/response.js';
import * as rowService from './center-csr-matching.service.js';
import * as fieldsService from './center-csr-matching-fields.service.js';
import {
  assertTable,
  assertRowVisible,
  assertWritable,
  autoFillKeys,
  rowVisible,
  stripHidden,
  writableValues,
} from '../../../core/access.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

const TABLE = 'center_csr_matching';
const SYSTEM_KEYS = new Set(['id', 'version', 'created_at', 'updated_at', 'exam_id']);

const splitRow = (row) => {
  const system = {};
  const values = {};
  Object.entries(row || {}).forEach(([key, val]) => {
    if (SYSTEM_KEYS.has(key)) system[key] = val;
    else values[key] = val;
  });
  return { system, values };
};

const ruleValues = (row) => ({ ...splitRow(row).values, __id: row?.id });

const forClient = (req, row) => {
  const { system, values } = splitRow(row);
  return { ...system, ...stripHidden(req, TABLE, values) };
};

const examIdFromReq = (req) =>
  String(req.query?.examId || req.body?.examId || req.body?.exam_id || '').trim();

const autoKeys = async () => {
  try {
    return autoFillKeys((await fieldsService.getConfig())?.fields);
  } catch {
    return [];
  }
};

const loadVisible = async (req, id) => {
  const row = await rowService.getRowById(id);
  assertRowVisible(req, TABLE, ruleValues(row));
  return row;
};

/** Rows are scoped per bio exam; field config stays global. */
export const listRows = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  const examId = examIdFromReq(req);
  const rows = await rowService.getAllRows(examId);
  return rows.filter((row) => rowVisible(req, TABLE, ruleValues(row))).map((row) => forClient(req, row));
});

export const getRow = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  return forClient(req, await loadVisible(req, req.params.id));
});

export const createRow = handle(async (req) => {
  assertTable(req, TABLE, 'create');
  const examId = examIdFromReq(req);
  const values = writableValues(req, TABLE, req.body?.values ?? {}, await autoKeys());
  assertRowVisible(req, TABLE, values);
  return forClient(req, await rowService.createRow(values, examId));
}, 201);

export const updateRow = handle(async (req) => {
  assertTable(req, TABLE, 'edit');
  const existing = await loadVisible(req, req.params.id);
  const values = req.body?.values ?? {};
  const previous = splitRow(existing).values;
  assertWritable(req, TABLE, values, previous);
  assertRowVisible(req, TABLE, { ...ruleValues(existing), ...values });
  return forClient(req, await rowService.updateRow(req.params.id, values, req.body?.version));
});

export const deleteRows = handle(async (req) => {
  assertTable(req, TABLE, 'delete');
  const ids = req.body?.ids ?? req.params.id;
  for (const id of Array.isArray(ids) ? ids : [ids]) await loadVisible(req, id);
  return rowService.deleteRows(ids);
});

export const importRows = handle(async (req) => {
  assertTable(req, TABLE, 'import');
  const examId = examIdFromReq(req);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const keys = await autoKeys();
  const prepared = rows.map((row) => {
    const values = writableValues(req, TABLE, row, keys);
    assertRowVisible(req, TABLE, values);
    return values;
  });
  return rowService.importRows(prepared, examId);
}, 201);

export const getConfig = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  return fieldsService.getConfig();
});

export const saveConfig = handle(async (req) => {
  assertTable(req, TABLE, 'configure');
  return fieldsService.saveConfig(req.body, req.user?.id);
});
