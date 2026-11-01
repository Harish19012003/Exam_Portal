import { vendorRepository } from './vendor.repository.js';
import { assertUniqueBatch, assertUniqueValues } from '../shared/unique-fields.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { decodeVendor, getCustomFields, pickCustomValues } from './vendor-fields.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

// Vendor ids are MongoDB ObjectIds (24 hex characters), kept as strings end to end.
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const toId = (value) => {
  const id = String(value ?? '').trim();
  if (!OBJECT_ID.test(id)) throw validationError('Invalid vendor id');
  return id;
};

const isBlank = (v) => v === undefined || v === null || v === '';

/** Validate + encode one vendor's custom values; `partial` skips the required check (updates). */
const prepare = (fields, input, { partial = false, prefix = '' } = {}) => {
  let values;
  try {
    values = pickCustomValues(fields, input);
  } catch (error) {
    throw error instanceof AppError ? validationError(`${prefix}${error.message}`) : error;
  }
  if (!partial) {
    const missing = fields.find((f) => f.required && isBlank(values[f.key]));
    if (missing) throw validationError(`${prefix}${missing.label} is required`);
  }
  return values;
};

const requireFields = (fields) => {
  if (!fields.length) throw validationError('Add at least one vendor field before adding vendors');
};

export async function getAllVendors() {
  const [rows, fields] = await Promise.all([vendorRepository.findAll(), getCustomFields()]);
  return rows.map((row) => decodeVendor(row, fields));
}

export async function getVendorById(id) {
  const vendor = await vendorRepository.findById(toId(id));
  if (!vendor) throw new AppError('Vendor not found', 404, ERROR_CODES.NOT_FOUND);
  return decodeVendor(vendor, await getCustomFields());
}

export async function createVendor(input) {
  const fields = await getCustomFields();
  requireFields(fields);
  const values = prepare(fields, input);
  assertUniqueValues(fields, values, await vendorRepository.findAll());
  const id = await vendorRepository.create(values);
  return getVendorById(id);
}

export async function updateVendor(id, input, version) {
  const fields = await getCustomFields();
  const vendorId = toId(id);
  const values = prepare(fields, input, { partial: true });
  assertUniqueValues(fields, values, await vendorRepository.findAll(), { excludeId: vendorId });
  await vendorRepository.update(vendorId, values, version);
  return getVendorById(vendorId);
}

export async function deleteVendors(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map((v) => String(v ?? '').trim()).filter((v) => OBJECT_ID.test(v)))];
  if (!list.length) throw validationError('No vendors to delete');
  return { success: true, deleted: await vendorRepository.deleteMany(list) };
}

/** Rows are objects keyed by field key. All-or-nothing; errors name the offending row. */
export async function importVendors(rows, { ignoreExisting = false } = {}) {
  const fields = await getCustomFields();
  requireFields(fields);
  if (!Array.isArray(rows) || !rows.length) throw validationError('No rows to import');

  const prepared = rows.map((row, i) => prepare(fields, row, { prefix: `Row ${i + 1}: ` }));
  assertUniqueBatch(fields, prepared, await vendorRepository.findAll(), { ignoreExisting });
  const count = await vendorRepository.createMany(prepared);
  return { success: true, count };
}
