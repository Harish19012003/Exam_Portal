import { successResponse } from '../../../core/response.js';
import * as deviceService from './device.service.js';
import * as fieldsService from './device-fields.service.js';
import * as apiService from './device-api.service.js';
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

const TABLE = 'devices';
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
  const row = await deviceService.getDeviceById(id);
  assertRowVisible(req, TABLE, ruleValues(row));
  return row;
};

/** Config stays global; Param rows are scoped per bio exam. */
export const listDevices = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  const examId = examIdFromReq(req);
  const rows = await deviceService.getAllDevices(examId);
  return rows.filter((row) => rowVisible(req, TABLE, ruleValues(row))).map((row) => forClient(req, row));
});

export const getDevice = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  return forClient(req, await loadVisible(req, req.params.id));
});

export const createDevice = handle(async (req) => {
  assertTable(req, TABLE, 'create');
  const examId = examIdFromReq(req);
  const values = writableValues(req, TABLE, req.body?.values ?? {}, await autoKeys());
  assertRowVisible(req, TABLE, values);
  return forClient(req, await deviceService.createDevice(values, examId));
}, 201);

export const updateDevice = handle(async (req) => {
  assertTable(req, TABLE, 'edit');
  const existing = await loadVisible(req, req.params.id);
  const values = req.body?.values ?? {};
  const previous = splitRow(existing).values;
  assertWritable(req, TABLE, values, previous);
  assertRowVisible(req, TABLE, { ...ruleValues(existing), ...values });
  return forClient(req, await deviceService.updateDevice(req.params.id, values, req.body?.version));
});

export const deleteDevices = handle(async (req) => {
  assertTable(req, TABLE, 'delete');
  const ids = req.body?.ids ?? req.params.id;
  for (const id of Array.isArray(ids) ? ids : [ids]) await loadVisible(req, id);
  return deviceService.deleteDevices(ids);
});

export const importDevices = handle(async (req) => {
  assertTable(req, TABLE, 'import');
  const examId = examIdFromReq(req);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const keys = await autoKeys();
  const prepared = rows.map((row) => {
    const values = writableValues(req, TABLE, row, keys);
    assertRowVisible(req, TABLE, values);
    return values;
  });
  return deviceService.importDevices(prepared, examId);
}, 201);

export const getConfig = handle(async (req) => {
  assertTable(req, TABLE, 'view');
  return fieldsService.getConfig();
});

export const saveConfig = handle(async (req) => {
  assertTable(req, TABLE, 'configure');
  return fieldsService.saveConfig(req.body, req.user?.id);
});

/** External API sync replaces table data for one exam, so it needs the configure right. */
const configureOnly = (fn) => async (req) => {
  assertTable(req, TABLE, 'configure');
  return fn(req);
};

const viewFromReq = (req) =>
  String(req.query?.view || req.body?.view || 'devices').trim() || 'devices';

export const getApiConfig = handle(configureOnly((req) => apiService.getApiConfig(viewFromReq(req))));
export const saveApiConfig = handle(
  configureOnly((req) => apiService.saveApiConfig(req.body, req.user?.id, viewFromReq(req))),
);
export const testApiConfig = handle(
  configureOnly((req) => apiService.testApiConfig(req.body, viewFromReq(req), examIdFromReq(req))),
);
export const syncFromApi = handle(
  configureOnly((req) =>
    apiService.syncFromApi(
      req.body?.confirmReplace === true,
      'manual',
      examIdFromReq(req),
      viewFromReq(req),
    ),
  ),
);
