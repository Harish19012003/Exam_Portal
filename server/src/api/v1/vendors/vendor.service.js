import { vendorRepository } from './vendor.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/**
 * Get all vendors
 * @param {object} queryOptions
 */
export async function getAllVendors(queryOptions) {
  return vendorRepository.findAll(queryOptions);
}

/**
 * Get a vendor by vendor_code
 * @param {string} vendorCode
 */
export async function getVendorByCode(vendorCode) {
  const vendor = await vendorRepository.findByCode(vendorCode);
  if (!vendor) {
    throw new AppError(`Vendor '${vendorCode}' not found`, 404, ERROR_CODES.NOT_FOUND);
  }
  return vendor;
}

/**
 * Create a new vendor
 * @param {object} vendorData
 */
export async function createVendor(vendorData) {
  const existing = await vendorRepository.findByCode(vendorData.vendor_code);
  if (existing) {
    throw new AppError(
      `Vendor with code '${vendorData.vendor_code}' already exists`,
      409,
      ERROR_CODES.CONFLICT
    );
  }

  await vendorRepository.create(vendorData);
  return vendorRepository.findByCode(vendorData.vendor_code);
}

/**
 * Update an existing vendor
 * @param {string} vendorCode
 * @param {object} updateData
 */
export async function updateVendor(vendorCode, updateData) {
  const existing = await getVendorByCode(vendorCode);
  const version = updateData.version !== undefined ? updateData.version : existing.version;
  delete updateData.version;

  await vendorRepository.update(vendorCode, updateData, version);
  return vendorRepository.findByCode(vendorCode);
}

/**
 * Delete a vendor
 * @param {string} vendorCode
 */
export async function deleteVendor(vendorCode) {
  await getVendorByCode(vendorCode);
  await vendorRepository.delete(vendorCode);
  return { success: true, message: `Vendor '${vendorCode}' deleted successfully` };
}

/**
 * Bulk seed or import vendors into MySQL
 * @param {Array<object>} vendors
 */
export async function seedVendors(vendors) {
  const count = await vendorRepository.bulkUpsert(vendors);
  return { success: true, count, message: `${count} vendors stored in MySQL database` };
}
