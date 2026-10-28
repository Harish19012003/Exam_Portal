import { useRef, useState, useEffect } from 'react';
import type { Density, TableFeaturesConfig } from '../types';
import {
  X, RefreshCw, PanelRight, Filter, Layers, Plus, Trash2, Settings, RotateCcw, FilterX, Edit2, PinOff, EyeOff, Maximize, Minimize, ArrowLeftRight, AlignJustify, Bookmark, Check, Loader2, FileText, FileSpreadsheet, FileDown, Code2, Copy, Printer
} from 'lucide-react';

import { Icon } from '@iconify/react';
import { GlobalSearchInput } from '../../DynamicData/GlobalSearchInput';
import { VIEW_TOOLBAR_STACK_CLASS, viewToolbarBorderClass } from '../../DynamicData/viewToolbarChrome';
import { useQuickFiltersStore } from '../../DynamicData/quickFiltersStore';
import { TransposeIcon } from '../icons/TransposeIcon';


interface TableToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearAll: () => void;
  onRefresh: () => void;
  onOpenSidebar: () => void;
  onAddRow: () => void;
  onResetPins: () => void;
  onResetVisibility: () => void;
  onResetOrder: () => void;
  onResetWidths: () => void;
  onFactoryReset: () => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  onBulkUpdate: () => void;
  onEditSelected: () => void;
  onCancelSelection: () => void;
  totalCount: number;
  filteredCount: number;
  isDarkMode: boolean;
  editingCount?: number;
  onSaveAllEdits?: () => void;
  onCancelAllEdits?: () => void;
  isSaving?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onExportJSON?: () => void;
  onCopyTSV?: () => void;
  onPrint?: () => void;
  onPrintAll?: () => void;
  /** Opens the Import modal (CSV upload + paste table). */
  onOpenImport?: () => void;
  density?: Density;
  onDensityChange?: (d: Density) => void;
  savedViews?: { id: string; name: string }[];
  activeViewId?: string | null;
  onSaveView?: (name: string) => void;
  onLoadView?: (id: string) => void;
  onDeleteView?: (id: string) => void;
  features?: TableFeaturesConfig;
  isTransposed?: boolean;
  onToggleTranspose?: () => void;
}

