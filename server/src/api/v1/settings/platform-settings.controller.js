import { v2 as cloudinary } from 'cloudinary';
import { ERROR_CODES } from '@exam-view/shared';
import { successResponse } from '../../../core/response.js';
import { AppError } from '../../../core/errors.js';
import { createRateWindow } from '../../../core/rate-window.js';
import { getCloudinaryConfig, isCloudinaryConfigured } from '../../../services/cloudinary-config.service.js';
import * as platformSettingsService from './platform-settings.service.js';

/** GET /settings/platform/branding — public (login tab icon / portal name before sign-in). */
export const getPublicBranding = async (_req, res, next) => {
  try {
    return successResponse(res, await platformSettingsService.getPublicBranding(), 200);
  } catch (error) {
    next(error);
  }
};

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

const assertWithinRateLimit = createRateWindow(20, 60 * 60 * 1000, 'Too many uploads. Please try again later.');

/** POST /settings/platform/branding/signature { kind: 'logo' | 'favicon' } — super admin only. */
export const getBrandingUploadSignature = async (req, res, next) => {
  try {
    const kind = req.body?.kind;
    if (!platformSettingsService.BRANDING_KINDS.includes(kind)) {
      throw new AppError('Unknown branding image', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const config = await getCloudinaryConfig();
    if (!isCloudinaryConfigured(config)) {
      throw new AppError('Image uploads are not configured', 503, ERROR_CODES.SERVICE_UNAVAILABLE);
    }
    assertWithinRateLimit(String(req.user.id));

    const params = {
      allowed_formats: 'jpg,jpeg,png,webp,svg',
      invalidate: true,
      overwrite: true,
      public_id: platformSettingsService.brandingPublicId(kind),
      timestamp: Math.round(Date.now() / 1000),
    };
    const signature = cloudinary.utils.api_sign_request(params, config.api_secret);
    return successResponse(res, { cloud_name: config.cloud_name, api_key: config.api_key, signature, ...params }, 200);
  } catch (error) {
    next(error);
  }
};
