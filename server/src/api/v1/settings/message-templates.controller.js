import { ERROR_CODES } from '@exam-view/shared';
import { successResponse } from '../../../core/response.js';
import { AppError } from '../../../core/errors.js';
import { createRateWindow } from '../../../core/rate-window.js';
import { emailService } from '../../../integrations/email.js';
import * as templates from './message-templates.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const assertWithinTestLimit = createRateWindow(10, 60 * 60 * 1000, 'Too many test emails. Please try again later.');

/** GET /settings/message-templates */
export const list = async (_req, res, next) => {
  try {
    return successResponse(res, await templates.listTemplates(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/message-templates/:id  { subject?, body?, enabled? } */
export const save = async (req, res, next) => {
  try {
    return successResponse(res, await templates.saveTemplate(req.params.id, req.body, req.user?.id), 200);
  } catch (error) {
    next(error);
  }
};

/** DELETE /settings/message-templates/:id — back to the built-in default. */
export const reset = async (req, res, next) => {
  try {
    return successResponse(res, await templates.resetTemplate(req.params.id, req.user?.id), 200);
  } catch (error) {
    next(error);
  }
};

/** POST /settings/message-templates/:id/test  { to } — sends the SAVED template with sample values. */
export const sendTest = async (req, res, next) => {
  try {
    const to = String(req.body?.to || '').trim();
    if (!EMAIL_RE.test(to) || to.length > 120) {
      throw new AppError('Enter a valid email address', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    assertWithinTestLimit(String(req.user.id));
    const { subject, html } = await templates.renderSample(req.params.id);
    try {
      await emailService.sendEmail(to, subject, html);
    } catch (err) {
      throw new AppError(
        `Could not send the test email: ${err?.message || 'mail server error'}. Check Settings > Email.`,
        502,
        ERROR_CODES.SERVICE_UNAVAILABLE,
      );
    }
    return successResponse(res, { sent: true, to }, 200);
  } catch (error) {
    next(error);
  }
};
