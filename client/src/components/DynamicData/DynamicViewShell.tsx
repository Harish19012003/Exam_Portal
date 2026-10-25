// Shared chrome for the non-table Dynamic* views: framed container, toolbar
// (search + per-view controls + refresh), scroll body, sticky count footer,
// and the record detail drawer. Table keeps its own pagination footer.
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { RefreshCw } from 'lucide-react';
import { RecordEditSidebar as RecordDetail } from '../DynamicTable/components/RecordEditSidebar';
import type { ColumnConfig, DataRow } from '../DynamicTable/types';
import { GlobalSearchInput } from './GlobalSearchInput';
import { ViewCountFooter } from './ViewCountFooter';
import { ViewToolbarActions } from './ViewToolbarActions';
import { VIEW_TOOLBAR_BANNER_CLASS, viewToolbarBorderClass } from './viewToolbarChrome';

export interface DynamicViewShellProps {
  isDarkMode: boolean;
  columns: ColumnConfig[];

  enableSearch?: boolean;
  search: string;
  onSearchChange: (value: string) => void;

  filteredCount: number;
  totalCount: number;

  enableRefresh?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;

  enableExport?: boolean;
  enableFullScreen?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onExportCSV?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  onExportPDF?: () => void | Promise<void>;
  onExportJSON?: () => void | Promise<void>;
  onCopyTSV?: () => void | Promise<void>;
  onPrint?: () => void | Promise<void>;
  onPrintAll?: () => void | Promise<void>;

  /** Control in the right toolbar cluster (e.g. mobile layout dropdown). */
  searchTrailing?: ReactNode;

  /** Per-view toolbar controls (desktop layout switchers). */
  toolbarExtras?: ReactNode;

  /** Actions in the sticky footer (e.g. design palette). */
  footerExtras?: ReactNode;

  /** Tailwind classes for the scroll container — views differ in padding. */
  bodyClassName?: string;
  isEmpty?: boolean;
  emptyMessage?: string;

  /** Record opened in the detail drawer, or null. */
  activeRow?: DataRow | null;
  onSaveRecord?: (updated: DataRow) => void;
  onCloseRecord?: () => void;

  children: ReactNode;
}

export function DynamicViewShell({
  isDarkMode,
  columns,
  enableSearch = true,
  search,
  onSearchChange,
  filteredCount,
  totalCount,
  enableRefresh = true,
  isRefreshing = false,
  onRefresh,
  enableExport,
  enableFullScreen,
  isFullScreen = false,
  onToggleFullScreen,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onExportJSON,
  onCopyTSV,
  onPrint,
  onPrintAll,
  searchTrailing,
  toolbarExtras,
  footerExtras,
  bodyClassName = 'flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 md:p-4',
  isEmpty = false,
  emptyMessage = 'No records match your search.',
  activeRow,
  onSaveRecord,
  onCloseRecord,
  children,
}: DynamicViewShellProps) {
  const iconBtnCls = `relative flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 duration-200 flex-shrink-0
    ${isDarkMode
      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`;

  const refreshBtn = enableRefresh ? (
    <button
      onClick={onRefresh}
      title="Refresh"
      className={iconBtnCls}
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  ) : null;

  return (
    <div
      className={
        isFullScreen
          ? `fixed inset-0 z-[9999] flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#0B1E19]' : 'bg-white'}`
          : // Below lg: flush with the page (no nested frame). Avoids card-in-card on tablets.
            `relative flex h-full min-w-0 flex-1 flex-col overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent lg:rounded-2xl lg:border ${
              isDarkMode ? 'lg:bg-[#0B1E19] lg:border-gray-800' : 'lg:bg-white lg:border-gray-200'
            }`
      }
    >
      <div
        className={`${VIEW_TOOLBAR_BANNER_CLASS} ${viewToolbarBorderClass(isDarkMode)} ${
          isDarkMode ? 'max-lg:bg-[#0B1E19]' : 'max-lg:bg-white'
        } lg:bg-transparent`}
      >
        {enableSearch && (
          <GlobalSearchInput
            isDarkMode={isDarkMode}
            value={search}
            onChange={onSearchChange}
          />
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {searchTrailing}
          {toolbarExtras}
          <ViewToolbarActions
            isDarkMode={isDarkMode}
            enableExport={enableExport}
            enableFullScreen={enableFullScreen}
            isFullScreen={isFullScreen}
            onToggleFullScreen={onToggleFullScreen}
            onExportCSV={onExportCSV}
            onExportExcel={onExportExcel}
            onExportPDF={onExportPDF}
            onExportJSON={onExportJSON}
            onCopyTSV={onCopyTSV}
            onPrint={onPrint}
            onPrintAll={onPrintAll}
          />
          {refreshBtn}
        </div>
      </div>

      <div className={bodyClassName}>
        {isEmpty ? (
          <div
            className={`flex flex-col items-center justify-center h-full gap-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
          >
            <Icon icon="hugeicons:search-01" className="w-8 h-8 opacity-50" />
            <p className="text-[13px] font-medium">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>

      <ViewCountFooter
        isDarkMode={isDarkMode}
        filteredCount={filteredCount}
        totalCount={totalCount}
        search={search}
        extras={footerExtras}
      />

      {activeRow && (
        <RecordDetail
          row={activeRow}
          columns={columns}
          isDarkMode={isDarkMode}
          enableSubRows={false}
          onSave={updated => onSaveRecord?.(updated)}
          onClose={() => onCloseRecord?.()}
        />
      )}
    </div>
  );
}
