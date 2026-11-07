import { AppError } from '../../../core/errors.js';
import { DEFAULT_EXAM_VIEW, ERROR_CODES, examViewLabel, isExamViewKey } from '@exam-view/shared';
import * as repo from './exam-preset.repository.js';
import { cleanFields } from '../exam-tables/exam-table.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);
const notFound = () => new AppError('Preset not found', 404, ERROR_CODES.NOT_FOUND);
const duplicatePair = (serviceValue, view) =>
  new AppError(
    `A preset for “${serviceValue}” on ${examViewLabel(view)} already exists`,
    409,
    ERROR_CODES.CONFLICT,
  );

const withTable = async (fn) => {
  await repo.ensurePresetTable();
  return fn();
};

const cleanPayload = (body = {}) => {
  const name = String(body.name ?? '').trim();
  const serviceValue = String(body.serviceValue ?? '').trim();
  const viewRaw = String(body.view ?? DEFAULT_EXAM_VIEW).trim() || DEFAULT_EXAM_VIEW;
  if (!name || name.length > 120) throw validationError('Preset name is required (max 120 characters)');
  if (!serviceValue || serviceValue.length > 191) throw validationError('Service is required (max 191 characters)');
  if (!isExamViewKey(viewRaw)) throw validationError(`Unknown exam page: "${viewRaw}"`);
  const fields = cleanFields(body.fields ?? []);
  let features = null;
  if (body.features != null) {
    if (typeof body.features !== 'object' || Array.isArray(body.features)) throw validationError('features must be an object');
    if (JSON.stringify(body.features).length > 200000) throw validationError('Features are too large');
    features = body.features;
  }
  return { name, serviceValue, view: viewRaw, fields, features };
};

export const listPresets = () => withTable(() => repo.listPresets());

export const createPreset = (body, userId) =>
  withTable(async () => {
    const payload = cleanPayload(body);
    if (await repo.findByServiceAndView(payload.serviceValue, payload.view)) {
      throw duplicatePair(payload.serviceValue, payload.view);
    }
    const id = await repo.insertPreset({ ...payload, createdBy: userId });
    return repo.findById(id);
  });

export const updatePreset = (id, body) =>
  withTable(async () => {
    const payload = cleanPayload(body);
    const same = await repo.findByServiceAndView(payload.serviceValue, payload.view);
    if (same && String(same.id) !== String(id)) throw duplicatePair(payload.serviceValue, payload.view);
    if (!(await repo.updatePreset(id, payload))) throw notFound();
    return repo.findById(id);
  });

export const deletePreset = (id) =>
  withTable(async () => {
    if (!(await repo.deletePreset(id))) throw notFound();
    return { success: true, id: String(id) };
  });

/**
 * Bulk import: same service + page replaces the existing preset (keeps its id).
 * Body: `{ presets: [{ name, serviceValue, view, fields, features? }, ...] }`
 */
export const bulkUpsert = (body, userId) =>
  withTable(async () => {
    const items = Array.isArray(body?.presets) ? body.presets : null;
    if (!items || items.length === 0) throw validationError('presets must be a non-empty array');
    if (items.length > 200) throw validationError('At most 200 presets per import');
    const results = [];
    for (const item of items) {
      const payload = cleanPayload(item);
      const existing = await repo.findByServiceAndView(payload.serviceValue, payload.view);
      if (existing) {
        await repo.updatePreset(existing.id, payload);
        results.push(await repo.findById(existing.id));
      } else {
        const id = await repo.insertPreset({ ...payload, createdBy: userId });
        results.push(await repo.findById(id));
      }
    }
    return results;
  });
