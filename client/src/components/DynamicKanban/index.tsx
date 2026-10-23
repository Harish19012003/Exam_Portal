import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { Icon } from '@iconify/react';
import { Columns3, RefreshCw } from 'lucide-react';
import {
  RecordDetail,
  RecordItem,
  RecordDesignSidebar,
  SoftRangeSlider,
  SettingRow,
  SettingToggle,
  DesignSectionLabel,
  ViewFeatureBuilder,
  DesignFooterButton,
  ViewToolbarActions,
  SummaryChipsEditor,
  QuickFiltersEditor,
  useFilteredRows,
  useRecordDesign,
  useSharedColumns,
  useSharedRows,
  useViewFeatures,
  useSummaryChipsStore,
  useQuickFiltersStore,
  STATUS_COLORS,
  COLUMN_CONFIG,
  MOCK_ROWS,
  isFieldColumn,
  ViewCountFooter,
  GlobalSearchInput,
  KANBAN_FEATURE_ITEMS,
  KANBAN_FEATURES_STORAGE_KEY,
} from '../DynamicData';
import {
  VIEW_TOOLBAR_BANNER_CLASS,
  viewToolbarBorderClass,
} from '../DynamicData/viewToolbarChrome';
import type { ColumnConfig, DataRow, FieldColumn } from '../DynamicData';
import { FieldCombobox } from '../DynamicTable/components/FieldCombobox';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboardTSV,
  handlePrint,
} from '../DynamicTable/export';
import { DEFAULT_KANBAN_FEATURES } from './types';
import type { DynamicKanbanProps } from './types';
import {
  KANBAN_DESIGN_STORAGE_KEY,
  KANBAN_LAYOUTS,
  createDefaultKanbanDesign,
} from './design';
import type { KanbanDesignConfig, KanbanLayoutKind } from './design';

const UNASSIGNED = '__unassigned__';

function resolveGroupColumn(columns: ColumnConfig[], groupByKey?: string): FieldColumn | undefined {
  if (groupByKey) {
    const col = columns.find(c => c.key === groupByKey);
    if (col && isFieldColumn(col)) return col;
  }
  const statusCol = columns.find(c => isFieldColumn(c) && c.dataType === 'status');
  if (statusCol && isFieldColumn(statusCol)) return statusCol;
  const dropdownCol = columns.find(c => isFieldColumn(c) && c.dataType === 'dropdown');
  return dropdownCol && isFieldColumn(dropdownCol) ? dropdownCol : undefined;
}

function resolveGroupValues(column: FieldColumn | undefined, rows: DataRow[]): string[] {
  if (!column) return [];
  const fromOptions = column.options ?? [];
  const seen = new Set(fromOptions);
  const extra: string[] = [];
  let hasUnassigned = false;
  rows.forEach(r => {
    const v = String(r.values[column.key] ?? '').trim();
    if (!v) {
      hasUnassigned = true;
      return;
    }
    if (!seen.has(v)) {
      seen.add(v);
      extra.push(v);
    }
  });
  return [...fromOptions, ...extra, ...(hasUnassigned ? [UNASSIGNED] : [])];
}

