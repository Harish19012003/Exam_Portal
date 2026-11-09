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

/** Load many exams in one query (no link enrichment). */
export const getExamsByIds = async (ids = []) => {
  const fields = await loadConfiguredFields();
  return examRepository.findByIds(ids, fields);
};

const assertAllExist = (ids, exams) => {
  const found = new Set((exams || []).map((e) => String(e.id)));
  for (const id of ids) {
    if (!found.has(String(id))) {
      throw new AppError(`Exam not found: ${id}`, 404, ERROR_CODES.NOT_FOUND);
    }
  }
};

const examsInOrder = (ids, exams) => {
  const byId = new Map((exams || []).map((e) => [String(e.id), e]));
  return (ids || []).map((id) => byId.get(String(id))).filter(Boolean);
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
  const [source] = await examRepository.findByIds([examId], fields);
  if (!source) {
    throw new AppError(`Exam not found: ${examId}`, 404, ERROR_CODES.NOT_FOUND);
  }

  const linkedIds = await examLinkRepository.findLinkedIds(examId);
  const linkedExams = linkedIds.length
    ? examsInOrder(linkedIds, await examRepository.findByIds(linkedIds, fields))
    : [];

  return {
    examId: String(examId),
    linkedExamIds: linkedExams.map((e) => e.id),
    linkedExams,
  };
};

export const setLinks = async (examId, linkedExamIds = [], userId, { exams: preloaded } = {}) => {
  const sourceId = String(examId);
  const wanted = [
    ...new Set(
      (Array.isArray(linkedExamIds) ? linkedExamIds : [])
        .map(String)
        .filter((id) => id && id !== sourceId),
    ),
  ];

  const exams =
    Array.isArray(preloaded) && preloaded.length
      ? preloaded
      : await examRepository.findByIds([sourceId, ...wanted], await loadConfiguredFields());
  assertAllExist([sourceId, ...wanted], exams);

  const linkedIds = await examLinkRepository.setLinksForExam(sourceId, wanted, {
    createdBy: userId || null,
  });

  const linkedExams = linkedIds.length
    ? examsInOrder(
        linkedIds,
        exams.filter((e) => linkedIds.includes(String(e.id))),
      )
    : [];

  return {
    examId: sourceId,
    linkedExamIds: linkedIds,
    linkedExams,
  };
};

export const unlink = async (examId, linkedExamId) => {
  const fields = await loadConfiguredFields();
  const [source] = await examRepository.findByIds([examId], fields);
  if (!source) {
    throw new AppError(`Exam not found: ${examId}`, 404, ERROR_CODES.NOT_FOUND);
  }
  const ok = await examLinkRepository.removeLink(examId, linkedExamId);
  if (!ok) {
    throw new AppError('Link not found', 404, ERROR_CODES.NOT_FOUND);
  }
  return { success: true, examId: String(examId), linkedExamId: String(linkedExamId) };
};

/** Link every pair among the given exams (bulk “group as linked”). */
export const linkMany = async (examIds = [], userId, { exams: preloaded } = {}) => {
  const ids = [...new Set((Array.isArray(examIds) ? examIds : []).map(String).filter(Boolean))];
  if (ids.length < 2) {
    throw new AppError('Select at least two exams to link', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  const exams = Array.isArray(preloaded) && preloaded.length ? preloaded : await getExamsByIds(ids);
  assertAllExist(ids, exams);
  return examLinkRepository.linkMany(ids, { createdBy: userId || null });
};
