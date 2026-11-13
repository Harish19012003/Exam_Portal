/**
 * Branding images are uploaded as the original, but shown as small optimized copies (Cloudinary builds each
 * once, then its CDN serves it from cache), so delivery bandwidth stays tiny.
 */
export const MAX_BRANDING_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export const validateBrandingFile = (file) => {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please choose a PNG, JPG, WebP or SVG image');
  }
  if (file.size > MAX_BRANDING_BYTES) {
    throw new Error('That image is too large (max 2 MB)');
  }
};

const withTransform = (url, transform) => {
  if (!url || typeof url !== 'string') {return '';}
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (!url.includes('res.cloudinary.com') || at === -1) {return url;}
  return `${url.slice(0, at + marker.length)}${transform}/${url.slice(at + marker.length)}`;
};

/** Sidebar / login logo: fits inside 160x160 (2x of the largest use), keeps aspect ratio and transparency. */
export const optimizedLogoUrl = (url) => withTransform(url, 'c_fit,w_160,h_160,f_auto,q_auto');

/** Browser-tab icon: a small square PNG (favicons need a widely supported format). */
export const optimizedFaviconUrl = (url) => withTransform(url, 'c_pad,w_64,h_64,f_png');
