import * as examLinkRepository from './exam-link.repository.js';
import * as examRepository from './exam.repository.js';
import * as settingsService from '../settings/settings.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

const loadConfiguredFields = async () => {
  try {
    const config = await settingsService.getExamTableConfig();
    return Array.isArray(config?.fields) ? config.fields : [];
  } catch {
    return [];
  }
};

const assertExamExists = async (id, fields) => {
  const exam = await examRepository.findById(id, fields);
  if (!exam) {
    throw new AppError(`Exam not found: ${id}`, 404, ERROR_CODES.NOT_FOUND);
  }
  return exam;
};

/** Attach linkedExamIds onto exam list/detail payloads. */
export const withLinkedIds = async (exams) => {
  const list = Array.isArray(exams) ? exams : exams ? [exams] : [];
  if (!list.length) return Array.isArray(exams) ? [] : exams;
  const map = await examLinkRepository.linkedIdsByExam(list.map((e) => e.id));
  const enriched = list.map((exam) => ({
    ...exam,
    linkedExamIds: map.get(String(exam.id)) || [],
  }));
  return Array.isArray(exams) ? enriched : enriched[0];
};

export const listLinks = async (examId) => {
  const fields = await loadConfiguredFields();
  await assertExamExists(examId, fields);
  const linkedIds = await examLinkRepository.findLinkedIds(examId);
  const linkedExams = [];
  for (const id of linkedIds) {
    const exam = await examRepository.findById(id, fields);
    if (exam) linkedExams.push(exam);
  }
  return {
    examId: String(examId),
    linkedExamIds: linkedIds,
    linkedExams,
  };
};

export const setLinks = async (examId, linkedExamIds = [], userId) => {
  const fields = await loadConfiguredFields();
  await assertExamExists(examId, fields);

  const wanted = [
    ...new Set(
      (Array.isArray(linkedExamIds) ? linkedExamIds : [])
        .map(String)
        .filter((id) => id && id !== String(examId)),
    ),
  ];

  for (const id of wanted) {
    await assertExamExists(id, fields);
  }

  const linkedIds = await examLinkRepository.setLinksForExam(examId, wanted, {
    createdBy: userId || null,
  });

  const linkedExams = [];
  for (const id of linkedIds) {
    const exam = await examRepository.findById(id, fields);
    if (exam) linkedExams.push(exam);
  }

  return {
    examId: String(examId),
    linkedExamIds: linkedIds,
    linkedExams,
  };
};

export const unlink = async (examId, linkedExamId) => {
  const fields = await loadConfiguredFields();
  await assertExamExists(examId, fields);
  const ok = await examLinkRepository.removeLink(examId, linkedExamId);
  if (!ok) {
    throw new AppError('Link not found', 404, ERROR_CODES.NOT_FOUND);
  }
  return { success: true, examId: String(examId), linkedExamId: String(linkedExamId) };
};

/** Link every pair among the given exams (bulk “group as linked”). */
export const linkMany = async (examIds = [], userId) => {
  const fields = await loadConfiguredFields();
  const ids = [...new Set((Array.isArray(examIds) ? examIds : []).map(String).filter(Boolean))];
  if (ids.length < 2) {
    throw new AppError('Select at least two exams to link', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  for (const id of ids) {
    await assertExamExists(id, fields);
  }
  return examLinkRepository.linkMany(ids, { createdBy: userId || null });
};
