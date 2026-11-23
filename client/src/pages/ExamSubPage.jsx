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
 * All tabs share the same Center list rows (keyed by center_code).
 * Exam Day shows an expanded center×date view of that same spreadsheet.
 */
export const ExamSubRoute = () => {
  const { examId: urlExamId, subTab } = useParams();
  // Device Master moved out of Exams to its own global page.
  if (subTab === 'device-master') return <Navigate to="/device-master" replace />;
  if (!isExamViewKey(subTab)) {
    return <Navigate to={examPath(examIdFromUrl(urlExamId))} replace />;
  }
  return <ExamExplorePage key={subTab} />;
};
