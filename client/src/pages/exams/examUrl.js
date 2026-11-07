/**
 * Exam ids look like `exam_<time>_<suffix>`; the URL drops the redundant `exam_` prefix.
 * Old links that still carry the prefix keep working.
 */
const PREFIX = 'exam_';

export const examUrlId = (id) => {
  const s = String(id || '');
  return s.startsWith(PREFIX) ? s.slice(PREFIX.length) : s;
};

export const examIdFromUrl = (param) => {
  const s = String(param || '');
  return !s || s.startsWith(PREFIX) ? s : `${PREFIX}${s}`;
};

export const examPath = (id, tab = 'center-list') =>
  `/exams/${encodeURIComponent(examUrlId(id))}/${tab}`;
