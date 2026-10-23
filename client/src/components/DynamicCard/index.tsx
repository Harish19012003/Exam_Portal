import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Image as ImageIcon, Rows3, PanelsTopLeft } from 'lucide-react';
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
  CARD_FEATURE_ITEMS,
  CARD_FEATURES_STORAGE_KEY,
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
import { DEFAULT_CARD_FEATURES } from './types';
import type { DynamicCardProps } from './types';
import {
  CARD_DESIGN_STORAGE_KEY,
  CARD_DEFAULT_LAYOUT_KEY,
  CARD_LAYOUTS,
  CARD_LAYOUT_KEYS,
  createDefaultCardDesign,
} from './design';
import type { CardLayoutKind } from './design';

const LAYOUT_TOOLBAR: { key: CardLayoutKind; label: string; icon: typeof LayoutGrid; title: string }[] = [
  { key: 'card', label: 'Card', icon: LayoutGrid, title: 'Card layout' },
  { key: 'gallery', label: 'Gallery', icon: ImageIcon, title: 'Gallery layout' },
  { key: 'compact', label: 'Compact', icon: Rows3, title: 'Compact layout' },
  { key: 'cover', label: 'Cover', icon: PanelsTopLeft, title: 'Cover layout' },
];

export function DynamicCard({ isDarkMode, initialColumns, initialRows, features }: DynamicCardProps) {
  const { features: cfg, toggleFeature } = useViewFeatures(
    CARD_FEATURES_STORAGE_KEY,
    DEFAULT_CARD_FEATURES,
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

  const { design, updateDesign, resetDesign } = useRecordDesign(
    CARD_DESIGN_STORAGE_KEY,
    () => createDefaultCardDesign(cfg.layout),
    CARD_LAYOUT_KEYS,
  );

  const { defaultLayout, setDefaultLayout } = useDefaultLayout(
    CARD_DEFAULT_LAYOUT_KEY,
    CARD_LAYOUT_KEYS,
    design.layout,
  );

  useEffect(() => {
    if (design.layout !== defaultLayout) {
      updateDesign({ layout: defaultLayout });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const selectLayout = useCallback(
    (key: CardLayoutKind) => {
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

  const layoutDef = CARD_LAYOUTS[design.layout] ?? CARD_LAYOUTS.card;
  const filteredRows = useFilteredRows(rows, columns, {
    search: cfg.enableSearch ? search : '',
    filters: quickFilters.activeFilters,
  });

  const shellClass = isDarkMode
    ? 'bg-[#0e1a17]/60 border-gray-800'
    : 'bg-white border-gray-100';

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
        isEmpty={filteredRows.length === 0}
        activeRow={activeRow}
        onSaveRecord={handleSaveRecord}
        onCloseRecord={() => setActiveRow(null)}
        searchTrailing={
          <LayoutMenuDropdown
            isDarkMode={isDarkMode}
            value={defaultLayout}
            options={LAYOUT_TOOLBAR}
            onChange={selectLayout}
          />
        }
        toolbarExtras={
          <div className={`hidden sm:flex items-center rounded-lg border p-0.5 flex-shrink-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {LAYOUT_TOOLBAR.map(({ key, icon: Icon, title }) => {
              const isActive = design.layout === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectLayout(key)}
                  title={`${title} · Remembers on reload`}
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
        }
        footerExtras={
          <DesignFooterButton
            isDarkMode={isDarkMode}
            active={designOpen}
            title="Design cards"
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
        items={CARD_FEATURE_ITEMS}
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
          layouts={CARD_LAYOUTS}
          title="Card design"
          previewVariant="card"
          preview={
            previewRow ? (
              <div className="w-[280px]">
                <RecordItem
                  row={previewRow}
                  columns={columns}
                  design={design}
                  layout={layoutDef}
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