export function TableToolbar({
  search,
  onSearch,
  hasActiveFilters,
  activeFilterCount,
  onClearAll,
  onRefresh,
  onOpenSidebar,
  onAddRow,
  onResetPins,
  onResetVisibility,
  onResetOrder,
  onResetWidths,
  onFactoryReset,
  selectedCount,
  onDeleteSelected,
  onBulkUpdate,
  onEditSelected,
  onCancelSelection,
  isDarkMode,
  editingCount = 0,
  onSaveAllEdits,
  onCancelAllEdits,
  isSaving = false,
  isFullScreen = false,
  onToggleFullScreen,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onExportJSON,
  onCopyTSV,
  onPrint,
  onPrintAll,
  onOpenImport,
  density = 'standard',
  onDensityChange,
  savedViews = [],
  activeViewId,
  onSaveView,
  onLoadView,
  onDeleteView,
  features,
  isTransposed = false,
  onToggleTranspose,
}: TableToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showDensity, setShowDensity] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const quickFilters = useQuickFiltersStore();
  const quickFiltersAvailable = quickFilters.enabled && quickFilters.fieldKeys.length > 0;
  // Shell owns filter chrome when quick filters are on — don't duplicate count/clear here.
  const showFilterCountChip = hasActiveFilters && !quickFiltersAvailable;
  const showToolbarClearFilters = hasActiveFilters && !quickFiltersAvailable;

  const handleExport = (exportFn: () => void | Promise<void>) => {
    setIsExporting(true);
    setShowExport(false);
    // Give the browser more time to render and start the CSS animation before the heavy task freezes the main thread
    setTimeout(async () => {
      try {
        await exportFn();
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };
  const [newViewName, setNewViewName] = useState('');
  const settingsRef = useRef<HTMLDivElement>(null);
  const viewsRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 700); // Spin for 700ms
  };

  const showSearch = features?.enableSearch !== false;
  const showBulkBar = features?.enableBulkActions !== false && selectedCount > 0;
  const showEditingBar = editingCount > 1;
  const showAddRow = features?.enableAddRow !== false;
  const showRefresh = features?.enableRefresh !== false;
  const showTranspose = features?.enableTranspose !== false && Boolean(onToggleTranspose);
  const densityEnabled = features?.enableDensity !== false && Boolean(onDensityChange);
  const exportEnabled =
    features?.enableExport !== false && Boolean(onExportCSV || onExportExcel || onExportPDF);
  const importEnabled = Boolean(features?.enableImport) && Boolean(onOpenImport);
  const savedViewsEnabled = features?.enableSavedViews !== false;
  const fullScreenEnabled = features?.enableFullScreen !== false && Boolean(onToggleFullScreen);
  const settingsEnabled = features?.enableSettings !== false;

  const hasToolbarContent =
    showSearch ||
    hasActiveFilters ||
    showBulkBar ||
    showEditingBar ||
    showAddRow ||
    showRefresh ||
    showTranspose ||
    densityEnabled ||
    exportEnabled ||
    importEnabled ||
    savedViewsEnabled ||
    fullScreenEnabled ||
    settingsEnabled;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
      if (viewsRef.current && !viewsRef.current.contains(e.target as Node)) setShowViews(false);
    }
    if (showSettings || showViews) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings, showViews]);

  // Avoid empty padded chrome when every toolbar feature is off.
  if (!hasToolbarContent) return null;

  const iconBtnCls = `relative flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 duration-200 flex-shrink-0
    ${isDarkMode
      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`;

  return (
    <div className={`${VIEW_TOOLBAR_STACK_CLASS} ${viewToolbarBorderClass(isDarkMode)}`}>
      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      
      {/* Top row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search & Filters */}
        {features?.enableSearch !== false && (
          <GlobalSearchInput
            isDarkMode={isDarkMode}
            value={search}
            onChange={onSearch}
          />
        )}

        {/* Filter indicator — hidden when Quick Filters chrome owns the filter icon */}
        {showFilterCountChip && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold
            ${isDarkMode ? 'bg-[#13C296]/10 border-[#13C296]/30 text-[#13C296]' : 'bg-[#13C296]/10 border-[#13C296]/20 text-[#0f9f7a]'}`}>
            <Filter className="w-3 h-3" aria-hidden="true" />
            {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
          </div>
        )}

        {/* Bulk Selection Actions */}
        {features?.enableBulkActions !== false && selectedCount > 0 && (
          <div className="flex items-center animate-[fadeIn_0.2s_ease-out]">
            
            <div className={`flex items-center h-9 rounded-lg p-1 transition-all
              ${isDarkMode ? 'bg-gray-800/80' : 'bg-gray-100'}`}
            >
              <div className="flex items-center gap-1 h-full px-1">
                <button
                  onClick={onCancelSelection}
                  title="Deselect All"
                  className={`flex items-center justify-center w-7 h-full rounded-md transition-all
                    ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                  <X className="w-4 h-4" />
                </button>

                <div className={`w-px h-4 mx-0.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

                <button
                  onClick={onEditSelected}
                  title="Edit"
                  className={`flex items-center justify-center w-7 h-full rounded-md transition-all
                    ${isDarkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900'}`}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onBulkUpdate}
                  title="Mass Update"
                  className={`flex items-center justify-center w-7 h-full rounded-md transition-all
                    ${isDarkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900'}`}
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button
                  onClick={onDeleteSelected}
                  title="Delete"
                  className={`flex items-center justify-center w-7 h-full rounded-md transition-all
                    ${isDarkMode ? 'text-red-400 hover:bg-gray-700 hover:text-red-300' : 'text-red-500 hover:bg-white hover:shadow-sm hover:text-red-600'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Bulk Edit Actions */}
          {editingCount > 1 && (
            <div className="flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]">
              <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <span className={`text-[11px] font-bold tracking-wide uppercase px-1
                ${isDarkMode ? 'text-[#13C296]' : 'text-[#0a8066]'}`}>
                {editingCount} editing
              </span>
              <button
                onClick={onSaveAllEdits}
                disabled={isSaving}
                className={`flex items-center justify-center min-w-[90px] gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[#13C296] text-white hover:bg-[#0f9f7a] shadow-sm disabled:opacity-70`}
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Save all</span>}
              </button>
              <button
                onClick={onCancelAllEdits}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors border shadow-sm
                  ${isDarkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span>Cancel all</span>
              </button>
            </div>
          )}

        {/* Right-side buttons */}
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">

          {/* ── Add row ── */}
          {features?.enableAddRow !== false && (
            <button
              onClick={onAddRow}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 sm:gap-1.5 rounded-lg transition-colors bg-[#13C296] hover:bg-[#0f9f7a] text-white"
              aria-label="Add new row"
            >
              <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline text-[12px] font-bold">Add row</span>
            </button>
          )}

          {/* ── Icon-only utilities ── */}
          <div className="flex items-center gap-1">

            {/* Clear all filters + sort — hidden when Quick Filters chrome handles clear */}
            {showToolbarClearFilters && (
              <button
                onClick={onClearAll}
                className={iconBtnCls}
                title="Clear all filters and sort"
                aria-label="Clear all filters and sort"
              >
                <FilterX className="w-4 h-4" />
              </button>
            )}

            {/* Density */}
            {features?.enableDensity !== false && onDensityChange && (
              <div className="relative">
                <button
                  onClick={() => setShowDensity(!showDensity)}
                  className={`${iconBtnCls} ${showDensity ? (isDarkMode ? 'bg-gray-800' : 'bg-gray-200') : ''}`}
                  title="Density"
                >
                  <AlignJustify className="w-4 h-4" />
                </button>
                {showDensity && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDensity(false)} />
                    <div className={`absolute right-0 top-full mt-1 w-44 py-1 rounded-xl shadow-lg border z-50 animate-in fade-in zoom-in-95 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                      {(['extra-compact', 'compact', 'standard', 'comfortable', 'spacious', 'extra-spacious'] as const).map(d => {
                        const heightPx = d === 'extra-compact' ? '32px' : d === 'compact' ? '48px' : d === 'standard' ? '64px' : d === 'comfortable' ? '80px' : d === 'spacious' ? '96px' : '120px';
                        const label = `${d} (${heightPx})`;
                        return (
                        <button
                          key={d}
                          onClick={() => { onDensityChange && onDensityChange(d); setShowDensity(false); }}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium capitalize flex items-center justify-between ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          {label}
                          {density === d && <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-[#13C296]' : 'bg-[#0a8066]'}`} />}
                        </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Transpose Table (Row ↔ Col) */}
            {features?.enableTranspose !== false && onToggleTranspose && (
              <button
                type="button"
                onClick={onToggleTranspose}
                className={`${iconBtnCls} ${
                  isTransposed
                    ? isDarkMode
                      ? 'bg-[#13C296]/20 text-[#13C296]'
                      : 'bg-[#13C296]/15 text-[#0f9f7a]'
                    : ''
                }`}
                title={isTransposed ? 'Exit transposed view' : 'Transpose table (view only)'}
                aria-label={isTransposed ? 'Exit transposed view' : 'Transpose table'}
                aria-pressed={isTransposed}
              >
                <TransposeIcon className="w-4 h-4" />
              </button>
            )}

            {/* Import (opens modal) */}
            {importEnabled && (
              <button
                type="button"
                onClick={onOpenImport}
                className={iconBtnCls}
                title="Import data"
                aria-label="Import data"
              >
                <Icon icon="hugeicons:file-upload" className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Export Dropdown */}
            {features?.enableExport !== false && (onExportCSV || onExportExcel || onExportPDF) && (
              <div className="relative">
                <button
                  onClick={() => setShowExport(prev => !prev)}
                  disabled={isExporting}
                  className={`${iconBtnCls} ${showExport ? (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-900') : ''} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isExporting ? "Exporting..." : "Export Data"}
                >
                  {isExporting ? (
                    <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  ) : (
                    <Icon icon="hugeicons:share-01" className="w-[18px] h-[18px]" />
                  )}
                </button>
                
                {showExport && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                    <div className={`absolute right-0 top-full mt-1 w-40 py-1 rounded-xl shadow-lg border z-50 animate-in fade-in zoom-in-95 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                      {onExportCSV && (
                        <button
                          onClick={() => handleExport(onExportCSV)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          <FileText className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Export CSV
                        </button>
                      )}
                      {onExportExcel && (
                        <button
                          onClick={() => handleExport(onExportExcel)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          <FileSpreadsheet className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Export Excel
                        </button>
                      )}
                      {onExportPDF && (
                        <button
                          onClick={() => handleExport(onExportPDF)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          <FileDown className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Export PDF
                        </button>
                      )}
                      {onExportJSON && (
                        <button
                          onClick={() => handleExport(onExportJSON)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 border-t ${isDarkMode ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-700'}`}
                        >
                          <Code2 className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Export JSON
                        </button>
                      )}
                      {onCopyTSV && (
                        <button
                          onClick={() => handleExport(onCopyTSV)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 border-t ${isDarkMode ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-700'}`}
                        >
                          <Copy className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Copy as TSV
                        </button>
                      )}
                      {onPrint && (
                        <button
                          onClick={() => handleExport(onPrint)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          <Printer className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Print Current View
                        </button>
                      )}
                      {onPrintAll && (
                        <button
                          onClick={() => handleExport(onPrintAll)}
                          className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                          <Printer className="w-4 h-4 opacity-70 flex-shrink-0" />
                          Print All Rows
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Saved Views */}
            {features?.enableSavedViews !== false && (
              <div className="relative" ref={viewsRef}>
                <button
                  onClick={() => setShowViews(prev => !prev)}
                  className={`${iconBtnCls} ${activeViewId ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : ''}`}
                  title="Saved Views"
                >
                  <Bookmark className="w-4 h-4" />
                </button>

                {showViews && (
                  <div 
                    className={`absolute right-0 top-full mt-2 w-64 rounded-xl shadow-lg border z-50 py-2 origin-top-right
                      ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{ animation: 'slideDownFade 0.2s ease-out forwards' }}
                  >
                    <div className={`px-3 py-1 mb-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Save Current View
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input 
                          type="text" 
                          placeholder="View Name..." 
                          value={newViewName}
                          onChange={e => setNewViewName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newViewName.trim() && onSaveView) {
                              onSaveView(newViewName.trim());
                              setNewViewName('');
                              setShowViews(false);
                            }
                          }}
                          className={`flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-md outline-none border transition-colors
                            ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-200 focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500'}`}
                        />
                        <button
                          disabled={!newViewName.trim() || !onSaveView}
                          onClick={() => {
                            if (newViewName.trim() && onSaveView) {
                              onSaveView(newViewName.trim());
                              setNewViewName('');
                              setShowViews(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-md text-[13px] font-medium text-white transition-colors
                            ${!newViewName.trim() ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Saved Views
                    </div>
                    
                    {savedViews.length === 0 ? (
                      <div className={`px-4 py-3 text-[13px] italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        No saved views yet.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto mt-1">
                        {savedViews.map(view => (
                          <div 
                            key={view.id} 
                            className={`flex items-center justify-between group px-2 py-1.5 mx-2 rounded-md transition-colors cursor-pointer
                              ${isDarkMode ? 'hover:bg-gray-700/50 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}
                              ${activeViewId === view.id ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-700') : ''}
                            `}
                            onClick={() => {
                              if (onLoadView) onLoadView(view.id);
                              setShowViews(false);
                            }}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              {activeViewId === view.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span className="text-[13px] font-medium truncate">{view.name}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteView) onDeleteView(view.id);
                              }}
                              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-all
                                ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-gray-600' : 'text-gray-400 hover:text-red-600 hover:bg-white'}
                              `}
                              title="Delete View"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Toggle */}
            {features?.enableFullScreen !== false && onToggleFullScreen && (
              <button
                onClick={onToggleFullScreen}
                className={iconBtnCls}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                aria-label={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            )}

            {/* Settings (Reset) */}
            {features?.enableSettings !== false && (
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettings(prev => !prev)}
                  className={iconBtnCls}
                  title="Table Settings"
                  aria-label="Table Settings"
                >
                  <Settings className={`w-4 h-4 transition-transform duration-300 ${showSettings ? 'rotate-90 scale-110' : ''}`} />
                </button>
                
                {showSettings && (
                  <div 
                    className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border z-50 py-1 origin-top-right
                      ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{ animation: 'slideDownFade 0.2s ease-out forwards' }}
                  >
                    
                    <div className={`px-4 py-2 mt-1 text-[11px] font-bold uppercase tracking-wider
                      ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Display
                    </div>
                    
                    <button onClick={() => { onOpenSidebar(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-gray-200 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <PanelRight className="w-4 h-4 opacity-70" />
                      Manage Columns
                    </button>

                    <div className={`my-2 h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />

                    <div className={`px-4 py-1 text-[11px] font-bold uppercase tracking-wider
                      ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Reset Options
                    </div>
                    
                    <button onClick={() => { onResetPins(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-gray-200 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <PinOff className="w-4 h-4 opacity-70" />
                      Reset Pins
                    </button>
                    <button onClick={() => { onResetVisibility(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-gray-200 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <EyeOff className="w-4 h-4 opacity-70" />
                      Reset Visibility
                    </button>
                    <button onClick={() => { onResetWidths(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-gray-200 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <Maximize className="w-4 h-4 opacity-70" />
                      Reset Column Widths
                    </button>
                    <button onClick={() => { onResetOrder(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-gray-200 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <ArrowLeftRight className="w-4 h-4 opacity-70" />
                      Reset Column Order
                    </button>
                    
                    <div className={`my-2 h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                    
                    <button onClick={() => { onFactoryReset(); setShowSettings(false); }}
                      className={`w-[calc(100%-16px)] mx-2 mb-2 text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2.5
                      ${isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                      <RotateCcw className="w-4 h-4 opacity-70" />
                      Factory Reset
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Refresh — always last on the right */}
            {features?.enableRefresh !== false && (
              <button
                onClick={handleRefresh}
                className={iconBtnCls}
                title="Refresh Data"
                aria-label="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
