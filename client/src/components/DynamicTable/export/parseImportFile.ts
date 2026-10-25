import { parseCsv } from './parseCsv';

export type ImportFileKind = 'csv' | 'excel' | 'json';

export function detectImportFileKind(file: File): ImportFileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return 'csv';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  if (name.endsWith('.json') || file.type === 'application/json') return 'json';
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

async function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
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

async function parseJsonFile(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
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
    // Support { values: { ... } } shape from portal exports
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

/** Parse CSV / Excel / JSON into row objects keyed by header (label or key). */
export async function parseImportFile(file: File): Promise<{
  kind: ImportFileKind;
  rows: Record<string, string>[];
}> {
  const kind = detectImportFileKind(file);
  if (!kind) {
    throw new Error('Unsupported file. Use CSV, Excel (.xlsx), or JSON.');
  }

  if (kind === 'csv') {
    const text = await file.text();
    const { rows } = parseCsv(text);
    return { kind, rows };
  }
  if (kind === 'excel') {
    const rows = await parseExcelFile(file);
    return { kind, rows };
  }
  const rows = await parseJsonFile(file);
  return { kind, rows };
}
