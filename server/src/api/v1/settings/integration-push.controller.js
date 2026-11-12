import { successResponse } from '../../../core/response.js';
import { auditService } from '../../../services/audit.service.js';
import { createRateWindow } from '../../../core/rate-window.js';
import {
  getFirebaseSettingsView,
  saveFirebaseSettings,
  verifyFirebaseServerKey,
} from '../../../services/firebase-config.service.js';

const assertTestAllowed = createRateWindow(10, 10 * 60 * 1000, 'Too many connection tests. Try again in a few minutes.');

/** GET /settings/integrations/push */
export const getPush = async (_req, res, next) => {
  try {
    return successResponse(res, await getFirebaseSettingsView(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/integrations/push */
export const putPush = async (req, res, next) => {
  try {
    const { view, changed, keyChanged } = await saveFirebaseSettings(req.body, req.user?.id);
    await auditService.logAction({
      userId: req.user?.id,
      action: 'integration.push.update',
      resourceType: 'integration',
      resourceId: 'push',
      newData: { fields: changed, server_key_changed: keyChanged },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    return successResponse(res, view, 200);
  } catch (error) {
    next(error);
  }
};

/** POST /settings/integrations/push/test  { service_account? } — verifies the key, sends nothing. */
export const testPush = async (req, res, next) => {
  try {
    assertTestAllowed(String(req.user?.id || ''));
    const result = await verifyFirebaseServerKey(req.body?.service_account);
    return successResponse(res, { ok: true, ...result }, 200);
  } catch (error) {
    next(error);
  }
};
