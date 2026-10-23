import { apiClient } from '../../api/client';
import {
  listLocalExams,
  clearLocalExams,
} from './examDraftStorage';

const unwrap = (response) => response?.data?.data ?? response?.data;

/** List exams from SQL (shared across portal). */
export const listExams = async () => {
  const { data } = await apiClient.get('/exams');
  const rows = unwrap(data);
  return Array.isArray(rows) ? rows : [];
};

export const createExam = async ({ values, fields = [] }) => {
  const { data } = await apiClient.post('/exams', { values, fields });
  return unwrap(data);
};

export const updateExam = async (id, patch = {}) => {
  const { data } = await apiClient.patch(`/exams/${encodeURIComponent(id)}`, patch);
  return unwrap(data);
};

export const deleteExam = async (id) => {
  await apiClient.delete(`/exams/${encodeURIComponent(id)}`);
  return true;
};

const MIGRATION_FLAG = 'exam_idb_to_sql_migrated_v1';

/**
 * One-time: push IndexedDB exam rows into SQL, then clear local exam store.
 * Drafts in IndexedDB are left alone.
 */
export const migrateLocalExamsToSqlIfNeeded = async () => {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return { skipped: true };

    const local = await listLocalExams();
    if (!local.length) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return { imported: 0 };
    }

    const { data } = await apiClient.post('/exams/import', { exams: local });
    const result = unwrap(data) || {};
    await clearLocalExams();
    localStorage.setItem(MIGRATION_FLAG, '1');
    return result;
  } catch {
    // SQL table may not exist yet — keep IndexedDB until migrate runs
    return { failed: true };
  }
};
