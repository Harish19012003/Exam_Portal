import { DEFAULT_DEVICE_MASTER_VIEW } from '@exam-view/shared';
import { apiClient } from '../../api/client';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** Device Master field presets: { id, name, view, fields, fieldCount, features, updatedAt } */
export const listDevicePresets = async () => {
  const rows = unwrap(await apiClient.get('/device-presets'));
  return Array.isArray(rows) ? rows : [];
};

export const createDevicePreset = async (preset) => unwrap(await apiClient.post('/device-presets', preset));
export const updateDevicePreset = async (id, preset) =>
  unwrap(await apiClient.patch(`/device-presets/${id}`, preset));
export const deleteDevicePreset = async (id) => unwrap(await apiClient.delete(`/device-presets/${id}`));

export const bulkSaveDevicePresets = async (presets) =>
  unwrap(await apiClient.post('/device-presets/bulk', { presets }));

export const presetsForDeviceView = (presets, view = DEFAULT_DEVICE_MASTER_VIEW) => {
  const viewKey = String(view || DEFAULT_DEVICE_MASTER_VIEW);
  return (Array.isArray(presets) ? presets : []).filter(
    (p) => String(p?.view || DEFAULT_DEVICE_MASTER_VIEW) === viewKey,
  );
};
