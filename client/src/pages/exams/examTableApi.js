import { DEFAULT_EXAM_VIEW } from '@exam-view/shared';
import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;
const base = (examId) => `/exams/${encodeURIComponent(examId)}/table`;
const withView = (view) => ({ view: view || DEFAULT_EXAM_VIEW });

/** { exists, table, view, fields, features, views } */
export const getExamTable = async (examId, view = DEFAULT_EXAM_VIEW) =>
  unwrap(await apiClient.get(base(examId), { params: withView(view) }));

/** Create the exam's shared table shell (or ensure a tab's field config), optionally from a preset. */
export const createExamTable = async (examId, { presetId, view = DEFAULT_EXAM_VIEW } = {}) =>
  unwrap(
    await apiClient.post(base(examId), {
      ...(presetId != null ? { presetId } : {}),
      ...withView(view),
    }),
  );

/**
 * Save the Fields drawer and/or Feature Builder for one exam tab.
 * The server persists field definitions to match `fields` for that view.
 * Removing fields needs `confirmDrops: true` when data would be deleted.
 */
export const saveExamTableConfig = async (
  examId,
  { fields, features, confirmDrops, view = DEFAULT_EXAM_VIEW } = {},
) =>
  unwrap(
    await apiClient.put(`${base(examId)}/config`, {
      fields,
      features,
      confirmDrops,
      ...withView(view),
    }),
  );

/** Paginated center rows. Defaults: page=1, limit=100 (server max 500). */
export const listExamRows = async (examId, { page = 1, limit = 100 } = {}) =>
  unwrap(
    await apiClient.get(`${base(examId)}/rows`, {
      params: { page, limit },
    }),
  );
export const createExamRow = async (examId, values, view = DEFAULT_EXAM_VIEW) =>
  unwrap(await apiClient.post(`${base(examId)}/rows`, { values, ...withView(view) }));
export const createExamRowsBulk = async (examId, rows, view = DEFAULT_EXAM_VIEW) =>
  unwrap(await apiClient.post(`${base(examId)}/rows/bulk`, { rows, ...withView(view) }));
export const updateExamRow = async (examId, rowId, values, view = DEFAULT_EXAM_VIEW) =>
  unwrap(
    await apiClient.patch(`${base(examId)}/rows/${encodeURIComponent(rowId)}`, {
      values,
      ...withView(view),
    }),
  );

/**
 * Mass Edit against the database.
 * - `{ all: true, values }` → every row in the exam table
 * - `{ ids, values }` → only those row ids
 * - `{ filters, search, searchKeys, values }` → server matches then updates
 */
export const bulkUpdateExamRows = async (
  examId,
  {
    values,
    ids,
    all = false,
    filters,
    search,
    searchKeys,
    view = DEFAULT_EXAM_VIEW,
  } = {},
) =>
  unwrap(
    await apiClient.post(`${base(examId)}/rows/bulk-update`, {
      values,
      ids,
      all: Boolean(all),
      ...(filters && typeof filters === 'object' ? { filters } : {}),
      ...(typeof search === 'string' ? { search } : {}),
      ...(Array.isArray(searchKeys) ? { searchKeys } : {}),
      ...withView(view),
    }),
  );

export const deleteExamRows = async (examId, ids) =>
  unwrap(await apiClient.post(`${base(examId)}/rows/delete`, { ids }));

/** Server validation message if present, else a generic fallback. */
export const apiErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error?.message || fallback;
