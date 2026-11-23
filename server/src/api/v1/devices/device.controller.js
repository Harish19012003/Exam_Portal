import { successResponse } from '../../../core/response.js';
import * as deviceService from './device.service.js';
import * as fieldsService from './device-fields.service.js';
import * as apiService from './device-api.service.js';
import { createFlatTableAccess } from '../shared/flat-table-access.js';
import { assertTable } from '../../../core/access.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

const TABLE = 'devices';

const guarded = createFlatTableAccess(TABLE, {
  list: () => deviceService.getAllDevices(),
  get: (id) => deviceService.getDeviceById(id),
  create: (values) => deviceService.createDevice(values),
  update: (id, values, version) => deviceService.updateDevice(id, values, version),
  remove: (ids) => deviceService.deleteDevices(ids),
  import: (rows) => deviceService.importDevices(rows),
  config: () => fieldsService.getConfig(),
  saveConfig: (body, userId) => fieldsService.saveConfig(body, userId),
});

/** External API sync replaces table data, so it needs the configure right. */
const configureOnly = (fn) => (req) => {
  assertTable(req, TABLE, 'configure');
  return fn(req);
};

export const listDevices = handle(guarded.list);
export const getDevice = handle(guarded.get);
export const createDevice = handle(guarded.create, 201);
export const updateDevice = handle(guarded.update);
export const deleteDevices = handle(guarded.remove);
export const importDevices = handle(guarded.import, 201);
export const getConfig = handle(guarded.config);
export const saveConfig = handle(guarded.saveConfig);
export const getApiConfig = handle(configureOnly(() => apiService.getApiConfig()));
export const saveApiConfig = handle(configureOnly((req) => apiService.saveApiConfig(req.body, req.user?.id)));
export const testApiConfig = handle(configureOnly((req) => apiService.testApiConfig(req.body)));
export const syncFromApi = handle(configureOnly((req) => apiService.syncFromApi(req.body?.confirmReplace === true)));
