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

/** Format a date string to locale date */
export function formatDate(value: unknown): string {
  if (!value) return '';
  try {
    const d = !isNaN(Number(value)) ? new Date(Number(value)) : new Date(String(value));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

/** Format a date string to locale datetime */
export function formatDatetime(value: unknown): string {
  if (!value) return '';
  try {
    const d = !isNaN(Number(value)) ? new Date(Number(value)) : new Date(String(value));
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
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
  Active:         { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/30 text-emerald-400', dot: 'bg-emerald-500' },
  ACTIVE:         { light: 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]', dark: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800', dot: 'bg-[#10b981]' },
  Inactive:       { light: 'bg-gray-100 text-gray-600',       dark: 'bg-gray-800 text-gray-400',          dot: 'bg-gray-400'   },
  INACTIVE:       { light: 'bg-gray-100 text-gray-600',       dark: 'bg-gray-800 text-gray-400',          dot: 'bg-gray-400'   },
  Pending:        { light: 'bg-amber-100 text-amber-700',      dark: 'bg-amber-900/30 text-amber-400',    dot: 'bg-amber-500'  },
  PENDING:        { light: 'bg-amber-100 text-amber-700',      dark: 'bg-amber-900/30 text-amber-400',    dot: 'bg-amber-500'  },
  Suspended:      { light: 'bg-rose-100 text-rose-700',        dark: 'bg-rose-950/40 text-rose-400 border border-rose-800/60', dot: 'bg-rose-500' },
  SUSPENDED:      { light: 'bg-rose-100 text-rose-700',        dark: 'bg-rose-950/40 text-rose-400 border border-rose-800/60', dot: 'bg-rose-500' },
  'Under Review': { light: 'bg-blue-100 text-blue-700',        dark: 'bg-blue-950/40 text-blue-400 border border-blue-800/60', dot: 'bg-blue-500' },
  'UNDER REVIEW': { light: 'bg-blue-100 text-blue-700',        dark: 'bg-blue-950/40 text-blue-400 border border-blue-800/60', dot: 'bg-blue-500' },
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
