import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at', 'exam_id']);

export const mapCenterCsrRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchList = async (examId) => {
  const res = await apiClient.get('/center-csr-matching', {
    params: { examId: String(examId || '') },
  });
  const list = res.data?.data || res.data;
  return mapCenterCsrRows(list);
};

const fetchConfig = async () => {
  const res = await apiClient.get('/center-csr-matching/config');
  return res.data?.data || res.data || {};
};

export const useCenterCsrMatchingList = (examId) =>
  useQuery({
    queryKey: queryKeys.centerCsrMatching.list(examId),
    queryFn: () => fetchList(examId),
    enabled: Boolean(examId),
  });

export const useCenterCsrMatchingConfig = () =>
  useQuery({
    queryKey: queryKeys.centerCsrMatching.config(),
    queryFn: fetchConfig,
  });

export const useInvalidateCenterCsrMatching = (examId) => {
  const queryClient = useQueryClient();
  const listKey = queryKeys.centerCsrMatching.list(examId);
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
      queryClient.setQueryData(queryKeys.centerCsrMatching.config(), (prev) => ({
        ...(prev && typeof prev === 'object' ? prev : {}),
        fields,
      }));
    },
    [queryClient],
  );
  return { invalidateList, refetchList, setList, setConfigFields, queryClient };
};
