import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlignJustify, Rows3, ChevronRight, CornerDownRight } from 'lucide-react';
import {
  CellRenderer,
  DynamicViewShell,
  LayoutMenuDropdown,
  RecordDetail,
  RecordItem,
  RecordDesignSidebar,
  SettingRow,
  SettingToggle,
  StatusBadge,
  ViewFeatureBuilder,
  DesignFooterButton,
  SummaryChipsEditor,
  QuickFiltersEditor,
  useFilteredRows,
  useRecordDesign,
  useSharedColumns,
  useSharedRows,
  useViewFeatures,
  useDefaultLayout,
  useSummaryChipsStore,
  useQuickFiltersStore,
  getRecordIdentity,
  hasSubRows,
  resolveSubRowColumns,
  COLUMN_CONFIG,
  MOCK_ROWS,
  TREE_FEATURE_ITEMS,
  TREE_FEATURES_STORAGE_KEY,
} from '../DynamicData';
import type { ColumnConfig, DataRow } from '../DynamicData';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboardTSV,
  handlePrint,
} from '../DynamicTable/export';
import { DEFAULT_TREE_FEATURES } from './types';
import type { DynamicTreeProps } from './types';
import {
  TREE_DESIGN_STORAGE_KEY,
  TREE_DEFAULT_LAYOUT_KEY,
  TREE_LAYOUTS,
  TREE_LAYOUT_KEYS,
  createDefaultTreeDesign,
} from './design';
import type { TreeDesignConfig, TreeLayoutKind } from './design';

interface ActiveContext {
  row: DataRow;
  columns: ColumnConfig[];
  parentId?: string;
}

const LAYOUT_OPTIONS: { key: TreeLayoutKind; label: string; icon: typeof Rows3 }[] = [
  { key: 'comfortable', label: 'Comfortable', icon: Rows3 },
  { key: 'compact', label: 'Compact', icon: AlignJustify },
];

