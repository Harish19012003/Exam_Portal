import { successResponse } from '../../../core/response.js';
import * as platformSettingsService from './platform-settings.service.js';

/** GET /settings/platform — any signed-in user (the app shell shows the name and banner). */
export const getPlatformSettings = async (_req, res, next) => {
  try {
    return successResponse(res, await platformSettingsService.getPlatformSettings(), 200);
  } catch (error) {
    next(error);
  }
};

/** PUT /settings/platform — people with the Settings page right. */
export const putPlatformSettings = async (req, res, next) => {
  try {
    const saved = await platformSettingsService.savePlatformSettings(req.body, req.user?.id);
    return successResponse(res, saved, 200);
  } catch (error) {
    next(error);
  }
};
