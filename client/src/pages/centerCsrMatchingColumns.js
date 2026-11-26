/**
 * Hardcoded Center-CSR-Matching columns — always present in the table.
 * Extra fields may be added later via Manage Fields / Bulk Fields (stored in meta).
 */

/** @typedef {{ id: string, key: string, label: string, dataType: string, order: number, required?: boolean }} CenterCsrFixedColumn */

/** @type {CenterCsrFixedColumn[]} */
export const CENTER_CSR_FIXED_COLUMNS = [
  { id: 'fixed_exam_date', key: 'exam_date', label: 'Exam Date', dataType: 'date', order: 1, required: false },
  { id: 'fixed_exam_shift', key: 'exam_shift', label: 'Exam Shift', dataType: 'text', order: 2, required: false },
  { id: 'fixed_center_code', key: 'center_code', label: 'Center Code', dataType: 'text', order: 3, required: false },
  { id: 'fixed_client_code', key: 'client_code', label: 'Client Code', dataType: 'text', order: 4, required: false },
];

export const CENTER_CSR_FIXED_KEYS = CENTER_CSR_FIXED_COLUMNS.map((c) => c.key);
export const CENTER_CSR_FIXED_KEY_SET = new Set(CENTER_CSR_FIXED_KEYS);

/** System + hardcoded keys that new custom fields may not use. */
export const CENTER_CSR_RESERVED_KEYS = [
  'id',
  'version',
  'created_at',
  'updated_at',
  ...CENTER_CSR_FIXED_KEYS,
];

/** Hardcoded defs (cloned). */
export const hardcodedCenterCsrFields = () => CENTER_CSR_FIXED_COLUMNS.map((f) => ({ ...f }));

/** Drop hardcoded keys — extras only (what presets / meta store). */
export const stripCenterCsrFixedFields = (fields = []) =>
  (Array.isArray(fields) ? fields : []).filter((f) => f?.key && !CENTER_CSR_FIXED_KEY_SET.has(f.key));

/** Hardcoded columns first, then extras — for table / field-builder display. */
export const withHardcodedCenterCsrFields = (extras = []) => {
  const fixed = hardcodedCenterCsrFields();
  const rest = stripCenterCsrFixedFields(extras).map((f, i) => ({
    ...f,
    order: fixed.length + i + 1,
  }));
  return [...fixed, ...rest];
};
