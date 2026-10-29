import { AppError } from '../../../core/errors.js';
import { ERROR_CODES } from '@exam-view/shared';

/** Field types where "no two records share this value" makes sense (choice and flag fields repeat by nature). */
export const UNIQUE_FIELD_TYPES = new Set(['text', 'code', 'mono', 'email', 'phone', 'number', 'currency', 'link']);

export const uniqueFields = (fields) => (fields || []).filter((f) => f.unique === true && UNIQUE_FIELD_TYPES.has(f.dataType));

/** Compare ignoring case and surrounding spaces; blanks never collide, so a unique field may be left empty. */
export const normalizeUnique = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().toLowerCase();
  return text === '' ? null : text;
};

const duplicateError = (field, value, prefix = '', inFile = false) =>
  new AppError(
    `${prefix}${field.label} "${String(value).trim()}" ${inFile ? 'appears more than once in the file' : 'already exists'}`,
    409,
    ERROR_CODES.CONFLICT,
  );

/** Throws when `values` (only the keys present are checked) reuses a unique value held by another row. */
export const assertUniqueValues = (fields, values, existingRows, { excludeId } = {}) => {
  uniqueFields(fields).forEach((field) => {
    if (!(field.key in values)) return;
    const wanted = normalizeUnique(values[field.key]);
    if (wanted === null) return;
    if (existingRows.some((row) => String(row.id) !== String(excludeId) && normalizeUnique(row[field.key]) === wanted)) {
      throw duplicateError(field, values[field.key]);
    }
  });
};

/** Throws for the first row in `rows` that repeats a unique value, already stored (unless `ignoreExisting`) or earlier in `rows`. */
export const assertUniqueBatch = (fields, rows, existingRows, { ignoreExisting = false } = {}) => {
  uniqueFields(fields).forEach((field) => {
    const seen = new Set(ignoreExisting ? [] : existingRows.map((r) => normalizeUnique(r[field.key])).filter((v) => v !== null));
    rows.forEach((row, i) => {
      const value = normalizeUnique(row[field.key]);
      if (value === null) return;
      if (seen.has(value)) {
        const inFile = rows.slice(0, i).some((r) => normalizeUnique(r[field.key]) === value);
        throw duplicateError(field, row[field.key], `Row ${i + 1}: `, inFile);
      }
      seen.add(value);
    });
  });
};

/** Drops rows whose unique value is already stored (unless `ignoreExisting`) or repeated earlier in `rows`. */
export const dropUniqueConflicts = (fields, rows, existingRows, { ignoreExisting = false } = {}) => {
  const unique = uniqueFields(fields);
  if (!unique.length) return { rows, skipped: 0 };
  const seen = new Map(
    unique.map((f) => [f.key, new Set(ignoreExisting ? [] : existingRows.map((r) => normalizeUnique(r[f.key])).filter((v) => v !== null))]),
  );
  const kept = rows.filter((row) => {
    const values = unique.map((f) => [f.key, normalizeUnique(row[f.key])]);
    if (values.some(([key, v]) => v !== null && seen.get(key).has(v))) return false;
    values.forEach(([key, v]) => v !== null && seen.get(key).add(v));
    return true;
  });
  return { rows: kept, skipped: rows.length - kept.length };
};

/** Refuse to make a field unique while the existing rows already repeat a value in it. */
export const assertCanBecomeUnique = (field, existingRows) => {
  if (!UNIQUE_FIELD_TYPES.has(field.dataType)) {
    throw new AppError(`"${field.label}" is a ${field.dataType} field and cannot be unique`, 400, ERROR_CODES.VALIDATION_ERROR);
  }
  const counts = new Map();
  existingRows.forEach((row) => {
    const value = normalizeUnique(row[field.key]);
    if (value !== null) counts.set(value, (counts.get(value) || 0) + 1);
  });
  const repeated = [...counts.entries()].filter(([, n]) => n > 1);
  if (repeated.length) {
    throw new AppError(
      `Cannot make "${field.label}" unique: ${repeated.length} value${repeated.length === 1 ? ' is' : 's are'} used by more than one record (for example "${repeated[0][0]}"). Fix or delete the duplicates first.`,
      409,
      ERROR_CODES.CONFLICT,
    );
  }
};
