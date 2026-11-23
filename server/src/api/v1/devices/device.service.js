import { deviceRepository } from './device.repository.js';
import { assertUniqueBatch, assertUniqueValues } from '../shared/unique-fields.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { decodeDevice, getCustomFields, pickCustomValues } from './device-fields.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

// Device ids are MongoDB ObjectIds (24 hex characters), kept as strings end to end.
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const toId = (value) => {
  const id = String(value ?? '').trim();
  if (!OBJECT_ID.test(id)) throw validationError('Invalid device id');
  return id;
};

const isBlank = (v) => v === undefined || v === null || v === '';

/** Validate + encode one device's custom values; `partial` skips the required check (updates). */
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
  if (!fields.length) throw validationError('Add at least one device field before adding devices');
};

export async function getAllDevices() {
  const [rows, fields] = await Promise.all([deviceRepository.findAll(), getCustomFields()]);
  return rows.map((row) => decodeDevice(row, fields));
}

export async function getDeviceById(id) {
  const device = await deviceRepository.findById(toId(id));
  if (!device) throw new AppError('Device not found', 404, ERROR_CODES.NOT_FOUND);
  return decodeDevice(device, await getCustomFields());
}

export async function createDevice(input) {
  const fields = await getCustomFields();
  requireFields(fields);
  const values = prepare(fields, input);
  assertUniqueValues(fields, values, await deviceRepository.findAll());
  const id = await deviceRepository.create(values);
  return getDeviceById(id);
}

export async function updateDevice(id, input, version) {
  const fields = await getCustomFields();
  const deviceId = toId(id);
  const values = prepare(fields, input, { partial: true });
  assertUniqueValues(fields, values, await deviceRepository.findAll(), { excludeId: deviceId });
  await deviceRepository.update(deviceId, values, version);
  return getDeviceById(deviceId);
}

export async function deleteDevices(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map((v) => String(v ?? '').trim()).filter((v) => OBJECT_ID.test(v)))];
  if (!list.length) throw validationError('No devices to delete');
  return { success: true, deleted: await deviceRepository.deleteMany(list) };
}

/** Rows are objects keyed by field key. All-or-nothing; errors name the offending row. */
export async function importDevices(rows, { ignoreExisting = false } = {}) {
  const fields = await getCustomFields();
  requireFields(fields);
  if (!Array.isArray(rows) || !rows.length) throw validationError('No rows to import');

  const prepared = rows.map((row, i) => prepare(fields, row, { prefix: `Row ${i + 1}: ` }));
  assertUniqueBatch(fields, prepared, await deviceRepository.findAll(), { ignoreExisting });
  const count = await deviceRepository.createMany(prepared);
  return { success: true, count };
}
