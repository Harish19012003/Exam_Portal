import { DATE_LINK_TYPES, formatISODate } from './examFieldTypes';

export const EXAM_DATE_WINDOWS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
];

export const SCHEDULE_ROLE_OPTIONS = [
  { value: '', label: 'Not used for chips' },
  { value: 'start', label: 'Schedule start' },
  { value: 'end', label: 'Schedule end' },
];

const isDateField = (field) => DATE_LINK_TYPES.has(field?.dataType);

/**
 * Resolve schedule start/end from fields the user marked (scheduleRole).
 * No name/key heuristics — chips stay inactive until mapped.
 * @returns {{ startKey: string, endKey: string } | null}
 */
export const resolveExamScheduleFields = (fields = []) => {
  const dateFields = (fields || []).filter(isDateField);
  if (dateFields.length === 0) return null;

  const start = dateFields.find((f) => f.scheduleRole === 'start');
  const end = dateFields.find((f) => f.scheduleRole === 'end');

  if (start && end) return { startKey: start.key, endKey: end.key };
  if (start) return { startKey: start.key, endKey: start.key };
  if (end) return { startKey: end.key, endKey: end.key };
  return null;
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
 * When no schedule roles are set, non-All windows are a no-op (show all).
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

    // Upcoming: based on start date (today or later).
    if (window === 'upcoming') return start >= today;
    // Today: schedule span covers today.
    if (window === 'today') return start <= today && today <= end;
    // Last 7 days: based on end date falling in [today−6 … today].
    if (window === 'last7') return end >= last7Start && end <= today;
    return true;
  });
};
