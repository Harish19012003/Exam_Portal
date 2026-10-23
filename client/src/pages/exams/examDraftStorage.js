/**
 * IndexedDB = unsaved create-form draft only.
 * Saved exams live in MySQL via examApi.js.
 */

const DB_NAME = 'exam_portal';
const DB_VERSION = 2;
const DRAFTS_STORE = 'drafts';
const EXAMS_STORE = 'exams'; // legacy store — read/clear during one-time SQL migration
const CREATE_EXAM_DRAFT_KEY = 'create_exam';

const openDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
      }
      // Keep legacy exams store so we can migrate old rows to SQL once
      if (!db.objectStoreNames.contains(EXAMS_STORE)) {
        const exams = db.createObjectStore(EXAMS_STORE, { keyPath: 'id' });
        exams.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

const runStoreRequest = async (storeName, mode, createRequest) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request;
      try {
        request = createRequest(store);
      } catch (err) {
        reject(err);
        return;
      }

      let requestResult;
      request.onsuccess = () => {
        requestResult = request.result;
      };
      request.onerror = () => {
        reject(request.error || new Error('IndexedDB request failed'));
      };
      tx.oncomplete = () => resolve(requestResult);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
};

/** Unsaved create-form values (autosave while typing). */
export const loadCreateExamDraft = async () => {
  try {
    const record = await runStoreRequest(DRAFTS_STORE, 'readonly', (store) =>
      store.get(CREATE_EXAM_DRAFT_KEY),
    );
    if (!record || typeof record !== 'object') return null;
    return {
      values: record.values && typeof record.values === 'object' ? record.values : {},
      sameAsFlags:
        record.sameAsFlags && typeof record.sameAsFlags === 'object'
          ? record.sameAsFlags
          : {},
      updatedAt: record.updatedAt || null,
    };
  } catch {
    return null;
  }
};

export const saveCreateExamDraft = async ({ values, sameAsFlags }) => {
  try {
    await runStoreRequest(DRAFTS_STORE, 'readwrite', (store) =>
      store.put({
        id: CREATE_EXAM_DRAFT_KEY,
        values: values || {},
        sameAsFlags: sameAsFlags || {},
        updatedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
};

/** Cleared after successful SQL save. */
export const clearCreateExamDraft = async () => {
  try {
    await runStoreRequest(DRAFTS_STORE, 'readwrite', (store) =>
      store.delete(CREATE_EXAM_DRAFT_KEY),
    );
    return true;
  } catch {
    return false;
  }
};

/** Legacy IndexedDB exam rows (for one-time migrate → SQL). */
export const listLocalExams = async () => {
  try {
    const rows = await runStoreRequest(EXAMS_STORE, 'readonly', (store) => store.getAll());
    const list = Array.isArray(rows) ? rows : [];
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch {
    return [];
  }
};

export const clearLocalExams = async () => {
  try {
    const rows = await listLocalExams();
    await Promise.all(
      rows.map((row) =>
        runStoreRequest(EXAMS_STORE, 'readwrite', (store) => store.delete(row.id)),
      ),
    );
    return true;
  } catch {
    return false;
  }
};
