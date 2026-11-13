import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { AggregationType, ColumnConfig, ConditionalFormatRule, DataRow, RowData, FilterValue, PendingDelete, SortConfig, PendingEdit, SavedView, Density } from '../types';
import { genRowId } from '../utils';
import {
  readPref,
  saveTablePrefs,
  TABLE_PREFS_KEY,
  loadTablePrefs,
  mergeColumnOrder,
  mergeColumnVisibility,
  pinAuditColumnsLast,
  pickLayoutSlice,
  type TablePrefs,
} from '../utils/prefsStorage';
import { publishSharedColumns } from '../../DynamicData/schemaStore';
import { getSharedRows, publishSharedRows, subscribeSharedRows } from '../../DynamicData/rowsStore';
import { normalizeConditionalFormatRule } from '../utils/conditionalFormat';
import {
  applyAggregations,
  diffAggregations,
  layoutSignature,
  summarizeLayoutChanges,
  type LayoutSlice,
} from '../utils/layoutDraft';
import { createCompositeColumnHandlers } from './tableState/compositeColumnHandlers';
import { createConditionalFormatHandlers } from './tableState/conditionalFormatHandlers';
import { createSavedViewHandlers, loadSavedViews } from './tableState/savedViewHandlers';
import { setLookupPick } from '../editors/lookupPicks';
import { seedLookupRow } from '../editors/lookupSeeds';
import { setLookupDisplayOverrides } from '../editors/lookupDisplayOverrides';
import type { BulkLookupPickMeta } from '../components/BulkLookupPicker';
import type { BulkAssigneePickMeta } from '../components/BulkAssigneePicker';
import { seedAssigneeLabels } from '../editors/assigneeLabels';
import { useDebouncedRowSave } from './useDebouncedRowSave';
export type { TableStateHandlers } from './tableState/types';
import type { TableStateHandlers } from './tableState/types';

const sanitizeColumns = (cols: ColumnConfig[]): ColumnConfig[] => {
  return cols.map((col, idx) => ({
    order: col.order ?? idx + 1,
    visible: col.visible ?? true,
    pinned: col.pinned ?? null,
    width: col.width ?? 180,
    ...col,
  }));
};

/** Date × shift columns — template px from features.dateShifts. */
const isDateShiftColumn = (col: { key?: string; dateShiftTemplate?: boolean } | string) => {
  if (typeof col === 'string') return String(col || '').toLowerCase().startsWith('ds_');
  if (col?.dateShiftTemplate) return true;
  return String(col?.key || '').toLowerCase().startsWith('ds_');
};

type LayoutSeed = {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  density: Density;
  /** Footer totals that differ from the page schema (`null` = removed). */
  columnAggregations: Record<string, AggregationType | null>;
  conditionalFormats: ConditionalFormatRule[];
};

const hasKeys = (obj?: Record<string, unknown> | null) =>
  Boolean(obj && typeof obj === 'object' && Object.keys(obj).length > 0);

/**
 * Starting layout for the table.
 *  - 'saved'   → what is stored on the server (user override, else org default). The baseline that
 *                "unsaved changes" are measured against.
 *  - 'current' → the same, plus this browser's draft when it was made from that saved layout.
 *                A draft made from an older saved layout (saved elsewhere since) is stale and ignored.
 */
