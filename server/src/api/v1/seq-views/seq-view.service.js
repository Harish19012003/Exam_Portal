import { seqViewRepository } from './seq-view.repository.js';
import { assertUniqueBatch, assertUniqueValues } from '../shared/unique-fields.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { decodeSeqView, getCustomFields, pickCustomValues } from './seq-view-fields.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

// SeqView ids are MongoDB ObjectIds (24 hex characters), kept as strings end to end.
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const toId = (value) => {
  const id = String(value ?? '').trim();
  if (!OBJECT_ID.test(id)) throw validationError('Invalid SeqView id');
  return id;
};

const isBlank = (v) => v === undefined || v === null || v === '';

/** Validate + encode one SeqView's custom values; `partial` skips the required check (updates). */
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
  if (!fields.length) throw validationError('Add at least one SeqView field before adding SeqViews');
};

export async function getAllSeqViews() {
  const [rows, fields] = await Promise.all([seqViewRepository.findAll(), getCustomFields()]);
  return rows.map((row) => decodeSeqView(row, fields));
}

export async function getSeqViewById(id) {
  const seqView = await seqViewRepository.findById(toId(id));
  if (!seqView) throw new AppError('SeqView not found', 404, ERROR_CODES.NOT_FOUND);
  return decodeSeqView(seqView, await getCustomFields());
}

export async function createSeqView(input) {
  const fields = await getCustomFields();
  requireFields(fields);
  const values = prepare(fields, input);
  assertUniqueValues(fields, values, await seqViewRepository.findAll());
  const id = await seqViewRepository.create(values);
  return getSeqViewById(id);
}

export async function updateSeqView(id, input, version) {
  const fields = await getCustomFields();
  const seqViewId = toId(id);
  const values = prepare(fields, input, { partial: true });
  assertUniqueValues(fields, values, await seqViewRepository.findAll(), { excludeId: seqViewId });
  await seqViewRepository.update(seqViewId, values, version);
  return getSeqViewById(seqViewId);
}

export async function deleteSeqViews(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map((v) => String(v ?? '').trim()).filter((v) => OBJECT_ID.test(v)))];
  if (!list.length) throw validationError('No SeqViews to delete');
  return { success: true, deleted: await seqViewRepository.deleteMany(list) };
}

/** Rows are objects keyed by field key. All-or-nothing; errors name the offending row. */
export async function importSeqViews(rows, { ignoreExisting = false } = {}) {
  const fields = await getCustomFields();
  requireFields(fields);
  if (!Array.isArray(rows) || !rows.length) throw validationError('No rows to import');

  const prepared = rows.map((row, i) => prepare(fields, row, { prefix: `Row ${i + 1}: ` }));
  assertUniqueBatch(fields, prepared, await seqViewRepository.findAll(), { ignoreExisting });
  const count = await seqViewRepository.createMany(prepared);
  return { success: true, count };
}
