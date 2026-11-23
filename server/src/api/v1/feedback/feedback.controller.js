import { successResponse } from '../../../core/response.js';
import { createRateWindow } from '../../../core/rate-window.js';
import * as feedbackService from './feedback.service.js';

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

// Stop accidental floods: 10 reports per user per 10 minutes.
const assertWithinRateLimit = createRateWindow(10, 10 * 60 * 1000, 'Too many reports in a short time. Please wait a few minutes.');

export const create = handle((req) => {
  assertWithinRateLimit(String(req.user.id));
  return feedbackService.createFeedback(req.body || {}, req.me || { id: req.user.id });
}, 201);
export const listMine = handle((req) => feedbackService.listMine(req.user.id));
export const listAll = handle(() => feedbackService.listAll());
export const update = handle((req) => feedbackService.updateFeedback(req.params.id, req.body || {}, req.me || { id: req.user.id }));
export const remove = handle((req) => feedbackService.deleteFeedback(req.params.id));
