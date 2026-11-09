import { successResponse } from '../../../core/response.js';
import * as examLinkService from './exam-link.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import {
  assertTable,
  assertRowVisible,
  rowVisible,
  stripHidden,
} from '../../../core/access.js';

const TABLE = 'exams';

const ruleValues = (exam) => ({ ...(exam?.values || {}), __id: exam?.id });

const forClient = (req, exam) => ({
  ...exam,
  values: stripHidden(req, TABLE, exam.values),
});

/** One batched load + visibility checks for every id. */
const requireVisibleExams = async (req, ids = []) => {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!unique.length) return [];

  const exams = await examLinkService.getExamsByIds(unique);
  const byId = new Map(exams.map((exam) => [String(exam.id), exam]));

  for (const id of unique) {
    const exam = byId.get(id);
    if (!exam) {
      throw new AppError(`Exam not found: ${id}`, 404, ERROR_CODES.NOT_FOUND);
    }
    assertRowVisible(req, TABLE, ruleValues(exam));
  }

  return unique.map((id) => byId.get(id));
};

export const listLinks = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'view');
    await requireVisibleExams(req, [req.params.id]);
    const result = await examLinkService.listLinks(req.params.id);
    const visibleLinked = (result.linkedExams || []).filter((exam) =>
      rowVisible(req, TABLE, ruleValues(exam)),
    );
    return successResponse(
      res,
      {
        examId: result.examId,
        linkedExamIds: visibleLinked.map((e) => e.id),
        linkedExams: visibleLinked.map((exam) => forClient(req, exam)),
      },
      200,
    );
  } catch (error) {
    next(error);
  }
};

export const setLinks = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'edit');

    const raw = req.body?.linkedExamIds ?? req.body?.linked_exam_ids;
    if (!Array.isArray(raw)) {
      throw new AppError('linkedExamIds must be an array', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const wanted = [...new Set(raw.map(String).filter(Boolean))];
    const exams = await requireVisibleExams(req, [req.params.id, ...wanted]);

    const result = await examLinkService.setLinks(req.params.id, wanted, req.user?.id, {
      exams,
    });
    return successResponse(
      res,
      {
        examId: result.examId,
        linkedExamIds: result.linkedExamIds,
        linkedExams: (result.linkedExams || []).map((exam) => forClient(req, exam)),
      },
      200,
    );
  } catch (error) {
    next(error);
  }
};

export const unlink = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'edit');
    await requireVisibleExams(req, [req.params.id]);
    const result = await examLinkService.unlink(req.params.id, req.params.linkedExamId);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const linkMany = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'edit');
    const raw = req.body?.examIds ?? req.body?.exam_ids;
    if (!Array.isArray(raw)) {
      throw new AppError('examIds must be an array', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const ids = [...new Set(raw.map(String).filter(Boolean))];
    const exams = await requireVisibleExams(req, ids);
    const result = await examLinkService.linkMany(ids, req.user?.id, { exams });
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
