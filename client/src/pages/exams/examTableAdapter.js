import { getEffectiveDataType, resolveFieldOptions } from './examFieldTypes';

/** Map builder field types onto DynamicTable DataType */
const toTableDataType = (field) => {
  const t = getEffectiveDataType(field);
  if (t === 'code' || t === 'mono') return 'text';
  if (t === 'dot') return 'boolean';
  return t || 'text';
};

/** Build DynamicTable columns from field-builder defs (fully dynamic) */
export const buildExamTableColumns = (fields = []) =>
  (fields || []).map((field, index) => {
    const dataType = toTableDataType(field);
    const isAuto = field.autoFill && field.autoFill !== 'none';
    const options = resolveFieldOptions(field);
    return {
      key: field.key,
      label: field.label || field.key,
      dataType,
      order: field.order ?? index + 1,
      visible: true,
      pinned: null,
      width: dataType === 'date' || dataType === 'datetime' ? 150 : 180,
      editable: !isAuto && dataType !== 'formula' && dataType !== 'composite',
      required: Boolean(field.required) && !isAuto,
      filterable: true,
      sortable: true,
      options: options.length ? options : undefined,
      formula: field.formula,
      resultType: dataType === 'formula' ? 'text' : undefined,
    };
  });

/** Build DynamicTable rows from IndexedDB exam records */
export const buildExamTableRows = (exams = []) =>
  (exams || []).map((exam) => ({
    rowId: exam.id,
    id: exam.id,
    version: 1,
    values: exam.values && typeof exam.values === 'object' ? { ...exam.values } : {},
  }));