export function DynamicKanban({ isDarkMode, initialColumns, initialRows, features }: DynamicKanbanProps) {
  const { features: cfg, toggleFeature } = useViewFeatures(
    KANBAN_FEATURES_STORAGE_KEY,
    DEFAULT_KANBAN_FEATURES,
    features,
  );
  const summaryChips = useSummaryChipsStore();
  const quickFilters = useQuickFiltersStore();
  const columns = useSharedColumns(COLUMN_CONFIG, initialColumns);
  const [rows, setRows] = useSharedRows(MOCK_ROWS, initialRows);
  const [search, setSearch] = useState('');
  const [activeRow, setActiveRow] = useState<DataRow | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [featureBuilderOpen, setFeatureBuilderOpen] = useState(false);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const { design, updateDesign, resetDesign } = useRecordDesign<KanbanDesignConfig>(
    KANBAN_DESIGN_STORAGE_KEY,
    () => createDefaultKanbanDesign('comfortable', features?.groupByKey),
    Object.keys(KANBAN_LAYOUTS) as KanbanLayoutKind[],
  );

  const layoutDef = KANBAN_LAYOUTS[design.layout as KanbanLayoutKind] ?? KANBAN_LAYOUTS.comfortable;
  const groupColumn = useMemo(
    () => resolveGroupColumn(columns, design.groupByKey ?? features?.groupByKey),
    [columns, design.groupByKey, features?.groupByKey],
  );

  const filteredRows = useFilteredRows(rows, columns, {
    search: cfg.enableSearch ? search : '',
    filters: quickFilters.activeFilters,
  });
  const groupValues = useMemo(
    () => resolveGroupValues(groupColumn, filteredRows),
    [groupColumn, filteredRows],
  );

  const rowsByGroup = useMemo(() => {
    const map: Record<string, DataRow[]> = {};
    groupValues.forEach(g => {
      map[g] = [];
    });
    filteredRows.forEach(r => {
      const raw = groupColumn ? String(r.values[groupColumn.key] ?? '').trim() : '';
      const key = raw || UNASSIGNED;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [filteredRows, groupColumn, groupValues]);

  const visibleGroups = useMemo(
    () =>
      design.hideEmptyColumns
        ? groupValues.filter(g => (rowsByGroup[g]?.length ?? 0) > 0)
        : groupValues,
    [design.hideEmptyColumns, groupValues, rowsByGroup],
  );

  const groupableFields = useMemo(
    () =>
      columns.filter(
        c =>
          isFieldColumn(c) &&
          c.visible !== false &&
          (c.dataType === 'status' || c.dataType === 'dropdown' || c.dataType === 'boolean'),
      ),
    [columns],
  );

  const previewRow = useMemo(
    () => filteredRows[0] ?? rows[0] ?? null,
    [filteredRows, rows],
  );

  const resolveOptions = useMemo(
    () => (groupColumn ? { excludeFieldKeys: new Set([groupColumn.key]) } : undefined),
    [groupColumn],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  }, []);

  const handleSaveRecord = useCallback((updated: DataRow) => {
    setRows(prev => prev.map(r => (r.rowId === updated.rowId ? updated : r)));
    setActiveRow(null);
  }, []);

  const handleDrop = useCallback(
    (groupValue: string) => {
      if (!dragRowId || !groupColumn) return;
      const nextVal = groupValue === UNASSIGNED ? '' : groupValue;
      setRows(prev =>
        prev.map(r =>
          r.rowId === dragRowId ? { ...r, values: { ...r.values, [groupColumn.key]: nextVal } } : r,
        ),
      );
      setDragRowId(null);
      setDragOverGroup(null);
    },
    [dragRowId, groupColumn],
  );

  const boardBg = isDarkMode ? 'bg-black/20' : 'bg-gray-50';
  const shellClass = isDarkMode
    ? 'bg-[#122420] hover:bg-[#152a26] shadow-sm shadow-black/40 ring-1 ring-white/5 hover:ring-[#13C296]/35'
    : 'bg-white hover:bg-white shadow-sm shadow-gray-200/80 hover:shadow-md';

  const columnWidth = Math.min(360, Math.max(200, design.columnWidth || 260));

  if (!groupColumn) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-2xl border ${isDarkMode ? 'bg-[#0B1E19] border-gray-800 text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}
      >
        <p className="text-[13px] font-medium">No status/dropdown column available to group by.</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={
          isFullScreen
            ? `fixed inset-0 z-[9999] flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#0B1E19]' : 'bg-white'}`
            : `relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border ${isDarkMode ? 'bg-[#0B1E19] border-gray-800' : 'bg-white border-gray-200'}`
        }
      >
        <div
          className={`${VIEW_TOOLBAR_BANNER_CLASS} ${viewToolbarBorderClass(isDarkMode)}`}
        >
          {cfg.enableSearch && (
            <GlobalSearchInput
              isDarkMode={isDarkMode}
              value={search}
              onChange={setSearch}
            />
          )}
          <div className="flex-1" />
          <ViewToolbarActions
            isDarkMode={isDarkMode}
            enableExport={cfg.enableExport}
            enableFullScreen={cfg.enableFullScreen}
            isFullScreen={isFullScreen}
            onToggleFullScreen={() => setIsFullScreen(p => !p)}
            onExportCSV={() => exportToCSV(filteredRows, columns)}
            onExportExcel={() => exportToExcel(filteredRows, columns)}
            onExportPDF={() => exportToPDF(filteredRows, columns)}
            onExportJSON={() => exportToJSON(filteredRows, columns)}
            onCopyTSV={() => copyToClipboardTSV(filteredRows, columns)}
            onPrint={handlePrint}
            onPrintAll={() => exportToPDF(filteredRows, columns, 'print')}
          />
          {cfg.enableRefresh && (
            <button
              onClick={handleRefresh}
              title="Refresh"
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all active:scale-90 duration-200 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-4 ${boardBg}`}>
          {filteredRows.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center h-full gap-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
            >
              <Icon icon="hugeicons:search-01" className="w-8 h-8 opacity-50" />
              <p className="text-[13px] font-medium">No records match your search.</p>
            </div>
          ) : (
            <div className="flex gap-5 h-full">
              {visibleGroups.map(groupValue => {
                const label = groupValue === UNASSIGNED ? 'Unassigned' : groupValue;
                const dotColors = STATUS_COLORS[groupValue];
                const cards = rowsByGroup[groupValue] ?? [];
                const isDragOver = dragOverGroup === groupValue;

                return (
                  <div
                    key={groupValue}
                    onDragOver={(e: DragEvent) => {
                      e.preventDefault();
                      if (cfg.enableDragUpdate) setDragOverGroup(groupValue);
                    }}
                    onDragLeave={() =>
                      setDragOverGroup(prev => (prev === groupValue ? null : prev))
                    }
                    onDrop={(e: DragEvent) => {
                      e.preventDefault();
                      if (cfg.enableDragUpdate) handleDrop(groupValue);
                    }}
                    style={{ width: columnWidth }}
                    className={`flex flex-col flex-shrink-0 rounded-lg transition-colors ${isDragOver ? 'bg-[#13C296]/10' : ''}`}
                  >
                    <div className="flex items-center gap-2 px-1 py-1.5 mb-2 flex-shrink-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors?.dot ?? 'bg-gray-400'}`}
                      />
                      <span
                        className={`text-[12.5px] font-bold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                      >
                        {label}
                      </span>
                      <span
                        className={`ml-auto text-[11px] font-semibold tabular-nums ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                        {cards.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[80px] pr-0.5">
                      {cards.map(row => (
                        <RecordItem
                          key={row.rowId}
                          row={row}
                          columns={columns}
                          design={design}
                          layout={layoutDef}
                          isDarkMode={isDarkMode}
                          // flex-shrink-0: tall lanes (e.g. Active ×40) must not
                          // compress cards — overflow-hidden would clip the subtitle.
                          shellClass={`flex-shrink-0 ${shellClass} ${dragRowId === row.rowId ? 'opacity-40' : ''}`}
                          resolveOptions={resolveOptions}
                          draggable={cfg.enableDragUpdate}
                          onDragStart={() => setDragRowId(row.rowId)}
                          onDragEnd={() => {
                            setDragRowId(null);
                            setDragOverGroup(null);
                          }}
                          onClick={cfg.enableOpenDetail ? () => setActiveRow(row) : undefined}
                        />
                      ))}
                      {cards.length === 0 && (
                        <div
                          className={`flex items-center justify-center py-8 text-[11px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                        >
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ViewCountFooter
          isDarkMode={isDarkMode}
          filteredCount={filteredRows.length}
          totalCount={rows.length}
          search={search}
          extras={
            <DesignFooterButton
              isDarkMode={isDarkMode}
              active={designOpen}
              title="Design board"
              onClick={() => {
                setFeatureBuilderOpen(false);
                setDesignOpen(o => !o);
              }}
            />
          }
        />

        {activeRow && (
          <RecordDetail
            row={activeRow}
            columns={columns}
            isDarkMode={isDarkMode}
            enableSubRows={false}
            onSave={handleSaveRecord}
            onClose={() => setActiveRow(null)}
          />
        )}

        <ViewFeatureBuilder
          isDarkMode={isDarkMode}
          isOpen={featureBuilderOpen}
          onToggleOpen={() => {
            setDesignOpen(false);
            setFeatureBuilderOpen(o => !o);
          }}
          onClose={() => setFeatureBuilderOpen(false)}
          items={KANBAN_FEATURE_ITEMS}
          values={
            {
              ...cfg,
              enableSummaryChips: summaryChips.enabled,
              enableQuickFilters: quickFilters.enabled,
            } as Record<string, boolean | undefined>
          }
          onToggle={key => {
            if (key === 'enableSummaryChips') {
              summaryChips.toggleEnabled();
              return;
            }
            if (key === 'enableQuickFilters') {
              quickFilters.toggleEnabled();
              return;
            }
            toggleFeature(key as keyof typeof cfg & string);
          }}
          subtitle="Shared toggles apply to every view"
          featureConfig={{
            enableSummaryChips: <SummaryChipsEditor isDarkMode={isDarkMode} columns={columns} />,
            enableQuickFilters: <QuickFiltersEditor isDarkMode={isDarkMode} columns={columns} />,
          }}
        />
      </div>

      {designOpen && (
        <RecordDesignSidebar
          isDarkMode={isDarkMode}
          columns={columns}
          design={design}
          onChange={updateDesign}
          onReset={resetDesign}
          onClose={() => setDesignOpen(false)}
          layouts={KANBAN_LAYOUTS}
          title="Kanban design"
          previewVariant="card"
          extras={
            <div>
              <DesignSectionLabel icon={Columns3} isDarkMode={isDarkMode}>
                Board
              </DesignSectionLabel>

              <div className="space-y-2.5">
                <SettingRow label="Group by" isDarkMode={isDarkMode}>
                  <FieldCombobox
                    value={groupColumn.key}
                    fields={groupableFields}
                    isDarkMode={isDarkMode}
                    onChange={key => updateDesign({ groupByKey: key })}
                  />
                </SettingRow>

                <div
                  className={`rounded-xl border px-2.5 py-2 ${
                    isDarkMode ? 'border-gray-800 bg-[#0e1a17]/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <SettingRow
                    label="Hide empty columns"
                    info="Only show lanes with cards"
                    isDarkMode={isDarkMode}
                    trailing={
                      <SettingToggle
                        active={design.hideEmptyColumns}
                        onClick={() => updateDesign({ hideEmptyColumns: !design.hideEmptyColumns })}
                        isDarkMode={isDarkMode}
                      />
                    }
                  />
                </div>

                <div
                  className={`rounded-xl border px-2.5 py-2 ${
                    isDarkMode ? 'border-gray-800 bg-[#0e1a17]/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <SettingRow
                    label="Column width"
                    isDarkMode={isDarkMode}
                    trailing={
                      <span className={`text-[11px] tabular-nums ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {columnWidth}px
                      </span>
                    }
                  >
                    <SoftRangeSlider
                      isDarkMode={isDarkMode}
                      min={200}
                      max={360}
                      value={columnWidth}
                      onChange={v => updateDesign({ columnWidth: v })}
                      className="w-full"
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          }
          preview={
            previewRow ? (
              <div
                className={`rounded-lg p-2 ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`}
                style={{ width: columnWidth }}
              >
                <RecordItem
                  row={previewRow}
                  columns={columns}
                  design={design}
                  layout={layoutDef}
                  isDarkMode={isDarkMode}
                  shellClass={shellClass}
                  resolveOptions={resolveOptions}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
