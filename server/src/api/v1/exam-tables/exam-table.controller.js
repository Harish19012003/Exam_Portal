import { successResponse } from '../../../core/response.js';
import * as service from './exam-table.service.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const getTable = handle((req) => service.getTable(req.params.examId));
export const createTable = handle((req) => service.createTable(req.params.examId, req.user?.id, { presetId: req.body?.presetId }), 201);
export const saveConfig = handle((req) => service.saveConfig(req.params.examId, req.body));
export const listRows = handle((req) => service.listRows(req.params.examId));
export const createRow = handle((req) => service.createRow(req.params.examId, req.body, req.user?.id), 201);
export const updateRow = handle((req) =>
  service.updateRow(req.params.examId, Number(req.params.rowId), req.body, req.user?.id),
);
export const deleteRows = handle((req) =>
  service.deleteRows(req.params.examId, req.body?.ids ?? req.params.rowId),
);
