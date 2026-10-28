import { successResponse } from '../../../core/response.js';
import * as groupService from './user-group.service.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const listGroups = handle(() => groupService.listGroups());
export const createGroup = handle((req) => groupService.createGroup(req.body, req.user), 201);
export const updateGroup = handle((req) => groupService.updateGroup(req.params.id, req.body));
export const deleteGroup = handle((req) => groupService.deleteGroup(req.params.id));
