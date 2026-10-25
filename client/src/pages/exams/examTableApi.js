import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;
const base = (examId) => `/exams/${encodeURIComponent(examId)}/table`;

/** { exists, table, fields, features } */
export const getExamTable = async (examId) => unwrap(await apiClient.get(base(examId)));
/** Create the exam's table, optionally pre-filled from a field preset. */
export const createExamTable = async (examId, { presetId } = {}) =>
  unwrap(await apiClient.post(base(examId), presetId != null ? { presetId } : {}));

/**
 * Save the Fields drawer and/or Feature Builder for one exam table.
 * The server adds / changes / drops the real SQL columns to match `fields`.
 * Removing fields needs `confirmDrops: true`.
 */
export const saveExamTableConfig = async (examId, { fields, features, confirmDrops } = {}) =>
  unwrap(await apiClient.put(`${base(examId)}/config`, { fields, features, confirmDrops }));

export const listExamRows = async (examId) => unwrap(await apiClient.get(`${base(examId)}/rows`));
export const createExamRow = async (examId, values) =>
  unwrap(await apiClient.post(`${base(examId)}/rows`, { values }));
export const updateExamRow = async (examId, rowId, values) =>
  unwrap(await apiClient.patch(`${base(examId)}/rows/${encodeURIComponent(rowId)}`, { values }));
export const deleteExamRows = async (examId, ids) =>
  unwrap(await apiClient.post(`${base(examId)}/rows/delete`, { ids }));

/** Server validation message if present, else a generic fallback. */
export const apiErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error?.message || fallback;
