const pad = (n: number) => String(n).padStart(2, '0');

/** Normalize any date-ish value to `YYYY-MM-DD`. */
export function toDateValue(value: unknown): string {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normalize any datetime-ish value to `YYYY-MM-DDTHH:mm`. */
export function toDatetimeLocalValue(value: unknown): string {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.slice(0, 16);
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Normalize any time-ish value to `HH:mm`. */
export function toTimeValue(value: unknown): string {
  if (!value && value !== 0) return '';
  const str = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const [h, m] = str.split(':');
    return `${pad(Number(h))}:${pad(Number(m))}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(11, 16);
  const d = new Date(str.includes('T') || str.includes(' ') ? str : `1970-01-01T${str}`);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function splitDatetimeLocal(value: string): { date: string; time: string } {
  const normalized = toDatetimeLocalValue(value);
  if (!normalized) return { date: '', time: '00:00' };
  return { date: normalized.slice(0, 10), time: normalized.slice(11, 16) };
}

export function joinDatetimeLocal(date: string, time: string): string {
  if (!date) return '';
  const t = toTimeValue(time) || '00:00';
  return `${date}T${t}`;
}

export function formatDateDisplay(value: string): string {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDatetimeDisplay(value: string): string {
  if (!value) return '';
  const d = new Date(toDatetimeLocalValue(value));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTimeDisplay(value: string): string {
  if (!value) return '';
  const t = toTimeValue(value);
  const d = new Date(`1970-01-01T${t}`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function buildMonthGrid(monthDate: Date): { date: Date; inMonth: boolean }[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function isDateInRange(key: string, min?: string, max?: string): boolean {
  if (min && key < min) return false;
  if (max && key > max) return false;
  return true;
}

export function buildMinuteOptions(step = 1, includeMinute?: string): string[] {
  const safeStep = Math.max(1, Math.min(30, step));
  const options: string[] = [];
  for (let m = 0; m < 60; m += safeStep) options.push(pad(m));
  if (includeMinute) {
    const normalized = pad(Number(includeMinute));
    if (!options.includes(normalized)) {
      options.push(normalized);
      options.sort((a, b) => Number(a) - Number(b));
    }
  }
  return options;
}

export function buildHourOptions(): string[] {
  return Array.from({ length: 24 }, (_, h) => pad(h));
}

export function snapMinute(minute: string, step = 1): string {
  const n = Number(minute);
  if (isNaN(n)) return '00';
  if (step <= 1) return pad(Math.min(59, Math.max(0, n)));
  const safeStep = Math.max(1, Math.min(30, step));
  const snapped = Math.round(n / safeStep) * safeStep;
  return pad(Math.min(59, Math.max(0, snapped)));
}

export type Meridiem = 'AM' | 'PM';

export function to12HourParts(time24: string): { hour12: number; minute: string; period: Meridiem } {
  const t = toTimeValue(time24);
  const h24 = Number(t.slice(0, 2));
  const minute = t.slice(3, 5);
  const period: Meridiem = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

export function from12HourParts(hour12: number, minute: string, period: Meridiem): string {
  let h24 = hour12 % 12;
  if (period === 'PM') h24 += 12;
  return `${pad(h24)}:${pad(Number(minute))}`;
}

export const HOUR12_OPTIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
