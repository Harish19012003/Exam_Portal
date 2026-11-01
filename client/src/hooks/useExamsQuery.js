import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { listExams } from '../pages/exams/examApi';
import { listExamRows } from '../pages/exams/examTableApi';
import { fetchExamTableConfig } from '../pages/exams/examTableConfig';

export const useExamsList = (options = {}) =>
  useQuery({
    queryKey: queryKeys.exams.list(),
    queryFn: listExams,
    ...options,
  });

export const useExamTableConfig = (options = {}) =>
  useQuery({
    queryKey: queryKeys.exams.config(),
    queryFn: async () => fetchExamTableConfig(),
    ...options,
  });

export const useExamRows = (examId, options = {}) =>
  useQuery({
    queryKey: queryKeys.exams.rows(examId),
    queryFn: async () => {
      const data = await listExamRows(examId);
      if (Array.isArray(data)) {
        return data;
      }
      return Array.isArray(data?.rows) ? data.rows : [];
    },
    enabled: Boolean(examId),
    ...options,
  });

export const useInvalidateExams = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.exams.list() }),
    [queryClient],
  );
  const invalidateConfig = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.exams.config() }),
    [queryClient],
  );
  const invalidateRows = useCallback(
    (examId) => queryClient.invalidateQueries({ queryKey: queryKeys.exams.rows(examId) }),
    [queryClient],
  );
  const refetchList = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.exams.list() }),
    [queryClient],
  );
  const setList = useCallback(
    (updater) => {
      queryClient.setQueryData(queryKeys.exams.list(), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  const setRows = useCallback(
    (examId, updater) => {
      queryClient.setQueryData(queryKeys.exams.rows(examId), (prev) =>
        typeof updater === 'function' ? updater(prev || []) : updater,
      );
    },
    [queryClient],
  );
  return {
    invalidateList,
    invalidateConfig,
    invalidateRows,
    refetchList,
    setList,
    setRows,
    queryClient,
  };
};