/** Exported for tests. */
export const resolveLayoutSeed = (
  cols: ColumnConfig[],
  serverLayout?: TablePrefs | null,
  tableId?: string,
  defaultDensity: Density = 'standard',
  mode: 'saved' | 'current' = 'current',
): LayoutSeed => {
  const keys = cols.map((c) => c.key);
  const schemaVisibility = cols.reduce<Record<string, boolean>>((acc, c) => {
    acc[c.key] = c.visible !== false;
    return acc;
  }, {});
  const layout = pickLayoutSlice(serverLayout);

  const local = mode === 'current' ? loadTablePrefs(tableId) : null;
  const isLegacyCache = Boolean(local && local.baseSig === undefined);
  // A draft is valid when it was made from the layout that is saved now. Browser caches from before
  // drafts existed (no signature) are only used as before: when nothing is saved on the server yet.
  const draft: TablePrefs | null = !local
    ? null
    : isLegacyCache
      ? (Object.keys(layout).length === 0 ? local : null)
      : local.baseSig === layoutSignature(layout)
        ? local
        : null;
  const draftSlice = pickLayoutSlice(draft);

  const preferred = {
    columnOrder:
      Array.isArray(draftSlice.columnOrder) && draftSlice.columnOrder.length > 0
        ? draftSlice.columnOrder
        : layout.columnOrder,
    columnVisibility: hasKeys(draftSlice.columnVisibility as Record<string, unknown>)
      ? draftSlice.columnVisibility
      : layout.columnVisibility,
    columnWidths: hasKeys(draftSlice.columnWidths as Record<string, unknown>)
      ? draftSlice.columnWidths
      : layout.columnWidths,
  };

  // Density: a draft or the saved layout wins. A page-level default (e.g. center list → compact) also
  // wins over a stale browser "standard" left by the old global default.
  let density = (draftSlice.density as Density) || (layout.density as Density) || null;
  if (draft && isLegacyCache && density === 'standard' && defaultDensity !== 'standard') {
    density = defaultDensity;
  }
  if (!density) density = defaultDensity;

  // Footer totals + highlight rules. Browser caches from before drafts existed held these only locally
  // (they were never restored) — pick them up once so they can be saved properly.
  const legacy = mode === 'current' && isLegacyCache ? local : null;
  const legacyAggs =
    legacy && !('columnAggregations' in legacy) && Array.isArray(legacy.columns)
      ? diffAggregations(legacy.columns, cols)
      : undefined;
  const columnAggregations =
    draftSlice.columnAggregations ?? layout.columnAggregations ?? legacyAggs ?? {};
  const conditionalFormats = (
    draftSlice.conditionalFormats ?? layout.conditionalFormats ?? legacy?.conditionalFormats ?? []
  ).map(normalizeConditionalFormatRule);

  // Prefer saved/user widths; fall back to schema / date×shift template width.
  const preferredWidths = preferred.columnWidths || {};
  const columnWidths: Record<string, number> = {};
  cols.forEach((c) => {
    if (preferredWidths[c.key] != null) {
      columnWidths[c.key] = preferredWidths[c.key];
    } else if (c.width) {
      columnWidths[c.key] = c.width;
    }
  });
  // Sticky chrome columns are not in the schema — still restore their saved widths.
  ['__checkbox', '__actions'].forEach((k) => {
    if (preferredWidths[k] != null) columnWidths[k] = preferredWidths[k];
  });

  return {
    columnOrder: mergeColumnOrder(keys, preferred.columnOrder),
    columnVisibility: mergeColumnVisibility(keys, schemaVisibility, preferred.columnVisibility),
    columnWidths,
    density,
    columnAggregations,
    conditionalFormats,
  };
};

/** Layout seed → the comparable slice. Footer totals are round-tripped so "same as schema" entries drop out. */
/** Exported for tests. */
export const seedToSlice = (seed: LayoutSeed, schema: ColumnConfig[]): LayoutSlice => ({
  columnOrder: seed.columnOrder,
  columnVisibility: seed.columnVisibility,
  columnWidths: seed.columnWidths,
  density: seed.density,
  columnAggregations: diffAggregations(applyAggregations(schema, seed.columnAggregations), schema),
  conditionalFormats: seed.conditionalFormats,
});

const sanitizeRows = (rws: (DataRow | RowData)[]): DataRow[] => {
  return rws.map((r, idx) => {
    const { rowId, ...rest } = r;
    return {
      ...rest,
      rowId: rowId || r.id || `row_${idx + 1}`,
    };
  });
};

export type UseTableStateOptions = {
  tableId?: string;
  /** When false, do not sync into the shared Dynamic* view store (e.g. Vendors). Default true. */
  shareState?: boolean;
  /** Resolved layout from API (user override or org default). */
  layoutPrefs?: TablePrefs | null;
  /** Used when neither server nor local layout has a density yet. */
  defaultDensity?: Density;
  /** Saves the personal layout when the user clicks Save on the unsaved-changes bar. May reject on failure. */
  onLayoutPrefsChange?: (prefs: TablePrefs) => void | Promise<unknown>;
  onRowUpdate?: (rowId: string, updatedValues: Record<string, unknown>, row: DataRow) => Promise<void> | void;
  onRowDelete?: (rowIds: string[]) => Promise<void> | void;
  /**
   * When set, deleting a row hands it to the page instead of removing it from the table (no undo toast).
   * The page runs its own checks and confirmation, then reloads the rows.
   */
  onDeleteRowRequest?: (row: DataRow) => void;
  /** One call for a whole bulk update. When omitted, each row goes through onRowUpdate. */
  onBulkUpdate?: (items: { rowId: string; values: Record<string, unknown>; row: DataRow }[]) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
};

