import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UploadCloud,
  ClipboardPaste,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Eraser,
  Check,
  ChevronLeft,
  ChevronRight,
  Minimize2,
} from 'lucide-react';
import { isFieldColumn, type ColumnConfig } from '../types';
import { type ImportFileKind } from '../export/parseImportFile';
import {
  parseClipboardGridInWorker,
  parseImportFileInWorker,
} from '../export/parseImportInWorker';
import { SearchableSelect } from '../../../pages/exams/SearchableSelect';
import { InfoTip } from '../../PageHeading';

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  dataType?: string;
  /** Shown in the paste grid to keep positions aligned with the table, but never imported. */
  skip?: boolean;
};

/** Rows shown per preview page (paste grid + upload preview). All rows still import. */
const PREVIEW_PAGE_SIZE = 100;

type TabId = 'upload' | 'paste';

export type ImportMode = 'add' | 'update' | 'upsert' | 'replace';

export type ImportProgressHandlers = {
  onProgress?: (done: number, total: number) => void;
  mode?: ImportMode;
  matchKey?: string;
};

export type ImportMatchKeyOption = { key: string; label: string };

export type ImportExistingRow = {
  id: string;
  values?: Record<string, unknown> | null;
};

interface ImportDataModalProps {
  columns: ColumnConfig[];
  /** Keys of columns currently visible in the table. Non-importable ones among them stay in the paste grid as greyed placeholders. */
  visibleKeys?: string[];
  isDarkMode: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onImport: (
    rows: Record<string, string>[],
    handlers?: ImportProgressHandlers,
  ) => Promise<void> | void;
  /** Stable id (the table id). When set, pasted rows survive closing the dialog as a local draft. */
  draftKey?: string;
  /**
   * When set, show Add / Update / Upsert and match-key picker.
   * Update & Upsert match pasted rows to these existing records by the chosen key.
   */
  matchKeyOptions?: ImportMatchKeyOption[];
  existingRows?: ImportExistingRow[];
  /** Preferred match column (e.g. unique-row key / center code). */
  defaultMatchKey?: string;
  /**
   * Show “Replace all” — remove every existing record, then import the incoming rows.
   * Off by default (destructive); enable for tables that support a full wipe + re-import.
   */
  allowReplaceAll?: boolean;
  /**
   * Active list / group / tag the import applies to (e.g. “AM”, “All users”).
   * Shown so Add / Update / Upsert / Replace all are clearly scoped.
   */
  scopeLabel?: string;
  /** Short hint under the scope chip (e.g. “Tag filter”). */
  scopeHint?: string;
  /** Extra copy for the info tip (page-specific notes). */
  scopeHelp?: ReactNode;
  /**
   * While an import is running, user can minimize: modal closes but the request continues.
   * Parent should show a floating progress chip and toast when the import promise settles.
   */
  onMinimize?: (job: { done: number; total: number; mode: ImportMode }) => void;
  /** Progress while import runs (also after minimize). */
  onImportProgress?: (done: number, total: number) => void;
}

const normalizeMatchValue = (raw: unknown) => String(raw ?? '').trim().toLowerCase();

// Browser storage holds only the unsaved paste draft; the import itself goes through the API.
const draftStorageKey = (draftKey: string) => `table_import_draft_v1:${draftKey}`;

const readDraft = (draftKey: string | undefined, cols: ImportColumn[]): Record<string, string>[] | null => {
  if (!draftKey) return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(draftKey));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    // Re-key onto the current columns so a changed field list can't break the grid.
    const rows = parsed
      .filter((r) => r && typeof r === 'object')
      .map((r) => {
        const row = emptyRow(cols);
        cols.forEach((c) => {
          row[c.key] = String(r[c.key] ?? '');
        });
        return row;
      })
      .filter(rowHasData);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
};

const writeDraft = (draftKey: string | undefined, rows: Record<string, string>[]) => {
  if (!draftKey) return;
  try {
    const filled = rows.filter(rowHasData);
    if (filled.length) localStorage.setItem(draftStorageKey(draftKey), JSON.stringify(filled));
    else localStorage.removeItem(draftStorageKey(draftKey));
  } catch {
    /* storage unavailable — the draft just won't persist */
  }
};

