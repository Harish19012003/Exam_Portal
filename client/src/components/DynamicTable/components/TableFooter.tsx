import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../types';

interface TableFooterProps {
  page: number;
  pageSize: number;
  totalPages: number;
  filteredCount: number;
  totalCount: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  isDarkMode: boolean;
  selectedCount: number;
}

const PAGE_SIZES = PAGE_SIZE_OPTIONS;

export function TableFooter({
  page,
  pageSize,
  totalPages,
  filteredCount,
  totalCount,
  onPageChange,
  onPageSizeChange,
  isDarkMode,
  selectedCount,
}: TableFooterProps) {
  const start = Math.min((page - 1) * pageSize + 1, filteredCount);
  const end = Math.min(page * pageSize, filteredCount);

  // Generate page number buttons with ellipsis
  const pageNumsDesktop = getPageNumbers(page, totalPages, 5);
  const pageNumsMobile = getPageNumbers(page, totalPages, 3);

  const pageBtnBase = `w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center`;
  const pageBtnActive = `bg-[#13C296] text-white`;
  const pageBtnInactive = isDarkMode
    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
  const pageBtnEllipsis = isDarkMode ? 'text-gray-600' : 'text-gray-400';

  const arrowBtnBase = `w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-colors flex items-center justify-center`;
  const arrowEnabled = isDarkMode
    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700';
  const arrowDisabled = isDarkMode ? 'text-gray-700 cursor-not-allowed' : 'text-gray-200 cursor-not-allowed';

  return (
    <div data-dt-footer-bar className={`flex items-center justify-between px-4 py-3 border-t flex-shrink-0 flex-wrap gap-4
      ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
      
      {/* Left: count + rows per page */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {selectedCount > 0 && (
            <div className={`hidden sm:flex items-center px-2.5 py-1 rounded-md text-[12px] font-bold animate-[fadeIn_0.2s_ease-out]
              ${isDarkMode ? 'bg-[#13C296]/20 text-[#13C296]' : 'bg-[#13C296]/10 text-[#0f9f7a]'}`}>
              {selectedCount} selected
            </div>
          )}
          
          <p className={`hidden sm:block text-[12px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {filteredCount === 0 ? 'No results' : (
              <>
                <span className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{start}–{end}</span>
                {' of '}
                <span className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{filteredCount.toLocaleString()}</span>
                {filteredCount < totalCount && (
                  <span className={`hidden sm:inline ml-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    (filtered from {totalCount.toLocaleString()})
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <span className="hidden sm:inline">Rows per page:</span>
            <span className="sm:hidden">Row:</span>
          </span>
          <select
            value={pageSize}
            onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className={`text-[12px] font-bold rounded-lg border px-2 py-1 outline-none transition-all
              focus:ring-2 focus:ring-[#13C296]/20 focus:border-[#13C296] cursor-pointer
              ${isDarkMode
                ? 'bg-gray-800 border-gray-700 text-gray-200'
                : 'bg-white border-gray-200 text-gray-700'}`}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map(ps => (
              <option key={ps} value={ps}>{ps}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {/* Prev */}
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${arrowBtnBase} ${page === 1 ? arrowDisabled : arrowEnabled}`}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Page numbers (Desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            {pageNumsDesktop.map((num, i) =>
              num === '...' ? (
                <span key={`desk-e${i}`} className={`${pageBtnBase} ${pageBtnEllipsis}`} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={`desk-${num}`}
                  onClick={() => onPageChange(num as number)}
                  className={`${pageBtnBase} ${num === page ? pageBtnActive : pageBtnInactive}`}
                  aria-label={`Page ${num}`}
                  aria-current={num === page ? 'page' : undefined}
                >
                  {num}
                </button>
              )
            )}
          </div>

          {/* Page numbers (Mobile) */}
          <div className="flex sm:hidden items-center gap-0.5">
            {pageNumsMobile.map((num, i) =>
              num === '...' ? (
                <span key={`mob-e${i}`} className={`${pageBtnBase} ${pageBtnEllipsis}`} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={`mob-${num}`}
                  onClick={() => onPageChange(num as number)}
                  className={`${pageBtnBase} ${num === page ? pageBtnActive : pageBtnInactive}`}
                  aria-label={`Page ${num}`}
                  aria-current={num === page ? 'page' : undefined}
                >
                  {num}
                </button>
              )
            )}
          </div>

          {/* Next */}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${arrowBtnBase} ${page === totalPages ? arrowDisabled : arrowEnabled}`}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function getPageNumbers(
  current: number,
  total: number,
  maxButtons: number
): (number | '...')[] {
  if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1);
  
  if (maxButtons < 5) {
    let startPage = Math.max(1, current - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;
    if (endPage > total) {
      endPage = total;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    const res: (number | '...')[] = [];
    for (let i = startPage; i <= endPage; i++) res.push(i);
    return res;
  }

  const half = Math.floor(maxButtons / 2);
  const result: (number | '...')[] = [];

  if (current <= half + 1) {
    for (let i = 1; i <= maxButtons - 2; i++) result.push(i);
    result.push('...', total);
  } else if (current >= total - half) {
    result.push(1, '...');
    for (let i = total - (maxButtons - 3); i <= total; i++) result.push(i);
  } else {
    result.push(1, '...');
    for (let i = current - (half - 2); i <= current + (half - 2); i++) result.push(i);
    result.push('...', total);
  }

  return result;
}
