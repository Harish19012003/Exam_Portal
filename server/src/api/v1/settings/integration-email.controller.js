import { ERROR_CODES } from '@exam-view/shared';
import { successResponse } from '../../../core/response.js';
import { AppError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { auditService } from '../../../services/audit.service.js';
import { emailService } from '../../../integrations/email.js';
import {
  getEmailSettingsView,
  saveEmailSettings,
  resolveForTest,
  isValidEmail,
} from '../../../services/email-config.service.js';
import { userRepository } from '../users/user.repository.js';

const MAX_TESTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const recentTests = new Map();

/** Stops the test button being used to send bulk mail from the server. */
const assertTestRateLimit = (userId) => {
  const now = Date.now();
  const hits = (recentTests.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_TESTS) {
    throw new AppError('Too many test emails. Try again in a few minutes.', 429, ERROR_CODES.RATE_LIMITED);
  }
  hits.push(now);
  recentTests.set(userId, hits);
};

/** Plain-language reason for a failed send. Never includes credentials. */
const explainMailError = (error) => {
  const code = error?.code;
  if (code === 'EAUTH' || error?.responseCode === 535) {
    return 'The mail server rejected the username or password. For Gmail, use an App Password (needs 2-step verification).';
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ESOCKET', 'EDNS', 'ENOTFOUND'].includes(code)) {
    return 'Could not reach the mail server. Check the host and port. Some hosting providers (including free tiers) block outbound SMTP; if this works locally but not here, use an email provider that works over HTTPS.';
  }
  if (code === 'EENVELOPE' || error?.responseCode === 550) {
    return 'The mail server did not accept the sender or recipient address.';
  }
  return 'The test email could not be sent. Check the settings and try again.';
};

/** GET /settings/integrations/email */
export const getEmail = async (_req, res, next) => {
  try {
    return successResponse(res, await getEmailSettingsView(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/integrations/email */
export const putEmail = async (req, res, next) => {
  try {
    const { view, changed, passwordChanged } = await saveEmailSettings(req.body, req.user?.id);
    // Audit the fact of the change, never the values.
    await auditService.logAction({
      userId: req.user?.id,
      action: 'integration.email.update',
      resourceType: 'integration',
      resourceId: 'email',
      newData: { fields: changed, password_changed: passwordChanged },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    return successResponse(res, view, 200);
  } catch (error) {
    next(error);
  }
};

/** POST /settings/integrations/email/test  { to?, ...unsaved form values } */
export const testEmail = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '');
    assertTestRateLimit(userId);

    let to = String(req.body?.to || '').trim();
    if (!to) {to = (await userRepository.findById(userId))?.email || '';}
    if (!isValidEmail(to)) {throw new AppError('Enter a valid address to send the test to', 400, ERROR_CODES.VALIDATION_ERROR);}

    const config = await resolveForTest(req.body || {});
    if (!config.user || !config.pass) {
      throw new AppError('Add a username and password before sending a test', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    try {
      await emailService.sendWithConfig(
        config,
        to,
        'Exam View - test email',
        '<p>This is a test email from <strong>Platform Settings</strong>. Your email setup works.</p>',
      );
    } catch (error) {
      logger.warn('[Email] Test send failed', { code: error?.code, responseCode: error?.responseCode });
      throw new AppError(explainMailError(error), 502, ERROR_CODES.SERVICE_UNAVAILABLE);
    }

    return successResponse(res, { sent: true, to }, 200);
  } catch (error) {
    next(error);
  }
};