const SKIP_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  '__created_by',
  '__updated_by',
]);

function isImportableColumn(c: ColumnConfig): boolean {
  if (!isFieldColumn(c)) return false;
  if (c.dataType === 'formula' || c.dataType === 'composite') return false;
  if (SKIP_KEYS.has(c.key) || c.key.startsWith('__')) return false;
  if (c.editable === false) return false;
  return true;
}

export function getImportableColumns(columns: ColumnConfig[]): ImportColumn[] {
  return (columns || [])
    .filter(isImportableColumn)
    .map((c) => ({
      key: c.key,
      label: c.label || c.key,
      required: Boolean(c.required),
      dataType: c.dataType,
    }));
}

/**
 * Paste-grid columns: importable columns plus, in table order, the visible columns that can't be
 * imported (formula / read-only / system). Those stay as greyed placeholders so a block copied from
 * the table pastes column-for-column.
 */
export function getGridColumns(columns: ColumnConfig[], visibleKeys?: string[]): ImportColumn[] {
  const visible = visibleKeys ? new Set(visibleKeys) : null;
  const out: ImportColumn[] = [];
  (columns || []).forEach((c) => {
    if (isImportableColumn(c)) {
      out.push({ key: c.key, label: c.label || c.key, required: Boolean(c.required), dataType: c.dataType });
    } else if (visible?.has(c.key)) {
      out.push({ key: c.key, label: c.label || c.key, skip: true });
    }
  });
  return out;
}

function emptyRow(cols: ImportColumn[]): Record<string, string> {
  const row: Record<string, string> = {};
  cols.forEach((c) => {
    row[c.key] = '';
  });
  return row;
}

const BLANK_PASTE_ROWS = 10;

