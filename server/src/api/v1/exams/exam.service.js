import { randomUUID } from 'crypto';
import * as examRepository from './exam.repository.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

const snapshotFields = (fields = []) =>
  (Array.isArray(fields) ? fields : []).map((f, index) => ({
    key: f.key,
    label: f.label,
    dataType: f.dataType,
    autoFill: f.autoFill || 'none',
    order: typeof f.order === 'number' ? f.order : index,
  }));

export const listExams = async () => examRepository.findAll();

export const getExam = async (id) => {
  const exam = await examRepository.findById(id);
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

  const existing = await examRepository.findById(examId);
  if (existing) {
    throw new AppError('Exam already exists', 409, ERROR_CODES.CONFLICT);
  }

  return examRepository.create({
    id: examId,
    values: values && typeof values === 'object' ? values : {},
    fields: snapshotFields(fields),
    createdBy: userId || null,
  });
};

export const updateExam = async (id, { values, fields }) => {
  const updated = await examRepository.update(id, {
    values,
    fields: fields !== undefined ? snapshotFields(fields) : undefined,
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
  return { success: true, id };
};

/** Import browser IndexedDB rows into SQL (idempotent upsert). */
export const importExams = async (exams = [], userId) => {
  const list = Array.isArray(exams) ? exams : [];
  let imported = 0;
  for (const row of list) {
    if (!row?.id) continue;
    await examRepository.upsert({
      id: String(row.id),
      values: row.values && typeof row.values === 'object' ? row.values : {},
      fields: snapshotFields(row.fields),
      createdBy: userId || null,
    });
    imported += 1;
  }
  return { imported, total: list.length };
};
