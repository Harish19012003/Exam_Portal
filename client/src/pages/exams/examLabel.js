import { resolveExamScheduleFields, toDayKey } from './examDateWindow';

export const pick = (values, keys) => {
  for (const key of keys) {
    const v = values?.[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

/** "UPPSC (Bio-Metric - abc)" — service / project code parts are optional. */
export const buildExamLabel = (exam) => {
  const values = exam?.values || {};
  const name = pick(values, ['exam_name', 'name', 'title']) || 'Untitled exam';
  const detail = [pick(values, ['service']), pick(values, ['project_code'])]
    .filter(Boolean)
    .join(' - ');
  return detail ? `${name} (${detail})` : name;
};

const formatDayLabel = (dayKey) => {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return '';
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const valueDay = (values, key) => {
  if (!key) return '';
  return toDayKey(values?.[key]);
};

/**
 * Short schedule label for lists/dialogs, e.g. "May 3, 2026" or "May 1 – May 3, 2026".
 * Prefers fields marked scheduleRole start/end; falls back to common date keys.
 */
export const buildExamDateLabel = (exam, fields = []) => {
  const values = exam?.values || {};
  const schedule = resolveExamScheduleFields(fields);

  let start = '';
  let end = '';
  if (schedule) {
    start = valueDay(values, schedule.startKey);
    end = valueDay(values, schedule.endKey);
  }
  if (!start && !end) {
    start = pick(values, ['start_date', 'exam_start', 'exam_date', 'date']);
    end = pick(values, ['end_date', 'exam_end']);
    start = toDayKey(start);
    end = toDayKey(end);
  }
  if (!start && !end) return '';
  if (!start) start = end;
  if (!end) end = start;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const startLabel = formatDayLabel(start);
  const endLabel = formatDayLabel(end);
  if (!startLabel) return '';
  if (start === end) return startLabel;
  return `${startLabel} – ${endLabel}`;
};
