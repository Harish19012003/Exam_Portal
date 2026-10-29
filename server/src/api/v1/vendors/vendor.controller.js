import { successResponse } from '../../../core/response.js';
import * as vendorService from './vendor.service.js';
import * as fieldsService from './vendor-fields.service.js';
import { createFlatTableAccess } from '../shared/flat-table-access.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

const guarded = createFlatTableAccess('vendors', {
  list: () => vendorService.getAllVendors(),
  get: (id) => vendorService.getVendorById(id),
  create: (values) => vendorService.createVendor(values),
  update: (id, values, version) => vendorService.updateVendor(id, values, version),
  remove: (ids) => vendorService.deleteVendors(ids),
  import: (rows) => vendorService.importVendors(rows),
  config: () => fieldsService.getConfig(),
  saveConfig: (body, userId) => fieldsService.saveConfig(body, userId),
});

export const listVendors = handle(guarded.list);
export const getVendor = handle(guarded.get);
export const createVendor = handle(guarded.create, 201);
export const updateVendor = handle(guarded.update);
export const deleteVendors = handle(guarded.remove);
export const importVendors = handle(guarded.import, 201);
export const getConfig = handle(guarded.config);
export const saveConfig = handle(guarded.saveConfig);
