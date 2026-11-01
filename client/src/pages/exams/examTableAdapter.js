import { getEffectiveDataType, resolveFieldOptions } from './examFieldTypes';
import { isTableSourceField } from './tableLookupApi';

/** Map builder field types onto DynamicTable DataType */
const toTableDataType = (field) => {
  const t = getEffectiveDataType(field);
  if (t === 'code' || t === 'mono') return 'text';
  if (t === 'dot') return 'boolean';
  if (t === 'linked') return 'text';
  return t || 'text';
};

const toIsoDateTime = (value) => {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toISOString();
};

const auditCol = (key, label, dataType, order, width = 160) => ({
  key,
  label,
  dataType,
  order,
  visible: true,
  pinned: null,
  width,
  editable: false,
  required: false,
  filterable: true,
  sortable: true,
});

/** System audit columns always shown on the exams table */
export const EXAM_AUDIT_COLUMNS = [
  auditCol('__created_by', 'Created by', 'text', 8998, 160),
  auditCol('__updated_by', 'Modify by', 'text', 8999, 160),
  auditCol('created_at', 'Created at', 'datetime', 9001, 170),
  auditCol('updated_at', 'Updated at', 'datetime', 9002, 170),
];

/** Builder field keys that should show the resolved creator / modifier */
const CREATED_BY_KEYS = new Set(['created_by', 'createdby', 'created_by_user']);
const MODIFY_BY_KEYS = new Set([
  'modify_by',
  'modified_by',
  'updated_by',
  'modifyby',
  'modifiedby',
]);

/** DynamicTable columns for field-builder defs only (no audit columns); shared by exams and vendors */
export const buildFieldColumns = (fields = []) =>
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
      // Linked values follow another field, so they are read-only. Table-column fields are edited
      // by searching their source table (the cell stores that row's id).
      editable: !isAuto && dataType !== 'formula' && dataType !== 'composite' && field.dataType !== 'linked',
      lookup: isTableSourceField(field)
        ? {
            table: field.tableSource.table,
            column: field.tableSource.column,
            detailColumn: field.tableSource.detailColumn,
          }
        : undefined,
      required: Boolean(field.required) && !isAuto,
      filterable: true,
      sortable: true,
      options: options.length ? options : undefined,
      formula: field.formula,
      resultType: dataType === 'formula' ? 'text' : undefined,
    };
  });

/** Build exam DynamicTable columns: builder fields plus the audit columns */
export const buildExamTableColumns = (fields = []) => {
  const dynamic = buildFieldColumns(fields);

  // Avoid duplicating if builder already defined these keys
  const keys = new Set(dynamic.map((c) => c.key));
  const lowerKeys = new Set([...keys].map((k) => String(k).toLowerCase()));
  const hasCreatedByField = [...CREATED_BY_KEYS].some((k) => lowerKeys.has(k));
  const hasModifyByField = [...MODIFY_BY_KEYS].some((k) => lowerKeys.has(k));

  const audit = EXAM_AUDIT_COLUMNS.filter((c) => {
    if (keys.has(c.key)) return false;
    if (c.key === '__created_by' && hasCreatedByField) return false;
    if (c.key === '__updated_by' && hasModifyByField) return false;
    return true;
  });
  return [...dynamic, ...audit];
};

const resolveActorLabel = (label, email, fallback) =>
  label || email || fallback || '';

/** Build DynamicTable rows from SQL exam records */
export const buildExamTableRows = (exams = []) =>
  (exams || []).map((exam) => {
    const values =
      exam.values && typeof exam.values === 'object' ? { ...exam.values } : {};

    const createdLabel = resolveActorLabel(
      exam.createdByLabel,
      exam.createdByEmail,
      '',
    );
    const updatedLabel = resolveActorLabel(
      exam.updatedByLabel,
      exam.updatedByEmail,
      createdLabel,
    );

    values.created_at = toIsoDateTime(exam.createdAt ?? values.created_at);
    values.updated_at = toIsoDateTime(exam.updatedAt ?? values.updated_at);
    values.__created_by = createdLabel;
    values.__updated_by = updatedLabel;

    // Always resolve builder Created by / Modify by keys from SQL user join
    Object.keys(values).forEach((key) => {
      const lower = String(key).toLowerCase();
      if (CREATED_BY_KEYS.has(lower)) values[key] = createdLabel;
      if (MODIFY_BY_KEYS.has(lower)) values[key] = updatedLabel;
    });
    CREATED_BY_KEYS.forEach((k) => {
      if (!(k in values)) values[k] = createdLabel;
    });
    MODIFY_BY_KEYS.forEach((k) => {
      if (!(k in values)) values[k] = updatedLabel;
    });

    return {
      rowId: exam.id,
      id: exam.id,
      version: 1,
      values,
    };
  });
