import ImportWorker from './import.worker?worker';
import type { ImportFileKind } from './parseImportFile';

export type ImportColumnLite = { key: string; label: string };

type WorkerOk = {
  id: number;
  success: true;
  kind?: ImportFileKind;
  rows?: Record<string, string>[];
  rawCount?: number;
  grid?: string[][];
};

type WorkerErr = {
  id: number;
  success: false;
  error: string;
};

const worker = new ImportWorker();
let messageId = 0;

function runWorker<T extends WorkerOk>(payload: Record<string, unknown>, transfer?: Transferable[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    const onMessage = (e: MessageEvent<WorkerOk | WorkerErr>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      if (e.data.success) resolve(e.data as T);
      else reject(new Error((e.data as WorkerErr).error || 'Import parse failed'));
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ ...payload, id }, transfer ?? []);
  });
}

/** Parse + normalize a CSV / Excel / JSON file off the main thread. */
export async function parseImportFileInWorker(
  file: File,
  cols: ImportColumnLite[],
): Promise<{ kind: ImportFileKind; rows: Record<string, string>[]; rawCount: number }> {
  const buffer = await file.arrayBuffer();
  const result = await runWorker<WorkerOk>(
    {
      action: 'parse-file',
      name: file.name,
      mime: file.type,
      buffer,
      cols,
    },
    [buffer],
  );
  return {
    kind: result.kind as ImportFileKind,
    rows: result.rows || [],
    rawCount: result.rawCount ?? (result.rows || []).length,
  };
}

/** Parse clipboard TSV/CSV text into a 2D grid off the main thread. */
export async function parseClipboardGridInWorker(text: string): Promise<string[][]> {
  const result = await runWorker<WorkerOk>({
    action: 'parse-clipboard',
    text,
  });
  return result.grid || [];
}

/**
 * Upload rows in sequential batches so request bodies stay small and the UI can
 * keep showing progress. Failures stop further batches (partial success possible).
 */
export async function importRowsInChunks<T>(
  rows: T[],
  sendBatch: (batch: T[], meta: { offset: number; total: number; batchIndex: number; batchCount: number }) => Promise<void>,
  options?: {
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ imported: number; batches: number }> {
  const total = rows.length;
  if (!total) return { imported: 0, batches: 0 };
  const chunkSize = Math.max(50, options?.chunkSize ?? 400);
  const batchCount = Math.ceil(total / chunkSize);
  let imported = 0;

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const offset = batchIndex * chunkSize;
    const batch = rows.slice(offset, offset + chunkSize);
    await sendBatch(batch, { offset, total, batchIndex, batchCount });
    imported += batch.length;
    options?.onProgress?.(imported, total);
  }

  return { imported, batches: batchCount };
}