export function useTableState(
  initialColumns: ColumnConfig[],
  initialRows: DataRow[],
  options: UseTableStateOptions = {},
): TableStateHandlers {
  const {
    tableId,
    shareState = true,
    layoutPrefs = null,
    defaultDensity = 'standard',
    onLayoutPrefsChange,
    onRowUpdate,
    onRowDelete,
    onDeleteRowRequest,
    onBulkUpdate,
  } = options;

  const [rows, setRows] = useState<DataRow[]>(() =>
    sanitizeRows((shareState ? getSharedRows() : null) ?? initialRows),
  );
  // Starting layout: the saved layout, plus this browser's draft when it is still based on it.
  // Computed once; later schema changes recompute below.
  const [seeds] = useState(() => {
    const schema = sanitizeColumns(initialColumns);
    return {
      current: resolveLayoutSeed(schema, layoutPrefs, tableId, defaultDensity, 'current'),
      saved: resolveLayoutSeed(schema, layoutPrefs, tableId, defaultDensity, 'saved'),
      schema,
    };
  });
  /** The page's own column definitions — footer totals are saved as differences from these. */
  const schemaColumnsRef = useRef<ColumnConfig[]>(seeds.schema);
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    applyAggregations(seeds.schema, seeds.current.columnAggregations),
  );
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  /** The last SAVED layout — "unsaved changes" means the table differs from this. */
  const savedSliceRef = useRef<LayoutSlice>(seedToSlice(seeds.saved, seeds.schema));
  const [savedSig, setSavedSig] = useState(() => layoutSignature(savedSliceRef.current));
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSaveError, setLayoutSaveError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);

  const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set());
  const [rowDrafts, setRowDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const rowDraftsRef = useRef(rowDrafts);
  rowDraftsRef.current = rowDrafts;
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const initialSeed = seeds.current;

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => initialSeed.columnWidths);

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(tableId));
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => initialSeed.columnOrder);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => initialSeed.columnVisibility,
  );

  const [highlightedColKey, setHighlightedColKey] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedColKey) {
      const timer = setTimeout(() => {
        setHighlightedColKey(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightedColKey]);
  const [transitioningCols, setTransitioningCols] = useState<Record<string, 'show' | 'hide'>>({});

  const [density, setDensity] = useState<Density>(() => initialSeed.density);

  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>(
    () => seeds.current.conditionalFormats,
  );
  const [recentFormatColors, setRecentFormatColors] = useState<string[]>(() =>
    readPref('recentFormatColors', [], tableId),
  );

  // Sync when parent switches presets (prop identity change) — not on first mount,
  // so we don't clobber rows another view already published this session.
  const skipInitialPropSync = useRef(true);
  const skipInitialRowsSync = useRef(true);
  const layoutPrefsRef = useRef(layoutPrefs);
  layoutPrefsRef.current = layoutPrefs;
  /** Last date×shift template widths from props — only re-apply when the template itself changes. */
  const lastDateShiftTemplateWidthsRef = useRef<Record<string, number>>({});

  // Columns / table identity — reset chrome when schema changes; keep live resize widths.
  useEffect(() => {
    const cleanCols = sanitizeColumns(initialColumns);
    const seed = resolveLayoutSeed(cleanCols, layoutPrefsRef.current, tableId, defaultDensity, 'current');
    const keySet = new Set(cleanCols.map((c) => c.key));
    // Keep footer totals: saved / draft ones, plus anything changed in this session on columns that still exist.
    const sessionAggs = diffAggregations(columnsRef.current, schemaColumnsRef.current);
    Object.keys(sessionAggs).forEach((k) => {
      if (!keySet.has(k)) delete sessionAggs[k];
    });
    schemaColumnsRef.current = cleanCols;
    setColumns(applyAggregations(cleanCols, { ...seed.columnAggregations, ...sessionAggs }));
    // The page's schema changed (e.g. a preset switch): re-measure "saved" against the new columns.
    savedSliceRef.current = seedToSlice(
      resolveLayoutSeed(cleanCols, layoutPrefsRef.current, tableId, defaultDensity, 'saved'),
      cleanCols,
    );
    setSavedSig(layoutSignature(savedSliceRef.current));
    setColumnOrder(seed.columnOrder);
    setColumnVisibility(seed.columnVisibility);
    // Merge: keep in-session (or just-resized) widths; adopt new template when it changes.
    // Preserve sticky chrome cols (__checkbox / __actions) — dropping them forced preset reset.
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      ['__checkbox', '__actions'].forEach((k) => {
        if (prev[k] != null) next[k] = prev[k];
        else if (seed.columnWidths[k] != null) next[k] = seed.columnWidths[k];
      });
      keySet.forEach((k) => {
        const col = cleanCols.find((c) => c.key === k);
        const templateW = col?.width;
        if (isDateShiftColumn(col || k) && templateW) {
          const prevTemplate = lastDateShiftTemplateWidthsRef.current[k];
          if (prevTemplate !== undefined && prevTemplate !== templateW) {
            next[k] = templateW;
            return;
          }
        }
        if (prev[k] != null) next[k] = prev[k];
        else if (seed.columnWidths[k] != null) next[k] = seed.columnWidths[k];
        else if (templateW != null) next[k] = templateW;
      });
      return next;
    });
    {
      const seen: Record<string, number> = {};
      cleanCols.forEach((c) => {
        if (isDateShiftColumn(c) && c.width) seen[c.key] = c.width;
      });
      lastDateShiftTemplateWidthsRef.current = seen;
    }
    if (seed.density) setDensity(seed.density);
    setSort([]);
    setFilters({});
    setSearch('');
    setSelectedRows(new Set());
    if (skipInitialPropSync.current) {
      skipInitialPropSync.current = false;
      return;
    }
    setRows(sanitizeRows(initialRows));
    // initialRows intentionally omitted — row data syncs in the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColumns, tableId, defaultDensity]);

  // Soft-sync row data from parent without wiping sort / filters / selection.
  useEffect(() => {
    if (skipInitialRowsSync.current) {
      skipInitialRowsSync.current = false;
      return;
    }
    setRows(sanitizeRows(initialRows));
  }, [initialRows]);

  // Soft-sync accent + date×shift template metadata without fighting interactive resize.
  useEffect(() => {
    setColumns((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const src = initialColumns.find((ic) => ic.key === c.key);
        const accent = src?.accentColor || undefined;
        const width = src?.width;
        let col = c;
        if ((c.accentColor || undefined) !== accent) {
          col = { ...col, accentColor: accent };
          changed = true;
        }
        // Keep column def width in sync with template for defaults / auto-fit — display uses columnWidths.
        if (isDateShiftColumn(src || c) && width && c.width !== width) {
          col = col === c ? { ...c, width } : { ...col, width };
          changed = true;
        }
        return col;
      });
      return changed ? next : prev;
    });

    setColumnWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      const seen: Record<string, number> = {};
      initialColumns.forEach((c) => {
        if (!isDateShiftColumn(c) || !c.width) return;
        seen[c.key] = c.width;
        const prevTemplate = lastDateShiftTemplateWidthsRef.current[c.key];
        if (prevTemplate === undefined) {
          // First time we see this column: fill only if layout has no width yet.
          if (next[c.key] == null) {
            next[c.key] = c.width;
            changed = true;
          }
        } else if (prevTemplate !== c.width) {
          // Bulk Fields / date-shift template width changed — adopt the new template.
          next[c.key] = c.width;
          changed = true;
        }
        // else: keep the user's resized width
      });
      lastDateShiftTemplateWidthsRef.current = seen;
      return changed ? next : prev;
    });
  }, [initialColumns]);


  /** The layout as it is right now — what Save would store. */
  const currentSlice = useMemo<LayoutSlice>(
    () => ({
      columnOrder,
      columnVisibility,
      columnWidths,
      density,
      columnAggregations: diffAggregations(columns, schemaColumnsRef.current),
      conditionalFormats,
    }),
    [columnOrder, columnVisibility, columnWidths, density, columns, conditionalFormats],
  );
  const currentSig = useMemo(() => layoutSignature(currentSlice), [currentSlice]);
  const onLayoutPrefsChangeRef = useRef(onLayoutPrefsChange);
  onLayoutPrefsChangeRef.current = onLayoutPrefsChange;

  /** Unsaved personal changes (only for tables that can save a layout). */
  const layoutDirty = Boolean(onLayoutPrefsChange) && currentSig !== savedSig;
  const layoutChangeSummary = useMemo(
    () => (layoutDirty ? summarizeLayoutChanges(currentSlice, savedSliceRef.current) : []),
    // savedSig stands in for the saved slice (a ref) so the list refreshes after a save
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutDirty, currentSlice, savedSig],
  );

  // Browser draft — debounced, column resize can fire many updates per second. Survives a reload so
  // unsaved changes are not lost; `baseSig` ties it to the saved layout it was made from.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveTablePrefs({
        columns,
        columnWidths,
        columnOrder,
        columnVisibility,
        density,
        conditionalFormats,
        recentFormatColors,
        columnAggregations: currentSlice.columnAggregations,
        baseSig: layoutSignature(pickLayoutSlice(layoutPrefsRef.current)),
      }, tableId);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [columns, columnWidths, columnOrder, columnVisibility, density, conditionalFormats, recentFormatColors, currentSlice, savedSig, tableId]);

  /** Store the personal layout on the server. Returns true on success; on failure the draft is kept. */
  const saveLayoutChanges = useCallback(async (): Promise<boolean> => {
    const save = onLayoutPrefsChangeRef.current;
    if (!save) return false;
    setLayoutSaving(true);
    setLayoutSaveError(null);
    try {
      await save(pickLayoutSlice(currentSlice as TablePrefs));
      savedSliceRef.current = currentSlice;
      setSavedSig(currentSig);
      return true;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not save your table changes. They are kept in this browser — try again.';
      setLayoutSaveError(message);
      return false;
    } finally {
      setLayoutSaving(false);
    }
  }, [currentSlice, currentSig]);

  /** Throw away unsaved changes and go back to the last saved layout. */
  const discardLayoutChanges = useCallback(() => {
    const saved = savedSliceRef.current;
    setColumnOrder(saved.columnOrder || []);
    setColumnVisibility(saved.columnVisibility || {});
    setColumnWidths(saved.columnWidths || {});
    if (saved.density) setDensity(saved.density as Density);
    setConditionalFormats(saved.conditionalFormats || []);
    setColumns((prev) => {
      const schemaTotals = new Map(schemaColumnsRef.current.map((c) => [c.key, c.aggregation]));
      const reset = prev.map((c) => ({ ...c, aggregation: schemaTotals.get(c.key) }));
      return applyAggregations(reset, saved.columnAggregations);
    });
    setLayoutSaveError(null);
  }, []);

  // Let the sibling Dynamic* views render composites/formulas built here.
  useEffect(() => {
    if (!shareState) return;
    publishSharedColumns(columns);
  }, [columns, shareState]);

  // Keep parent chrome + sibling views on the same live row set.
  useEffect(() => {
    if (!shareState) return;
    publishSharedRows(rows);
  }, [rows, shareState]);

  // Pick up edits published by List/Card/… without fighting our own publishes.
  useEffect(() => {
    if (!shareState) return undefined;
    return subscribeSharedRows(() => {
      const next = getSharedRows();
      if (!next) return;
      setRows(prev => (prev === next ? prev : next));
    });
  }, [shareState]);

  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'columns' | 'construction' | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [dragColKey, setDragColKey] = useState<string | null>(null);

  // Keep timer refs for pending delete/edit so we can cancel on undo
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetPage = useCallback(() => setPage(1), []);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string, shiftKey = false) => {
    setSort(prev => {
      if (!shiftKey) {
        const existing = prev.find(s => s.key === key);
        if (!existing) return [{ key, direction: 'asc' }];
        if (existing.direction === 'asc') return [{ key, direction: 'desc' }];
        return [];
      }
      const existing = prev.find(s => s.key === key);
      if (!existing) return [...prev, { key, direction: 'asc' }];
      if (existing.direction === 'asc') return prev.map(s => s.key === key ? { ...s, direction: 'desc' as const } : s);
      return prev.filter(s => s.key !== key);
    });
    resetPage();
  }, [resetPage]);

  /** Set or clear sort for a column (header ⋯ menu). */
  const handleSetSortDirection = useCallback(
    (key: string, direction: 'asc' | 'desc' | null) => {
      setSort((prev) => {
        if (!direction) return prev.filter((s) => s.key !== key);
        const rest = prev.filter((s) => s.key !== key);
        return [{ key, direction }, ...rest];
      });
      resetPage();
    },
    [resetPage],
  );

  // ── Filter ─────────────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((colKey: string, filter: FilterValue | null) => {
    setFilters(prev => {
      const next = { ...prev };
      if (filter === null) delete next[colKey];
      else next[colKey] = filter;
      return next;
    });
    resetPage();
  }, [resetPage]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    resetPage();
  }, [resetPage]);

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setFilters({});
    setSort([]);
    setSearch('');
    resetPage();
  }, [resetPage]);

  // ── Row selection ──────────────────────────────────────────────────────────
  const handleToggleRowSelect = useCallback((rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((allRowIds: string[]) => {
    setSelectedRows(prev =>
      prev.size === allRowIds.length ? new Set() : new Set(allRowIds)
    );
  }, []);

  const handleClearSelection = useCallback(() => setSelectedRows(new Set()), []);

  // Coalesce rapid inline edits into one PATCH per row (optimistic UI still instant).
  const { queueSave, flushRow, flushAll, cancelRow } = useDebouncedRowSave(onRowUpdate);

  // ── Inline edit ────────────────────────────────────────────────────────────
  // Queue saves OUTSIDE the setState updater — React Strict Mode runs updaters
  // twice in dev, which was double-saving and clearing the lookup pick mid-flight.
  const handleCellSave = useCallback((rowId: string, colKey: string, newValue: unknown) => {
    let updated: DataRow | undefined;
    setRows(prev => {
      const next = prev.map(r =>
        r.rowId === rowId ? { ...r, values: { ...r.values, [colKey]: newValue } } : r
      );
      updated = next.find(r => r.rowId === rowId);
      return next;
    });
    setEditingCell(null);
    if (updated) queueSave(rowId, { [colKey]: newValue }, updated);
  }, [queueSave]);

  /** One local paint + one queued onRowUpdate for multi-cell patches (lookup group fill). */
  const handleCellsSave = useCallback((rowId: string, updates: Record<string, unknown>) => {
    if (!updates || Object.keys(updates).length === 0) return;
    let updated: DataRow | undefined;
    setRows(prev => {
      const next = prev.map(r =>
        r.rowId === rowId ? { ...r, values: { ...r.values, ...updates } } : r
      );
      updated = next.find(r => r.rowId === rowId);
      return next;
    });
    setEditingCell(null);
    if (updated) queueSave(rowId, updates, updated);
  }, [queueSave]);

  const handleRowDraftChange = useCallback((rowId: string, colKey: string, newValue: unknown) => {
    setRowDrafts(prev => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [colKey]: newValue }
    }));
  }, []);

  const commitRowDraft = useCallback((rowId: string) => {
    const draft = rowDraftsRef.current[rowId];
    if (draft) {
      let updated: DataRow | undefined;
      setRows(rPrev => {
        const originalRow = rPrev.find(r => r.rowId === rowId);
        if (originalRow) {
          setPendingEdit(pe => {
            const prevRows = pe?.originalRows || [];
            const newRows = [...prevRows.filter(r => r.rowId !== rowId), originalRow];

            if (editTimerRef.current) clearTimeout(editTimerRef.current);
            editTimerRef.current = setTimeout(() => setPendingEdit(null), 15000);

            return { id: String(Date.now()), originalRows: newRows, timerId: editTimerRef.current! };
          });
        }

        const nextRows = rPrev.map(r =>
          r.rowId === rowId ? { ...r, values: { ...r.values, ...draft } } : r
        );
        updated = nextRows.find(r => r.rowId === rowId);
        return nextRows;
      });
      // Explicit row commit — merge into queue then flush immediately.
      if (updated) {
        queueSave(rowId, draft, updated);
        flushRow(rowId);
      }
    }
    setRowDrafts(prev => {
      if (!(rowId in prev)) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setEditingRowIds(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, [queueSave, flushRow]);

  const cancelRowDraft = useCallback((rowId: string) => {
    setRowDrafts(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setEditingRowIds(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, []);

  const handleEditSelectedRows = useCallback(() => {
    setEditingRowIds(prev => {
      const next = new Set(prev);
      selectedRows.forEach(id => next.add(id));
      return next;
    });
    // Drop single-cell edit so lookup autoFocus cannot open on every row for that column.
    setEditingCell(null);
    setSelectedRows(new Set());
  }, [selectedRows]);

  // ── Delete (soft, with undo toast) ─────────────────────────────────────────
  const handleDeleteRow = useCallback((rowId: string) => {
    const index = rows.findIndex(r => r.rowId === rowId);
    if (index === -1) return;
    const row = rows[index];
    if (onDeleteRowRequest) {
      setContextMenu(null);
      onDeleteRowRequest(row);
      return;
    }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    cancelRow(rowId);
    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setSelectedRows(prev => { const s = new Set(prev); s.delete(rowId); return s; });
    setContextMenu(null);

    const timerId = setTimeout(() => {
      setPendingDelete(null);
      if (onRowDelete) void onRowDelete([rowId]);
    }, 15000);
    deleteTimerRef.current = timerId;
    setPendingDelete({ rowId, row, timerId, index });
  }, [rows, onRowDelete, onDeleteRowRequest, cancelRow]);

  const handleUndoDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.timerId) clearTimeout(pendingDelete.timerId);
    setRows(prev => {
      const newRows = [...prev];
      newRows.splice(pendingDelete.index, 0, pendingDelete.row);
      return newRows;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

  const handleUndoEdit = useCallback(() => {
    if (!pendingEdit) return;
    if (pendingEdit.timerId) clearTimeout(pendingEdit.timerId);
    
    setRows(prev => {
      const originalMap = new Map(pendingEdit.originalRows.map(r => [r.rowId, r]));
      return prev.map(r => originalMap.has(r.rowId) ? originalMap.get(r.rowId)! : r);
    });
    setPendingEdit(null);
  }, [pendingEdit]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedRows);
    ids.forEach((id) => cancelRow(id));
    setRows(prev => prev.filter(r => !selectedRows.has(r.rowId)));
    setSelectedRows(new Set());
    setShowBulkConfirm(false);
    if (ids.length && onRowDelete) void onRowDelete(ids);
  }, [selectedRows, onRowDelete, cancelRow]);

  const handleBulkUpdate = useCallback((
    updates: Record<string, unknown>,
    lookupPicks: BulkLookupPickMeta[] = [],
    targetRows?: DataRow[],
    assigneePicks: BulkAssigneePickMeta[] = [],
  ) => {
    if (Object.keys(updates).length === 0) return;

    // Flush any pending cell saves first so bulk does not race them.
    flushAll();

    const targets =
      targetRows ??
      (selectedRows.size > 0 ? rows.filter((r) => selectedRows.has(r.rowId)) : []);
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((r) => r.rowId));

    // Mass Edit lookup picks must register source-row ids for every target — otherwise
    // restoreLookupIds keeps the old (often empty) value and cells clear after save.
    lookupPicks.forEach((pick) => {
      if (pick.table && pick.id) seedLookupRow(pick.table, pick.id, pick.seedValues || {});
      targets.forEach((r) => {
        setLookupPick(r.rowId, pick.columnKey, pick.id);
        const displayPatch: Record<string, string> = {};
        Object.entries(updates).forEach(([k, v]) => {
          if (v == null) return;
          displayPatch[k] = String(v);
        });
        if (Object.keys(displayPatch).length) setLookupDisplayOverrides(r.rowId, displayPatch);
      });
    });

    // Seed assignee names so chips don't flash “…” after Mass Edit.
    const displayUpdates: Record<string, unknown> = { ...updates };
    assigneePicks.forEach((pick) => {
      seedAssigneeLabels(
        Object.entries(pick.labels || {}).map(([id, name]) => ({ id, name: String(name) })),
      );
      const labelList = pick.ids.map((id) => pick.labels[id] || id);
      displayUpdates[pick.columnKey] =
        labelList.length > 1 || Array.isArray(updates[pick.columnKey])
          ? labelList
          : labelList[0] || '';
    });

    const payload = targets.map((r) => ({
      rowId: r.rowId,
      values: updates,
      row: { ...r, values: { ...r.values, ...updates } },
    }));
    if (onBulkUpdate) {
      void onBulkUpdate(payload);
    } else if (onRowUpdate) {
      payload.forEach((t) => void onRowUpdate(t.rowId, t.values, t.row));
    }

    setRows((prev) => {
      const originalRows = prev.filter((r) => targetIds.has(r.rowId));

      setPendingEdit((pe) => {
        const prevRows = pe?.originalRows || [];
        const prevRowIds = new Set(prevRows.map((r) => r.rowId));
        const newOriginals = originalRows.filter((r) => !prevRowIds.has(r.rowId));
        const newRows = [...prevRows, ...newOriginals];

        if (editTimerRef.current) clearTimeout(editTimerRef.current);
        editTimerRef.current = setTimeout(() => setPendingEdit(null), 15000);

        return { id: String(Date.now()), originalRows: newRows, timerId: editTimerRef.current! };
      });

      return prev.map((r) =>
        targetIds.has(r.rowId) ? { ...r, values: { ...r.values, ...displayUpdates } } : r,
      );
    });

    setSelectedRows(new Set());
    setShowBulkUpdate(false);
  }, [selectedRows, rows, onRowUpdate, onBulkUpdate, flushAll]);

  const handleAddRow = useCallback(() => {
    const newRow: DataRow = { rowId: genRowId(), version: 1, values: {} };
    setRows(prev => [newRow, ...prev]);
    setPage(1);
  }, []);

  // ── Column management ──────────────────────────────────────────────────────
  const handleColumnWidthChange = useCallback((key: string, width: number) => {
    const minW = key === '__checkbox' ? 32 : key === '__actions' ? 40 : 50;
    setColumnWidths(prev => ({ ...prev, [key]: Math.max(minW, width) }));
  }, []);

  /** Batch width update (multi-column resize) — one React commit. */
  const handleColumnWidthsChange = useCallback((updates: Record<string, number>) => {
    setColumnWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(updates).forEach(([key, width]) => {
        const minW = key === '__checkbox' ? 32 : key === '__actions' ? 40 : 50;
        const w = Math.max(minW, width);
        if (next[key] !== w) {
          next[key] = w;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const handleColumnReorder = useCallback((fromKey: string, toKey: string) => {
    setColumnOrder((prev) => {
      const arr = [...prev];
      const fi = arr.indexOf(fromKey);
      const ti = arr.indexOf(toKey);
      if (fi === -1 || ti === -1) return prev;
      arr.splice(fi, 1);
      arr.splice(ti, 0, fromKey);
      // Created / Modify by & at stay at the far right after any drag.
      return pinAuditColumnsLast(arr);
    });
  }, []);

  const handleToggleColumnVisibility = useCallback((key: string) => {
    const isVisibleNow = columnVisibility[key] !== false;
    const type = isVisibleNow ? 'hide' : 'show';
    
    setTransitioningCols(curr => ({ ...curr, [key]: type }));
    
    if (!isVisibleNow) {
      setHighlightedColKey(key);
    }
    
    setTimeout(() => {
      setTransitioningCols(curr => {
        const next = { ...curr };
        delete next[key];
        return next;
      });
    }, type === 'show' ? 1500 : 400);

    setColumnVisibility(prev => ({ ...prev, [key]: !isVisibleNow }));
  }, [columnVisibility]);

  /** Bulk show/hide (e.g. Center list shift chips). */
  const handlePatchColumnVisibility = useCallback((patch: Record<string, boolean>) => {
    if (!patch || typeof patch !== 'object') return;
    setColumnVisibility((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(patch).forEach(([key, visible]) => {
        if (!key) return;
        const want = Boolean(visible);
        const wasVisible = next[key] !== false;
        if (wasVisible === want) return;
        next[key] = want;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, []);

  const handlePinColumn = useCallback((key: string, pin: 'left' | 'right' | null) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, pinned: pin } : c));
  }, []);

  // ── Resets ─────────────────────────────────────────────────────────────────
  const handleResetPins = useCallback(() => {
    setColumns(prev => prev.map(c => {
      const initCol = initialColumns.find(ic => ic.key === c.key);
      return { ...c, pinned: initCol ? initCol.pinned : null };
    }));
  }, [initialColumns]);

  const handleResetVisibility = useCallback(() => {
    const v: Record<string, boolean> = {};
    initialColumns.forEach(c => { v[c.key] = c.visible !== false; });
    setColumnVisibility(v);
  }, [initialColumns]);

  const handleResetOrder = useCallback(() => {
    setColumnOrder(
      pinAuditColumnsLast(
        [...initialColumns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.key),
      ),
    );
  }, [initialColumns]);

  const handleResetWidths = useCallback(() => {
    const w: Record<string, number> = {};
    initialColumns.forEach((c) => {
      if (c.width) w[c.key] = c.width;
    });
    setColumnWidths(w);
    setColumns((prev) =>
      prev.map((c) => {
        const src = initialColumns.find((ic) => ic.key === c.key);
        const width = src?.width ?? c.width;
        return width && c.width !== width ? { ...c, width } : c;
      }),
    );
  }, [initialColumns]);

  const handleFactoryReset = useCallback(() => {
    const clean = sanitizeColumns(initialColumns);
    const w: Record<string, number> = {};
    clean.forEach((c) => {
      if (c.width) w[c.key] = c.width;
    });
    setColumns(clean);
    setSort([]);
    setFilters({});
    setSearch('');
    setColumnWidths(w);
    setColumnVisibility(
      clean.reduce<Record<string, boolean>>((acc, c) => {
        acc[c.key] = c.visible !== false;
        return acc;
      }, {}),
    );
    setColumnOrder(pinAuditColumnsLast(clean.map((c) => c.key)));
    localStorage.removeItem(TABLE_PREFS_KEY);
    setActiveViewId(null);
  }, [initialColumns]);

  const {
    handleAddCompositeColumn,
    handleAddCompositeColumnAndContinue,
    handleDeleteCompositeColumn,
    handleUpdateCompositeColumn,
  } = createCompositeColumnHandlers(setColumns, setColumnOrder, setColumnWidths, setColumnVisibility);

  const {
    handleSaveView,
    handleLoadView,
    handleDeleteView,
  } = createSavedViewHandlers(
    savedViews,
    activeViewId,
    columnOrder,
    columnVisibility,
    columnWidths,
    filters,
    sort,
    setSavedViews,
    setActiveViewId,
    setColumnOrder,
    setColumnVisibility,
    setColumnWidths,
    setFilters,
    setSort,
    tableId,
  );

  const {
    handleAddConditionalFormat,
    handleUpdateConditionalFormat,
    handleDeleteConditionalFormat,
    handleToggleConditionalFormat,
    handlePushRecentFormatColor,
  } = createConditionalFormatHandlers(setConditionalFormats, setRecentFormatColors);

  const handleAddFormulaColumn = useCallback((col: ColumnConfig) => {
    setColumns(prev => [...prev, col]);
    setColumnOrder(prev => {
      const idx = prev.findIndex(k => k === col.key);
      if (idx === -1) {
        return [...prev, col.key];
      }
      return prev;
    });
    setColumnWidths(prev => ({ ...prev, [col.key]: col.width ?? 180 }));
    setColumnVisibility(prev => ({ ...prev, [col.key]: true }));
  }, []);

  const handleUpdateFormulaColumn = useCallback((oldKey: string, newCol: ColumnConfig) => {
    setColumns(prev => prev.map(c => c.key === oldKey ? newCol : c));
  }, []);

  const handleUpdateColumnAggregation = useCallback((colKey: string, agg: AggregationType | undefined) => {
    setColumns(prev => prev.map(c => c.key === colKey ? { ...c, aggregation: agg } : c));
  }, []);

  const handleUpdateColumnProp = useCallback((colKey: string, prop: string, value: unknown) => {
    setColumns(prev => prev.map(c => c.key === colKey ? { ...c, [prop]: value } : c));
  }, []);

  const handleToggleExpandRow = useCallback((rowId: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  return {
    rows, setRows, columns, setColumns,
    sort, filters, search,
    handleSort, handleSetSortDirection, handleFilterChange, handleSearch, handleClearAll,
    page, pageSize, setPage, setPageSize,
    selectedRows, handleToggleRowSelect, handleSelectAll, handleClearSelection,
    expandedRowIds, handleToggleExpandRow,
    editingCell, setEditingCell,
    editingRowIds, setEditingRowIds,
    rowDrafts, setRowDrafts,
    focusedCell, setFocusedCell,
    handleRowDraftChange, commitRowDraft, cancelRowDraft,
    handleEditSelectedRows, handleCellSave, handleCellsSave,
    handleDeleteRow, handleUndoDelete, handleDeleteSelected, handleAddRow,
    contextMenu, setContextMenu,
    pendingDelete, setPendingDelete,
    pendingEdit, setPendingEdit, handleUndoEdit,
    columnWidths, columnOrder, columnVisibility, highlightedColKey, transitioningCols,
    handleColumnWidthChange, handleColumnWidthsChange, handleColumnReorder,
    handleToggleColumnVisibility, handlePatchColumnVisibility, handlePinColumn, handleAddCompositeColumn, handleAddCompositeColumnAndContinue,
    handleDeleteCompositeColumn, handleUpdateCompositeColumn,
    handleResetPins, handleResetVisibility, handleResetOrder, handleResetWidths, handleFactoryReset,
    openFilterKey, setOpenFilterKey,
    density, setDensity,
    activeSidebar, setActiveSidebar,
    showBulkConfirm, setShowBulkConfirm,
    showBulkUpdate, setShowBulkUpdate, handleBulkUpdate,
    dragColKey, setDragColKey,
    savedViews, activeViewId, handleSaveView, handleLoadView, handleDeleteView,
    handleUpdateColumnAggregation,
    handleUpdateColumnProp,
    layoutDirty, layoutSaving, layoutSaveError, layoutChangeSummary, saveLayoutChanges, discardLayoutChanges,
    handleAddFormulaColumn,
    handleUpdateFormulaColumn,
    conditionalFormats,
    recentFormatColors,
    handleAddConditionalFormat,
    handleUpdateConditionalFormat,
    handleDeleteConditionalFormat,
    handleToggleConditionalFormat,
    handlePushRecentFormatColor,
  };

}
