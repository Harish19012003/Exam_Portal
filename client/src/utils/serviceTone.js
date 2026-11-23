/** Stable hue per service so "Bio-Metric", "CSO", "Frisking" always get the same colour. */
const SERVICE_HUES = [252, 200, 160, 28, 330, 45, 280, 190];

export const serviceHue = (service) => {
  const key = String(service || '').trim().toLowerCase();
  if (!key) return 220;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SERVICE_HUES[h % SERVICE_HUES.length];
};

/** "REIL RSSB" → "RR", "UPPSC PCS" → "UP". */
export const nameInitials = (name) =>
  String(name || '')
    .split(/[\s/_·-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
