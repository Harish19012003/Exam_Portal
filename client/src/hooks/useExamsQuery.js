import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * Server-paginated center rows for one exam.
 * Returns `{ rows, total, page, limit, totalPages }`.
 */
export const useExamRows = (examId, { page = 1, limit = 100, enabled, ...options } = {}) =>
  useQuery({
    queryKey: queryKeys.exams.rows(examId, page, limit),
    queryFn: async () => {
      const data = await listExamRows(examId, { page, limit });
      if (Array.isArray(data)) {
        return {
          rows: data,
          total: data.length,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(data.length / limit) || 1),
        };
      }
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const total = Number(data?.total) || rows.length;
      const resolvedLimit = Number(data?.limit) || limit;
      const resolvedPage = Number(data?.page) || page;
      return {
        rows,
        total,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages:
          Number(data?.totalPages) || Math.max(1, Math.ceil(total / resolvedLimit) || 1),
      };
    },
    enabled: enabled !== undefined ? enabled : Boolean(examId),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useInvalidateExams = () => {
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => {
      // An exam edit also changes the cached single-exam copies the explore pages read.
      queryClient.invalidateQueries({ queryKey: queryKeys.exams.details() });
      return queryClient.invalidateQueries({ queryKey: queryKeys.exams.list() });
    },
    [queryClient],
  );
  const invalidateConfig = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.exams.config() }),
    [queryClient],
  );
  const invalidateRows = useCallback(
    (examId) =>
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.exams.all, 'rows', String(examId || '')],
      }),
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
  /**
   * Patch every cached rows page for this exam (15 / 200 / 500 keys).
   * Cell edits used to update only the active page key — a page-size flip or
   * unique-import query then put the old values back on screen / after refresh.
   */
  const setRows = useCallback(
    (examId, updater, _pageKey = {}) => {
      const id = String(examId || '');
      queryClient.setQueriesData(
        { queryKey: [...queryKeys.exams.all, 'rows', id] },
        (prev) => {
          if (prev == null) return prev;
          const base =
            prev && !Array.isArray(prev)
              ? prev
              : {
                  rows: Array.isArray(prev) ? prev : [],
                  total: Array.isArray(prev) ? prev.length : 0,
                  page: 1,
                  limit: 100,
                  totalPages: 1,
                };
          const nextRows =
            typeof updater === 'function' ? updater(base.rows || []) : updater;
          const totalDelta = (nextRows?.length || 0) - (base.rows?.length || 0);
          const total = Math.max(0, (Number(base.total) || 0) + totalDelta);
          return {
            ...base,
            rows: nextRows,
            total,
            totalPages: Math.max(1, Math.ceil(total / (base.limit || 100)) || 1),
          };
        },
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
