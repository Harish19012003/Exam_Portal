import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UploadCloud,
  ClipboardPaste,
  Download,
  Plus,
  Trash2,
  Info,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { isFieldColumn, type ColumnConfig } from '../types';
import { parseCsv } from '../export/parseCsv';
import { parseImportFile, type ImportFileKind } from '../export/parseImportFile';

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  dataType?: string;
};

type TabId = 'upload' | 'paste';

interface ImportDataModalProps {
  columns: ColumnConfig[];
  isDarkMode: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<void> | void;
}

const SKIP_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  '__created_by',
  '__updated_by',
]);

export function getImportableColumns(columns: ColumnConfig[]): ImportColumn[] {
  return (columns || [])
    .filter((c) => {
      if (!isFieldColumn(c)) return false;
      if (c.dataType === 'formula' || c.dataType === 'composite') return false;
      if (SKIP_KEYS.has(c.key) || c.key.startsWith('__')) return false;
      if (c.editable === false) return false;
      return true;
    })
    .map((c) => ({
      key: c.key,
      label: c.label || c.key,
      required: Boolean(c.required),
      dataType: c.dataType,
    }));
}

function emptyRow(cols: ImportColumn[]): Record<string, string> {
  const row: Record<string, string> = {};
  cols.forEach((c) => {
    row[c.key] = '';
  });
  return row;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sampleRow(cols: ImportColumn[]): Record<string, string> {
  const row: Record<string, string> = {};
  cols.forEach((c) => {
    row[c.label] = c.required ? `sample_${c.key}` : '';
  });
  return row;
}

async function downloadTemplate(cols: ImportColumn[], kind: ImportFileKind) {
  const headers = cols.map((c) => c.label);
  const sample = sampleRow(cols);

  if (kind === 'csv') {
    const escape = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const line = headers.map((h) => escape(sample[h] ?? '')).join(',');
    const csv = `${headers.map(escape).join(',')}\n${line}\n`;
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'import_template.csv');
    return;
  }

  if (kind === 'json') {
    const json = JSON.stringify([sample], null, 2);
    triggerDownload(
      new Blob([json], { type: 'application/json;charset=utf-8;' }),
      'import_template.json',
    );
    return;
  }

  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet([sample], { header: headers });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Import');
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'import_template.xlsx',
  );
}

/** Map a pasted/uploaded object (label or key headers) onto column keys */
function normalizeRow(
  raw: Record<string, string>,
  cols: ImportColumn[],
): Record<string, string> {
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

function parseTsvOrCsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  // Prefer tab (Excel paste); fall back to CSV parse
  if (normalized.includes('\t')) {
    return normalized.split('\n').map((line) => line.split('\t').map((c) => c.trim()));
  }
  const { headers, rows } = parseCsv(normalized);
  if (!headers.length) return [];
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
}

