import { AppError } from '../../../core/errors.js';
import {
  DEFAULT_DEVICE_MASTER_VIEW,
  ERROR_CODES,
  deviceMasterViewLabel,
  isDeviceMasterViewKey,
} from '@exam-view/shared';
import * as repo from './device-preset.repository.js';
import { cleanFields } from '../exam-tables/exam-table.service.js';
import { CENTER_CSR_FIXED_KEY_SET } from '../center-csr-matching/fixedFields.js';
import {
  DEVICE_REPORT_FIXED_KEY_SET,
  isDeviceReportFixedView,
} from '../devices/deviceReportFixedFields.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Preset not found', 404, ERROR_CODES.NOT_FOUND);
const duplicatePair = (name, view) =>
  new AppError(
    `A preset named “${name}” already exists for ${deviceMasterViewLabel(view)}`,
    409,
    ERROR_CODES.CONFLICT,
  );

/** Presets store only extra fields — fixed columns stay hardcoded per tab type. */
const sanitizeFieldsForView = (view, fields) => {
  const cleaned = cleanFields(fields ?? []);
  if (view === 'center-csr-matching') {
    return cleaned.filter((f) => f?.key && !CENTER_CSR_FIXED_KEY_SET.has(f.key));
  }
  if (isDeviceReportFixedView(view)) {
    return cleaned.filter((f) => f?.key && !DEVICE_REPORT_FIXED_KEY_SET.has(f.key));
  }
  return cleaned;
};

const cleanPayload = (body = {}) => {
  const name = String(body.name ?? '').trim();
  const viewRaw = String(body.view ?? DEFAULT_DEVICE_MASTER_VIEW).trim() || DEFAULT_DEVICE_MASTER_VIEW;
  if (!name || name.length > 120) throw validationError('Preset name is required (max 120 characters)');
  if (!isDeviceMasterViewKey(viewRaw)) throw validationError(`Unknown Device Master page: "${viewRaw}"`);
  const fields = sanitizeFieldsForView(viewRaw, body.fields);
  let features = null;
  if (body.features != null) {
    if (typeof body.features !== 'object' || Array.isArray(body.features)) {
      throw validationError('features must be an object');
    }
    if (JSON.stringify(body.features).length > 200000) throw validationError('Features are too large');
    features = body.features;
  }
  let layout;
  if (body.layout !== undefined) {
    if (body.layout === null) layout = null;
    else {
      if (typeof body.layout !== 'object' || Array.isArray(body.layout)) {
        throw validationError('layout must be an object');
      }
      if (JSON.stringify(body.layout).length > 200000) throw validationError('Layout is too large');
      layout = body.layout;
    }
  }
  return { name, view: viewRaw, fields, features, layout };
};

export const listPresets = () => repo.listPresets();

export const createPreset = async (body, userId) => {
  const payload = cleanPayload(body);
  if (await repo.findByViewAndName(payload.view, payload.name)) {
    throw duplicatePair(payload.name, payload.view);
  }
  const id = await repo.insertPreset({ ...payload, createdBy: userId });
  return repo.findById(id);
};

export const updatePreset = async (id, body) => {
  const payload = cleanPayload(body);
  const same = await repo.findByViewAndName(payload.view, payload.name);
  if (same && String(same.id) !== String(id)) throw duplicatePair(payload.name, payload.view);
  if (!(await repo.updatePreset(id, payload))) throw notFound();
  return repo.findById(id);
};

export const deletePreset = async (id) => {
  if (!(await repo.deletePreset(id))) throw notFound();
  return { success: true, id: String(id) };
};

/** Bulk import: same view + name replaces the existing preset. */
export const bulkUpsert = async (body, userId) => {
  const items = Array.isArray(body?.presets) ? body.presets : null;
  if (!items || items.length === 0) throw validationError('presets must be a non-empty array');
  if (items.length > 200) throw validationError('At most 200 presets per import');
  const results = [];
  for (const item of items) {
    const payload = cleanPayload(item);
    const existing = await repo.findByViewAndName(payload.view, payload.name);
    if (existing) {
      await repo.updatePreset(existing.id, payload);
      results.push(await repo.findById(existing.id));
    } else {
      const id = await repo.insertPreset({ ...payload, createdBy: userId });
      results.push(await repo.findById(id));
    }
  }
  return results;
};
