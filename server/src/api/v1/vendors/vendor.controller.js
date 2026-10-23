import { successResponse } from '../../../core/response.js';
import * as vendorService from './vendor.service.js';
import { vendorCreateSchema, vendorUpdateSchema } from './vendor.validation.js';

export const listVendors = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const vendors = await vendorService.getAllVendors({ search, status });
    return successResponse(res, vendors, 200);
  } catch (error) {
    next(error);
  }
};

export const getVendor = async (req, res, next) => {
  try {
    const { vendorCode } = req.params;
    const vendor = await vendorService.getVendorByCode(vendorCode);
    return successResponse(res, vendor, 200);
  } catch (error) {
    next(error);
  }
};

export const createVendor = async (req, res, next) => {
  try {
    const validated = vendorCreateSchema.parse(req.body);
    const vendor = await vendorService.createVendor(validated);
    return successResponse(res, vendor, 201);
  } catch (error) {
    next(error);
  }
};

export const updateVendor = async (req, res, next) => {
  try {
    const { vendorCode } = req.params;
    const validated = vendorUpdateSchema.parse(req.body);
    const vendor = await vendorService.updateVendor(vendorCode, validated);
    return successResponse(res, vendor, 200);
  } catch (error) {
    next(error);
  }
};

export const deleteVendor = async (req, res, next) => {
  try {
    const { vendorCode } = req.params;
    const result = await vendorService.deleteVendor(vendorCode);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const seedVendors = async (req, res, next) => {
  try {
    const vendors = Array.isArray(req.body.vendors) ? req.body.vendors : req.body;
    const result = await vendorService.seedVendors(vendors);
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
};
