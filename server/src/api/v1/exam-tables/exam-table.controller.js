import { DEFAULT_EXAM_VIEW } from '@exam-view/shared';
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

const viewOf = (req, bodyFirst = false) => {
  if (bodyFirst) return req.body?.view || req.query?.view || DEFAULT_EXAM_VIEW;
  return req.query?.view || req.body?.view || DEFAULT_EXAM_VIEW;
};

export const getTable = handle(async (req) => {
  await assertExamVisible(req);
  return service.getTable(req.params.examId, viewOf(req));
});

export const createTable = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'configure');
  return service.createTable(req.params.examId, req.user?.id, {
    presetId: req.body?.presetId,
    view: viewOf(req, true),
  });
}, 201);

export const saveConfig = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'configure');
  return service.saveConfig(req.params.examId, { ...req.body, view: viewOf(req, true) });
});

export const listRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'view');
  const allFields = await service.listAllFields(req.params.examId).catch(() => []);
  const page = req.query?.page;
  const limit = req.query?.limit;
  const result = await service.listRows(req.params.examId, { page, limit });
  const fields = allFields || [];
  const rows = (result.rows || [])
    .filter((row) => rowVisible(req, TABLE, ruleValues(req, row), fields))
    .map((row) => forClient(req, row));
  // Keep DB total for pagination; ACL may hide a few rows on the current page.
  return { ...result, rows };
});

export const createRow = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'create');
  const view = viewOf(req, true);
  const { fields } = await service.getTable(req.params.examId, view);
  const values = writableValues(req, TABLE, req.body?.values, autoFillKeys(fields));
  assertRowVisible(req, TABLE, { ...values, __exam_id: req.params.examId }, fields);
  return forClient(
    req,
    await service.createRow(req.params.examId, { ...req.body, values, view }, req.user?.id),
  );
}, 201);

export const createRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'create');
  const view = viewOf(req, true);
  const { fields } = await service.getTable(req.params.examId, view);
  const autoKeys = autoFillKeys(fields);
  const list = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const rows = [];
  const denied = [];
  list.forEach((raw, index) => {
    try {
      const values = writableValues(req, TABLE, raw, autoKeys);
      assertRowVisible(req, TABLE, { ...values, __exam_id: req.params.examId }, fields);
      rows.push({ index, values });
    } catch (err) {
      denied.push({ index, message: err?.message || 'Not allowed' });
    }
  });
  const result = await service.createRows(
    req.params.examId,
    { rows: rows.map((r) => r.values), view },
    req.user?.id,
  );
  // Map failures back to original indexes.
  const failures = [
    ...denied,
    ...result.failures.map((f) => ({ index: rows[f.index]?.index ?? f.index, message: f.message })),
  ].sort((a, b) => a.index - b.index);
  return { created: result.created, failures };
}, 201);

export const updateRow = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'edit');
  const view = viewOf(req, true);
  const { fields } = await service.getTable(req.params.examId, view);
  const existing = await service.getRow(req.params.examId, req.params.rowId);
  assertRowVisible(req, TABLE, ruleValues(req, existing), fields);
  const values = req.body?.values;
  assertWritable(req, TABLE, values, existing.values);
  assertRowVisible(req, TABLE, { ...ruleValues(req, existing), ...(values || {}) }, fields);
  return forClient(
    req,
    await service.updateRow(req.params.examId, req.params.rowId, { ...req.body, view }, req.user?.id),
  );
});

/** Mass Edit: patch many rows (by ids), by search/filters, or every row in the exam table. */
export const bulkUpdateRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'edit');
  const view = viewOf(req, true);
  const { fields } = await service.getTable(req.params.examId, view);
  const values = writableValues(req, TABLE, req.body?.values, autoFillKeys(fields));
  assertWritable(req, TABLE, values, {});
  const all = Boolean(req.body?.all);
  const filters = req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : undefined;
  const search = typeof req.body?.search === 'string' ? req.body.search : undefined;
  const searchKeys = Array.isArray(req.body?.searchKeys) ? req.body.searchKeys.map(String) : undefined;
  const useFilter = !all && (Boolean(String(search || '').trim()) || (filters && Object.keys(filters).length > 0));
  if (!all && !useFilter) {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const found = await service.getRowsByIds(req.params.examId, ids);
    found.forEach((row) => assertRowVisible(req, TABLE, ruleValues(req, row), fields));
  }
  return service.bulkUpdateRows(
    req.params.examId,
    { values, ids: req.body?.ids, all, filters, search, searchKeys, view },
    req.user?.id,
  );
});

export const deleteRows = handle(async (req) => {
  await assertExamVisible(req);
  assertTable(req, TABLE, 'delete');
  const allFields = await service.listAllFields(req.params.examId).catch(() => []);
  const ids = req.body?.ids ?? req.params.rowId;
  const idList = Array.isArray(ids) ? ids : [ids];
  const found = await service.getRowsByIds(req.params.examId, idList);
  found.forEach((row) => assertRowVisible(req, TABLE, ruleValues(req, row), allFields));
  return service.deleteRows(req.params.examId, ids);
});
