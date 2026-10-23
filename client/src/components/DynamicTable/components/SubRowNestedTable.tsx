import { useState, useEffect } from 'react';
import type { ColumnConfig, DataRow, AggregationType } from '../types';
import { isFieldColumn } from '../types';
import { CellRenderer } from '../renderers';
import { CellEditor } from '../editors';
import { AggregationFooterCell } from './AggregationFooterCell';
import { Icon } from '@iconify/react';
import { Edit2, Trash2, Check, X, Plus } from 'lucide-react';

interface SubRowNestedTableProps {
  parentRowId: string;
  columns: ColumnConfig[];
  rows: DataRow[];
  isDarkMode: boolean;
  allColumns: ColumnConfig[];
  rowHeight?: number;
}

/**
 * Full-width nested sub-table rendered inside an expanded parent row.
 * Features pinned selection column, pinned actions column, multi-row editing, and interactive summary footer with aggregation dropdowns.
 */
export function SubRowNestedTable({
  parentRowId,
  columns,
  rows,
  isDarkMode,
  allColumns,
}: SubRowNestedTableProps) {
  const [subRowsData, setSubRowsData] = useState<DataRow[]>(rows);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set());
  const [rowDrafts, setRowDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedSubRows, setSelectedSubRows] = useState<Set<string>>(new Set());
  const [openAggDropdown, setOpenAggDropdown] = useState<string | null>(null);

  const [columnAggregations, setColumnAggregations] = useState<Record<string, AggregationType | undefined>>(() => {
    const initial: Record<string, AggregationType | undefined> = {};
    columns.forEach((c) => {
      const key = c.key.toLowerCase();
      if (isFieldColumn(c) && c.aggregation) {
        initial[c.key] = c.aggregation;
      } else if (key.includes('budget') || key.includes('spent') || key.includes('price') || key.includes('cost')) {
        initial[c.key] = 'sum';
      } else if (key.includes('completion') || key.includes('progress') || key.includes('rate')) {
        initial[c.key] = 'avg';
      } else if (key.includes('hours') || key.includes('number')) {
        initial[c.key] = 'sum';
      } else if (key.includes('task_id') || key.includes('id')) {
        initial[c.key] = 'count';
      }
    });
    return initial;
  });

  useEffect(() => {
    setSubRowsData(rows);
  }, [rows]);

  // Compute column aggregation value
  const computeSubColumnAgg = (colKey: string, aggType?: AggregationType): number | undefined => {
    if (!aggType) return undefined;
    const rawValues = subRowsData.map((r) => r.values[colKey]);
    const numValues = rawValues
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter((v) => !isNaN(v));

    if (aggType === 'count') {
      return rawValues.filter((v) => v !== undefined && v !== null && v !== '').length;
    }

    if (numValues.length === 0) return undefined;

    switch (aggType) {
      case 'sum':
        return numValues.reduce((a, b) => a + b, 0);
      case 'avg':
        return numValues.reduce((a, b) => a + b, 0) / numValues.length;
      case 'min':
        return Math.min(...numValues);
      case 'max':
        return Math.max(...numValues);
      case 'median': {
        const sorted = [...numValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      default:
        return undefined;
    }
  };

  // Toggle single row selection
  const handleToggleSelectSubRow = (subRowId: string) => {
    setSelectedSubRows((prev) => {
      const next = new Set(prev);
      if (next.has(subRowId)) next.delete(subRowId);
      else next.add(subRowId);
      return next;
    });
  };

  // Toggle select all sub-rows
  const handleToggleSelectAllSubRows = () => {
    if (selectedSubRows.size === subRowsData.length) {
      setSelectedSubRows(new Set());
    } else {
      setSelectedSubRows(new Set(subRowsData.map((r) => r.rowId)));
    }
  };

  // Single cell save
  const handleCellSave = (subRowId: string, colKey: string, newValue: unknown) => {
    setSubRowsData((prev) =>
      prev.map((r) =>
        r.rowId === subRowId
          ? { ...r, values: { ...r.values, [colKey]: newValue } }
          : r
      )
    );
    setEditingCell(null);
  };

  // Draft change during Row Edit mode
  const handleDraftChange = (subRowId: string, colKey: string, newValue: unknown) => {
    setRowDrafts((prev) => ({
      ...prev,
      [subRowId]: { ...(prev[subRowId] || {}), [colKey]: newValue },
    }));
  };

  // Start row edit for one row
  const startRowEdit = (subRowId: string) => {
    const rowObj = subRowsData.find((r) => r.rowId === subRowId);
    if (!rowObj) return;
    setEditingRowIds((prev) => new Set(prev).add(subRowId));
    setRowDrafts((prev) => ({ ...prev, [subRowId]: { ...rowObj.values } }));
  };

  // Cancel row edit for one row
  const cancelRowEdit = (subRowId: string) => {
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(subRowId);
      return next;
    });
    setRowDrafts((prev) => {
      const next = { ...prev };
      delete next[subRowId];
      return next;
    });
  };

  // Commit row edit for one row
  const commitRowEdit = (subRowId: string) => {
    const draft = rowDrafts[subRowId];
    if (draft) {
      setSubRowsData((prev) =>
        prev.map((r) =>
          r.rowId === subRowId
            ? { ...r, values: { ...r.values, ...draft } }
            : r
        )
      );
    }
    cancelRowEdit(subRowId);
  };

  // Edit ONLY Selected Rows
  const editSelectedRows = () => {
    if (selectedSubRows.size === 0) return;
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      selectedSubRows.forEach((id) => next.add(id));
      return next;
    });
    setRowDrafts((prev) => {
      const next = { ...prev };
      selectedSubRows.forEach((id) => {
        const r = subRowsData.find((item) => item.rowId === id);
        if (r) next[id] = { ...r.values };
      });
      return next;
    });
  };

  // Edit ALL rows simultaneously
  const editAllRows = () => {
    const allIds = new Set(subRowsData.map((r) => r.rowId));
    const drafts: Record<string, Record<string, unknown>> = {};
    subRowsData.forEach((r) => {
      drafts[r.rowId] = { ...r.values };
    });
    setEditingRowIds(allIds);
    setRowDrafts(drafts);
  };

  // Commit ALL editing rows
  const commitAllRows = () => {
    setSubRowsData((prev) =>
      prev.map((r) => {
        const draft = rowDrafts[r.rowId];
        return draft ? { ...r, values: { ...r.values, ...draft } } : r;
      })
    );
    setEditingRowIds(new Set());
    setRowDrafts({});
  };

  // Cancel ALL editing rows
  const cancelAllRows = () => {
    setEditingRowIds(new Set());
    setRowDrafts({});
  };

  // Delete Selected Rows
  const deleteSelectedRows = () => {
    setSubRowsData((prev) => prev.filter((r) => !selectedSubRows.has(r.rowId)));
    setSelectedSubRows(new Set());
  };

  // Add new sub-row
  const handleAddSubRow = () => {
    const newId = `sub_row_${parentRowId}_${Date.now()}`;
    const initialValues: Record<string, unknown> = {};
    columns.forEach((c) => {
      initialValues[c.key] = c.dataType === 'number' ? 0 : c.dataType === 'currency' ? 0 : '';
    });
    initialValues['task_id'] = `TASK-NEW-${subRowsData.length + 1}`;
    initialValues['task_name'] = 'New Sub-item Milestone';
    initialValues['status'] = 'Active';

    const newRow: DataRow = {
      rowId: newId,
      values: initialValues,
    };

    setSubRowsData((prev) => [...prev, newRow]);
    startRowEdit(newId);
  };

  // Delete sub-row
  const handleDeleteSubRow = (subRowId: string) => {
    setSubRowsData((prev) => prev.filter((r) => r.rowId !== subRowId));
    cancelRowEdit(subRowId);
    setSelectedSubRows((prev) => {
      const next = new Set(prev);
      next.delete(subRowId);
      return next;
    });
  };

  const containerBg = isDarkMode ? 'bg-[#0f1d19]/90 border-teal-500/25' : 'bg-white/95 border-teal-600/20';
  const headerBg = isDarkMode ? 'bg-[#142621] text-gray-300 border-teal-500/20' : 'bg-teal-50/80 text-gray-700 border-teal-600/15';
  const footerBg = isDarkMode ? 'bg-[#142621] text-gray-300 border-teal-500/30' : 'bg-teal-50/90 text-gray-800 border-teal-600/20';
  const rowBorder = isDarkMode ? 'border-gray-800/80 hover:bg-teal-950/20' : 'border-gray-100 hover:bg-teal-50/40';
  const textMuted = isDarkMode ? 'text-teal-400/90' : 'text-teal-700';

  const isMultiEditing = editingRowIds.size > 0;
  const hasSelection = selectedSubRows.size > 0;
  const isAllSelected = subRowsData.length > 0 && selectedSubRows.size === subRowsData.length;

  return (
    <div className={`w-full overflow-hidden rounded-xl border shadow-sm ${containerBg}`}>
      {/* Sub-table Header Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b text-xs font-semibold ${headerBg}`}>
        <div className="flex items-center gap-2">
          <Icon icon="hugeicons:flow-connection" className={`w-4 h-4 ${textMuted}`} />
          <span>Sub-items</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            isDarkMode ? 'bg-teal-900/60 text-teal-300' : 'bg-teal-100 text-teal-800'
          }`}>
            {subRowsData.length}
          </span>

          {hasSelection && !isMultiEditing && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#13C296]/20 text-[#13C296] border border-[#13C296]/30">
              {selectedSubRows.size} selected
            </span>
          )}

          {isMultiEditing && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Editing {editingRowIds.size} row{editingRowIds.size > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2">
          {isMultiEditing ? (
            <>
              <button
                type="button"
                onClick={commitAllRows}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#13C296] text-white hover:bg-[#0eb188] transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Save ({editingRowIds.size})
              </button>
              <button
                type="button"
                onClick={cancelAllRows}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                Cancel All
              </button>
            </>
          ) : hasSelection ? (
            <>
              <button
                type="button"
                onClick={editSelectedRows}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#13C296] text-white hover:bg-[#0eb188] transition-colors shadow-sm"
                title="Edit selected sub-rows"
              >
                <Edit2 className="w-3 h-3" />
                Edit Selected ({selectedSubRows.size})
              </button>
              <button
                type="button"
                onClick={deleteSelectedRows}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  isDarkMode
                    ? 'border-red-900/50 bg-red-950/40 text-red-300 hover:bg-red-900/60'
                    : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                }`}
                title="Delete selected sub-rows"
              >
                <Trash2 className="w-3 h-3" />
                Delete ({selectedSubRows.size})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubRows(new Set())}
                className={`px-2 py-1 text-[10px] transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={editAllRows}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  isDarkMode
                    ? 'border-teal-500/30 bg-teal-950/40 text-teal-300 hover:bg-teal-900/50'
                    : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
                }`}
                title="Edit all sub-table rows"
              >
                <Edit2 className="w-3 h-3" />
                Edit All Rows
              </button>
              <button
                type="button"
                onClick={handleAddSubRow}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#13C296]/90 text-white hover:bg-[#13C296] transition-colors shadow-sm"
                title="Add new sub-item"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {/* Independent Horizontal Scroll Wrapper */}
      <div
        className="w-full overflow-x-auto overscroll-x-contain touch-pan-x"
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.stopPropagation();
          }
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <table className="w-max text-left border-collapse">
          <thead>
            <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${headerBg}`}>
              {/* PINNED Selection Checkbox Column */}
              <th className={`sticky left-0 px-3 py-2.5 w-10 text-center select-none z-20 ${headerBg}`}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAllSubRows}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-[#13C296] cursor-pointer"
                  title="Select / Deselect all sub-rows"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 whitespace-nowrap font-medium text-left"
                  style={{ width: col.width ? `${col.width}px` : 'auto' }}
                >
                  {col.label}
                </th>
              ))}
              {/* PINNED Actions Column Header */}
              <th className={`sticky right-0 px-3 py-2.5 whitespace-nowrap font-medium text-center z-20 ${headerBg}`}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200/20 text-xs">
            {subRowsData.map((row, idx) => {
              const isRowEditing = editingRowIds.has(row.rowId);
              const isSelected = selectedSubRows.has(row.rowId);
              const rowDraft = rowDrafts[row.rowId] || {};

              const stickyCellBg = isRowEditing
                ? isDarkMode ? 'bg-[#0a1814]' : 'bg-teal-50'
                : isSelected
                ? isDarkMode ? 'bg-[#0b1b16]' : 'bg-teal-50/80'
                : isDarkMode ? 'bg-[#0f1d19]' : 'bg-white';

              return (
                <tr
                  key={row.rowId || `sub-row-${parentRowId}-${idx}`}
                  className={`transition-colors ${
                    isRowEditing
                      ? isDarkMode ? 'bg-teal-950/40' : 'bg-teal-50/60'
                      : isSelected
                      ? isDarkMode ? 'bg-teal-950/30' : 'bg-teal-50/40'
                      : rowBorder
                  }`}
                >
                  {/* PINNED Selection Checkbox Cell */}
                  <td className={`sticky left-0 px-3 py-2.5 text-center select-none z-10 ${stickyCellBg}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectSubRow(row.rowId)}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-[#13C296] cursor-pointer"
                    />
                  </td>

                  {columns.map((col) => {
                    const isCellEditing = editingCell?.rowId === row.rowId && editingCell?.colKey === col.key;

                    if (isRowEditing) {
                      const valueToEdit = rowDraft[col.key] !== undefined ? rowDraft[col.key] : row.values[col.key];
                      return (
                        <td key={col.key} className="px-2 py-1.5 whitespace-nowrap">
                          <CellEditor
                            value={valueToEdit}
                            row={row}
                            column={col}
                            isDarkMode={isDarkMode}
                            onSave={(val) => handleDraftChange(row.rowId, col.key, val)}
                            onCancel={() => {}}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-2.5 whitespace-nowrap transition-colors select-none ${
                          isCellEditing
                            ? isDarkMode ? 'bg-teal-950/60 ring-1 ring-[#13C296]' : 'bg-teal-50 ring-1 ring-[#13C296]'
                            : 'cursor-pointer hover:bg-teal-500/10'
                        }`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ rowId: row.rowId, colKey: col.key });
                        }}
                        title="Double-click to edit cell"
                      >
                        {isCellEditing ? (
                          <CellEditor
                            value={row.values[col.key]}
                            row={row}
                            column={col}
                            isDarkMode={isDarkMode}
                            onSave={(val) => handleCellSave(row.rowId, col.key, val)}
                            onCancel={() => setEditingCell(null)}
                            autoFocus
                          />
                        ) : (
                          <CellRenderer
                            value={row.values[col.key]}
                            row={row}
                            column={col}
                            allColumns={allColumns.length > 0 ? allColumns : columns}
                            isDarkMode={isDarkMode}
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* PINNED Row Action Controls */}
                  <td className={`sticky right-0 px-3 py-2 whitespace-nowrap z-10 ${stickyCellBg}`}>
                    <div className="flex items-center justify-center gap-1">
                      {isRowEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => commitRowEdit(row.rowId)}
                            className="p-1 rounded-md text-[#13C296] hover:bg-[#13C296]/20 transition-colors"
                            title="Save Row"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelRowEdit(row.rowId)}
                            className="p-1 rounded-md text-gray-400 hover:bg-gray-500/20 transition-colors"
                            title="Cancel Row Edit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startRowEdit(row.rowId)}
                            className={`p-1 rounded-md transition-colors ${
                              isDarkMode
                                ? 'text-gray-400 hover:text-teal-300 hover:bg-teal-900/40'
                                : 'text-gray-500 hover:text-teal-700 hover:bg-teal-50'
                            }`}
                            title="Edit Row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubRow(row.rowId)}
                            className={`p-1 rounded-md transition-colors ${
                              isDarkMode
                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-950/40'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Delete Sub-item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Sub-Table Interactive Summary Aggregation Footer */}
          <tfoot>
            <tr className={`border-t-2 font-semibold text-[11px] ${footerBg}`}>
              <td className={`sticky left-0 px-3 py-2 text-center z-20 ${footerBg}`}>
                <span className="text-[10px] font-bold opacity-70">∑</span>
              </td>
              {columns.map((col) => {
                const aggType = columnAggregations[col.key];
                const aggValue = computeSubColumnAgg(col.key, aggType);
                const colWithAgg: ColumnConfig = { ...col, aggregation: aggType };

                return (
                  <AggregationFooterCell
                    key={`footer-${col.key}`}
                    col={colWithAgg}
                    columnWidth={col.width || 140}
                    stickyStyle={{}}
                    pinnedBg=""
                    isPinned={false}
                    isDarkMode={isDarkMode}
                    aggValue={aggValue}
                    isDropdownOpen={openAggDropdown === col.key}
                    onToggleDropdown={() => setOpenAggDropdown(openAggDropdown === col.key ? null : col.key)}
                    onSelectAggregation={(newAgg) => {
                      setColumnAggregations((prev) => ({ ...prev, [col.key]: newAgg }));
                      setOpenAggDropdown(null);
                    }}
                  />
                );
              })}
              <td className={`sticky right-0 px-3 py-2 text-center z-20 ${footerBg}`} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}





