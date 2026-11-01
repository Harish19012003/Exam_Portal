/**
 * Off-main-thread import parsing (CSV / Excel / JSON / clipboard TSV).
 * Keeps the Bulk Import dialog responsive for large files and pastes.
 */

export type ImportFileKind = 'csv' | 'excel' | 'json';

export type ImportColumnLite = {
  key: string;
  label: string;
};

type ParseFileRequest = {
  id: number;
  action: 'parse-file';
  name: string;
  mime?: string;
  buffer: ArrayBuffer;
  cols: ImportColumnLite[];
};

type ParseClipboardRequest = {
  id: number;
  action: 'parse-clipboard';
  text: string;
};

type NormalizeRequest = {
  id: number;
  action: 'normalize-rows';
  rows: Record<string, string>[];
  cols: ImportColumnLite[];
};

type WorkerRequest = ParseFileRequest | ParseClipboardRequest | NormalizeRequest;

function detectKind(name: string, mime = ''): ImportFileKind | null {
  const n = name.toLowerCase();
  const m = mime.toLowerCase();
  if (n.endsWith('.csv') || m === 'text/csv') return 'csv';
  if (
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    m.includes('spreadsheet') ||
    m === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  if (n.endsWith('.json') || m === 'application/json') return 'json';
  return null;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cellToString).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
}

/** Minimal CSV parser (handles quotes and commas). */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = cells[index] ?? '';
    });
    return obj;
  });

  return { headers, rows };
}

function recordsFromMatrix(matrix: unknown[][]): Record<string, string>[] {
  if (!matrix.length) return [];
  const headers = (matrix[0] || []).map((h) => String(h ?? '').trim());
  if (!headers.some(Boolean)) return [];
  return matrix.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      obj[header] = cellToString(row?.[i]);
    });
    return obj;
  });
}

async function parseExcel(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  return recordsFromMatrix(matrix);
}

function parseJson(text: string): Record<string, string>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file');
  }

  let list: unknown[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rows)) list = obj.rows;
    else if (Array.isArray(obj.data)) list = obj.data;
    else if (Array.isArray(obj.exams)) list = obj.exams;
    else throw new Error('JSON must be an array of objects, or { rows|data|exams: [...] }');
  } else {
    throw new Error('JSON must be an array of row objects');
  }

  return list.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {} as Record<string, string>;
    }
    const raw = item as Record<string, unknown>;
    const source =
      raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values)
        ? (raw.values as Record<string, unknown>)
        : raw;
    const out: Record<string, string> = {};
    Object.entries(source).forEach(([k, v]) => {
      if (k === 'id' || k === 'fields' || k === 'values') return;
      out[k] = cellToString(v);
    });
    return out;
  });
}

function emptyRow(cols: ImportColumnLite[]): Record<string, string> {
  const row: Record<string, string> = {};
  cols.forEach((c) => {
    row[c.key] = '';
  });
  return row;
}

function normalizeRow(raw: Record<string, string>, cols: ImportColumnLite[]): Record<string, string> {
  const byLabel = new Map(cols.map((c) => [c.label.trim().toLowerCase(), c.key]));
  const byKey = new Map(cols.map((c) => [c.key.trim().toLowerCase(), c.key]));
  const out = emptyRow(cols);
  Object.entries(raw || {}).forEach(([header, value]) => {
    const h = String(header || '').trim().toLowerCase();
    if (!h) return;
    const key = byKey.get(h) || byLabel.get(h);
    if (!key) return;
    out[key] = value == null ? '' : String(value);
  });
  return out;
}

function rowHasData(row: Record<string, string>): boolean {
  return Object.values(row).some((v) => String(v || '').trim() !== '');
}

function parseClipboardGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.includes('\t')) {
    return normalized.split('\n').map((line) => line.split('\t').map((c) => c.trim()));
  }
  const { headers, rows } = parseCsv(normalized);
  if (!headers.length) return [];
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.action === 'parse-file') {
      const kind = detectKind(msg.name, msg.mime);
      if (!kind) {
        throw new Error('Unsupported file. Use CSV, Excel (.xlsx), or JSON.');
      }
      let rows: Record<string, string>[] = [];
      if (kind === 'csv') {
        rows = parseCsv(decodeText(msg.buffer)).rows;
      } else if (kind === 'excel') {
        rows = await parseExcel(msg.buffer);
      } else {
        rows = parseJson(decodeText(msg.buffer));
      }
      const normalized = rows.map((r) => normalizeRow(r, msg.cols)).filter(rowHasData);
      self.postMessage({ id: msg.id, success: true, kind, rows: normalized, rawCount: rows.length });
      return;
    }

    if (msg.action === 'parse-clipboard') {
      const grid = parseClipboardGrid(msg.text);
      self.postMessage({ id: msg.id, success: true, grid });
      return;
    }

    if (msg.action === 'normalize-rows') {
      const rows = msg.rows.map((r) => normalizeRow(r, msg.cols)).filter(rowHasData);
      self.postMessage({ id: msg.id, success: true, rows });
      return;
    }

    throw new Error('Unknown import worker action');
  } catch (error) {
    self.postMessage({
      id: msg.id,
      success: false,
      error: error instanceof Error ? error.message : 'Import parse failed',
    });
  }
};
