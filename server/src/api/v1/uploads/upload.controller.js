/**
 * Signed direct uploads for file / image fields (table attachments, exam form attachments).
 *
 * The browser uploads the file straight to Cloudinary using a short-lived signature from here, so file bytes
 * never pass through this server and nothing is written to local disk. The app stores only the returned URL.
 * Cloudinary credentials come from Platform Settings > Storage (or the server env as fallback).
 */
import { v2 as cloudinary } from 'cloudinary';
import { ERROR_CODES } from '@exam-view/shared';
import { CLOUDINARY_PATHS } from '../../../integrations/cloudinary.js';
import { successResponse } from '../../../core/response.js';
import { AppError } from '../../../core/errors.js';
import { createRateWindow } from '../../../core/rate-window.js';
import { getCloudinaryConfig, isCloudinaryConfigured } from '../../../services/cloudinary-config.service.js';

/** Documents and images only: no scripts or executables. */
const ALLOWED_FORMATS = 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,csv,txt,zip';

const assertWithinRateLimit = createRateWindow(120, 60 * 60 * 1000, 'Too many uploads. Please try again later.');

/** POST /uploads/signature */
export const getAttachmentUploadSignature = async (req, res, next) => {
  try {
    const config = await getCloudinaryConfig();
    if (!isCloudinaryConfigured(config)) {
      throw new AppError('File uploads are not configured', 503, ERROR_CODES.SERVICE_UNAVAILABLE);
    }
    assertWithinRateLimit(String(req.user.id));

    const params = {
      allowed_formats: ALLOWED_FORMATS,
      folder: `${CLOUDINARY_PATHS.DYNAMIC}/attachments`,
      timestamp: Math.round(Date.now() / 1000),
    };
    const signature = cloudinary.utils.api_sign_request(params, config.api_secret);
    return successResponse(res, { cloud_name: config.cloud_name, api_key: config.api_key, signature, ...params }, 200);
  } catch (error) {
    next(error);
  }
};
