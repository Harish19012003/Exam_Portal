import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Field presets per service: { id, name, serviceValue, fields, fieldCount, features, updatedAt } */
export const listExamPresets = async () => {
  const rows = unwrap(await apiClient.get('/exam-presets'));
  return Array.isArray(rows) ? rows : [];
};

export const createExamPreset = async (preset) => unwrap(await apiClient.post('/exam-presets', preset));
export const updateExamPreset = async (id, preset) =>
  unwrap(await apiClient.patch(`/exam-presets/${id}`, preset));
export const deleteExamPreset = async (id) => unwrap(await apiClient.delete(`/exam-presets/${id}`));

/** Preset for a service value (same case-insensitive match the server uses), or null. */
export const findPresetForService = (presets, serviceValue) => {
  const wanted = String(serviceValue ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return presets.find((p) => p.serviceValue.trim().toLowerCase() === wanted) || null;
};