function blankPasteGrid(cols: ImportColumn[], count = BLANK_PASTE_ROWS): Record<string, string>[] {
  return Array.from({ length: count }, () => emptyRow(cols));
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

export function ImportDataModal({
  columns,
  visibleKeys,
  isDarkMode,
  title = 'Bulk Import',
  subtitle = 'Upload CSV, Excel, or JSON — or paste table data to add multiple rows.',
  onClose,
  onImport,
  draftKey,
  matchKeyOptions,
  existingRows,
  defaultMatchKey,
  allowReplaceAll = false,
  scopeLabel,
  scopeHint,
  scopeHelp,
  onMinimize,
  onImportProgress,
}: ImportDataModalProps) {
  const importCols = useMemo(() => getImportableColumns(columns), [columns]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const gridCols = useMemo(() => getGridColumns(columns, visibleKeys), [columns, visibleKeys]);
  const matchKeys = useMemo(() => {
    if (!Array.isArray(matchKeyOptions) || !matchKeyOptions.length) return [];
    const importable = new Set(importCols.map((c) => c.key));
    return matchKeyOptions.filter((m) => importable.has(m.key));
  }, [matchKeyOptions, importCols]);
  /** Mode bar when Update/Upsert (match keys) and/or Replace all is available. */
  const replaceEnabled = matchKeys.length > 0 || allowReplaceAll;
  const showImportHelp = Boolean(scopeLabel) || replaceEnabled || matchKeys.length > 0;
  const [tab, setTab] = useState<TabId>('paste');
  const [importMode, setImportMode] = useState<ImportMode>('update');
  const [matchKey, setMatchKey] = useState(() => {
    if (defaultMatchKey && matchKeys.some((m) => m.key === defaultMatchKey)) return defaultMatchKey;
    return matchKeys[0]?.key || '';
  });
  const [draftRestored, setDraftRestored] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<ImportFileKind | null>(null);
  const [parsing, setParsing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [pasteRows, setPasteRows] = useState<Record<string, string>[]>(
    () =>
      readDraft(draftKey, importCols) ?? blankPasteGrid(importCols),
  );
  const [pastePage, setPastePage] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  /** Hide overlay but stay mounted so the in-flight import is not torn down. */
  const [minimized, setMinimized] = useState(false);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    if (!replaceEnabled) {
      setImportMode('add');
      return;
    }
    setImportMode((prev) => {
      if (prev === 'replace' && !allowReplaceAll) return matchKeys.length ? 'update' : 'add';
      if ((prev === 'update' || prev === 'upsert') && !matchKeys.length) {
        return allowReplaceAll ? 'replace' : 'add';
      }
      return prev;
    });
    setMatchKey((prev) => {
      if (prev && matchKeys.some((m) => m.key === prev)) return prev;
      if (defaultMatchKey && matchKeys.some((m) => m.key === defaultMatchKey)) return defaultMatchKey;
      return matchKeys[0]?.key || '';
    });
  }, [replaceEnabled, matchKeys, defaultMatchKey, allowReplaceAll]);

  useEffect(() => {
    const draft = readDraft(draftKey, importCols);
    setDraftRestored(Boolean(draft));
    setPasteRows(draft ?? blankPasteGrid(importCols));
    setPastePage(1);
    setPreviewRows([]);
    setFileName('');
    setFileKind(null);
    setError('');
  }, [importCols, draftKey]);

  // Keep the paste grid as a draft so closing the dialog doesn't lose it.
  useEffect(() => {
    const t = window.setTimeout(() => writeDraft(draftKey, pasteRows), 300);
    return () => window.clearTimeout(t);
  }, [draftKey, pasteRows]);

  const clearPasteRows = () => {
    setPasteRows(blankPasteGrid(importCols));
    setPastePage(1);
    setDraftRestored(false);
    setError('');
    writeDraft(draftKey, []);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never dismiss mid-import (same rule as backdrop / Cancel).
      if (e.key === 'Escape' && !submittingRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyFile = useCallback(
    async (file: File) => {
      setError('');
      setParsing(true);
      try {
        const { kind, rows } = await parseImportFileInWorker(
          file,
          importCols.map((c) => ({ key: c.key, label: c.label })),
        );
        if (!rows.length) {
          setError(
            `No data rows matched importable columns in the ${kind.toUpperCase()} file.`,
          );
          setPreviewRows([]);
          setFileName('');
          setFileKind(null);
          return;
        }
        setFileName(file.name);
        setFileKind(kind);
        setPreviewRows(rows);
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

  /**
   * Spreadsheet-style paste: clipboard text is parsed in a Web Worker, then the
   * block lands at the focused cell and spreads right/down (extra rows added).
   */
  const handlePasteOnGrid = (
    e: ClipboardEvent,
    startRow = 0,
    startColKey?: string,
  ) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setPasting(true);

    const startColIdx = Math.max(
      0,
      startColKey ? gridCols.findIndex((c) => c.key === startColKey) : 0,
    );
    const startRowIdx = Math.max(0, startRow);
    const colsSnapshot = gridCols;

    void (async () => {
      try {
        const grid = await parseClipboardGridInWorker(text);
        if (!grid.length) {
          setError('Nothing to paste — copy cells from Excel/Sheets and try again.');
          return;
        }

        const first = grid[0].map((c) => c.trim().toLowerCase());
        const looksLikeHeader =
          startColIdx === 0 &&
          first.some((h) =>
            colsSnapshot.some(
              (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h,
            ),
          );

        let dataLines = grid;
        let headerMap: (string | null)[] | null = null;

        if (looksLikeHeader) {
          dataLines = grid.slice(1);
          headerMap = first.map((h) => {
            const col = colsSnapshot.find(
              (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h,
            );
            return col && !col.skip ? col.key : null;
          });
        }

        if (!dataLines.length) {
          setError('Nothing to paste — copy cells from Excel/Sheets and try again.');
          return;
        }

        const canWrite = headerMap
          ? headerMap.some(Boolean)
          : dataLines.some((cells) =>
              cells.some((_, ci) => {
                const col = colsSnapshot[startColIdx + ci];
                return Boolean(col) && !col.skip;
              }),
            );
        if (!canWrite) {
          setError('Nothing to paste — copy cells from Excel/Sheets and try again.');
          return;
        }

        setPasteRows((prev) => {
          const next = prev.map((r) => ({ ...r }));

          dataLines.forEach((cells, ri) => {
            const rowIdx = startRowIdx + ri;
            while (next.length <= rowIdx) next.push(emptyRow(colsSnapshot));
            const row = { ...next[rowIdx] };

            if (headerMap) {
              headerMap.forEach((key, i) => {
                if (!key) return;
                row[key] = cells[i] ?? '';
              });
            } else {
              cells.forEach((val, ci) => {
                const col = colsSnapshot[startColIdx + ci];
                if (!col || col.skip) return;
                row[col.key] = val ?? '';
              });
            }

            next[rowIdx] = row;
          });

          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not parse pasted data');
      } finally {
        setPasting(false);
      }
    })();
  };

  const updatePasteCell = (rowIndex: number, key: string, value: string) => {
    setPasteRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)),
    );
  };

  const addPasteRow = () => {
    setPasteRows((prev) => [...prev, emptyRow(importCols)]);
    setPastePage(Math.max(1, Math.ceil((pasteRows.length + 1) / PREVIEW_PAGE_SIZE)));
  };

  const removePasteRow = (index: number) => {
    setPasteRows((prev) => {
      if (prev.length <= 1) return [emptyRow(importCols)];
      return prev.filter((_, i) => i !== index);
    });
  };

  const activeRows = tab === 'upload' ? previewRows : pasteRows.filter(rowHasData);
  const pastePageCount = Math.max(1, Math.ceil(pasteRows.length / PREVIEW_PAGE_SIZE));
  const safePastePage = Math.min(pastePage, pastePageCount);
  const pastePageOffset = (safePastePage - 1) * PREVIEW_PAGE_SIZE;
  const visiblePasteRows = useMemo(
    () => pasteRows.slice(pastePageOffset, pastePageOffset + PREVIEW_PAGE_SIZE),
    [pasteRows, pastePageOffset],
  );

  useEffect(() => {
    if (pastePage !== safePastePage) setPastePage(safePastePage);
  }, [pastePage, safePastePage]);
  const requiredMissing = useMemo(() => {
    const req = importCols.filter((c) => c.required);
    if (!req.length || !activeRows.length) return 0;
    return activeRows.filter((row) =>
      req.some((c) => !String(row[c.key] || '').trim()),
    ).length;
  }, [activeRows, importCols]);

  const existingLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (!matchKey || !Array.isArray(existingRows)) return map;
    existingRows.forEach((r) => {
      const v = normalizeMatchValue(r?.values?.[matchKey]);
      if (!v || map.has(v)) return;
      map.set(v, String(r.id));
    });
    return map;
  }, [existingRows, matchKey]);

  const matchPreview = useMemo(() => {
    if (!replaceEnabled || importMode === 'add' || importMode === 'replace' || !matchKey) {
      return { update: 0, create: 0, unmatched: 0, blankKey: 0 };
    }
    let update = 0;
    let create = 0;
    let unmatched = 0;
    let blankKey = 0;
    activeRows.forEach((row) => {
      const v = normalizeMatchValue(row[matchKey]);
      if (!v) {
        blankKey += 1;
        return;
      }
      if (existingLookup.has(v)) update += 1;
      else if (importMode === 'upsert') create += 1;
      else unmatched += 1;
    });
    return { update, create, unmatched, blankKey };
  }, [replaceEnabled, importMode, matchKey, activeRows, existingLookup]);

  const needsMatchKey = importMode === 'update' || importMode === 'upsert';

  const handleSubmit = async () => {
    setError('');
    setImportProgress(null);
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
    if (replaceEnabled && needsMatchKey) {
      if (!matchKey) {
        setError('Choose a column to match existing records.');
        return;
      }
      if (importMode === 'update' && matchPreview.update === 0) {
        setError(
          matchPreview.blankKey
            ? `No matching rows. ${matchPreview.blankKey} pasted row${matchPreview.blankKey === 1 ? '' : 's'} missing “${matchKeys.find((m) => m.key === matchKey)?.label || matchKey}”.`
            : 'No pasted rows match existing records for the selected key.',
        );
        return;
      }
    }
    if (replaceEnabled && importMode === 'replace' && !activeRows.length) {
      setError('Add incoming rows before replacing existing records.');
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
    setImportProgress({ done: 0, total: payload.length });
    onImportProgress?.(0, payload.length);
    const mode = replaceEnabled ? importMode : 'add';
    try {
      await onImport(payload, {
        onProgress: (done, total) => {
          const t = total || payload.length;
          if (mountedRef.current) setImportProgress({ done, total: t });
          onImportProgress?.(done, t);
        },
        mode,
        matchKey: replaceEnabled && needsMatchKey ? matchKey : undefined,
      });
      if (tab === 'paste') writeDraft(draftKey, []);
      if (mountedRef.current) onClose();
    } catch (err) {
      // Parent onImport / toast should also report failures when minimized.
      if (mountedRef.current) {
        setMinimized(false); // bring the dialog back so the error is visible
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setImportProgress(null);
      }
    }
  };

  const requestClose = () => {
    if (submitting) return; // never abort an in-flight import by dismissing
    onClose();
  };

  const handleMinimize = () => {
    if (!submitting || !onMinimize) return;
    setMinimized(true);
    onMinimize({
      done: importProgress?.done || 0,
      total: importProgress?.total || activeRows.length,
      mode: replaceEnabled ? importMode : 'add',
    });
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

  // Stay mounted while minimized so await onImport keeps running; parent shows the chip.
  if (minimized) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/45"
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`w-full max-w-[920px] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${bg} ${border}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={submitting || undefined}
      >
        {/* Header */}
        <div className={`flex flex-wrap items-start gap-x-3 gap-y-3 px-5 py-4 border-b sm:flex-nowrap sm:items-center ${border}`}>
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
            <div className="w-10 h-10 rounded-xl bg-[#13C296]/15 text-[#13C296] flex items-center justify-center flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[16px] font-bold tracking-tight whitespace-nowrap">{title}</h2>
              <InfoTip title="How bulk import works" label="How bulk import works">
                {subtitle ? <p>{subtitle}</p> : null}
                {scopeLabel ? (
                  <p>
                    You are importing in <strong>{scopeLabel}</strong>
                    {scopeHint ? ` (${scopeHint})` : ''}. Add, Update, Upsert, and Replace all
                    only apply to this list — not the whole portal.
                  </p>
                ) : null}
                {showImportHelp ? (
                  <>
                    <p>Choose a mode:</p>
                    <ul>
                      <li>
                        <strong>Add new</strong> — create rows only; existing records are left alone.
                      </li>
                      {matchKeys.length > 0 ? (
                        <>
                          <li>
                            <strong>Update matching</strong> — overwrite rows that match on the
                            selected key; unmatched incoming rows are skipped.
                          </li>
                          <li>
                            <strong>Upsert</strong> — update matches, and add rows that do not match
                            yet.
                          </li>
                        </>
                      ) : null}
                      {allowReplaceAll ? (
                        <li>
                          <strong>Replace all</strong> — remove existing rows
                          {scopeLabel ? ` in “${scopeLabel}”` : ''}
                          , then import the incoming rows. Protected accounts (if any) are kept.
                        </li>
                      ) : null}
                    </ul>
                  </>
                ) : null}
                {scopeHelp ? <p>{scopeHelp}</p> : null}
              </InfoTip>
              {scopeLabel ? (
                <span
                  className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                    isDarkMode ? 'bg-[#13C296]/15 text-[#5eead4]' : 'bg-[#13C296]/12 text-[#0f766e]'
                  }`}
                >
                  <span className={`font-medium shrink-0 ${muted}`}>Importing in</span>
                  <span className="truncate">{scopeLabel}</span>
                  {scopeHint ? (
                    <span className={`font-medium shrink-0 opacity-80 ${muted}`}>· {scopeHint}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
          {/* Tabs live in the header: wrap under the title on narrow screens */}
          <div
            role="tablist"
            aria-label="Import method"
            className={`order-last flex w-full gap-0.5 rounded-xl p-1 sm:order-none sm:w-auto sm:flex-shrink-0 ${surface}`}
          >
            {([
              { id: 'upload', label: 'Upload File', Icon: UploadCloud },
              { id: 'paste', label: 'Paste Table Data', Icon: ClipboardPaste },
            ] as const).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-semibold transition-colors sm:min-h-[36px] sm:flex-none
                  ${tab === id
                    ? 'bg-[#13C296] text-white shadow-[0_1px_3px_rgba(19,194,150,0.35)]'
                    : `${muted} ${isDarkMode ? 'hover:bg-white/5 hover:text-gray-100' : 'hover:bg-black/[0.04] hover:text-gray-800'}`
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          {submitting && onMinimize ? (
            <button
              type="button"
              onClick={handleMinimize}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold sm:min-h-[36px]
                ${isDarkMode ? 'text-gray-200 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Keep importing in the background"
              aria-label="Minimize and continue import in background"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Minimize</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className={`p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {replaceEnabled && (
            <div className={`rounded-xl border px-2.5 py-2 space-y-1.5 ${border} ${surface}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Import mode">
                {(
                  [
                    { id: 'add' as const, label: 'Add new', hint: 'Create rows only', show: true },
                    {
                      id: 'update' as const,
                      label: 'Update matching',
                      hint: 'Overwrite existing by key',
                      show: matchKeys.length > 0,
                    },
                    {
                      id: 'upsert' as const,
                      label: 'Upsert',
                      hint: 'Update if found, else add',
                      show: matchKeys.length > 0,
                    },
                    {
                      id: 'replace' as const,
                      label: 'Replace all',
                      hint: 'Remove all existing, then import incoming rows',
                      show: allowReplaceAll,
                    },
                  ] as const
                )
                  .filter((m) => m.show)
                  .map(({ id, label, hint }) => (
                  <button
                    key={id}
                    type="button"
                    title={hint}
                    aria-pressed={importMode === id}
                    disabled={submitting}
                    onClick={() => setImportMode(id)}
                    className={`min-h-[32px] px-2.5 rounded-lg text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50
                      ${importMode === id
                        ? id === 'replace'
                          ? 'bg-rose-500 text-white shadow-[0_1px_3px_rgba(244,63,94,0.35)]'
                          : 'bg-[#13C296] text-white shadow-[0_1px_3px_rgba(19,194,150,0.35)]'
                        : isDarkMode
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-[#13C296]/50'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {needsMatchKey && (
                <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:max-w-[320px] sm:ml-auto">
                  <span className={`text-[12px] font-semibold whitespace-nowrap ${muted}`}>
                    Match on
                  </span>
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      id="import-match-key"
                      ariaLabel="Match on"
                      value={matchKey}
                      options={matchKeys.map((m) => ({ value: m.key, label: m.label }))}
                      portal
                      searchThreshold={6}
                      placeholder="Select column…"
                      onChange={(key) => setMatchKey(String(key || ''))}
                    />
                  </div>
                </div>
              )}
              </div>
              {importMode === 'replace' && activeRows.length > 0 && (
                <p className={`text-[12px] font-medium ${muted}`}>
                  Preview:{' '}
                  <span className={isDarkMode ? 'text-rose-300' : 'text-rose-600'}>
                    {scopeLabel
                      ? `remove all in “${scopeLabel}”`
                      : 'remove all existing'}
                  </span>
                  {' · '}
                  <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}>
                    import {activeRows.length} incoming
                  </span>
                </p>
              )}
              {needsMatchKey && activeRows.length > 0 && (
                <p className={`text-[12px] font-medium ${muted}`}>
                  Preview
                  {existingLookup.size === 0 ? ' (no loaded rows to match yet)' : ''}
                  :{' '}
                  <span className={isDarkMode ? 'text-sky-300' : 'text-sky-700'}>
                    {matchPreview.update} update
                  </span>
                  {importMode === 'upsert' && (
                    <>
                      {' · '}
                      <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}>
                        {matchPreview.create} new
                      </span>
                    </>
                  )}
                  {importMode === 'update' && matchPreview.unmatched > 0 && (
                    <>
                      {' · '}
                      <span className={isDarkMode ? 'text-amber-300' : 'text-amber-700'}>
                        {matchPreview.unmatched} unmatched (skipped)
                      </span>
                    </>
                  )}
                  {matchPreview.blankKey > 0 && (
                    <>
                      {' · '}
                      <span className={isDarkMode ? 'text-rose-300' : 'text-rose-600'}>
                        {matchPreview.blankKey} missing key
                      </span>
                    </>
                  )}
                  <span className="opacity-70">
                    {' '}
                    — only pasted columns are written; other fields stay as-is.
                  </span>
                </p>
              )}
            </div>
          )}

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
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-[240px] flex-wrap items-center gap-x-2.5 gap-y-1">
                  <p className={`flex items-center gap-1.5 text-[12.5px] ${muted}`}>
                    <ClipboardPaste className="h-4 w-4 flex-shrink-0 text-[#13C296]" />
                    <span>
                      Copy cells from Excel / Sheets, click the starting cell, then press{' '}
                      <kbd className={`rounded border px-1 py-px font-sans text-[10.5px] font-semibold ${border}`}>⌘/Ctrl</kbd>
                      {' + '}
                      <kbd className={`rounded border px-1 py-px font-sans text-[10.5px] font-semibold ${border}`}>V</kbd>
                    </span>
                  </p>
                  {draftRestored && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#13C296]/15 px-2 py-0.5 text-[11px] font-semibold text-[#0f9f7a]">
                      <Check className="h-3 w-3" />
                      Draft restored
                    </span>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className={`px-1.5 text-[12px] font-semibold tabular-nums ${muted}`} aria-live="polite">
                    {pasting
                      ? 'Parsing…'
                      : `${pasteRows.filter(rowHasData).length} row${pasteRows.filter(rowHasData).length === 1 ? '' : 's'}`}
                  </span>
                  <button
                    type="button"
                    onClick={clearPasteRows}
                    disabled={!pasteRows.some(rowHasData)}
                    title="Clear all pasted rows"
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:min-h-[34px] disabled:cursor-not-allowed disabled:opacity-40
                      ${isDarkMode ? 'text-gray-300 hover:bg-rose-500/15 hover:text-rose-300' : 'text-gray-600 hover:bg-rose-50 hover:text-rose-600'}`}
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={addPasteRow}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#13C296]/15 px-3 text-xs font-bold text-[#0f9f7a] transition-colors hover:bg-[#13C296]/25 sm:min-h-[34px]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add row
                  </button>
                </div>
              </div>

              <div
                ref={pasteTableRef}
                onPaste={(e) => {
                  // Cell inputs handle paste with their own row/col; this is the fallback
                  // when the table wrapper itself is focused.
                  if ((e.target as HTMLElement).tagName === 'INPUT') return;
                  handlePasteOnGrid(e, pastePageOffset, gridCols[0]?.key);
                }}
                className={`import-grid-scroll rounded-xl border overflow-auto max-h-[min(420px,50vh)] relative ${border}`}
                tabIndex={0}
              >
                {pasting && (
                  <div className={`absolute inset-0 z-[3] flex items-center justify-center ${isDarkMode ? 'bg-[#0f1c18]/70' : 'bg-white/70'}`}>
                    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${muted}`}>
                      <Loader2 className="h-4 w-4 animate-spin text-[#13C296]" />
                      Parsing paste in background…
                    </span>
                  </div>
                )}
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead className={isDarkMode ? 'bg-[#1a2e28]' : 'bg-[#eefaf5]'}>
                    <tr>
                      <th
                        className={`sticky top-0 z-[1] px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b w-12 ${border}
                          ${isDarkMode ? 'bg-[#1a2e28] text-gray-400' : 'bg-[#eefaf5] text-gray-500'}`}
                      >
                        #
                      </th>
                      {gridCols.map((c) => (
                        <th
                          key={c.key}
                          title={c.skip ? 'Calculated / read-only in the table — not imported' : undefined}
                          className={`sticky top-0 z-[1] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border-b ${border}
                            ${c.skip
                              ? (isDarkMode ? 'bg-[#1a2e28] text-gray-500' : 'bg-[#eefaf5] text-gray-400')
                              : (isDarkMode ? 'bg-[#1a2e28] text-[#13C296]' : 'bg-[#eefaf5] text-[#0f766e]')}`}
                        >
                          {c.label}
                          {c.skip && <span className="ml-1 normal-case font-medium opacity-80">(auto)</span>}
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
                    {visiblePasteRows.map((row, localIdx) => {
                      const ri = pastePageOffset + localIdx;
                      return (
                      <tr key={ri} className={isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/80'}>
                        <td className={`px-2 py-1 border-b text-[11px] tabular-nums ${border} ${muted}`}>
                          {ri + 1}
                        </td>
                        {gridCols.map((c) => c.skip ? (
                          <td
                            key={c.key}
                            className={`px-3 py-1 border-b text-[13px] select-none ${border} ${muted}
                              ${isDarkMode ? 'bg-white/[0.02]' : 'bg-gray-50'}`}
                            title="Calculated / read-only in the table — not imported"
                          >
                            <span className="inline-block min-w-[100px]">—</span>
                          </td>
                        ) : (
                          <td key={c.key} className={`px-1.5 py-1 border-b ${border}`}>
                            <input
                              value={row[c.key] ?? ''}
                              onChange={(e) => updatePasteCell(ri, c.key, e.target.value)}
                              onPaste={(e) => handlePasteOnGrid(e, ri, c.key)}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pastePageCount > 1 && (
                <ImportPreviewPager
                  page={safePastePage}
                  pageCount={pastePageCount}
                  pageSize={PREVIEW_PAGE_SIZE}
                  totalRows={pasteRows.length}
                  isDarkMode={isDarkMode}
                  muted={muted}
                  border={border}
                  onPageChange={setPastePage}
                />
              )}
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
        <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t sm:px-5 ${border}`}>
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
            {submitting && onMinimize ? (
              <button
                type="button"
                onClick={handleMinimize}
                className={`flex-1 sm:flex-none min-h-[44px] px-4 rounded-lg border text-sm font-semibold sm:min-h-[34px] inline-flex items-center justify-center gap-1.5
                  ${isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Minimize
              </button>
            ) : (
              <button
                type="button"
                onClick={requestClose}
                disabled={submitting}
                className={`flex-1 sm:flex-none min-h-[44px] px-4 rounded-lg border text-sm font-semibold sm:min-h-[34px] disabled:cursor-not-allowed disabled:opacity-40
                  ${isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={submitting || !activeRows.length}
              onClick={() => void handleSubmit()}
              className="flex-1 sm:flex-none min-h-[44px] px-4 rounded-lg bg-[#13C296] text-white text-sm font-bold hover:bg-[#10a87f] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 sm:min-h-[34px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {importProgress && importProgress.total > 0
                    ? `Importing ${importProgress.done.toLocaleString()} / ${importProgress.total.toLocaleString()}…`
                    : 'Importing…'}
                </>
              ) : importMode === 'update' ? (
                `Update ${matchPreview.update || ''}`.trim()
              ) : importMode === 'upsert' ? (
                `Upsert ${activeRows.length || ''}`.trim()
              ) : importMode === 'replace' ? (
                `Replace with ${activeRows.length || ''}`.trim()
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

function ImportPreviewPager({
  page,
  pageCount,
  pageSize,
  totalRows,
  isDarkMode,
  muted,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  isDarkMode: boolean;
  muted: string;
  border?: string;
  onPageChange: (page: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);
  const btn = `inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[36px] sm:min-w-[36px] ${
    isDarkMode
      ? 'border-gray-600 text-gray-200 hover:bg-white/5'
      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
  }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={`text-[12px] font-medium tabular-nums ${muted}`}>
        Rows {from.toLocaleString()}–{to.toLocaleString()} of {totalRows.toLocaleString()}
        <span className="mx-1.5 opacity-50">·</span>
        Page {page} of {pageCount}
        <span className="mx-1.5 opacity-50">·</span>
        {pageSize}/page
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
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
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PREVIEW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * PREVIEW_PAGE_SIZE;
  const shown = rows.slice(offset, offset + PREVIEW_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          Data preview
          <span className={`ml-2 text-[12px] font-medium ${muted}`}>
            {rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'}
            {fileKind ? ` · ${fileKind.toUpperCase()}` : ''}
          </span>
        </p>
      </div>
      <div className={`import-grid-scroll rounded-xl border overflow-auto max-h-[min(320px,40vh)] ${border}`}>
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
            {shown.map((row, i) => {
              const abs = offset + i;
              return (
              <tr
                key={abs}
                className={`border-t ${border} ${isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/80'}`}
              >
                <td className={`px-3 py-2 text-[11px] tabular-nums ${muted}`}>{abs + 1}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <ImportPreviewPager
          page={safePage}
          pageCount={pageCount}
          pageSize={PREVIEW_PAGE_SIZE}
          totalRows={rows.length}
          isDarkMode={isDarkMode}
          muted={muted}
          border={border}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
