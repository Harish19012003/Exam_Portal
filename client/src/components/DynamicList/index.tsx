import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlignJustify, Rows3, ChevronRight } from 'lucide-react';
import {
  DynamicViewShell,
  LayoutMenuDropdown,
  RecordItem,
  RecordDesignSidebar,
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
  COLUMN_CONFIG,
  MOCK_ROWS,
  LIST_FEATURE_ITEMS,
  LIST_FEATURES_STORAGE_KEY,
  useDesignPanelTourHandlers,
} from '../DynamicData';
import type { DataRow } from '../DynamicData';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboardTSV,
  handlePrint,
} from '../DynamicTable/export';
import { DEFAULT_LIST_FEATURES } from './types';
import type { DynamicListProps } from './types';
import {
  LIST_DESIGN_STORAGE_KEY,
  LIST_DEFAULT_LAYOUT_KEY,
  LIST_LAYOUTS,
  LIST_LAYOUT_KEYS,
  createDefaultListDesign,
} from './design';
import type { ListLayoutKind } from './design';

const LAYOUT_OPTIONS: { key: ListLayoutKind; label: string; icon: typeof Rows3 }[] = [
  { key: 'comfortable', label: 'Comfortable', icon: Rows3 },
  { key: 'compact', label: 'Compact', icon: AlignJustify },
];

export function DynamicList({ isDarkMode, initialColumns, initialRows, features, isTourHost }: DynamicListProps) {
  const { features: cfg, toggleFeature } = useViewFeatures(
    LIST_FEATURES_STORAGE_KEY,
    DEFAULT_LIST_FEATURES,
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

  useDesignPanelTourHandlers({ setFeatureBuilderOpen, setDesignOpen }, Boolean(isTourHost));

  const { design, updateDesign, resetDesign } = useRecordDesign(
    LIST_DESIGN_STORAGE_KEY,
    () => createDefaultListDesign(cfg.density),
    LIST_LAYOUT_KEYS,
  );

  const { defaultLayout, setDefaultLayout } = useDefaultLayout(
    LIST_DEFAULT_LAYOUT_KEY,
    LIST_LAYOUT_KEYS,
    design.layout,
  );

  // Restore pinned default layout on load (and keep design in sync).
  useEffect(() => {
    if (design.layout !== defaultLayout) {
      updateDesign({ layout: defaultLayout });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const selectLayout = useCallback(
    (key: ListLayoutKind) => {
      setDefaultLayout(key);
      updateDesign({ layout: key });
    },
    [setDefaultLayout, updateDesign],
  );

  const patchDesign = useCallback(
    (patch: Parameters<typeof updateDesign>[0]) => {
      updateDesign(patch);
      if (patch.layout) setDefaultLayout(patch.layout);
    },
    [setDefaultLayout, updateDesign],
  );

  const layoutDef = LIST_LAYOUTS[design.layout] ?? LIST_LAYOUTS.comfortable;
  // Preview always shows the full desktop row (chips included) at a fixed
  // min-width so the design panel doesn’t crush it — scroll horizontally.
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

  const shellClass = isDarkMode
    ? 'max-lg:bg-transparent max-lg:border-gray-800 lg:bg-[#0e1a17]/60 lg:border-gray-800 max-lg:hover:bg-white/5 lg:hover:bg-[#122420]'
    : 'max-lg:bg-transparent max-lg:border-gray-100 lg:bg-white lg:border-gray-100 max-lg:hover:bg-gray-50 lg:hover:bg-gray-50/80';

  const previewRow = useMemo(
    () => filteredRows[0] ?? rows[0] ?? null,
    [filteredRows, rows],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  }, []);

  const handleSaveRecord = useCallback((updated: DataRow) => {
    setRows(prev => prev.map(r => (r.rowId === updated.rowId ? updated : r)));
    setActiveRow(null);
  }, []);

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
        bodyClassName={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar max-lg:px-0 max-lg:py-0 px-3 py-2 ${isDarkMode ? 'max-lg:bg-[#0B1E19]' : 'max-lg:bg-white'
          }`}
        isEmpty={filteredRows.length === 0}
        activeRow={activeRow}
        onSaveRecord={handleSaveRecord}
        onCloseRecord={() => setActiveRow(null)}
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
            <div className={`hidden sm:flex items-center rounded-lg border p-0.5 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {LAYOUT_OPTIONS.map(({ key, icon: Icon, label }) => {
                const isActive = design.layout === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectLayout(key)}
                    title={`${label} · Remembers on reload`}
                    className={`p-1.5 rounded-md transition-colors ${isActive
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
            title="Design list"
            onClick={() => {
              setFeatureBuilderOpen(false);
              setDesignOpen(o => !o);
            }}
          />
        }
      >
        <div className={layoutDef.containerClass}>
          {filteredRows.map(row => (
            <RecordItem
              key={row.rowId}
              row={row}
              columns={columns}
              design={design}
              layout={layoutDef}
              isDarkMode={isDarkMode}
              shellClass={shellClass}
              onClick={cfg.enableOpenDetail ? () => setActiveRow(row) : undefined}
              trailing={
                cfg.enableOpenDetail ? (
                  <ChevronRight
                    className={`w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                  />
                ) : undefined
              }
            />
          ))}
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
        items={LIST_FEATURE_ITEMS}
        values={{
          ...(cfg as unknown as Record<string, boolean | undefined>),
          enableSummaryChips: summaryChips.enabled,
          enableQuickFilters: quickFilters.enabled,
        }}
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

      {designOpen && (
        <RecordDesignSidebar
          isDarkMode={isDarkMode}
          columns={columns}
          design={design}
          onChange={patchDesign}
          onReset={resetDesign}
          onClose={() => setDesignOpen(false)}
          layouts={LIST_LAYOUTS}
          title="List design"
          preview={
            previewRow ? (
              <div className="min-w-[560px]">
                <RecordItem
                  row={previewRow}
                  columns={columns}
                  design={design}
                  layout={previewLayout}
                  isDarkMode={isDarkMode}
                  shellClass={shellClass}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
