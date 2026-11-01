import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

const fetchUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data?.data || [];
};

const fetchUserTags = async () => {
  const response = await apiClient.get('/users/tags');
  return response.data?.data || [];
};

const fetchUserGroups = async () => {
  const response = await apiClient.get('/users/groups');
  return response.data?.data || [];
};

export const useUsersList = (options = {}) =>
  useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: fetchUsers,
    ...options,
  });

export const useUserTags = (options = {}) =>
  useQuery({
    queryKey: queryKeys.users.tags(),
    queryFn: fetchUserTags,
    ...options,
  });

export const useUserGroups = (options = {}) =>
  useQuery({
    queryKey: queryKeys.users.groups(),
    queryFn: fetchUserGroups,
    ...options,
  });

export const useInvalidateUsers = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.users.list() }),
    [queryClient],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.users.list() }),
    [queryClient],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKeys.users.list(), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  return { invalidateList, refetchList, setList, queryClient };
};
