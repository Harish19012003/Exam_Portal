import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Loader2, Maximize, Minimize } from 'lucide-react';

export interface ViewToolbarActionsProps {
  isDarkMode: boolean;
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
}

export function ViewToolbarActions({
  isDarkMode,
  enableExport = true,
  enableFullScreen = true,
  isFullScreen = false,
  onToggleFullScreen,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onExportJSON,
  onCopyTSV,
  onPrint,
  onPrintAll,
}: ViewToolbarActionsProps) {
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasExportHandlers = Boolean(
    onExportCSV || onExportExcel || onExportPDF || onExportJSON || onCopyTSV || onPrint || onPrintAll,
  );
  const showExportMenu = enableExport && hasExportHandlers;
  const showFullScreen = enableFullScreen && Boolean(onToggleFullScreen);

  if (!showExportMenu && !showFullScreen) return null;

  const iconBtnCls = `relative flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 duration-200 flex-shrink-0
    ${isDarkMode
      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`;

  const handleExport = (exportFn: () => void | Promise<void>) => {
    setIsExporting(true);
    setShowExport(false);
    setTimeout(async () => {
      try {
        await exportFn();
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {showExportMenu && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExport(prev => !prev)}
            disabled={isExporting}
            className={`${iconBtnCls} ${showExport ? (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-900') : ''} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isExporting ? 'Exporting...' : 'Export Data'}
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
              <div
                className={`absolute right-0 top-full mt-1 w-40 py-1 rounded-xl shadow-lg border z-50 animate-in fade-in zoom-in-95 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
              >
                {onExportCSV && (
                  <button
                    type="button"
                    onClick={() => handleExport(onExportCSV)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:file-02" className="w-4 h-4 opacity-70" />
                    Export CSV
                  </button>
                )}
                {onExportExcel && (
                  <button
                    type="button"
                    onClick={() => handleExport(onExportExcel)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:file-01" className="w-4 h-4 opacity-70" />
                    Export Excel
                  </button>
                )}
                {onExportPDF && (
                  <button
                    type="button"
                    onClick={() => handleExport(onExportPDF)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:file-download" className="w-4 h-4 opacity-70" />
                    Export PDF
                  </button>
                )}
                {onExportJSON && (
                  <button
                    type="button"
                    onClick={() => handleExport(onExportJSON)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 border-t ${isDarkMode ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:code" className="w-4 h-4 opacity-70" />
                    Export JSON
                  </button>
                )}
                {onCopyTSV && (
                  <button
                    type="button"
                    onClick={() => handleExport(onCopyTSV)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 border-t ${isDarkMode ? 'border-gray-800 hover:bg-gray-800 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:copy-01" className="w-4 h-4 opacity-70" />
                    Copy as TSV
                  </button>
                )}
                {onPrint && (
                  <button
                    type="button"
                    onClick={() => handleExport(onPrint)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:printer" className="w-4 h-4 opacity-70" />
                    Print Current View
                  </button>
                )}
                {onPrintAll && (
                  <button
                    type="button"
                    onClick={() => handleExport(onPrintAll)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium flex items-center gap-2.5 ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Icon icon="hugeicons:printer" className="w-4 h-4 opacity-70" />
                    Print All Rows
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showFullScreen && (
        <button
          type="button"
          onClick={onToggleFullScreen}
          className={iconBtnCls}
          title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          aria-label={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
