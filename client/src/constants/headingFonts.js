/**
 * Heading fonts an admin can pick in Platform Settings. Only `--font-display` changes (headings, branding,
 * standalone screens); body text, tables and popups stay Inter. Keep names in sync with
 * ALLOWED_HEADING_FONTS in server/src/api/v1/settings/platform-settings.service.js.
 */
export const FONT_OPTIONS = [
  { name: 'Sora', query: 'Sora:wght@500;600;700;800', note: 'techy, wide' },
  { name: 'Bricolage Grotesque', query: 'Bricolage+Grotesque:opsz,wght@12..96,500..800', note: 'characterful' },
  { name: 'Fraunces', query: 'Fraunces:opsz,wght@9..144,500..800', note: 'soft serif' },
  { name: 'Outfit', query: 'Outfit:wght@500;600;700;800', note: 'friendly geometric' },
  { name: 'Plus Jakarta Sans', query: 'Plus+Jakarta+Sans:wght@500;600;700;800', note: 'subtle' },
  { name: 'Manrope', query: 'Manrope:wght@500;600;700;800', note: 'clean modern' },
  { name: 'Space Grotesk', query: 'Space+Grotesk:wght@500;600;700', note: 'quirky tech' },
  { name: 'Lexend', query: 'Lexend:wght@500;600;700;800', note: 'very readable' },
  { name: 'Playfair Display', query: 'Playfair+Display:wght@600;700;800', note: 'classic serif' },
  { name: 'DM Serif Display', query: 'DM+Serif+Display', note: 'bold serif' },
];

export const FONT_FALLBACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const findHeadingFont = (name) => FONT_OPTIONS.find((f) => f.name === name) || null;

/** Load the font's stylesheet once. */
export const ensureFontLink = (query) => {
  const id = `heading-font-${query.split(':')[0]}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  document.head.appendChild(link);
};

/** Point `--font-display` at the named font (empty / unknown = back to the project default). */
export const applyHeadingFont = (name) => {
  const root = document.documentElement;
  const option = findHeadingFont(name);
  if (!option) {
    root.style.removeProperty('--font-display');
    return;
  }
  ensureFontLink(option.query);
  root.style.setProperty('--font-display', `'${option.name}', ${FONT_FALLBACK}`);
};