export function ImportDataModal({
  columns,
  isDarkMode,
  title = 'Bulk Import',
  subtitle = 'Upload CSV, Excel, or JSON — or paste table data to add multiple rows.',
  onClose,
  onImport,
}: ImportDataModalProps) {
  const importCols = useMemo(() => getImportableColumns(columns), [columns]);
  const [tab, setTab] = useState<TabId>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<ImportFileKind | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [pasteRows, setPasteRows] = useState<Record<string, string>[]>(() => [
    emptyRow(importCols),
    emptyRow(importCols),
    emptyRow(importCols),
  ]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPasteRows([emptyRow(importCols), emptyRow(importCols), emptyRow(importCols)]);
    setPreviewRows([]);
    setFileName('');
    setFileKind(null);
    setError('');
  }, [importCols]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyFile = useCallback(
    async (file: File) => {
      setError('');
      setParsing(true);
      try {
        const { kind, rows } = await parseImportFile(file);
        if (!rows.length) {
          setError(`No data rows found in the ${kind.toUpperCase()} file.`);
          setPreviewRows([]);
          setFileName('');
          setFileKind(null);
          return;
        }
        const normalized = rows.map((r) => normalizeRow(r, importCols)).filter(rowHasData);
        if (!normalized.length) {
          setError('File headers/keys did not match any importable columns.');
          setPreviewRows([]);
          setFileName('');
          setFileKind(null);
          return;
        }
        setFileName(file.name);
        setFileKind(kind);
        setPreviewRows(normalized);
      } catch (err) {
        setPreviewRows([]);
        setFileName('');
        setFileKind(null);
        setError(err instanceof Error ? err.message : 'Could not read file');
      } finally {
        setParsing(false);
      }
    },
    [importCols],
  );

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await applyFile(file);
  };

  const handlePasteOnGrid = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    setError('');
    const grid = parseTsvOrCsv(text);
    if (!grid.length) return;

    const first = grid[0].map((c) => c.trim().toLowerCase());
    const looksLikeHeader = first.some(
      (h) =>
        importCols.some(
          (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h,
        ),
    );

    let dataLines = grid;
    let headerMap: (string | null)[] = importCols.map((c) => c.key);

    if (looksLikeHeader) {
      dataLines = grid.slice(1);
      headerMap = first.map((h) => {
        const col = importCols.find(
          (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h,
        );
        return col?.key ?? null;
      });
    } else {
      // No header — map by column order
      headerMap = importCols.map((c) => c.key);
    }

    const next = dataLines
      .map((cells) => {
        const row = emptyRow(importCols);
        if (looksLikeHeader) {
          headerMap.forEach((key, i) => {
            if (!key) return;
            row[key] = cells[i] ?? '';
          });
        } else {
          importCols.forEach((c, i) => {
            row[c.key] = cells[i] ?? '';
          });
        }
        return row;
      })
      .filter(rowHasData);

    if (!next.length) {
      setError('Nothing to paste — copy cells from Excel/Sheets and try again.');
      return;
    }
    setPasteRows(next.length ? next : [emptyRow(importCols)]);
  };

  const updatePasteCell = (rowIndex: number, key: string, value: string) => {
    setPasteRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)),
    );
  };

  const addPasteRow = () => {
    setPasteRows((prev) => [...prev, emptyRow(importCols)]);
  };

  const removePasteRow = (index: number) => {
    setPasteRows((prev) => {
      if (prev.length <= 1) return [emptyRow(importCols)];
      return prev.filter((_, i) => i !== index);
    });
  };

  const activeRows = tab === 'upload' ? previewRows : pasteRows.filter(rowHasData);
  const requiredMissing = useMemo(() => {
    const req = importCols.filter((c) => c.required);
    if (!req.length || !activeRows.length) return 0;
    return activeRows.filter((row) =>
      req.some((c) => !String(row[c.key] || '').trim()),
    ).length;
  }, [activeRows, importCols]);

  const handleSubmit = async () => {
    setError('');
    if (!importCols.length) {
      setError('No importable columns configured.');
      return;
    }
    if (!activeRows.length) {
      setError(
        tab === 'upload'
          ? 'Upload a CSV, Excel, or JSON file before importing.'
          : 'Paste or type at least one row before importing.',
      );
      return;
    }
    if (requiredMissing > 0) {
      setError(
        `${requiredMissing} row${requiredMissing === 1 ? '' : 's'} missing required fields.`,
      );
      return;
    }

    // Emit rows keyed by label so ExamsPage mapping (label/key) still works
    const payload = activeRows.map((row) => {
      const out: Record<string, string> = {};
      importCols.forEach((c) => {
        out[c.label] = row[c.key] ?? '';
        out[c.key] = row[c.key] ?? '';
      });
      return out;
    });

    setSubmitting(true);
    try {
      await onImport(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const bg = isDarkMode ? 'bg-[#0f1c18] text-gray-100' : 'bg-white text-gray-900';
  const border = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const surface = isDarkMode ? 'bg-[#152622]' : 'bg-gray-50';

  if (!importCols.length) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
        <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${bg} ${border}`}>
          <p className="text-sm font-semibold mb-2">Nothing to import</p>
          <p className={`text-sm ${muted} mb-4`}>
            Configure editable fields first, then try again.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-[#13C296] text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full max-w-[920px] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${bg} ${border}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${border}`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#13C296]/15 text-[#13C296] flex items-center justify-center flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
              <p className={`text-[12px] mt-0.5 ${muted}`}>{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`px-5 pt-4`}>
          <div className={`flex gap-1 p-1 rounded-xl ${surface}`}>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors
                ${tab === 'upload'
                  ? isDarkMode
                    ? 'bg-[#1a2e28] text-[#13C296] shadow-sm border border-[#13C296]/30'
                    : 'bg-white text-[#0f766e] shadow-sm border border-[#13C296]/30'
                  : `${muted} hover:text-inherit`
                }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setTab('paste')}
              className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors
                ${tab === 'paste'
                  ? isDarkMode
                    ? 'bg-[#1a2e28] text-[#13C296] shadow-sm border border-[#13C296]/30'
                    : 'bg-white text-[#0f766e] shadow-sm border border-[#13C296]/30'
                  : `${muted} hover:text-inherit`
                }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste Table Data
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'upload' && (
            <>
              <div className="flex flex-wrap gap-2">
                {(['csv', 'excel', 'json'] as ImportFileKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => void downloadTemplate(importCols, kind)}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border text-xs font-bold transition-colors
                      ${isDarkMode
                        ? 'border-gray-600 text-gray-200 hover:border-[#13C296] hover:text-[#13C296]'
                        : 'border-gray-300 text-gray-700 hover:border-[#13C296] hover:text-[#0f766e]'
                      }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {kind === 'csv' ? 'CSV template' : kind === 'excel' ? 'Excel template' : 'JSON template'}
                  </button>
                ))}
              </div>

              <div
                className={`rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors cursor-pointer
                  ${dragActive
                    ? 'border-[#13C296] bg-[#13C296]/10'
                    : isDarkMode
                      ? 'border-gray-600 hover:border-[#13C296]/60'
                      : 'border-gray-300 hover:border-[#13C296]/60'
                  }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => !parsing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void applyFile(f);
                    e.target.value = '';
                  }}
                />
                <div className="mx-auto w-12 h-12 rounded-full bg-[#13C296]/15 text-[#13C296] flex items-center justify-center mb-3">
                  {parsing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-semibold">
                  {parsing
                    ? 'Reading file…'
                    : 'Click to browse or drag CSV / Excel / JSON here'}
                </p>
                <p className={`text-[12px] mt-1 ${muted}`}>
                  Supported: .csv, .xlsx, .json — preview appears below after upload.
                </p>
                {fileName && (
                  <p className="mt-2 text-[12px] font-medium text-[#13C296]">
                    {fileName}
                    {fileKind ? ` · ${fileKind.toUpperCase()}` : ''}
                  </p>
                )}
              </div>

              {previewRows.length > 0 && (
                <PreviewTable
                  cols={importCols}
                  rows={previewRows}
                  isDarkMode={isDarkMode}
                  border={border}
                  muted={muted}
                  fileKind={fileKind}
                />
              )}
            </>
          )}

          {tab === 'paste' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`text-[12px] inline-flex items-start gap-1.5 ${muted}`}>
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#13C296]" />
                  Paste cells copied from Excel/Sheets (Ctrl+V / ⌘V) directly on this table.
                </p>
                <button
                  type="button"
                  onClick={addPasteRow}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border text-xs font-bold
                    ${isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-white/5' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>

              <div
                ref={pasteTableRef}
                onPaste={handlePasteOnGrid}
                className={`rounded-xl border overflow-auto max-h-[min(420px,50vh)] ${border}`}
                tabIndex={0}
              >
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead className={isDarkMode ? 'bg-[#1a2e28]' : 'bg-[#eefaf5]'}>
                    <tr>
                      {importCols.map((c) => (
                        <th
                          key={c.key}
                          className={`sticky top-0 z-[1] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border-b ${border}
                            ${isDarkMode ? 'bg-[#1a2e28] text-[#13C296]' : 'bg-[#eefaf5] text-[#0f766e]'}`}
                        >
                          {c.label}
                          {c.required && <span className="text-rose-500 ml-0.5">*</span>}
                        </th>
                      ))}
                      <th
                        className={`sticky top-0 right-0 z-[2] px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b w-14 ${border}
                          ${isDarkMode ? 'bg-[#1a2e28] text-gray-400' : 'bg-[#eefaf5] text-gray-500'}`}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasteRows.map((row, ri) => (
                      <tr key={ri} className={isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/80'}>
                        {importCols.map((c) => (
                          <td key={c.key} className={`px-1.5 py-1 border-b ${border}`}>
                            <input
                              value={row[c.key] ?? ''}
                              onChange={(e) => updatePasteCell(ri, c.key, e.target.value)}
                              className={`w-full min-w-[100px] px-2 py-2 text-[13px] rounded-lg border-0 outline-none bg-transparent
                                focus:ring-2 focus:ring-[#13C296]/35 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
                              placeholder={c.label}
                              aria-label={`${c.label} row ${ri + 1}`}
                            />
                          </td>
                        ))}
                        <td
                          className={`sticky right-0 px-1 py-1 border-b text-center ${border}
                            ${isDarkMode ? 'bg-[#0f1c18]' : 'bg-white'}`}
                        >
                          <button
                            type="button"
                            onClick={() => removePasteRow(ri)}
                            className={`p-2 rounded-lg min-w-[40px] min-h-[40px] inline-flex items-center justify-center
                              ${isDarkMode ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'}`}
                            aria-label={`Remove row ${ri + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <div
              className={`rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-medium ${
                isDarkMode ? 'text-rose-300' : 'text-rose-600'
              }`}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t ${border}`}>
          <div className={`flex items-center gap-2 text-[11px] ${muted}`}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>
              {importCols.length} column{importCols.length === 1 ? '' : 's'}
              {activeRows.length > 0 ? ` · ${activeRows.length} row${activeRows.length === 1 ? '' : 's'} ready` : ''}
            </span>
            {importCols.some((c) => c.required) && (
              <span
                className={`ml-2 inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 font-bold ${
                  isDarkMode ? 'text-rose-300' : 'text-rose-600'
                }`}
              >
                * Required fields
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 sm:flex-none min-h-[44px] px-4 rounded-xl border text-sm font-semibold
                ${isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !activeRows.length}
              onClick={() => void handleSubmit()}
              className="flex-1 sm:flex-none min-h-[44px] px-5 rounded-xl bg-[#13C296] text-white text-sm font-bold hover:bg-[#10a87f] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${activeRows.length || ''}`.trim()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PreviewTable({
  cols,
  rows,
  isDarkMode,
  border,
  muted,
  fileKind,
}: {
  cols: ImportColumn[];
  rows: Record<string, string>[];
  isDarkMode: boolean;
  border: string;
  muted: string;
  fileKind?: ImportFileKind | null;
}) {
  const shown = rows.slice(0, 12);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          Data preview
          <span className={`ml-2 text-[12px] font-medium ${muted}`}>
            {rows.length} row{rows.length === 1 ? '' : 's'}
            {fileKind ? ` · ${fileKind.toUpperCase()}` : ''}
            {rows.length > 12 ? ' · showing first 12' : ''}
          </span>
        </p>
      </div>
      <div className={`rounded-xl border overflow-auto max-h-[min(320px,40vh)] ${border}`}>
        <table className="w-full text-left border-collapse min-w-[480px]">
          <thead className={isDarkMode ? 'bg-[#1a2e28]' : 'bg-[#eefaf5]'}>
            <tr>
              <th
                className={`sticky top-0 z-[1] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide ${
                  isDarkMode ? 'bg-[#1a2e28] text-gray-400' : 'bg-[#eefaf5] text-gray-500'
                }`}
              >
                #
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`sticky top-0 z-[1] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border-b ${border}
                    ${isDarkMode ? 'bg-[#1a2e28] text-[#13C296]' : 'bg-[#eefaf5] text-[#0f766e]'}`}
                >
                  {c.label}
                  {c.required && <span className="text-rose-500 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={i}
                className={`border-t ${border} ${isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/80'}`}
              >
                <td className={`px-3 py-2 text-[11px] tabular-nums ${muted}`}>{i + 1}</td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className="px-3 py-2 text-[12px] whitespace-nowrap max-w-[200px] truncate"
                    title={row[c.key] || ''}
                  >
                    {row[c.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
