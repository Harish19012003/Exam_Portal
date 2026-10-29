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
