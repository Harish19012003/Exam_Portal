import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at']);

export const mapVendorRows = (list) =>
  (Array.isArray(list) ? list : []).map((v) => ({
    rowId: String(v.id),
    version: v.version || 1,
    values: Object.fromEntries(Object.entries(v).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
  }));

const fetchVendorList = async () => {
  const res = await apiClient.get('/vendors');
  const list = res.data?.data || res.data;
  return mapVendorRows(list);
};

const fetchVendorConfig = async () => {
  const res = await apiClient.get('/vendors/config');
  return res.data?.data || res.data || {};
};

export const useVendorsList = () =>
  useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: fetchVendorList,
  });

export const useVendorsConfig = () =>
  useQuery({
    queryKey: queryKeys.vendors.config(),
    queryFn: fetchVendorConfig,
  });

export const useInvalidateVendors = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list() }),
    [queryClient],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.vendors.list() }),
    [queryClient],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKeys.vendors.list(), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  const setConfigFields = useCallback(
    (fields) => {
      queryClient.setQueryData(queryKeys.vendors.config(), (prev) => ({
        ...(prev && typeof prev === 'object' ? prev : {}),
        fields,
      }));
    },
    [queryClient],
  );
  return { invalidateList, refetchList, setList, setConfigFields, queryClient };
};
