/**
 * Profile pictures are uploaded as the ORIGINAL, but shown as one small optimized copy.
 * Cloudinary builds that copy once (c_fill + face-centred, f_auto = WebP/AVIF, q_auto) and its CDN
 * serves it from cache afterwards. The original is only fetched when it is opened on purpose.
 * Keep a single size so only one derived asset exists per user.
 */
export const AVATAR_DISPLAY_SIZE = 192; // 2x the largest on-screen avatar (96px)
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Throws a user-friendly Error when the file should not be uploaded. */
export const validateAvatarFile = (file) => {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPG, PNG, WebP or GIF image');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('That image is too large (max 8 MB)');
  }
};

/** Original Cloudinary URL -> small optimized URL. Non-Cloudinary URLs are returned unchanged. */
export const optimizedAvatarUrl = (originalUrl) => {
  if (!originalUrl || typeof originalUrl !== 'string') {return '';}
  const marker = '/image/upload/';
  const at = originalUrl.indexOf(marker);
  if (!originalUrl.includes('res.cloudinary.com') || at === -1) {return originalUrl;}
  const transform = `c_fill,g_face,w_${AVATAR_DISPLAY_SIZE},h_${AVATAR_DISPLAY_SIZE},f_auto,q_auto`;
  return `${originalUrl.slice(0, at + marker.length)}${transform}/${originalUrl.slice(at + marker.length)}`;
};
