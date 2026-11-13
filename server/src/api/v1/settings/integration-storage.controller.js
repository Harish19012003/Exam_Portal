import { successResponse } from '../../../core/response.js';
import { auditService } from '../../../services/audit.service.js';
import { createRateWindow } from '../../../core/rate-window.js';
import {
  getCloudinarySettingsView,
  saveCloudinarySettings,
  resolveCloudinaryForTest,
  pingCloudinary,
} from '../../../services/cloudinary-config.service.js';

const assertTestAllowed = createRateWindow(10, 10 * 60 * 1000, 'Too many connection tests. Try again in a few minutes.');

/** GET /settings/integrations/storage */
export const getStorage = async (_req, res, next) => {
  try {
    return successResponse(res, await getCloudinarySettingsView(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/integrations/storage */
export const putStorage = async (req, res, next) => {
  try {
    const { view, changed, secretChanged } = await saveCloudinarySettings(req.body, req.user?.id);
    await auditService.logAction({
      userId: req.user?.id,
      action: 'integration.storage.update',
      resourceType: 'integration',
      resourceId: 'storage',
      newData: { fields: changed, secret_changed: secretChanged },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    return successResponse(res, view, 200);
  } catch (error) {
    next(error);
  }
};

/** POST /settings/integrations/storage/test  { ...unsaved form values } */
export const testStorage = async (req, res, next) => {
  try {
    assertTestAllowed(String(req.user?.id || ''));
    await pingCloudinary(await resolveCloudinaryForTest(req.body || {}));
    return successResponse(res, { ok: true }, 200);
  } catch (error) {
    next(error);
  }
};
