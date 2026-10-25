import React, { useEffect, useState } from 'react';
import type { ColumnConfig, DataRow, SubRowsConfig } from '../types';
import {
  resolveRenderSubRows,
  resolveSubRowColumns,
} from '../utils/subRowDisplay';
import { SubRowTreeGuide } from './SubRowTreeGuide';
import { DynamicTable } from '../index';


interface SubRowNestedPanelProps {
  parentRow: DataRow;
  subRows: DataRow[];
  colSpan: number;
  subRowsConfig?: SubRowsConfig;
  isDarkMode: boolean;
  allColumns: ColumnConfig[];
  checkboxWidth: number;
  rowHeight: number;
  enableRowSelection?: boolean;
  scrollWrapperRef?: React.RefObject<HTMLDivElement | null>;
}

/** Full-width nested sub-row panel — one cell, internal tree gutter + schema table. */
export function SubRowNestedPanel({
  parentRow,
  subRows,
  colSpan,
  subRowsConfig,
  isDarkMode,
  allColumns: _allColumns,
  checkboxWidth,
  rowHeight: _rowHeight,
  enableRowSelection = true,
  scrollWrapperRef,
}: SubRowNestedPanelProps) {
  const subRowColumns = resolveSubRowColumns(parentRow, subRowsConfig);
  const renderSubRows = resolveRenderSubRows(parentRow, subRowsConfig);

  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = scrollWrapperRef?.current;
    if (!el) return;
    const updateWidth = () => setViewportWidth(el.clientWidth);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollWrapperRef]);

  const panelBg = isDarkMode ? 'bg-[#0a1814]' : 'bg-teal-50/50';
  const border = isDarkMode ? 'border-[#13C296]/40' : 'border-[#13C296]/35';
  const rowBorder = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const gutterWidth = enableRowSelection && checkboxWidth > 0 ? checkboxWidth : 0;

  const subTableFeatures = {
    enableSubRows: false,
    enableFooter: true,
    enableSearch: true,
    enableColumnFiltering: true,
    enableColumnSorting: true,
    enableColumnResizing: true,
    enableRowSelection: true,
    enableCellEditing: true,
    enableActionsColumn: true,
    enableDensityToggle: true,
    enableSidebar: false,
  };

  const nestedContent = renderSubRows ? (
    renderSubRows({ parentRow, subRows, subRowColumns, isDarkMode })
  ) : subRowColumns.length > 0 ? (
    <div className="w-full rounded-xl overflow-hidden border border-teal-500/30 shadow-md">
      <DynamicTable
        isDarkMode={isDarkMode}
        initialColumns={subRowColumns}
        initialRows={subRows}
        features={subTableFeatures}
        enableFeatureBuilder={false}
      />
    </div>
  ) : null;


  return (
    <tr data-sub-row-panel={parentRow.rowId} className="sub-row-nested-panel">
      <td
        colSpan={colSpan}
        className={`border-b ${rowBorder} p-3 ${panelBg}`}
      >
        <div
          className="sticky left-0 z-[4] flex items-stretch gap-2 overflow-hidden transition-[width]"
          style={{
            width: viewportWidth ? `${viewportWidth - 28}px` : '100%',
            maxWidth: viewportWidth ? `${viewportWidth - 28}px` : '100%',
          }}
        >
          {gutterWidth > 0 && (
            <div
              className={`flex flex-shrink-0 items-center justify-start border-l-[3px] ${border} px-2.5 py-1`}
              style={{ width: gutterWidth, minWidth: gutterWidth }}
            >
              <SubRowTreeGuide isLastChild isDarkMode={isDarkMode} />
            </div>
          )}
          <div className="flex-1 min-w-0">{nestedContent}</div>
        </div>
      </td>
    </tr>
  );
}


