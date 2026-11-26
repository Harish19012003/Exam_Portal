import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at', 'exam_id']);

export const mapDeviceRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchDeviceList = async (examId) => {
  const res = await apiClient.get('/devices', {
    params: { examId: String(examId || '') },
  });
  const list = res.data?.data || res.data;
  return mapDeviceRows(list);
};

const fetchDeviceConfig = async () => {
  const res = await apiClient.get('/devices/config');
  return res.data?.data || res.data || {};
};

export const useDevicesList = (examId) =>
  useQuery({
    queryKey: queryKeys.devices.list(examId),
    queryFn: () => fetchDeviceList(examId),
    enabled: Boolean(examId),
  });

export const useDevicesConfig = () =>
  useQuery({
    queryKey: queryKeys.devices.config(),
    queryFn: fetchDeviceConfig,
  });

export const useInvalidateDevices = (examId) => {
  const queryClient = useQueryClient();
  const listKey = queryKeys.devices.list(examId);
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listKey }),
    [queryClient, listKey],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: listKey }),
    [queryClient, listKey],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(listKey, (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient, listKey],
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
