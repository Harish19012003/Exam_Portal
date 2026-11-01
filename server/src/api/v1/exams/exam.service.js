import { randomUUID } from 'crypto';
import * as examRepository from './exam.repository.js';
import * as settingsService from '../settings/settings.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import { dropTableForExam } from '../exam-tables/exam-table.service.js';

const snapshotFields = (fields = []) =>
  (Array.isArray(fields) ? fields : []).map((f, index) => ({
    key: f.key,
    label: f.label,
    dataType: f.dataType,
    autoFill: f.autoFill || 'none',
    order: typeof f.order === 'number' ? f.order : index,
  }));

const loadConfiguredFields = async () => {
  try {
    const config = await settingsService.getExamTableConfig();
    return Array.isArray(config?.fields) ? config.fields : [];
  } catch {
    return [];
  }
};

export const listExams = async () => {
  const fields = await loadConfiguredFields();
  if (fields.length) {
    await examRepository.syncFieldColumns(fields);
    // Best-effort migrate any leftover JSON blobs into columns
    try {
      await examRepository.migrateLegacyJsonRows(fields);
    } catch {
      // ignore
    }
  }
  return examRepository.findAll(fields);
};

export const getExam = async (id) => {
  const fields = await loadConfiguredFields();
  const exam = await examRepository.findById(id, fields);
  if (!exam) {
    throw new AppError('Exam not found', 404, ERROR_CODES.NOT_FOUND);
  }
  return exam;
};

export const createExam = async ({ values, fields, id }, userId) => {
  const examId =
    typeof id === 'string' && id.trim()
      ? id.trim()
      : `exam_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const configured = await loadConfiguredFields();
  const fieldDefs = Array.isArray(fields) && fields.length ? fields : configured;
  const existing = await examRepository.findById(examId, fieldDefs);
  if (existing) {
    throw new AppError('Exam already exists', 409, ERROR_CODES.CONFLICT);
  }

  const exam = await examRepository.create({
    id: examId,
    values: values && typeof values === 'object' ? values : {},
    fields: snapshotFields(fieldDefs),
    createdBy: userId || null,
  });

  // The exam's center list is not created here. An admin loads it from the Center list page,
  // either from the exam's service preset or one they choose, or starts blank.
  return exam;
};

export const updateExam = async (id, { values, fields }, userId) => {
  const configured = await loadConfiguredFields();
  const fieldDefs = Array.isArray(fields) && fields.length ? fields : configured;
  const updated = await examRepository.update(id, {
    values,
    fields: snapshotFields(fieldDefs),
    updatedBy: userId || null,
  });
  if (!updated) {
    throw new AppError('Exam not found', 404, ERROR_CODES.NOT_FOUND);
  }
  return updated;
};

export const deleteExam = async (id) => {
  const ok = await examRepository.remove(id);
  if (!ok) {
    throw new AppError('Exam not found', 404, ERROR_CODES.NOT_FOUND);
  }
  await dropTableForExam(id);
  return { success: true, id };
};

/**
 * Bulk import exams into the database.
 * - Rows with `id` → upsert
 * - Rows without `id` → create (CSV import)
 */
export const importExams = async (exams = [], userId) => {
  const configured = await loadConfiguredFields();
  const list = Array.isArray(exams) ? exams : [];
  let imported = 0;
  for (const row of list) {
    const fieldDefs =
      Array.isArray(row.fields) && row.fields.length ? row.fields : configured;
    const values = row.values && typeof row.values === 'object' ? row.values : {};
    if (row?.id) {
      await examRepository.upsert({
        id: String(row.id),
        values,
        fields: snapshotFields(fieldDefs),
        createdBy: userId || null,
      });
    } else {
      const examId = `exam_${Date.now()}_${randomUUID().slice(0, 8)}`;
      await examRepository.create({
        id: examId,
        values,
        fields: snapshotFields(fieldDefs),
        createdBy: userId || null,
      });
    }
    imported += 1;
  }
  return { imported, total: list.length };
};

/** Ensure SQL columns match published field keys */
export const syncExamColumnsFromConfig = async (fields = []) => {
  const result = await examRepository.syncFieldColumns(fields);
  try {
    await examRepository.migrateLegacyJsonRows(fields);
  } catch {
    // ignore
  }
  return result;
};
