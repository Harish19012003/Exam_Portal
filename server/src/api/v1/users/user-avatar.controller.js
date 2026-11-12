/**
 * Profile picture endpoints.
 *
 * The browser uploads the ORIGINAL image straight to Cloudinary using a short-lived signature
 * from here, so image bytes never pass through this server. We store only the original's URL.
 * The app displays a small optimized copy (one fixed size, f_auto/q_auto, see client
 * `optimizedAvatarUrl`) and only fetches the original when it is explicitly opened, so Cloudinary
 * delivery bandwidth stays tiny. One asset per user (fixed public_id + overwrite).
 *
 * Cloudinary credentials come from Platform Settings > Storage (or the server env as fallback).
 */
import { URL } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { ERROR_CODES } from '@exam-view/shared';
import { CLOUDINARY_PATHS } from '../../../integrations/cloudinary.js';
import { successResponse } from '../../../core/response.js';
import { AppError } from '../../../core/errors.js';
import { createRateWindow } from '../../../core/rate-window.js';
import { getCloudinaryConfig, isCloudinaryConfigured } from '../../../services/cloudinary-config.service.js';
import { userRepository } from './user.repository.js';

/** Only real photo formats may be uploaded with this signature. */
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif';

/** A person rarely changes their photo more than a few times an hour. */
const assertWithinRateLimit = createRateWindow(8, 60 * 60 * 1000, 'Too many photo uploads. Please try again later.');

const publicIdFor = (userId) => `${CLOUDINARY_PATHS.PROFILE}/${userId}`;

const loadConfig = async () => {
  const config = await getCloudinaryConfig();
  if (!isCloudinaryConfigured(config)) {
    throw new AppError('Image uploads are not configured', 503, ERROR_CODES.SERVICE_UNAVAILABLE);
  }
  return config;
};

/** The URL we store must be an image in OUR cloud, under THIS user's id — never an arbitrary link. */
const isOwnAvatarUrl = (rawUrl, userId, cloudName) => {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
      return false;
    }
    const path = decodeURIComponent(url.pathname);
    return path.startsWith(`/${cloudName}/image/upload/`) && path.includes(`/${publicIdFor(userId)}`);
  } catch {
    return false;
  }
};

/** POST /users/profile/avatar/signature */
export const getAvatarUploadSignature = async (req, res, next) => {
  try {
    const config = await loadConfig();
    const userId = String(req.user.id);
    assertWithinRateLimit(userId);

    const params = {
      allowed_formats: ALLOWED_FORMATS,
      invalidate: true,
      overwrite: true,
      public_id: publicIdFor(userId),
      timestamp: Math.round(Date.now() / 1000),
    };
    const signature = cloudinary.utils.api_sign_request(params, config.api_secret);

    return successResponse(res, {
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      signature,
      ...params,
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /users/profile/avatar  { secure_url, public_id } */
export const saveAvatar = async (req, res, next) => {
  try {
    const config = await loadConfig();
    const userId = String(req.user.id);
    const { secure_url: secureUrl, public_id: publicId } = req.body || {};

    if (publicId !== publicIdFor(userId) || !isOwnAvatarUrl(secureUrl, userId, config.cloud_name)) {
      throw new AppError('Invalid profile picture', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    await userRepository.update(userId, { avatar_url: secureUrl, avatar_public_id: publicId });
    return successResponse(res, { avatar_url: secureUrl }, 200);
  } catch (error) {
    next(error);
  }
};

/** DELETE /users/profile/avatar */
export const removeAvatar = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
    }

    if (user.avatar_public_id) {
      try {
        const config = await loadConfig();
        await cloudinary.uploader.destroy(user.avatar_public_id, {
          cloud_name: config.cloud_name,
          api_key: config.api_key,
          api_secret: config.api_secret,
          invalidate: true,
        });
      } catch {
        // The picture is unlinked from the profile either way; an orphaned asset is overwritten next upload.
      }
    }

    await userRepository.update(userId, { avatar_url: null, avatar_public_id: null });
    return successResponse(res, { avatar_url: null }, 200);
  } catch (error) {
    next(error);
  }
};
