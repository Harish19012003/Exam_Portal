/**
 * Shared Bulk Import runner for flat tables (Vendors, SeqView, Exams list).
 * Modes: add | update | upsert | replace — same UX as center-list ImportDataModal.
 *
 * @param {object} opts
 * @param {'add'|'update'|'upsert'|'replace'} opts.mode
 * @param {string} [opts.matchKey]
 * @param {Record<string, unknown>[]} opts.rows — prepared value objects
 * @param {{ id: string, values?: Record<string, unknown>|null }[]} opts.existingRows
 * @param {(batch: Record<string, unknown>[]) => Promise<void>} opts.createBatch
 * @param {(id: string, values: Record<string, unknown>) => Promise<void>} opts.updateOne
 * @param {(ids: string[]) => Promise<void>} opts.deleteMany
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @param {number} [opts.chunkSize]
 * @returns {Promise<{ created: number, updated: number, deleted: number, failures: string[] }>}
 */
export async function runModeAwareImport({
  mode = 'add',
  matchKey = '',
  rows = [],
  existingRows = [],
  createBatch,
  updateOne,
  deleteMany,
  onProgress,
  chunkSize = 200,
} = {}) {
  const workRows = Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object') : [];
  const failures = [];
  let created = 0;
  let updated = 0;
  let deleted = 0;
  const totalIncoming = workRows.length;
  const key = String(matchKey || '').trim();
  const norm = (v) => String(v ?? '').trim().toLowerCase();

  const { importRowsInChunks } = await import('../../components/DynamicTable/export/parseImportInWorker');

  const createBatches = async (rowsToCreate) => {
    if (!rowsToCreate.length) return;
    await importRowsInChunks(
      rowsToCreate,
      async (batch) => {
        await createBatch(batch);
        created += batch.length;
      },
      {
        chunkSize,
        onProgress: (done) =>
          onProgress?.(Math.min(done + updated, Math.max(totalIncoming, 1)), Math.max(totalIncoming, 1)),
      },
    );
  };

  if (mode === 'replace') {
    const ids = (existingRows || []).map((r) => String(r.id)).filter(Boolean);
    onProgress?.(0, Math.max(totalIncoming, 1));
    const DELETE_CHUNK = 200;
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const chunk = ids.slice(i, i + DELETE_CHUNK);
      await deleteMany(chunk);
      deleted += chunk.length;
    }
    await createBatches(workRows);
    return { created, updated, deleted, failures };
  }

  if (mode === 'add' || !key) {
    await createBatches(workRows);
    return { created, updated, deleted, failures };
  }

  const lookup = new Map();
  (existingRows || []).forEach((r) => {
    const v = norm(r?.values?.[key]);
    if (!v || lookup.has(v)) return;
    lookup.set(v, String(r.id));
  });

  const toUpdate = [];
  const toCreate = [];
  workRows.forEach((values) => {
    const v = norm(values[key]);
    if (!v) return;
    const id = lookup.get(v);
    if (id) toUpdate.push({ id, values });
    else if (mode === 'upsert') toCreate.push(values);
  });

  if (mode === 'update' && !toUpdate.length) {
    throw new Error(`No existing rows matched on “${key}”. Nothing was updated.`);
  }

  const totalWork = toUpdate.length + toCreate.length;
  let finished = 0;
  const bump = () => {
    finished += 1;
    onProgress?.(finished, Math.max(totalWork, 1));
  };

  const UPDATE_CONCURRENCY = 6;
  for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
    const slice = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
    await Promise.all(
      slice.map(async ({ id, values }) => {
        try {
          await updateOne(id, values);
          updated += 1;
        } catch (err) {
          failures.push(`${id}: ${err?.message || 'could not be updated'}`);
        } finally {
          bump();
        }
      }),
    );
  }

  if (toCreate.length) {
    const before = created;
    try {
      await createBatches(toCreate);
    } catch (err) {
      failures.push(err?.message || 'could not create new rows');
      created = before;
    }
    // createBatches already advanced progress via onProgress; bump remaining if needed
    while (finished < totalWork) bump();
  }

  return { created, updated, deleted, failures };
}

/** Match-key options from field-builder defs (skip auto / formula / linked). */
export const importMatchKeysFromFields = (fields = []) =>
  (fields || [])
    .filter(
      (f) =>
        f?.key &&
        !(f.autoFill && f.autoFill !== 'none') &&
        f.dataType !== 'formula' &&
        f.dataType !== 'composite' &&
        f.dataType !== 'linked' &&
        f.dataType !== 'fromExam',
    )
    .map((f) => ({ key: f.key, label: f.label || f.key }));

/** Prefer a “code” column, else first match key. */
export const pickDefaultMatchKey = (matchKeys = [], preferredKeys = []) => {
  const keys = new Set((matchKeys || []).map((m) => m.key));
  for (const k of preferredKeys || []) {
    if (keys.has(k)) return k;
  }
  const byCode = (matchKeys || []).find((m) => /code/i.test(`${m.key} ${m.label}`));
  return byCode?.key || matchKeys[0]?.key || '';
};
