import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at']);

export const mapDeviceRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchDeviceList = async () => {
  const res = await apiClient.get('/devices');
  const list = res.data?.data || res.data;
  return mapDeviceRows(list);
};

const fetchDeviceConfig = async () => {
  const res = await apiClient.get('/devices/config');
  return res.data?.data || res.data || {};
};

export const useDevicesList = () =>
  useQuery({
    queryKey: queryKeys.devices.list(),
    queryFn: fetchDeviceList,
  });

export const useDevicesConfig = () =>
  useQuery({
    queryKey: queryKeys.devices.config(),
    queryFn: fetchDeviceConfig,
  });

export const useInvalidateDevices = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() }),
    [queryClient],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.devices.list() }),
    [queryClient],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKeys.devices.list(), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  const setConfigFields = useCallback(
    (fields) => {
      queryClient.setQueryData(queryKeys.devices.config(), (prev) => ({
        ...(prev && typeof prev === 'object' ? prev : {}),
        fields,
      }));
    },
    [queryClient],
  );
  return { invalidateList, refetchList, setList, setConfigFields, queryClient };
};
