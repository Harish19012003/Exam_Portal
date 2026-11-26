import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildExamLabel, pick } from '../pages/exams/examLabel';
import { useExamsList } from './useExamsQuery';
import { isBioMetricService } from '../utils/bioService';

export const DEVICE_MASTER_BIO_EXAM_KEY = 'deviceMasterBioExamId';

const DeviceMasterBioExamContext = createContext(null);

/** Provider for the Bio Exams (Device Master) selected exam. Mount once in DashboardLayout. */
export const DeviceMasterBioExamProvider = ({ children }) => {
  const { data: exams } = useExamsList();
  const [examId, setExamIdState] = useState(() => {
    try {
      return localStorage.getItem(DEVICE_MASTER_BIO_EXAM_KEY) || '';
    } catch {
      return '';
    }
  });

  const setExamId = useCallback((id) => {
    const next = String(id || '');
    setExamIdState(next);
    try {
      if (next) localStorage.setItem(DEVICE_MASTER_BIO_EXAM_KEY, next);
      else localStorage.removeItem(DEVICE_MASTER_BIO_EXAM_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const bioExams = useMemo(
    () =>
      (exams || []).filter((exam) => isBioMetricService(pick(exam?.values || {}, ['service']))),
    [exams],
  );

  useEffect(() => {
    if (!bioExams.length) return;
    const stillValid = bioExams.some((e) => String(e.id) === String(examId));
    if (stillValid) return;
    setExamId(String(bioExams[0].id));
  }, [bioExams, examId, setExamId]);

  const exam = useMemo(
    () => bioExams.find((e) => String(e.id) === String(examId)) || bioExams[0] || null,
    [bioExams, examId],
  );

  const value = useMemo(
    () => ({
      examId: exam ? String(exam.id) : '',
      exam,
      label: exam ? buildExamLabel(exam) : 'Bio exam',
      bioExams,
      setExamId,
    }),
    [exam, bioExams, setExamId],
  );

  return (
    <DeviceMasterBioExamContext.Provider value={value}>{children}</DeviceMasterBioExamContext.Provider>
  );
};

export const useDeviceMasterBioExam = () => {
  const ctx = useContext(DeviceMasterBioExamContext);
  if (!ctx) {
    return {
      examId: '',
      exam: null,
      label: 'Bio exam',
      bioExams: [],
      setExamId: () => {},
    };
  }
  return ctx;
};
