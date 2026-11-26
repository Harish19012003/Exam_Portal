import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { DEFAULT_EXAM_VIEW, EXAM_DAY_VIEW } from '@exam-view/shared';
import { queryKeys } from '../../api/queryKeys';
import { getExamTable, listExamRows } from './examTableApi';
import { expandCenterRowsToExamDay } from './examDayExpand';
import { applySummaryDisplayValues, isSummaryField } from './examSummaryFields';

const asRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

/**
 * Paint read-only summary columns.
 * Source rows are the live set when this page already has them, otherwise every
 * row of that page (so a later edit on the source page updates this cell).
 */
export const useSummaryDisplayRows = (rows, fields, { examId, liveRowsByView = {} } = {}) => {
  const summaryFields = useMemo(() => (fields || []).filter(isSummaryField), [fields]);
  const sourceViews = useMemo(
    () => [...new Set(summaryFields.map((f) => String(f.summary?.sourceView || '').trim()).filter(Boolean))],
    [summaryFields],
  );
  const live = liveRowsByView || {};
  const liveViewsKey = Object.keys(live).sort().join('|');
  const fetchViews = useMemo(
    () => sourceViews.filter((view) => view !== EXAM_DAY_VIEW && !Array.isArray(live[view])),
    // liveViewsKey tracks which views already have a full row set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceViews, liveViewsKey],
  );
  const needsExamDay = sourceViews.includes(EXAM_DAY_VIEW) && !Array.isArray(live[EXAM_DAY_VIEW]);
  const hasLiveCenter = Array.isArray(live[DEFAULT_EXAM_VIEW]);

  const fetched = useQueries({
    queries: fetchViews.map((view) => ({
      queryKey: queryKeys.exams.rows(examId, 1, 100, '', '', true, view),
      queryFn: () => listExamRows(examId, { all: true, view }),
      enabled: Boolean(examId) && summaryFields.length > 0,
    })),
  });

  const centerRowsQuery = useQuery({
    queryKey: queryKeys.exams.rows(examId, 1, 100, '', '', true, DEFAULT_EXAM_VIEW),
    queryFn: () => listExamRows(examId, { all: true, view: DEFAULT_EXAM_VIEW }),
    enabled: Boolean(examId) && needsExamDay && !hasLiveCenter,
  });
  const centerConfigQuery = useQuery({
    queryKey: queryKeys.exams.table(examId, DEFAULT_EXAM_VIEW),
    queryFn: () => getExamTable(examId, DEFAULT_EXAM_VIEW),
    enabled: Boolean(examId) && needsExamDay,
  });
  const examDayConfigQuery = useQuery({
    queryKey: queryKeys.exams.table(examId, EXAM_DAY_VIEW),
    queryFn: () => getExamTable(examId, EXAM_DAY_VIEW),
    enabled: Boolean(examId) && needsExamDay,
  });

  const fetchedStamp = fetched.map((q) => q.dataUpdatedAt || 0).join(',');
  const fetchedByView = useMemo(() => {
    const map = {};
    fetchViews.forEach((view, i) => {
      map[view] = asRows(fetched[i]?.data);
    });
    return map;
    // fetchedStamp is the data revision; `fetched` is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchViews, fetchedStamp]);

  const examDayRows = useMemo(() => {
    if (!needsExamDay) return [];
    const centerRows = hasLiveCenter ? live[DEFAULT_EXAM_VIEW] : asRows(centerRowsQuery.data);
    const { rows: expanded } = expandCenterRowsToExamDay({
      centerRows,
      dateShiftsConfig: centerConfigQuery.data?.features?.dateShifts,
      targetFields: examDayConfigQuery.data?.fields || [],
    });
    return expanded;
  }, [
    needsExamDay,
    hasLiveCenter,
    live,
    centerRowsQuery.data,
    centerConfigQuery.data,
    examDayConfigQuery.data,
  ]);

  return useMemo(() => {
    if (!summaryFields.length) return rows;
    const sourceRowsByView = { ...fetchedByView };
    Object.entries(live).forEach(([view, list]) => {
      if (Array.isArray(list)) sourceRowsByView[view] = list;
    });
    if (needsExamDay) sourceRowsByView[EXAM_DAY_VIEW] = examDayRows;
    return applySummaryDisplayValues(rows, fields, sourceRowsByView);
  }, [rows, fields, summaryFields, fetchedByView, live, needsExamDay, examDayRows]);
};
