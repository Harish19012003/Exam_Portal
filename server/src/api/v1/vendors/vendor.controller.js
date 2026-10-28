import { successResponse } from '../../../core/response.js';
import * as vendorService from './vendor.service.js';
import * as fieldsService from './vendor-fields.service.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const listVendors = handle(() => vendorService.getAllVendors());
export const getVendor = handle((req) => vendorService.getVendorById(req.params.id));
export const createVendor = handle((req) => vendorService.createVendor(req.body?.values ?? {}), 201);
export const updateVendor = handle((req) =>
  vendorService.updateVendor(req.params.id, req.body?.values ?? {}, req.body?.version),
);
export const deleteVendors = handle((req) => vendorService.deleteVendors(req.body?.ids ?? req.params.id));
export const importVendors = handle((req) => vendorService.importVendors(req.body?.rows), 201);
export const getConfig = handle(() => fieldsService.getConfig());
export const saveConfig = handle((req) => fieldsService.saveConfig(req.body, req.user?.id));
