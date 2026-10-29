import { successResponse } from '../../../core/response.js';
import * as tableConfigService from './user-table-config.service.js';

const handle = (fn) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req));
  } catch (error) {
    next(error);
  }
};

export const getTableConfig = handle(() => tableConfigService.getTableConfig());
export const saveTableConfig = handle((req) => tableConfigService.saveTableConfig(req.body, req.user?.id));
