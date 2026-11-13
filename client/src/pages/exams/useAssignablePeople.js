import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { ASSIGNABLE_PAGE_SIZE, listAssignableUsersPage } from './assigneeApi';
import {
  formatAssigneeDisplay,
  seedAssigneeLabels,
} from '../../components/DynamicTable/editors/assigneeLabels';

const tagSig = (tagIds = []) =>
  [...new Set((tagIds || []).map(String).filter(Boolean))].sort().join(',');

/**
 * Debounced search string — keeps typing snappy while the infinite query key stays stable.
 */
export const useDebouncedValue = (value, delayMs = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
};

/**
 * Paginated + searchable people for a user-tags field.
 * Scroll the menu to load more; typing searches on the server.
 */
export const useAssignablePeople = (tagIds = [], { enabled = true, search = '' } = {}) => {
  const ids = useMemo(
    () => [...new Set((tagIds || []).map(String).filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tagSig(tagIds)],
  );
  const sig = tagSig(ids);
  const debouncedSearch = useDebouncedValue(String(search || '').trim(), 250);

  const query = useInfiniteQuery({
    queryKey: queryKeys.assignableUsersPage(sig, debouncedSearch),
    queryFn: ({ pageParam = 1, signal }) =>
      listAssignableUsersPage(ids, {
        search: debouncedSearch,
        page: pageParam,
        limit: ASSIGNABLE_PAGE_SIZE,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last?.hasMore ? Number(last.page || 1) + 1 : undefined),
    enabled: Boolean(enabled) && ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const people = useMemo(
    () => (query.data?.pages || []).flatMap((p) => (Array.isArray(p?.rows) ? p.rows : [])),
    [query.data],
  );

  useEffect(() => {
    if (!people.length) return;
    seedAssigneeLabels(people);
  }, [people]);

  const labels = useMemo(() => {
    const next = {};
    people.forEach((p) => {
      next[p.id] = formatAssigneeDisplay(p) || p.id;
    });
    return next;
  }, [people]);

  const total = query.data?.pages?.[0]?.total ?? people.length;
  const searching = String(search || '').trim() !== debouncedSearch;

  return {
    people,
    labels,
    total,
    loading: query.isLoading || searching,
    loadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    error: query.error
      ? query.error?.response?.data?.message || query.error?.message || 'Could not load people'
      : '',
    refetch: query.refetch,
  };
};

/** Prefetch first page (empty search) so the first cell open feels instant. */
export const usePrefetchAssignablePeople = () => {
  const queryClient = useQueryClient();
  return (tagIds = []) => {
    const ids = [...new Set((tagIds || []).map(String).filter(Boolean))];
    if (!ids.length) return;
    const sig = tagSig(ids);
    void queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.assignableUsersPage(sig, ''),
      queryFn: ({ pageParam = 1, signal }) =>
        listAssignableUsersPage(ids, { search: '', page: pageParam, limit: ASSIGNABLE_PAGE_SIZE, signal }),
      initialPageParam: 1,
      getNextPageParam: (last) => (last?.hasMore ? Number(last.page || 1) + 1 : undefined),
      staleTime: 5 * 60 * 1000,
    });
  };
};
