import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { isExamViewKey } from '@exam-view/shared';
import { ExamExplorePage } from './ExamExplorePage';
import { examIdFromUrl, examPath } from './exams/examUrl';

/** Old links (/exams/:examId) land on the exam's Center list. */
export const ExamIndexRedirect = () => {
  return <Navigate to={examPath(examIdFromUrl(useParams().examId))} replace />;
};

/**
 * Route element for /exams/:examId/:subTab.
 * Every operational tab shares the same center rows (keyed by center_code)
 * and shows its own column projection.
 */
export const ExamSubRoute = () => {
  const { examId: urlExamId, subTab } = useParams();
  if (!isExamViewKey(subTab)) {
    return <Navigate to={examPath(examIdFromUrl(urlExamId))} replace />;
  }
  return <ExamExplorePage key={subTab} />;
};
