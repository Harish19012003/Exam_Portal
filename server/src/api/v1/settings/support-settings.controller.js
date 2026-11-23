import { successResponse } from '../../../core/response.js';
import * as supportSettingsService from './support-settings.service.js';

/** GET /settings/support — any signed-in user (the Help modal). */
export const getSupportSettings = async (_req, res, next) => {
  try {
    return successResponse(res, await supportSettingsService.getSupportSettings(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/support — people with the Settings page right. */
export const putSupportSettings = async (req, res, next) => {
  try {
    return successResponse(res, await supportSettingsService.saveSupportSettings(req.body, req.user?.id), 200);
  } catch (error) {
    next(error);
  }
};
