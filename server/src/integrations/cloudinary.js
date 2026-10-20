import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';

// Paths as defined in PLANNING.md
export const CLOUDINARY_PATHS = {
  PROFILE: 'Exam portal/System/user-profile',
  DYNAMIC: 'Exam portal/Dynamic Data',
};

// Config comes from env (Zod validated theoretically)
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: env.CLOUDINARY_API_KEY || 'demo',
  api_secret: env.CLOUDINARY_API_SECRET || 'demo',
});

export const cloudinaryService = {
  /**
   * Upload an image to Cloudinary
   * @param {string} filePath - local file path or base64 string
   * @param {string} folder - target folder in Cloudinary
   */
  async uploadImage(filePath, folder = CLOUDINARY_PATHS.PROFILE) {
    try {
      const result = await cloudinary.uploader.upload(filePath, { folder });
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error('[Cloudinary] Upload Error:', error);
      throw new Error('Failed to upload image to Cloudinary');
    }
  },

  async deleteImage(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('[Cloudinary] Delete Error:', error);
      throw new Error('Failed to delete image from Cloudinary');
    }
  }
};