export function DynamicTree({ isDarkMode, initialColumns, initialRows, features }: DynamicTreeProps) {
  const { features: cfg, toggleFeature } = useViewFeatures(
    TREE_FEATURES_STORAGE_KEY,
    DEFAULT_TREE_FEATURES,
    features,
  );
  const summaryChips = useSummaryChipsStore();
  const quickFilters = useQuickFiltersStore();
  const columns = useSharedColumns(COLUMN_CONFIG, initialColumns);
  const [rows, setRows] = useSharedRows(MOCK_ROWS, initialRows);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => (cfg.defaultExpanded ? new Set((initialRows ?? MOCK_ROWS).map(r => r.rowId)) : new Set()),
  );
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [featureBuilderOpen, setFeatureBuilderOpen] = useState(false);

  const { design, updateDesign, resetDesign } = useRecordDesign<TreeDesignConfig>(
    TREE_DESIGN_STORAGE_KEY,
    () => createDefaultTreeDesign('comfortable'),
    TREE_LAYOUT_KEYS,
  );

  const { defaultLayout, setDefaultLayout } = useDefaultLayout(
    TREE_DEFAULT_LAYOUT_KEY,
    TREE_LAYOUT_KEYS,
    design.layout as TreeLayoutKind,
  );

  useEffect(() => {
    if (design.layout !== defaultLayout) {
      updateDesign({ layout: defaultLayout });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const selectLayout = useCallback(
    (key: TreeLayoutKind) => {
      setDefaultLayout(key);
      updateDesign({ layout: key });
    },
    [setDefaultLayout, updateDesign],
  );

  const patchDesign = useCallback(
    (patch: Partial<TreeDesignConfig>) => {
      updateDesign(patch);
      if (patch.layout) setDefaultLayout(patch.layout);
    },
    [setDefaultLayout, updateDesign],
  );

  const layoutDef = TREE_LAYOUTS[design.layout as TreeLayoutKind] ?? TREE_LAYOUTS.comfortable;
  const previewLayout = useMemo(
    () => ({
      ...layoutDef,
      fieldsClass: layoutDef.fieldsClass.replace(/hidden \w+:flex/g, 'flex'),
    }),
    [layoutDef],
  );

  const filteredRows = useFilteredRows(rows, columns, {
    search: cfg.enableSearch ? search : '',
    filters: quickFilters.activeFilters,
  });
  const previewRow = useMemo(
    () => filteredRows[0] ?? rows[0] ?? null,
    [filteredRows, rows],
  );

  const shellClass = isDarkMode
    ? 'max-lg:bg-transparent max-lg:border-gray-800 lg:bg-transparent lg:border-transparent max-lg:hover:bg-white/5 lg:hover:bg-[#122420]'
    : 'max-lg:bg-transparent max-lg:border-gray-100 lg:bg-transparent lg:border-transparent max-lg:hover:bg-gray-50 lg:hover:bg-gray-50';
  const subRowBg = isDarkMode ? 'hover:bg-[#0e1a17]' : 'hover:bg-gray-50/70';

  const toggleExpanded = useCallback((rowId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  }, []);

  const handleToggleFeature = useCallback(
    (key: string) => {
      if (key === 'enableSummaryChips') {
        summaryChips.toggleEnabled();
        return;
      }
      if (key === 'enableQuickFilters') {
        quickFilters.toggleEnabled();
        return;
      }
      if (key === 'defaultExpanded') {
        const next = !cfg.defaultExpanded;
        toggleFeature(key as keyof typeof cfg & string);
        setExpanded(next ? new Set(rows.map(r => r.rowId)) : new Set());
        return;
      }
      toggleFeature(key as keyof typeof cfg & string);
    },
    [cfg.defaultExpanded, quickFilters, rows, summaryChips, toggleFeature],
  );

  const handleSaveRecord = useCallback(
    (updated: DataRow) => {
      setRows(prev =>
        prev.map(r => {
          if (!activeContext?.parentId) {
            return r.rowId === updated.rowId ? { ...r, values: updated.values } : r;
          }
          if (r.rowId === activeContext.parentId) {
            return {
              ...r,
              subRows: (r.subRows ?? []).map(sr =>
                sr.rowId === updated.rowId ? { ...sr, values: updated.values } : sr,
              ),
            };
          }
          return r;
        }),
      );
      setActiveContext(null);
    },
    [activeContext],
  );

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <DynamicViewShell
        isDarkMode={isDarkMode}
        columns={columns}
        enableSearch={cfg.enableSearch}
        search={search}
        onSearchChange={setSearch}
        filteredCount={filteredRows.length}
        totalCount={rows.length}
        enableRefresh={cfg.enableRefresh}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
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
        bodyClassName={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar max-lg:px-0 max-lg:py-0 px-3 py-2 ${
          isDarkMode ? 'max-lg:bg-[#0B1E19]' : 'max-lg:bg-white'
        }`}
        isEmpty={filteredRows.length === 0}
        searchTrailing={
          cfg.enableDensity ? (
            <LayoutMenuDropdown
              isDarkMode={isDarkMode}
              value={defaultLayout}
              options={LAYOUT_OPTIONS}
              onChange={selectLayout}
            />
          ) : undefined
        }
        toolbarExtras={
          cfg.enableDensity ? (
          <div
            className={`hidden sm:flex items-center rounded-lg border p-0.5 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
          >
            {LAYOUT_OPTIONS.map(({ key, icon: Icon, label }) => {
              const isActive = design.layout === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectLayout(key)}
                  title={`${label} · Remembers on reload`}
                  className={`p-1.5 rounded-md transition-colors ${
                    isActive
                      ? 'bg-[#13C296] text-white'
                      : isDarkMode
                        ? 'text-gray-500 hover:text-gray-300'
                        : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
          ) : undefined
        }
        footerExtras={
          <DesignFooterButton
            isDarkMode={isDarkMode}
            active={designOpen}
            title="Design tree"
            onClick={() => {
              setFeatureBuilderOpen(false);
              setDesignOpen(o => !o);
            }}
          />
        }
      >
        <div className={layoutDef.containerClass}>
          {filteredRows.map(row => {
            const canExpand = hasSubRows(row);
            const isOpen = expanded.has(row.rowId);
            const subRowColumns = canExpand ? resolveSubRowColumns(row) : [];

            return (
              <div key={row.rowId}>
                <RecordItem
                  row={row}
                  columns={columns}
                  design={design}
                  layout={layoutDef}
                  isDarkMode={isDarkMode}
                  shellClass={shellClass}
                  onClick={() =>
                    canExpand
                      ? toggleExpanded(row.rowId)
                      : cfg.enableOpenDetail && setActiveContext({ row, columns })
                  }
                  leading={
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (canExpand) toggleExpanded(row.rowId);
                      }}
                      className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors ${
                        canExpand
                          ? isDarkMode
                            ? 'text-gray-400 hover:bg-white/10'
                            : 'text-gray-500 hover:bg-gray-100'
                          : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      {canExpand && (
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      )}
                    </button>
                  }
                  trailing={
                    <>
                      {canExpand && design.showSubItemCount && (
                        <span
                          className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDarkMode ? 'bg-black/30 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {row.subRows!.length} sub-item{row.subRows!.length === 1 ? '' : 's'}
                        </span>
                      )}
                      {!canExpand && cfg.enableOpenDetail && (
                        <ChevronRight
                          className={`w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                        />
                      )}
                    </>
                  }
                />

                {canExpand && isOpen && (
                  <div
                    className={`ml-6 pl-3 border-l flex flex-col gap-1 py-1 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
                  >
                    {row.subRows!.map(subRow => {
                      const subIdentity = getRecordIdentity(subRow, subRowColumns);
                      const budgetCol = subRowColumns.find(
                        c => c.key === 'completion' || c.key === 'budget',
                      );
                      return (
                        <div
                          key={subRow.rowId}
                          onClick={() =>
                            cfg.enableOpenDetail &&
                            setActiveContext({
                              row: subRow,
                              columns: subRowColumns,
                              parentId: row.rowId,
                            })
                          }
                          className={`group flex items-center gap-2 px-2.5 py-1.5 max-lg:rounded-none lg:rounded-lg transition-colors cursor-pointer ${subRowBg}`}
                        >
                          <CornerDownRight
                            className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                          />
                          <span
                            className={`text-[12.5px] truncate flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                          >
                            {subIdentity.primary}
                          </span>
                          {budgetCol && (
                            <div className="flex-shrink-0 w-[90px]">
                              <CellRenderer
                                value={subRow.values[budgetCol.key]}
                                row={subRow}
                                column={budgetCol}
                                allColumns={subRowColumns}
                                isDarkMode={isDarkMode}
                              />
                            </div>
                          )}
                          {subIdentity.statusValue && (
                            <StatusBadge value={subIdentity.statusValue} isDarkMode={isDarkMode} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DynamicViewShell>

      <ViewFeatureBuilder
        isDarkMode={isDarkMode}
        isOpen={featureBuilderOpen}
        onToggleOpen={() => {
          setDesignOpen(false);
          setFeatureBuilderOpen(o => !o);
        }}
        onClose={() => setFeatureBuilderOpen(false)}
        items={TREE_FEATURE_ITEMS}
        values={
          {
            ...cfg,
            enableSummaryChips: summaryChips.enabled,
            enableQuickFilters: quickFilters.enabled,
          } as Record<string, boolean | undefined>
        }
        onToggle={handleToggleFeature}
        subtitle="Shared toggles apply to every view"
        featureConfig={{
          enableSummaryChips: <SummaryChipsEditor isDarkMode={isDarkMode} columns={columns} />,
          enableQuickFilters: <QuickFiltersEditor isDarkMode={isDarkMode} columns={columns} />,
        }}
      />

      {activeContext && (
        <RecordDetail
          row={activeContext.row}
          columns={activeContext.columns}
          isDarkMode={isDarkMode}
          enableSubRows={false}
          onSave={handleSaveRecord}
          onClose={() => setActiveContext(null)}
        />
      )}

      {designOpen && (
        <RecordDesignSidebar
          isDarkMode={isDarkMode}
          columns={columns}
          design={design}
          onChange={patchDesign}
          onReset={resetDesign}
          onClose={() => setDesignOpen(false)}
          layouts={TREE_LAYOUTS}
          title="Tree design"
          extras={
            <div
              className={`rounded-xl border px-2.5 py-2 ${
                isDarkMode ? 'border-gray-800 bg-[#0e1a17]/60' : 'border-gray-200 bg-white'
              }`}
            >
              <SettingRow
                label="Sub-item count"
                info="Show how many children a node has"
                isDarkMode={isDarkMode}
                trailing={
                  <SettingToggle
                    active={design.showSubItemCount}
                    onClick={() => updateDesign({ showSubItemCount: !design.showSubItemCount })}
                    isDarkMode={isDarkMode}
                  />
                }
              />
            </div>
          }
          preview={
            previewRow ? (
              <div className="min-w-[520px]">
                <RecordItem
                  row={previewRow}
                  columns={columns}
                  design={design}
                  layout={previewLayout}
                  isDarkMode={isDarkMode}
                  shellClass={
                    isDarkMode
                      ? 'bg-[#0e1a17]/60 border-gray-800'
                      : 'bg-white border-gray-100'
                  }
                  leading={
                    <span
                      className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  }
                  trailing={
                    design.showSubItemCount && hasSubRows(previewRow) ? (
                      <span
                        className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDarkMode ? 'bg-black/30 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {previewRow.subRows!.length} sub-items
                      </span>
                    ) : undefined
                  }
                />
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
