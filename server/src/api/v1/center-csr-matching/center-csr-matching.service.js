import { centerCsrMatchingRepository } from './center-csr-matching.repository.js';
import { assertUniqueBatch, assertUniqueValues } from '../shared/unique-fields.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { decodeRow, getCustomFields, pickCustomValues } from './center-csr-matching-fields.service.js';

const validationError = (message) => new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR);

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const toId = (value) => {
  const id = String(value ?? '').trim();
  if (!OBJECT_ID.test(id)) throw validationError('Invalid row id');
  return id;
};

const toExamId = (value) => {
  // Exam primary keys are string ids (e.g. exam_<ts>_<uuid>), not Mongo ObjectIds.
  const id = String(value ?? '').trim();
  if (!id) throw validationError('examId is required');
  return id;
};

const isBlank = (v) => v === undefined || v === null || v === '';

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
  if (!fields.length) {
    throw validationError('Add at least one Center-CSR-Matching field before adding rows');
  }
};

export async function getAllRows(examId) {
  const id = toExamId(examId);
  const [rows, fields] = await Promise.all([
    centerCsrMatchingRepository.findByExamId(id),
    getCustomFields(),
  ]);
  return rows.map((row) => decodeRow(row, fields));
}

export async function getRowById(id) {
  const row = await centerCsrMatchingRepository.findById(toId(id));
  if (!row) throw new AppError('Center-CSR-Matching row not found', 404, ERROR_CODES.NOT_FOUND);
  return decodeRow(row, await getCustomFields());
}

export async function createRow(input, examId) {
  const fields = await getCustomFields();
  requireFields(fields);
  const scopedExamId = toExamId(examId);
  const values = prepare(fields, input);
  assertUniqueValues(fields, values, await centerCsrMatchingRepository.findByExamId(scopedExamId));
  const id = await centerCsrMatchingRepository.create({ ...values, exam_id: scopedExamId });
  return getRowById(id);
}

export async function updateRow(id, input, version) {
  const fields = await getCustomFields();
  const rowId = toId(id);
  const existing = await centerCsrMatchingRepository.findById(rowId);
  if (!existing) throw new AppError('Center-CSR-Matching row not found', 404, ERROR_CODES.NOT_FOUND);
  const values = prepare(fields, input, { partial: true });
  const scopeId = String(existing.exam_id || '').trim();
  const siblings = scopeId
    ? await centerCsrMatchingRepository.findByExamId(scopeId)
    : [];
  assertUniqueValues(fields, values, siblings, { excludeId: rowId });
  await centerCsrMatchingRepository.update(rowId, values, version);
  return getRowById(rowId);
}

export async function deleteRows(ids) {
  const list = [
    ...new Set(
      (Array.isArray(ids) ? ids : [ids])
        .map((v) => String(v ?? '').trim())
        .filter((v) => OBJECT_ID.test(v)),
    ),
  ];
  if (!list.length) throw validationError('No rows to delete');
  return { success: true, deleted: await centerCsrMatchingRepository.deleteMany(list) };
}

export async function importRows(rows, examId, { ignoreExisting = false } = {}) {
  const fields = await getCustomFields();
  requireFields(fields);
  const scopedExamId = toExamId(examId);
  if (!Array.isArray(rows) || !rows.length) throw validationError('No rows to import');

  const prepared = rows.map((row, i) => prepare(fields, row, { prefix: `Row ${i + 1}: ` }));
  assertUniqueBatch(
    fields,
    prepared,
    await centerCsrMatchingRepository.findByExamId(scopedExamId),
    { ignoreExisting },
  );
  const stamped = prepared.map((row) => ({ ...row, exam_id: scopedExamId }));
  const count = await centerCsrMatchingRepository.createMany(stamped);
  return { success: true, count };
}
