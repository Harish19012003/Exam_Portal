// ─── Shared utility helpers ────────────────────────────────────────────────────

/** Map country name → flag emoji */
export const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'India': '🇮🇳',
  'Germany': '🇩🇪',
  'United Kingdom': '🇬🇧',
  'Japan': '🇯🇵',
  'Mexico': '🇲🇽',
  'Australia': '🇦🇺',
  'Russia': '🇷🇺',
  'South Korea': '🇰🇷',
  'Brazil': '🇧🇷',
  'Egypt': '🇪🇬',
  'France': '🇫🇷',
  'Argentina': '🇦🇷',
  'Poland': '🇵🇱',
  'Sweden': '🇸🇪',
  'Nigeria': '🇳🇬',
  'Norway': '🇳🇴',
  'Israel': '🇮🇱',
  'Saudi Arabia': '🇸🇦',
  'Denmark': '🇩🇰',
  'Canada': '🇨🇦',
  'Iran': '🇮🇷',
  'Italy': '🇮🇹',
  'China': '🇨🇳',
  'UAE': '🇦🇪',
  'Pakistan': '🇵🇰',
  'Singapore': '🇸🇬',
  'Colombia': '🇨🇴',
  'New Zealand': '🇳🇿',
};

export function countryToFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🌐';
}

/** Format a number as currency (USD) */
export function formatCurrency(value: unknown): string {
  const n = Number(value);
  if (isNaN(n)) return String(value ?? '');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format a number with thousand separators */
export function formatNumber(value: unknown): string {
  const n = Number(value);
  if (isNaN(n)) return String(value ?? '');
  return new Intl.NumberFormat('en-US').format(n);
}

/** Parse common date inputs (ISO, timestamps, dd/mm/yyyy, dd-mm-yyyy) */
function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  // Numeric timestamp
  if (!isNaN(Number(raw)) && raw.length >= 10) {
    const d = new Date(Number(raw));
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy or dd-mm-yyyy (with optional time)
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const hour = dmy[4] != null ? Number(dmy[4]) : 0;
    const minute = dmy[5] != null ? Number(dmy[5]) : 0;
    const second = dmy[6] != null ? Number(dmy[6]) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a date string to locale date */
export function formatDate(value: unknown): string {
  if (!value) return '';
  const d = parseFlexibleDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format a date string to locale datetime */
export function formatDatetime(value: unknown): string {
  if (!value) return '';
  const d = parseFlexibleDate(value);
  if (!d) return String(value);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Format a date string or time string to locale time */
export function formatTime(value: unknown): string {
  if (!value) return '';
  try {
    // If it's a simple HH:MM string, prepend a dummy date to parse it
    const strVal = String(value);
    const parseable = strVal.includes('T') || strVal.includes(' ') ? strVal : `1970-01-01T${strVal}`;
    const d = !isNaN(Number(value)) ? new Date(Number(value)) : new Date(parseable);
    if (isNaN(d.getTime())) return strVal;

    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/** Status → color tokens */
export const STATUS_COLORS: Record<
  string,
  { light: string; dark: string; dot: string }
> = {
  Active: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/30 text-emerald-400', dot: 'bg-emerald-500' },
  Inactive: { light: 'bg-gray-100 text-gray-600', dark: 'bg-gray-800 text-gray-400', dot: 'bg-gray-400' },
  Pending: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/30 text-amber-400', dot: 'bg-amber-500' },
};

/** Generate a unique row id */
export function genRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Get initials from a name string (up to 2 chars) */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Consistent avatar background colors based on string hash */
const AVATAR_COLORS = [
  '#6366f1', '#14b8a6', '#f59e0b', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#10b981',
];
export function avatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
