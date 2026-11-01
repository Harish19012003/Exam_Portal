import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at']);

export const mapSeqViewRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchSeqViewList = async () => {
  const res = await apiClient.get('/seq-views');
  const list = res.data?.data || res.data;
  return mapSeqViewRows(list);
};

const fetchSeqViewConfig = async () => {
  const res = await apiClient.get('/seq-views/config');
  return res.data?.data || res.data || {};
};

/** Cached SeqView rows — reused across page switches until invalidated / stale. */
export const useSeqViewsList = () =>
  useQuery({
    queryKey: queryKeys.seqViews.list(),
    queryFn: fetchSeqViewList,
  });

/** Cached SeqView field/feature config. */
export const useSeqViewsConfig = () =>
  useQuery({
    queryKey: queryKeys.seqViews.config(),
    queryFn: fetchSeqViewConfig,
  });

export const useInvalidateSeqViews = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.seqViews.list() }),
    [queryClient],
  );
  const invalidateConfig = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.seqViews.config() }),
    [queryClient],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.seqViews.list() }),
    [queryClient],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKeys.seqViews.list(), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  const setConfigFields = useCallback(
    (fields) => {
      queryClient.setQueryData(queryKeys.seqViews.config(), (prev) => ({
        ...(prev && typeof prev === 'object' ? prev : {}),
        fields,
      }));
    },
    [queryClient],
  );
  return { invalidateList, invalidateConfig, refetchList, setList, setConfigFields, queryClient };
};
