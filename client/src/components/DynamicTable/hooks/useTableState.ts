import { useCallback, useRef, useState, useEffect } from 'react';
import type { AggregationType, ColumnConfig, ConditionalFormatRule, DataRow, RowData, FilterValue, PendingDelete, SortConfig, PendingEdit, SavedView, Density } from '../types';
import { genRowId } from '../utils';
import {
  readPref,
  saveTablePrefs,
  TABLE_PREFS_KEY,
  loadTablePrefs,
  mergeColumnOrder,
  mergeColumnVisibility,
  pickLayoutSlice,
  type TablePrefs,
} from '../utils/prefsStorage';
import { publishSharedColumns } from '../../DynamicData/schemaStore';
import { getSharedRows, publishSharedRows, subscribeSharedRows } from '../../DynamicData/rowsStore';
import { normalizeConditionalFormatRule } from '../utils/conditionalFormat';
import { createCompositeColumnHandlers } from './tableState/compositeColumnHandlers';
import { createConditionalFormatHandlers } from './tableState/conditionalFormatHandlers';
import { createSavedViewHandlers, loadSavedViews } from './tableState/savedViewHandlers';
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

const resolveLayoutSeed = (
  cols: ColumnConfig[],
  serverLayout?: TablePrefs | null,
  tableId?: string,
): {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  density: Density;
} => {
  const keys = cols.map((c) => c.key);
  const schemaVisibility = cols.reduce<Record<string, boolean>>((acc, c) => {
    acc[c.key] = c.visible !== false;
    return acc;
  }, {});
  const local = loadTablePrefs(tableId);
  const layout = pickLayoutSlice(serverLayout);
  const fromLocal = pickLayoutSlice(local);
  // Server (user/org) wins over localStorage cache
  const preferred = {
    columnOrder: layout.columnOrder ?? fromLocal.columnOrder,
    columnVisibility: layout.columnVisibility ?? fromLocal.columnVisibility,
    columnWidths: layout.columnWidths ?? fromLocal.columnWidths,
    density: layout.density ?? fromLocal.density,
  };

  return {
    columnOrder: mergeColumnOrder(keys, preferred.columnOrder),
    columnVisibility: mergeColumnVisibility(keys, schemaVisibility, preferred.columnVisibility),
    columnWidths: { ...(preferred.columnWidths || {}) },
    density: (preferred.density as Density) || 'standard',
  };
};

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
  /** Debounced personal layout save. */
  onLayoutPrefsChange?: (prefs: TablePrefs) => void;
  onRowUpdate?: (rowId: string, updatedValues: Record<string, unknown>, row: DataRow) => Promise<void> | void;
  onRowDelete?: (rowIds: string[]) => Promise<void> | void;
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
    onLayoutPrefsChange,
    onRowUpdate,
    onRowDelete,
    onBulkUpdate,
  } = options;

  const [rows, setRows] = useState<DataRow[]>(() =>
    sanitizeRows((shareState ? getSharedRows() : null) ?? initialRows),
  );
  const [columns, setColumns] = useState<ColumnConfig[]>(() => sanitizeColumns(initialColumns));

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
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const initialSeed = resolveLayoutSeed(sanitizeColumns(initialColumns), layoutPrefs, tableId);

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

  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>(() =>
    readPref('conditionalFormats', [], tableId).map(normalizeConditionalFormatRule),
  );
  const [recentFormatColors, setRecentFormatColors] = useState<string[]>(() =>
    readPref('recentFormatColors', [], tableId),
  );

  // Sync when parent switches presets (prop identity change) — not on first mount,
  // so we don't clobber rows another view already published this session.
  const skipInitialPropSync = useRef(true);
  const layoutPrefsRef = useRef(layoutPrefs);
  layoutPrefsRef.current = layoutPrefs;

  useEffect(() => {
    const cleanCols = sanitizeColumns(initialColumns);
    const seed = resolveLayoutSeed(cleanCols, layoutPrefsRef.current, tableId);
    setColumns(cleanCols);
    setColumnOrder(seed.columnOrder);
    setColumnVisibility(seed.columnVisibility);
    setColumnWidths((prev) => ({ ...seed.columnWidths, ...prev }));
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
  }, [initialColumns, initialRows, tableId]);

  useEffect(() => {
    saveTablePrefs({
      columns,
      columnWidths,
      columnOrder,
      columnVisibility,
      density,
      conditionalFormats,
      recentFormatColors,
    }, tableId);
  }, [columns, columnWidths, columnOrder, columnVisibility, density, conditionalFormats, recentFormatColors, tableId]);

  // Debounced persist of personal layout (skip first paint)
  const skipInitialLayoutSave = useRef(true);
  const onLayoutPrefsChangeRef = useRef(onLayoutPrefsChange);
  onLayoutPrefsChangeRef.current = onLayoutPrefsChange;
  useEffect(() => {
    if (!onLayoutPrefsChangeRef.current) return;
    if (skipInitialLayoutSave.current) {
      skipInitialLayoutSave.current = false;
      return;
    }
    const slice = pickLayoutSlice({
      columnOrder,
      columnVisibility,
      columnWidths,
      density,
    });
    const timer = window.setTimeout(() => {
      onLayoutPrefsChangeRef.current?.(slice);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [columnOrder, columnVisibility, columnWidths, density]);

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

  // ── Inline edit ────────────────────────────────────────────────────────────
  const handleCellSave = useCallback((rowId: string, colKey: string, newValue: unknown) => {
    setRows(prev => {
      const next = prev.map(r =>
        r.rowId === rowId ? { ...r, values: { ...r.values, [colKey]: newValue } } : r
      );
      const updated = next.find(r => r.rowId === rowId);
      if (updated && onRowUpdate) {
        void onRowUpdate(rowId, { [colKey]: newValue }, updated);
      }
      return next;
    });
    setEditingCell(null);
  }, [onRowUpdate]);

  const handleRowDraftChange = useCallback((rowId: string, colKey: string, newValue: unknown) => {
    setRowDrafts(prev => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [colKey]: newValue }
    }));
  }, []);

  const commitRowDraft = useCallback((rowId: string) => {
    setRowDrafts(prev => {
      const draft = prev[rowId];
      if (draft) {
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
          const updated = nextRows.find(r => r.rowId === rowId);
          if (updated && onRowUpdate) {
            void onRowUpdate(rowId, draft, updated);
          }
          return nextRows;
        });
      }
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setEditingRowIds(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, [onRowUpdate]);

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
    setSelectedRows(new Set());
  }, [selectedRows]);

  // ── Delete (soft, with undo toast) ─────────────────────────────────────────
  const handleDeleteRow = useCallback((rowId: string) => {
    const index = rows.findIndex(r => r.rowId === rowId);
    if (index === -1) return;
    const row = rows[index];
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    setRows(prev => prev.filter(r => r.rowId !== rowId));
    setSelectedRows(prev => { const s = new Set(prev); s.delete(rowId); return s; });
    setContextMenu(null);

    const timerId = setTimeout(() => {
      setPendingDelete(null);
      if (onRowDelete) void onRowDelete([rowId]);
    }, 15000);
    deleteTimerRef.current = timerId;
    setPendingDelete({ rowId, row, timerId, index });
  }, [rows, onRowDelete]);

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
    setRows(prev => prev.filter(r => !selectedRows.has(r.rowId)));
    setSelectedRows(new Set());
    setShowBulkConfirm(false);
    if (ids.length && onRowDelete) void onRowDelete(ids);
  }, [selectedRows, onRowDelete]);

  const handleBulkUpdate = useCallback((updates: Record<string, unknown>) => {
    if (selectedRows.size === 0 || Object.keys(updates).length === 0) return;

    // Persist the selected rows: one bulk call if the page provides it, otherwise per row.
    const targets = rows
      .filter(r => selectedRows.has(r.rowId))
      .map(r => ({ rowId: r.rowId, values: updates, row: { ...r, values: { ...r.values, ...updates } } }));
    if (onBulkUpdate) {
      void onBulkUpdate(targets);
    } else if (onRowUpdate) {
      targets.forEach(t => void onRowUpdate(t.rowId, t.values, t.row));
    }

    setRows(prev => {
      const originalRows = prev.filter(r => selectedRows.has(r.rowId));
      
      setPendingEdit(pe => {
        const prevRows = pe?.originalRows || [];
        const prevRowIds = new Set(prevRows.map(r => r.rowId));
        // Add only the rows that aren't already in the current pending edit batch
        const newOriginals = originalRows.filter(r => !prevRowIds.has(r.rowId));
        const newRows = [...prevRows, ...newOriginals];
        
        if (editTimerRef.current) clearTimeout(editTimerRef.current);
        editTimerRef.current = setTimeout(() => setPendingEdit(null), 15000);
        
        return { id: String(Date.now()), originalRows: newRows, timerId: editTimerRef.current! };
      });

      return prev.map(r => 
        selectedRows.has(r.rowId) ? { ...r, values: { ...r.values, ...updates } } : r
      );
    });
    
    setSelectedRows(new Set());
    setShowBulkUpdate(false);
  }, [selectedRows, rows, onRowUpdate, onBulkUpdate]);

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

  const handleColumnReorder = useCallback((fromKey: string, toKey: string) => {
    setColumnOrder(prev => {
      const arr = [...prev];
      const fi = arr.indexOf(fromKey);
      const ti = arr.indexOf(toKey);
      if (fi === -1 || ti === -1) return prev;
      arr.splice(fi, 1);
      arr.splice(ti, 0, fromKey);
      return arr;
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
    setColumnOrder([...initialColumns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(c => c.key));
  }, [initialColumns]);

  const handleResetWidths = useCallback(() => {
    const w: Record<string, number> = {};
    initialColumns.forEach(c => { if (c.width) w[c.key] = c.width; });
    setColumnWidths(w);
  }, [initialColumns]);

  const handleFactoryReset = useCallback(() => {
    setColumns(initialColumns);
    setSort([]);
    setFilters({});
    setSearch('');
    setColumnWidths({});
    setColumnVisibility({});
    setColumnOrder(initialColumns.map(c => c.key));
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
    handleSort, handleFilterChange, handleSearch, handleClearAll,
    page, pageSize, setPage, setPageSize,
    selectedRows, handleToggleRowSelect, handleSelectAll, handleClearSelection,
    expandedRowIds, handleToggleExpandRow,
    editingCell, setEditingCell,
    editingRowIds, setEditingRowIds,
    rowDrafts, setRowDrafts,
    focusedCell, setFocusedCell,
    handleRowDraftChange, commitRowDraft, cancelRowDraft,
    handleEditSelectedRows, handleCellSave,
    handleDeleteRow, handleUndoDelete, handleDeleteSelected, handleAddRow,
    contextMenu, setContextMenu,
    pendingDelete, setPendingDelete,
    pendingEdit, setPendingEdit, handleUndoEdit,
    columnWidths, columnOrder, columnVisibility, highlightedColKey, transitioningCols,
    handleColumnWidthChange, handleColumnReorder,
    handleToggleColumnVisibility, handlePinColumn, handleAddCompositeColumn, handleAddCompositeColumnAndContinue,
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
