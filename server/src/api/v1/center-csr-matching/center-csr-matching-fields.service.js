import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { cleanFields, cleanRowValues } from '../exam-tables/exam-table.service.js';
import { effectiveType } from '../exam-tables/exam-table.repository.js';
import { decodeCellValue, encodeCellValue } from '../exams/exam.repository.js';
import { centerCsrMatchingRepository } from './center-csr-matching.repository.js';
import { assertCanBecomeUnique } from '../shared/unique-fields.js';
import * as repo from './center-csr-matching-fields.repository.js';
import { CENTER_CSR_FIXED_KEY_SET, stripFixedFields, withHardcodedFixedFields } from './fixedFields.js';

const MAX_FEATURES_BYTES = 200000;

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

export const getCustomFields = async () => repo.listFields();

export const getConfig = async () => ({
  fields: await repo.listFields(),
  features: await repo.getFeatures(),
});

export const saveConfig = async (body = {}, userId) => {
  const current = await repo.listFields();

  if (body.fields !== undefined) {
    const cleaned = cleanFields(body.fields);
    // System keys only — fixed business keys are stripped below, not treated as custom.
    const systemClash = cleaned.find((f) =>
      ['id', 'version', 'created_at', 'updated_at', 'exam_id', 'values', '_id'].includes(f.key),
    );
    if (systemClash) {
      throw validationError(`"${systemClash.key}" is reserved and cannot be used as a field key`);
    }

    // Someone tried to invent a custom field that reuses a hardcoded key (not the hardcoded def itself).
    const spoofed = cleaned.filter(
      (f) => CENTER_CSR_FIXED_KEY_SET.has(f.key) && !String(f.id || '').startsWith('fixed_'),
    );
    if (spoofed.length) {
      throw validationError(
        `Keys are hardcoded and cannot be used for custom fields: ${spoofed.map((f) => f.key).join(', ')}`,
      );
    }

    const extras = stripFixedFields(cleaned);
    const fields = withHardcodedFixedFields(extras);

    const newlyUnique = extras.filter(
      (f) => f.unique === true && !current.some((c) => c.key === f.key && c.unique === true),
    );
    if (newlyUnique.length) {
      const rows = await centerCsrMatchingRepository.findAll();
      newlyUnique.forEach((f) => assertCanBecomeUnique(f, rows));
    }

    const currentExtras = stripFixedFields(current);
    const nextKeys = new Set(extras.map((f) => f.key));
    const removed = currentExtras.filter((f) => !nextKeys.has(f.key)).map((f) => f.key);
    if (removed.length && body.confirmDrops !== true) {
      throw new AppError(
        `Removing fields deletes their data permanently. Confirm to remove: ${removed.join(', ')}`,
        409,
        ERROR_CODES.CONFLICT,
      );
    }
    try {
      await repo.applyFields(fields);
    } catch (error) {
      throw validationError(`Could not update Center-CSR-Matching fields: ${error.message}`);
    }
  }

  if (body.features !== undefined) {
    if (!body.features || typeof body.features !== 'object' || Array.isArray(body.features)) {
      throw validationError('features must be an object');
    }
    if (JSON.stringify(body.features).length > MAX_FEATURES_BYTES) throw validationError('Features are too large');
    await repo.saveFeatures(body.features, userId);
  }
  return getConfig();
};

export const pickCustomValues = (fields, input) => {
  const clean = cleanRowValues(fields, input);
  const out = {};
  fields.forEach((f) => {
    if (f.key in clean) out[f.key] = encodeCellValue(clean[f.key], effectiveType(f));
  });
  return out;
};

export const decodeRow = (row, fields) => {
  if (!row || !fields.length) return row;
  const out = { ...row };
  fields.forEach((f) => {
    if (f.key in out) out[f.key] = decodeCellValue(out[f.key], effectiveType(f));
  });
  return out;
};
