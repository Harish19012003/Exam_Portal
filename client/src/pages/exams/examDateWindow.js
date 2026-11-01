import { DATE_LINK_TYPES, formatISODate } from './examFieldTypes';

export const EXAM_DATE_WINDOWS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
];

const normText = (field) =>
  `${field?.key || ''} ${field?.label || ''}`.toLowerCase().replace(/[_-]+/g, ' ');

const isDateField = (field) => DATE_LINK_TYPES.has(field?.dataType);

const looksLikeStart = (field) => {
  const t = normText(field);
  return (
    /\bstart\s*date\b/.test(t) ||
    /\bstart\b/.test(t) ||
    /\bfrom\s*date\b/.test(t) ||
    (/\bfrom\b/.test(t) && /\bdate\b/.test(t))
  );
};

const looksLikeEnd = (field) => {
  const t = normText(field);
  return (
    /\bend\s*date\b/.test(t) ||
    /\bend\b/.test(t) ||
    /\bto\s*date\b/.test(t) ||
    (/\bto\b/.test(t) && /\bdate\b/.test(t))
  );
};

/**
 * Resolve schedule start/end field keys from builder fields (no hardcoded keys).
 * @returns {{ startKey: string, endKey: string } | null}
 */
export const resolveExamScheduleFields = (fields = []) => {
  const dateFields = (fields || []).filter(isDateField);
  if (dateFields.length === 0) return null;

  const start = dateFields.find(looksLikeStart);
  const end = dateFields.find(looksLikeEnd);

  if (start && end) return { startKey: start.key, endKey: end.key };
  if (start) return { startKey: start.key, endKey: start.key };
  if (end) return { startKey: end.key, endKey: end.key };

  // Single (or first) date field stands in for the whole span.
  const only = dateFields[0];
  return { startKey: only.key, endKey: only.key };
};

/** Parse a cell value to local calendar day as yyyy-mm-dd, or ''. */
export const toDayKey = (value) => {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatISODate(value);
  }
  const s = String(value).trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return formatISODate(d);
};

const addDays = (dayKey, delta) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return formatISODate(dt);
};

const cellDay = (row, key) => {
  if (!key) return '';
  const raw = row?.rawValues?.[key] ?? row?.values?.[key];
  return toDayKey(raw);
};

/**
 * Filter DynamicTable exam rows by date window.
 * When no schedule fields resolve, non-All windows are a no-op (show all).
 * Rows with no usable dates are hidden on non-All windows.
 */
export const filterRowsByDateWindow = (rows = [], fields = [], window = 'all') => {
  if (!window || window === 'all') return rows;

  const schedule = resolveExamScheduleFields(fields);
  if (!schedule) return rows;

  const today = formatISODate(new Date());
  const last7Start = addDays(today, -6);

  return (rows || []).filter((row) => {
    let start = cellDay(row, schedule.startKey);
    let end = cellDay(row, schedule.endKey);
    if (!start && !end) return false;
    if (!start) start = end;
    if (!end) end = start;
    // Normalize inverted spans.
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    if (window === 'upcoming') return end >= today;
    if (window === 'today') return start <= today && today <= end;
    if (window === 'last7') return start <= today && end >= last7Start;
    return true;
  });
};
