import { useMemo } from 'react';
import { isFromExamField } from './tableLookupApi';

const formatDateish = (raw, dataType) => {
  const s = String(raw);
  if (dataType === 'date' && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (dataType === 'datetime' && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const [datePart, timePart = ''] = s.split('T');
    const [y, m, d] = datePart.split('-');
    const time = timePart.slice(0, 5);
    return time ? `${d}/${m}/${y} ${time}` : `${d}/${m}/${y}`;
  }
  return s;
};

const displayValue = (raw, sourceField) => {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(', ');
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  const dataType = sourceField?.dataType;
  if (dataType === 'date' || dataType === 'datetime') return formatDateish(raw, dataType);
  return String(raw);
};

/**
 * Paint fromExam center-list fields from the parent exam.values (live, not stored on the row).
 */
export const useExamValueDisplayRows = (rows, fields, examValues, examSourceFields = []) => {
  const fromExamFields = useMemo(() => (fields || []).filter(isFromExamField), [fields]);
  const sourceByKey = useMemo(() => {
    const map = {};
    (examSourceFields || []).forEach((f) => {
      if (f?.key) map[f.key] = f;
    });
    return map;
  }, [examSourceFields]);

  return useMemo(() => {
    if (!fromExamFields.length) return rows;
    const source = examValues && typeof examValues === 'object' ? examValues : {};
    return (rows || []).map((row) => {
      const values = { ...row.values };
      const rawBase = row.rawValues || row.values || {};
      fromExamFields.forEach((f) => {
        values[f.key] = displayValue(source[f.examFieldKey], sourceByKey[f.examFieldKey]);
      });
      return { ...row, values, rawValues: rawBase };
    });
  }, [rows, fromExamFields, examValues, sourceByKey]);
};

/** Drop painted fromExam keys before save (same idea as linked fields). */
export const restoreFromExamValues = (updatedValues, originalValues, fields) => {
  const next = { ...updatedValues };
  (fields || []).filter(isFromExamField).forEach((f) => {
    if (originalValues && f.key in originalValues) next[f.key] = originalValues[f.key];
    else delete next[f.key];
  });
  return next;
};
