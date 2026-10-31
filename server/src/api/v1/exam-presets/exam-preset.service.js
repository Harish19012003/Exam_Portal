import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import * as repo from './exam-preset.repository.js';
import { cleanFields } from '../exam-tables/exam-table.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Preset not found', 404, ERROR_CODES.NOT_FOUND);
const duplicateService = () =>
  new AppError('A preset for this service already exists', 409, ERROR_CODES.CONFLICT);

const withTable = async (fn) => {
  await repo.ensurePresetTable();
  return fn();
};

const cleanPayload = (body = {}) => {
  const name = String(body.name ?? '').trim();
  const serviceValue = String(body.serviceValue ?? '').trim();
  if (!name || name.length > 120) throw validationError('Preset name is required (max 120 characters)');
  if (!serviceValue || serviceValue.length > 191) throw validationError('Service is required (max 191 characters)');
  const fields = cleanFields(body.fields ?? []);
  let features = null;
  if (body.features != null) {
    if (typeof body.features !== 'object' || Array.isArray(body.features)) throw validationError('features must be an object');
    if (JSON.stringify(body.features).length > 200000) throw validationError('Features are too large');
    features = body.features;
  }
  return { name, serviceValue, fields, features };
};

export const listPresets = () => withTable(() => repo.listPresets());

export const createPreset = (body, userId) =>
  withTable(async () => {
    const payload = cleanPayload(body);
    if (await repo.findByService(payload.serviceValue)) throw duplicateService();
    const id = await repo.insertPreset({ ...payload, createdBy: userId });
    return repo.findById(id);
  });

export const updatePreset = (id, body) =>
  withTable(async () => {
    const payload = cleanPayload(body);
    const same = await repo.findByService(payload.serviceValue);
    if (same && String(same.id) !== String(id)) throw duplicateService();
    if (!(await repo.updatePreset(id, payload))) throw notFound();
    return repo.findById(id);
  });

export const deletePreset = (id) =>
  withTable(async () => {
    if (!(await repo.deletePreset(id))) throw notFound();
    return { success: true, id: String(id) };
  });
