import { useCallback, useRef, useState, useEffect } from 'react';
import type { AggregationType, ColumnConfig, ConditionalFormatRule, DataRow, FilterValue, PendingDelete, SortConfig, PendingEdit, SavedView, Density } from '../types';
import { isFieldColumn } from '../types';
import { genRowId } from '../utils';
import { readPref, saveTablePrefs, TABLE_PREFS_KEY } from '../utils/prefsStorage';
import { normalizeConditionalFormatRule } from '../utils/conditionalFormat';
import { loadInitialColumns, syncColumnsWithInitial } from './tableState/columnMerge';
import { createCompositeColumnHandlers } from './tableState/compositeColumnHandlers';
import { createConditionalFormatHandlers } from './tableState/conditionalFormatHandlers';
import { createSavedViewHandlers, loadSavedViews } from './tableState/savedViewHandlers';
export type { TableStateHandlers } from './tableState/types';
import type { TableStateHandlers } from './tableState/types';

export function normalizeDataRows(rawRows: unknown[]): DataRow[] {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.map((r, i) => {
    if (!r || typeof r !== 'object') {
      return { rowId: `row_${i}`, version: 1, values: {} };
    }
    const obj = r as Record<string, unknown>;
    if ('values' in obj && obj.values && typeof obj.values === 'object') {
      return {
        rowId: String(obj.rowId || (obj as any).id || `row_${i}`),
        version: typeof obj.version === 'number' ? obj.version : 1,
        values: { ...(obj.values as Record<string, unknown>) },
      };
    }
    const rowId = String(obj.rowId || obj.id || `row_${i}`);
    return {
      rowId,
      version: typeof obj.version === 'number' ? obj.version : 1,
      values: { ...obj },
    };
  });
}

