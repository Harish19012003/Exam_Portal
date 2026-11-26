/**
 * Hardcoded Center-CSR-Matching columns — always present, never stored in meta.
 * Extra custom fields may be added later via Manage Fields / Bulk Fields.
 */

/** @typedef {{ id: string, key: string, label: string, dataType: string, order: number, required: boolean }} FixedFieldDef */

/** @type {FixedFieldDef[]} */
export const CENTER_CSR_FIXED_FIELDS = [
  { id: 'fixed_exam_date', key: 'exam_date', label: 'Exam Date', dataType: 'date', order: 1, required: false },
  { id: 'fixed_exam_shift', key: 'exam_shift', label: 'Exam Shift', dataType: 'text', order: 2, required: false },
  { id: 'fixed_center_code', key: 'center_code', label: 'Center Code', dataType: 'text', order: 3, required: false },
  { id: 'fixed_client_code', key: 'client_code', label: 'Client Code', dataType: 'text', order: 4, required: false },
];

export const CENTER_CSR_FIXED_KEYS = CENTER_CSR_FIXED_FIELDS.map((f) => f.key);
export const CENTER_CSR_FIXED_KEY_SET = new Set(CENTER_CSR_FIXED_KEYS);

/** Hardcoded defs (cloned so callers cannot mutate the module constant). */
export const hardcodedFixedFields = () => CENTER_CSR_FIXED_FIELDS.map((f) => ({ ...f }));

/** Drop any fixed-key defs; keep only extra custom fields for meta storage. */
export const stripFixedFields = (fields = []) =>
  (Array.isArray(fields) ? fields : []).filter((f) => f?.key && !CENTER_CSR_FIXED_KEY_SET.has(f.key));

/** Hardcoded fixed columns first, then extras (re-ordered). */
export const withHardcodedFixedFields = (extras = []) => {
  const fixed = hardcodedFixedFields();
  const rest = stripFixedFields(extras).map((f, i) => ({ ...f, order: fixed.length + i + 1 }));
  return [...fixed, ...rest];
};
