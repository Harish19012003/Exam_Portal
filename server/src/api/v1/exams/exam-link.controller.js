import { successResponse } from '../../../core/response.js';
import * as examLinkService from './exam-link.service.js';
import * as examService from './exam.service.js';
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

const requireVisibleExam = async (req, id) => {
  const exam = await examService.getExam(id);
  assertRowVisible(req, TABLE, ruleValues(exam));
  return exam;
};

export const listLinks = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'view');
    await requireVisibleExam(req, req.params.id);
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
    await requireVisibleExam(req, req.params.id);

    const raw = req.body?.linkedExamIds ?? req.body?.linked_exam_ids;
    if (!Array.isArray(raw)) {
      throw new AppError('linkedExamIds must be an array', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Only allow linking to exams the user can see.
    for (const id of raw) {
      await requireVisibleExam(req, id);
    }

    const result = await examLinkService.setLinks(req.params.id, raw, req.user?.id);
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
    await requireVisibleExam(req, req.params.id);
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
    for (const id of raw) {
      await requireVisibleExam(req, id);
    }
    const result = await examLinkService.linkMany(raw, req.user?.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
