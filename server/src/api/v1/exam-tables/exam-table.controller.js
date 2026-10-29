import { successResponse } from '../../../core/response.js';
import * as service from './exam-table.service.js';
import * as examService from '../exams/exam.service.js';
import {
  assertTable,
  assertRowVisible,
  assertWritable,
  autoFillKeys,
  rowVisible,
  stripHidden,
  writableValues,
} from '../../../core/access.js';

const TABLE = 'exam_rows';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

/** Explore data is only reachable through an exam the user can see. */
const assertExamVisible = async (req) => {
  assertTable(req, 'exams', 'view');
  const exam = await examService.getExam(req.params.examId);
  assertRowVisible(req, 'exams', { ...(exam.values || {}), __id: exam.id });
};

const ruleValues = (req, row) => ({ ...(row?.values || {}), __id: row?.id, __exam_id: req.params.examId });

const forClient = (req, row) => (row ? { ...row, values: stripHidden(req, TABLE, row.values) } : row);

export const getTable = handle(async (req) => {
  await assertExamVisible(req);
  return service.getTable(req.params.examId);
});

export const createTable = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'configure');
  return service.createTable(req.params.examId, req.user?.id, { presetId: req.body?.presetId });
}, 201);

export const saveConfig = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'configure');
  return service.saveConfig(req.params.examId, req.body);
});

export const listRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'view');
  const result = await service.listRows(req.params.examId);
  const rows = (result.rows || [])
    .filter((row) => rowVisible(req, TABLE, ruleValues(req, row)))
    .map((row) => forClient(req, row));
  return { ...result, rows, total: rows.length };
});

export const createRow = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'create');
  const { fields } = await service.getTable(req.params.examId);
  const values = writableValues(req, TABLE, req.body?.values, autoFillKeys(fields));
  assertRowVisible(req, TABLE, { ...values, __exam_id: req.params.examId });
  return forClient(req, await service.createRow(req.params.examId, { ...req.body, values }, req.user?.id));
}, 201);

export const updateRow = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'edit');
  const existing = await service.getRow(req.params.examId, req.params.rowId);
  assertRowVisible(req, TABLE, ruleValues(req, existing));
  const values = req.body?.values;
  assertWritable(req, TABLE, values, existing.values);
  assertRowVisible(req, TABLE, { ...ruleValues(req, existing), ...(values || {}) });
  return forClient(
    req,
    await service.updateRow(req.params.examId, Number(req.params.rowId), req.body, req.user?.id),
  );
});

export const deleteRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'delete');
  const ids = req.body?.ids ?? req.params.rowId;
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    const row = await service.getRow(req.params.examId, id);
    assertRowVisible(req, TABLE, ruleValues(req, row));
  }
  return service.deleteRows(req.params.examId, ids);
});
