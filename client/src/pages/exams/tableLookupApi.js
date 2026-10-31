import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Tables a field can read options from: [{ table, label, columns: [{ key, label }] }] */
export const listLookupSources = async () => {
  const rows = unwrap(await apiClient.get('/table-lookup/sources'));
  return Array.isArray(rows) ? rows : [];
};

/** One page of source rows matching `q`: { items: [{ id, label, detail }], hasMore } */
export const searchLookupRows = async ({ table, column, detailColumn, q = '', skip = 0, limit = 20 }) =>
  unwrap(
    await apiClient.get(`/table-lookup/${table}/rows`, {
      params: { column, detailColumn: detailColumn || undefined, q, skip, limit },
    }),
  );

/**
 * Current labels for saved row ids: { [id]: { id, label, detail, values } } (gone / hidden rows are absent).
 * `columns` also returns those columns' values under `values`, for linked fields.
 */
export const resolveLookupRows = async ({ table, column, detailColumn, columns, ids }) =>
  unwrap(
    await apiClient.post(`/table-lookup/${table}/resolve`, {
      column: column || undefined,
      detailColumn: detailColumn || undefined,
      columns: columns && columns.length ? columns : undefined,
      ids,
    }),
  );

export const isTableSourceField = (field) =>
  field?.optionsSource === 'table' && Boolean(field.tableSource?.table && field.tableSource?.column);

export const lookupText = (item) => (item?.detail ? `${item.label} · ${item.detail}` : item?.label || '');
export const MISSING_LABEL = '(missing)';

/** A read-only field that shows `linkedFrom.column` of the row picked in another (table column) field. */
export const isLinkedField = (field) =>
  field?.dataType === 'linked' && Boolean(field.linkedFrom?.fieldKey && field.linkedFrom?.column);

export const linkedFieldsOf = (fields, sourceKey) =>
  (fields || []).filter((f) => isLinkedField(f) && f.linkedFrom.fieldKey === sourceKey);

/* ---------- Column groups ----------
 * Fields that read from the same table and move together: pick a row in any editable member and
 * every other editable member takes the same row (they all store that row's id). Read-only
 * members are Linked values that point at one of them.
 */

/** Group key of a table-column field, or '' when it is not in a group. */
export const lookupGroupOf = (field) => (isTableSourceField(field) && field.lookupGroup ? field.lookupGroup : '');

/** Values to set on the other members of `changedKey`'s group when it changes. */
export const groupSyncPatch = (fields, changedKey, value) => {
  const group = lookupGroupOf((fields || []).find((f) => f.key === changedKey));
  if (!group) return {};
  const patch = {};
  fields.forEach((f) => {
    if (f.key !== changedKey && lookupGroupOf(f) === group) patch[f.key] = value;
  });
  return patch;
};

/** "vendor_record" → "Vendor record" */
export const humanizeGroup = (key) => {
  const text = String(key || '').replace(/_+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};
