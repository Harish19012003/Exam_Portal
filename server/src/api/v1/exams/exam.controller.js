import { successResponse } from '../../../core/response.js';
import * as examService from './exam.service.js';
import * as settingsService from '../settings/settings.service.js';
import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';
import {
  assertTable,
  assertRowVisible,
  assertWritable,
  autoFillKeys,
  rowVisible,
  stripHidden,
  writableValues,
} from '../../../core/access.js';

const TABLE = 'exams';

/** Values used by row rules: field values plus the exam id. */
const ruleValues = (exam) => ({ ...(exam?.values || {}), __id: exam?.id });

const forClient = (req, exam) => ({ ...exam, values: stripHidden(req, TABLE, exam.values) });

const examAutoKeys = async () => {
  try {
    const config = await settingsService.getExamTableConfig();
    return autoFillKeys(config?.fields);
  } catch {
    return [];
  }
};

const findExam = async (id) => {
  try {
    return await examService.getExam(id);
  } catch (error) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
};

export const listExams = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'view');
    const exams = await examService.listExams();
    const visible = exams.filter((exam) => rowVisible(req, TABLE, ruleValues(exam)));
    return successResponse(res, visible.map((exam) => forClient(req, exam)), 200);
  } catch (error) {
    next(error);
  }
};

export const getExam = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'view');
    const exam = await examService.getExam(req.params.id);
    assertRowVisible(req, TABLE, ruleValues(exam));
    return successResponse(res, forClient(req, exam), 200);
  } catch (error) {
    next(error);
  }
};

export const createExam = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      throw new AppError('Invalid exam payload', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    assertTable(req, TABLE, 'create');
    const values = writableValues(req, TABLE, req.body.values, await examAutoKeys());
    assertRowVisible(req, TABLE, values);
    const exam = await examService.createExam({ ...req.body, values }, req.user?.id);
    return successResponse(res, forClient(req, exam), 201);
  } catch (error) {
    next(error);
  }
};

export const updateExam = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'edit');
    const existing = await examService.getExam(req.params.id);
    assertRowVisible(req, TABLE, ruleValues(existing));
    const values = req.body?.values;
    assertWritable(req, TABLE, values, existing.values);
    assertRowVisible(req, TABLE, { ...ruleValues(existing), ...(values || {}) });
    const exam = await examService.updateExam(req.params.id, req.body || {}, req.user?.id);
    return successResponse(res, forClient(req, exam), 200);
  } catch (error) {
    next(error);
  }
};

export const deleteExam = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'delete');
    const existing = await examService.getExam(req.params.id);
    assertRowVisible(req, TABLE, ruleValues(existing));
    const result = await examService.deleteExam(req.params.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const importExams = async (req, res, next) => {
  try {
    assertTable(req, TABLE, 'import');
    const rows = Array.isArray(req.body?.exams) ? req.body.exams : req.body;
    const list = Array.isArray(rows) ? rows : [];
    const autoKeys = await examAutoKeys();
    const prepared = [];
    for (const row of list) {
      const raw = row?.values && typeof row.values === 'object' ? row.values : {};
      if (row?.id) {
        const existing = await findExam(row.id);
        if (existing) {
          assertTable(req, TABLE, 'edit');
          assertRowVisible(req, TABLE, ruleValues(existing));
          assertWritable(req, TABLE, raw, existing.values);
        }
      }
      const values = writableValues(req, TABLE, raw, autoKeys);
      assertRowVisible(req, TABLE, values);
      prepared.push({ ...row, values });
    }
    const result = await examService.importExams(prepared, req.user?.id);
    return successResponse(res, result, 200);
  } catch (error) {
    next(error);
  }
};