export function useTableState(
  initialColumns: ColumnConfig[],
  initialRows: DataRow[],
  tableId?: string,
  callbacks?: {
    onRowUpdate?: (rowId: string, updatedValues: Record<string, unknown>, row: DataRow) => Promise<void> | void;
    onRowDelete?: (rowIds: string[]) => Promise<void> | void;
    onRefresh?: () => Promise<void> | void;
  },
): TableStateHandlers {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const initialRowsRef = useRef(initialRows);
  const [rows, setRows] = useState<DataRow[]>(() => normalizeDataRows(initialRows));

  useEffect(() => {
    initialRowsRef.current = initialRows;
    if (initialRows) {
      setRows(normalizeDataRows(initialRows));
    }
  }, [initialRows]);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => loadInitialColumns(initialColumns, tableId));

  const [sort, setSort] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set());
  const [rowDrafts, setRowDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    readPref('columnWidths', {}, tableId),
  );

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(tableId));
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultOrder = [...initialColumns].sort((a, b) => a.order - b.order).map(c => c.key);
    const saved: string[] = readPref('columnOrder', defaultOrder, tableId);
    const initKeys = new Set(initialColumns.map(c => c.key));
    const validSaved = saved.filter(k => initKeys.has(k));
    if (validSaved.length === 0) return defaultOrder;
    const missing = defaultOrder.filter(k => !validSaved.includes(k));
    return [...validSaved, ...missing];
  });

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    initialColumns.forEach(c => { defaults[c.key] = c.visible; });
    const saved = readPref('columnVisibility', defaults, tableId);
    const initKeys = new Set(initialColumns.map(c => c.key));
    const filteredSaved: Record<string, boolean> = {};
    Object.keys(saved).forEach(k => {
      if (initKeys.has(k)) filteredSaved[k] = saved[k];
    });
    const hasKeys = Object.keys(filteredSaved).some(k => initKeys.has(k));
    return hasKeys ? { ...defaults, ...filteredSaved } : defaults;
  });

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

  const [density, setDensity] = useState<Density>(() =>
    readPref('density', 'standard', tableId),
  );

  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>(() =>
    readPref('conditionalFormats', [], tableId).map(normalizeConditionalFormatRule),
  );
  const [recentFormatColors, setRecentFormatColors] = useState<string[]>(() =>
    readPref('recentFormatColors', [], tableId),
  );

  useEffect(() => {
    const nextLoaded = loadInitialColumns(initialColumns, tableId);
    setColumns(nextLoaded);
    const defaultOrder = [...nextLoaded].sort((a, b) => a.order - b.order).map(c => c.key);
    setColumnOrder(defaultOrder);
    const defaults: Record<string, boolean> = {};
    nextLoaded.forEach(c => { defaults[c.key] = c.visible; });
    setColumnVisibility(defaults);
  }, [initialColumns, tableId]);

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

  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'columns' | null>(null);
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
      const nextRows = prev.map(r => r.rowId === rowId ? { ...r, values: { ...r.values, [colKey]: newValue } } : r);
      const target = nextRows.find(r => r.rowId === rowId);
      if (callbacksRef.current?.onRowUpdate && target) {
        callbacksRef.current.onRowUpdate(rowId, { [colKey]: newValue }, target);
      }
      return nextRows;
    });
    setEditingCell(null);
  }, []);

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
          const target = nextRows.find(r => r.rowId === rowId);
          if (callbacksRef.current?.onRowUpdate && target) {
            callbacksRef.current.onRowUpdate(rowId, draft, target);
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
  }, []);

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

    if (callbacksRef.current?.onRowDelete) {
      callbacksRef.current.onRowDelete([rowId]);
    }

    const timerId = setTimeout(() => {
      setPendingDelete(null);
    }, 15000);
    deleteTimerRef.current = timerId;
    setPendingDelete({ rowId, row, timerId, index });
  }, [rows]);

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
    const idsToDelete = Array.from(selectedRows);
    setRows(prev => prev.filter(r => !selectedRows.has(r.rowId)));
    setSelectedRows(new Set());
    setShowBulkConfirm(false);

    if (callbacksRef.current?.onRowDelete && idsToDelete.length > 0) {
      callbacksRef.current.onRowDelete(idsToDelete);
    }
  }, [selectedRows]);

  const handleBulkUpdate = useCallback((updates: Record<string, unknown>) => {
    if (selectedRows.size === 0 || Object.keys(updates).length === 0) return;
    const ids = Array.from(selectedRows);
    
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

      const nextRows = prev.map(r => 
        selectedRows.has(r.rowId) ? { ...r, values: { ...r.values, ...updates } } : r
      );

      if (callbacksRef.current?.onRowUpdate) {
        ids.forEach(id => {
          const target = nextRows.find(r => r.rowId === id);
          if (target) callbacksRef.current?.onRowUpdate?.(id, updates, target);
        });
      }

      return nextRows;
    });
    
    setSelectedRows(new Set());
    setShowBulkUpdate(false);
  }, [selectedRows]);

  const handleAddRow = useCallback(() => {
    const pkCol = initialColumns.find(c => isFieldColumn(c) && (c.isPrimaryKey || c.key === 'vendor_code'));
    const initialVals: Record<string, unknown> = {};
    let newId = genRowId();
    if (pkCol) {
      const prefix = pkCol.key.includes('vendor') ? 'VND' : 'ID';
      const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      initialVals[pkCol.key] = code;
      newId = code;
    }
    const newRow: DataRow = { rowId: newId, version: 1, values: initialVals };
    setRows(prev => [newRow, ...prev]);
    setPage(1);
  }, [initialColumns]);

  // ── Column management ──────────────────────────────────────────────────────
  const handleColumnWidthChange = useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: Math.max(60, width) }));
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
    setColumnOrder([...initialColumns].sort((a, b) => a.order - b.order).map(c => c.key));
  }, [initialColumns]);

  const handleResetWidths = useCallback(() => {
    const w: Record<string, number> = {};
    initialColumns.forEach(c => { w[c.key] = c.width; });
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

  const handleRefresh = useCallback(async () => {
    if (callbacksRef.current?.onRefresh) {
      try {
        await callbacksRef.current.onRefresh();
      } catch (err) {
        console.error('Error refreshing table data:', err);
      }
    }
    setRows(normalizeDataRows(initialRowsRef.current));
    setEditingRowIds(new Set());
    setRowDrafts({});
    setEditingCell(null);
  }, []);

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
    setColumnWidths(prev => ({ ...prev, [col.key]: col.width }));
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

  return {
    rows, setRows, columns, setColumns,
    sort, filters, search,
    handleSort, handleFilterChange, handleSearch, handleClearAll,
    page, pageSize, setPage, setPageSize,
    selectedRows, handleToggleRowSelect, handleSelectAll, handleClearSelection,
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
    handleResetPins, handleResetVisibility, handleResetOrder, handleResetWidths, handleFactoryReset, handleRefresh,
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
