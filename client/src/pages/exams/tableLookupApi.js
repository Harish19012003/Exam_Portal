import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Tables a field can read options from: [{ table, label, columns: [{ key, label }] }] */
export const listLookupSources = async () => {
  const rows = unwrap(await apiClient.get('/table-lookup/sources'));
  return Array.isArray(rows) ? rows : [];
};

/** One page of source rows matching `q`: { items: [{ id, label, detail }], hasMore } */
export const searchLookupRows = async ({
  table,
  column,
  detailColumn,
  q = '',
  skip = 0,
  limit = 20,
  signal,
}) =>
  unwrap(
    await apiClient.get(`/table-lookup/${table}/rows`, {
      params: { column, detailColumn: detailColumn || undefined, q, skip, limit },
      signal,
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

/** Dropdown / multi whose options are people filtered by configured user tags. */
export const isUserTagsField = (field) =>
  field?.optionsSource === 'userTags' && Array.isArray(field.userTagIds) && field.userTagIds.length > 0;

export const lookupText = (item) => (item?.detail ? `${item.label} · ${item.detail}` : item?.label || '');
export const MISSING_LABEL = '(missing)';

/** A read-only field that shows `linkedFrom.column` of the row picked in another (table column) field. */
export const isLinkedField = (field) =>
  field?.dataType === 'linked' && Boolean(field.linkedFrom?.fieldKey && field.linkedFrom?.column);

export const linkedFieldsOf = (fields, sourceKey) =>
  (fields || []).filter((f) => isLinkedField(f) && f.linkedFrom.fieldKey === sourceKey);

/** Read-only center-list field that mirrors a value from the parent exam record. */
export const isFromExamField = (field) =>
  field?.dataType === 'fromExam' && Boolean(field.examFieldKey);

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

/**
 * Extra source columns to resolve when picking `field`, so sibling group members and linked
 * value fields can fill in without a second round-trip after save.
 */
export const resolveColumnsForLookupField = (fields, field) => {
  if (!isTableSourceField(field)) return [];
  const cols = new Set();
  const group = lookupGroupOf(field);
  (fields || []).forEach((f) => {
    if (group && lookupGroupOf(f) === group && f.tableSource?.column) {
      cols.add(f.tableSource.column);
      if (f.tableSource.detailColumn) cols.add(f.tableSource.detailColumn);
    }
  });
  linkedFieldsOf(fields, field.key).forEach((l) => {
    if (l.linkedFrom?.column) cols.add(l.linkedFrom.column);
  });
  // Also linked fields hanging off other members of the same group.
  if (group) {
    (fields || []).forEach((f) => {
      if (lookupGroupOf(f) !== group) return;
      linkedFieldsOf(fields, f.key).forEach((l) => {
        if (l.linkedFrom?.column) cols.add(l.linkedFrom.column);
      });
    });
  }
  cols.delete(field.tableSource.column);
  if (field.tableSource.detailColumn) cols.delete(field.tableSource.detailColumn);
  return [...cols];
};

/**
 * Exam-table cells to paint when `field` is picked: other group members (label · detail) and
 * linked value fields (single column). Used by the picker for a same-tick local patch.
 */
export const syncFieldsForLookupField = (fields, field) => {
  if (!isTableSourceField(field)) return [];
  const group = lookupGroupOf(field);
  const out = [];
  const seen = new Set();
  const add = (entry) => {
    if (!entry?.key || seen.has(entry.key)) return;
    seen.add(entry.key);
    out.push(entry);
  };
  (fields || []).forEach((f) => {
    if (!group || lookupGroupOf(f) !== group) return;
    if (!f.tableSource?.column) return;
    add({
      key: f.key,
      column: f.tableSource.column,
      detailColumn: f.tableSource.detailColumn || undefined,
    });
  });
  const linkSources = group
    ? (fields || []).filter((f) => lookupGroupOf(f) === group).map((f) => f.key)
    : [field.key];
  linkSources.forEach((sourceKey) => {
    linkedFieldsOf(fields, sourceKey).forEach((l) => {
      add({ key: l.key, column: l.linkedFrom.column });
    });
  });
  return out;
};

/** "vendor_record" → "Vendor record" */
export const humanizeGroup = (key) => {
  const text = String(key || '').replace(/_+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};
