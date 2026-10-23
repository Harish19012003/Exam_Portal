import { useRef, useState, useEffect } from 'react';
import type { Density } from '../types';
import {
  Search, X, RefreshCw, PanelRight, Filter, Layers, Plus, Trash2, Settings, RotateCcw, FilterX, Edit2, PinOff, EyeOff, Maximize, Minimize, ArrowLeftRight, AlignJustify, Bookmark, Check, Loader2
} from 'lucide-react';

import { Icon } from '@iconify/react';


interface TableToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearAll: () => void;
  onRefresh: () => void | Promise<void>;
  onOpenSidebar: () => void;
  onAddRow?: () => void;
  showAddRow?: boolean;
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
  density?: Density;
  onDensityChange?: (d: Density) => void;
  savedViews?: { id: string; name: string }[];
  activeViewId?: string | null;
  onSaveView?: (name: string) => void;
  onLoadView?: (id: string) => void;
  onDeleteView?: (id: string) => void;
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
  showAddRow = true,
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
  density = 'standard',
  onDensityChange,
  savedViews = [],
  activeViewId,
  onSaveView,
  onLoadView,
  onDeleteView,
}: TableToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDensity, setShowDensity] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showViews, setShowViews] = useState(false);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Error refreshing table data:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 700); // Spin for at least 700ms
    }
  };

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

  const iconBtnCls = `relative flex items-center justify-center w-[34px] h-[34px] rounded-lg border transition-all active:scale-95 duration-150 flex-shrink-0
    ${isDarkMode
      ? 'border-gray-800 bg-gray-900/60 hover:bg-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-100 shadow-xs'
      : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-600 hover:text-gray-900 shadow-xs'}`;

  return (
    <div 
      className={`print:hidden flex flex-col gap-2 px-4 sm:px-6 py-2.5 border-b flex-shrink-0 w-full relative z-30 rounded-t-xl
        ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}
      style={{
        width: '100%',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '10px',
        paddingBottom: '10px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      
      {/* Top row */}
      <div 
        className="flex items-center justify-between gap-3 w-full flex-wrap"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* Left Side: Search & Filters & Bulk Selection */}
        <div 
          className="flex items-center gap-2.5 flex-wrap min-w-0"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
        >
          {/* Search */}
          <div
            className="w-full sm:w-[260px] md:w-[280px] flex items-center"
            style={{ width: '100%', maxWidth: '280px' }}
          >
            <div 
              className={`flex items-center gap-2 rounded-lg transition-all duration-200 overflow-hidden
                w-full h-[34px] px-3 border focus-within:ring-2 focus-within:ring-[#13C296]/20 focus-within:border-[#13C296]
                ${isDarkMode ? 'bg-gray-900/60 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-800 shadow-xs'}
              `}
              onClick={() => searchRef.current?.focus()}
            >
              <Search className={`flex-shrink-0 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} aria-hidden="true" />
              
              <input
                ref={searchRef}
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder="Search all columns…"
                className={`text-[13px] bg-transparent outline-none transition-all duration-200 flex-1 opacity-100 w-full
                  ${isDarkMode ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
                aria-label="Global search"
              />
              
              {search && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSearch(''); searchRef.current?.focus(); }}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter indicator */}
          {hasActiveFilters && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold
              ${isDarkMode ? 'bg-[#13C296]/10 border-[#13C296]/30 text-[#13C296]' : 'bg-[#13C296]/10 border-[#13C296]/20 text-[#0f9f7a]'}`}>
              <Filter className="w-3 h-3" aria-hidden="true" />
              {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
            </div>
          )}

          {/* Bulk Selection Actions */}
          {selectedCount > 0 && (
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
        </div>

        {/* Right-side buttons */}
        <div 
          className="flex items-center gap-2 ml-auto flex-wrap justify-end flex-shrink-0"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}
        >

          {/* ── Add row ── */}
          {showAddRow && onAddRow && (
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
          <div className="flex items-center gap-1.5">

            {/* Clear all filters + sort */}
            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                className={iconBtnCls}
                title="Clear all filters and sort"
                aria-label="Clear all filters and sort"
              >
                <FilterX className="w-4 h-4" />
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className={iconBtnCls}
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Density */}
            {onDensityChange && (
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
                    <div 
                      className={`absolute right-0 top-full mt-1.5 w-56 max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-1.5 rounded-xl shadow-xl border z-50 backdrop-blur-xl origin-top-right
                        ${isDarkMode ? 'bg-gray-900/95 border-gray-800 shadow-[0_12px_36px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-gray-200 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'}`}
                      style={{ animation: 'slideDownFade 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    >
                      <div className={`text-center w-full px-2 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Row Density
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {(['extra-compact', 'compact', 'standard', 'comfortable', 'spacious', 'extra-spacious'] as const).map(d => {
                          const heightPx = d === 'extra-compact' ? '32px' : d === 'compact' ? '48px' : d === 'standard' ? '64px' : d === 'comfortable' ? '80px' : d === 'spacious' ? '96px' : '120px';
                          const label = d.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                          const isActive = density === d;
                          return (
                            <button
                              key={d}
                              onClick={() => { onDensityChange && onDensityChange(d); setShowDensity(false); }}
                              className={`w-full text-left px-2 py-1.5 text-[12.5px] rounded-lg transition-all duration-150 flex items-center justify-between group
                                ${isActive 
                                  ? (isDarkMode ? 'bg-[#13C296]/15 text-[#13C296] font-semibold' : 'bg-[#13C296]/10 text-[#0f9f7a] font-semibold')
                                  : (isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors
                                  ${isActive 
                                    ? (isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/20 text-[#0a8066]')
                                    : (isDarkMode ? 'bg-gray-800 text-gray-400 group-hover:text-gray-200' : 'bg-gray-100 text-gray-500 group-hover:text-gray-700')}`}
                                >
                                  <AlignJustify className="w-3.5 h-3.5" />
                                </div>
                                <span className="capitalize">{label}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors
                                  ${isActive
                                    ? (isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/20 text-[#0a8066]')
                                    : (isDarkMode ? 'bg-gray-800 text-gray-400 group-hover:text-gray-300' : 'bg-gray-100 text-gray-500 group-hover:text-gray-700')}`}
                                >
                                  {heightPx}
                                </span>
                                {isActive && <Check className="w-3.5 h-3.5 text-[#13C296] flex-shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Export Dropdown */}
            {(onExportCSV || onExportExcel || onExportPDF) && (
              <div className="relative">
                <button
                  onClick={() => setShowExport(prev => !prev)}
                  disabled={isExporting}
                  className={`${iconBtnCls} ${showExport ? (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-900') : ''} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isExporting ? "Exporting..." : "Export Data"}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon icon="hugeicons:share-01" className="w-4 h-4" />
                  )}
                </button>
                
                {showExport && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                    <div 
                      className={`absolute right-0 top-full mt-1.5 w-52 max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-1.5 rounded-xl shadow-xl border z-50 backdrop-blur-xl origin-top-right
                        ${isDarkMode ? 'bg-gray-900/95 border-gray-800 shadow-[0_12px_36px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-gray-200 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'}`}
                      style={{ animation: 'slideDownFade 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    >
                      <div className={`text-center w-full px-2 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Export & Share
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {onExportCSV && (
                          <button
                            onClick={() => handleExport(onExportCSV)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:file-02" className="w-3.5 h-3.5" />
                            </div>
                            Export CSV
                          </button>
                        )}
                        {onExportExcel && (
                          <button
                            onClick={() => handleExport(onExportExcel)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-green-500/10 text-green-500 group-hover:bg-green-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:file-01" className="w-3.5 h-3.5" />
                            </div>
                            Export Excel
                          </button>
                        )}
                        {onExportPDF && (
                          <button
                            onClick={() => handleExport(onExportPDF)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:file-download" className="w-3.5 h-3.5" />
                            </div>
                            Export PDF
                          </button>
                        )}
                        {onExportJSON && (
                          <button
                            onClick={() => handleExport(onExportJSON)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:code" className="w-3.5 h-3.5" />
                            </div>
                            Export JSON
                          </button>
                        )}
                        {onCopyTSV && (
                          <button
                            onClick={() => handleExport(onCopyTSV)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:copy-01" className="w-3.5 h-3.5" />
                            </div>
                            Copy as TSV
                          </button>
                        )}

                        {(onPrint || onPrintAll) && (
                          <div className={`my-1 mx-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                        )}

                        {onPrint && (
                          <button
                            onClick={() => handleExport(onPrint)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:printer" className="w-3.5 h-3.5" />
                            </div>
                            Print Current View
                          </button>
                        )}
                        {onPrintAll && (
                          <button
                            onClick={() => handleExport(onPrintAll)}
                            className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                              ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            <div className="w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-500 group-hover:bg-cyan-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <Icon icon="hugeicons:printer" className="w-3.5 h-3.5" />
                            </div>
                            Print All Rows
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Saved Views */}
            <div className="relative" ref={viewsRef}>
              <button
                onClick={() => setShowViews(prev => !prev)}
                className={`${iconBtnCls} ${activeViewId ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : ''}`}
                title="Saved Views"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              {showViews && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowViews(false)} />
                  <div 
                    className={`absolute right-0 top-full mt-1.5 w-64 max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-2 rounded-xl shadow-xl border z-50 backdrop-blur-xl origin-top-right
                      ${isDarkMode ? 'bg-gray-900/95 border-gray-800 shadow-[0_12px_36px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-gray-200 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'}`}
                    style={{ animation: 'slideDownFade 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                  >
                    <div className={`px-1 pt-1.5 pb-2 mb-1.5 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                      <div className={`text-center w-full pt-0.5 pb-1 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Save Current View
                      </div>
                      <div className="flex gap-1.5">
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
                          className={`flex-1 min-w-0 px-2.5 py-1 text-[12.5px] rounded-lg outline-none border transition-colors
                            ${isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-200 focus:border-[#13C296]' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-[#13C296]'}`}
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
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white transition-all
                            ${!newViewName.trim() ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-[#13C296] hover:bg-[#0f9f7a]'}`}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className={`text-center w-full px-2 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Saved Views
                    </div>
                    
                    {savedViews.length === 0 ? (
                      <div className={`px-1.5 py-1.5 text-[12px] italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        No saved views yet.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto mt-0.5 flex flex-col gap-0.5">
                        {savedViews.map(view => (
                          <div 
                            key={view.id} 
                            className={`flex items-center justify-between group px-2 py-1.5 rounded-lg transition-all duration-150 cursor-pointer
                              ${isDarkMode ? 'hover:bg-gray-800/80 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}
                              ${activeViewId === view.id ? (isDarkMode ? 'bg-[#13C296]/15 text-[#13C296] font-semibold' : 'bg-[#13C296]/10 text-[#0f9f7a] font-semibold') : ''}
                            `}
                            onClick={() => {
                              if (onLoadView) onLoadView(view.id);
                              setShowViews(false);
                            }}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors
                                ${activeViewId === view.id 
                                  ? (isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/20 text-[#0a8066]')
                                  : (isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}`}
                              >
                                {activeViewId === view.id ? (
                                  <Check className="w-3.5 h-3.5 text-[#13C296]" />
                                ) : (
                                  <Bookmark className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <span className="text-[12.5px] font-medium truncate">{view.name}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteView) onDeleteView(view.id);
                              }}
                              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all
                                ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-600 hover:bg-white'}
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
                </>
              )}
            </div>

            {/* Fullscreen Toggle */}
            {onToggleFullScreen && (
              <button
                onClick={onToggleFullScreen}
                className={iconBtnCls}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                aria-label={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            )}

            {/* Divider */}
            <div className={`w-px h-4 mx-0.5 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />

            {/* Settings (Reset) */}
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
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div 
                    className={`absolute right-0 top-full mt-1.5 w-56 max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-1.5 rounded-xl shadow-xl border z-50 backdrop-blur-xl origin-top-right
                      ${isDarkMode ? 'bg-gray-900/95 border-gray-800 shadow-[0_12px_36px_rgba(0,0,0,0.5)]' : 'bg-white/95 border-gray-200 shadow-[0_12px_36px_rgba(0,0,0,0.1)]'}`}
                    style={{ animation: 'slideDownFade 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                  >
                    <div className={`text-center w-full px-2 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Display
                    </div>
                    
                    <button 
                      onClick={() => { onOpenSidebar(); setShowSettings(false); }}
                      className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                        ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      <div className="w-6 h-6 rounded-md bg-[#13C296]/10 text-[#13C296] group-hover:bg-[#13C296]/20 flex items-center justify-center flex-shrink-0 transition-colors">
                        <PanelRight className="w-3.5 h-3.5" />
                      </div>
                      Manage Columns
                    </button>

                    <div className={`my-1 mx-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />

                    <div className={`text-center w-full px-2 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Reset Options
                    </div>
                    
                    <div className="flex flex-col gap-0.5">
                      <button 
                        onClick={() => { onResetPins(); setShowSettings(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                          ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                      >
                        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                          <PinOff className="w-3.5 h-3.5" />
                        </div>
                        Reset Pins
                      </button>
                      <button 
                        onClick={() => { onResetVisibility(); setShowSettings(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                          ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                      >
                        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                          <EyeOff className="w-3.5 h-3.5" />
                        </div>
                        Reset Visibility
                      </button>
                      <button 
                        onClick={() => { onResetWidths(); setShowSettings(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                          ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                      >
                        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                          <Maximize className="w-3.5 h-3.5" />
                        </div>
                        Reset Column Widths
                      </button>
                      <button 
                        onClick={() => { onResetOrder(); setShowSettings(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[12.5px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2.5 group
                          ${isDarkMode ? 'text-gray-300 hover:bg-gray-800/80 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                      >
                        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </div>
                        Reset Column Order
                      </button>
                    </div>
                    
                    <div className={`my-1 mx-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                    
                    <button 
                      onClick={() => { onFactoryReset(); setShowSettings(false); }}
                      className={`w-full text-left px-2 py-1.5 text-[12.5px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-2.5 group text-rose-500 hover:bg-rose-500/10 dark:text-rose-400`}
                    >
                      <div className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </div>
                      Factory Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
