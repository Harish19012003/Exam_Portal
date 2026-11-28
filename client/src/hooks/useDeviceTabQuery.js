import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at', 'exam_id']);

export const mapDeviceTabRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchTabFields = async (view) => {
  const res = await apiClient.get(`/devices/tabs/${encodeURIComponent(view)}/fields`);
  const data = res.data?.data || res.data || {};
  return Array.isArray(data.fields) ? data.fields : [];
};

const fetchTabRows = async (view, examId) => {
  const res = await apiClient.get(`/devices/tabs/${encodeURIComponent(view)}/rows`, {
    params: { examId: String(examId || '') },
  });
  const list = res.data?.data || res.data;
  return mapDeviceTabRows(list);
};

export const useDeviceTabFields = (view) =>
  useQuery({
    queryKey: queryKeys.deviceTabs.fields(view),
    queryFn: () => fetchTabFields(view),
    enabled: Boolean(view),
  });

export const useDeviceTabList = (view, examId) =>
  useQuery({
    queryKey: queryKeys.deviceTabs.list(view, examId),
    queryFn: () => fetchTabRows(view, examId),
    enabled: Boolean(view && examId),
  });

export const useInvalidateDeviceTab = (view, examId) => {
  const queryClient = useQueryClient();
  const listKey = queryKeys.deviceTabs.list(view, examId);
  const fieldsKey = queryKeys.deviceTabs.fields(view);
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listKey }),
    [queryClient, listKey],
  );
  const invalidateFields = useCallback(
    () => queryClient.invalidateQueries({ queryKey: fieldsKey }),
    [queryClient, fieldsKey],
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
  return { invalidateList, invalidateFields, refetchList, setList, queryClient };
};
