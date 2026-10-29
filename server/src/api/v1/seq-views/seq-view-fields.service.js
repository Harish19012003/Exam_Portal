import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { cleanFields, cleanRowValues } from '../exam-tables/exam-table.service.js';
import { effectiveType } from '../exam-tables/exam-table.repository.js';
import { decodeCellValue, encodeCellValue } from '../exams/exam.repository.js';
import { seqViewRepository } from './seq-view.repository.js';
import { assertCanBecomeUnique } from '../shared/unique-fields.js';
import * as repo from './seq-view-fields.repository.js';

const MAX_FEATURES_BYTES = 200000;

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

/** Custom field definitions for the SeqView table. */
export const getCustomFields = async () => repo.listFields();

export const getConfig = async () => ({
  fields: await repo.listFields(),
  features: await repo.getFeatures(),
});

export const saveConfig = async (body = {}, userId) => {
  const current = await repo.listFields();

  if (body.fields !== undefined) {
    const fields = cleanFields(body.fields);
    const clash = fields.find((f) => repo.SEQ_VIEW_RESERVED_KEYS.includes(f.key));
    if (clash) throw validationError(`"${clash.key}" is reserved and cannot be used as a field key`);

    const newlyUnique = fields.filter((f) => f.unique === true && !current.some((c) => c.key === f.key && c.unique === true));
    if (newlyUnique.length) {
      const rows = await seqViewRepository.findAll();
      newlyUnique.forEach((f) => assertCanBecomeUnique(f, rows));
    }

    const keys = new Set(fields.map((f) => f.key));
    const removed = current.filter((f) => !keys.has(f.key)).map((f) => f.key);
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
      throw validationError(`Could not update SeqView fields: ${error.message}`);
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

/** Validated + encoded values for the custom columns present in `input`; core keys are not touched. */
export const pickCustomValues = (fields, input) => {
  const clean = cleanRowValues(fields, input);
  const out = {};
  fields.forEach((f) => {
    if (f.key in clean) out[f.key] = encodeCellValue(clean[f.key], effectiveType(f));
  });
  return out;
};

/** Turn stored custom column values (JSON text, tinyint, …) back into what the table editors expect. */
export const decodeSeqView = (row, fields) => {
  if (!row || !fields.length) return row;
  const out = { ...row };
  fields.forEach((f) => {
    if (f.key in out) out[f.key] = decodeCellValue(out[f.key], effectiveType(f));
  });
  return out;
};
