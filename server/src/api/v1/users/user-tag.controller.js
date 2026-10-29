import { successResponse } from '../../../core/response.js';
import * as tagService from './user-tag.service.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const listTags = handle(() => tagService.listTags());
export const createTag = handle((req) => tagService.createTag(req.body, req.user), 201);
export const updateTag = handle((req) => tagService.updateTag(req.params.id, req.body));
export const deleteTag = handle((req) => tagService.deleteTag(req.params.id));
export const reorderTags = handle((req) => tagService.reorderTags(req.body));
export const assignTags = handle((req) => tagService.assignTags(req.body));
export const setUserTags = handle((req) => tagService.setUserTags(req.params.id, req.body));
