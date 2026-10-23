import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Check, WifiOff, Sparkles, Loader2 } from 'lucide-react';
import { DynamicIcon } from './DynamicIcon';
import { ICON_PICKER_CATEGORIES, POPULAR_OFFLINE_ICONS } from './popularOfflineIcons';

const GRID_COLS = 7;
const VISIBLE_ROWS = 6;
const PAGE_SIZE = GRID_COLS * VISIBLE_ROWS;
const MAX_API_LIMIT = 999;
const ICON_GRID_CLASS = 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2';
const ICON_SCROLL_CLASS =
  'overflow-y-auto max-h-[min(380px,calc(100dvh-15.5rem))] sm:max-h-[min(424px,calc(100dvh-14rem))] md:max-h-[424px]';
const ICON_TILE_CLASS =
  'flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all min-h-[44px] touch-manipulation';

export interface IconPickerModalProps {
  isOpen: boolean;
  currentIconName?: string;
  isDarkMode: boolean;
  onClose: () => void;
  onSelectIcon: (iconName: string) => void;
  title?: string;
  description?: string;
  descriptionMobile?: string;
  applyLabel?: string;
}

export function IconPickerModal({
  isOpen,
  currentIconName = 'external-link',
  isDarkMode,
  onClose,
  onSelectIcon,
  title = 'Choose Icon',
  description = 'Pick any local icon or search 200,000+ Iconify icons live with infinite lazy loading',
  descriptionMobile = 'Search Iconify icons or pick a local icon',
  applyLabel = 'Apply Icon',
}: IconPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedIcon, setSelectedIcon] = useState(currentIconName);

  const [iconifyResults, setIconifyResults] = useState<string[]>([]);
  const [hasMoreOnline, setHasMoreOnline] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const iconifyCountRef = useRef(0);

  useEffect(() => {
    iconifyCountRef.current = iconifyResults.length;
  }, [iconifyResults.length]);

  useEffect(() => {
    setSelectedIcon(currentIconName);
  }, [currentIconName, isOpen]);

  const fetchIconifyPage = useCallback(async (query: string, start: number, append = false) => {
    if (!query) return;
    if (append) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setIsLoadingMore(true);
    } else {
      loadingMoreRef.current = false;
      setIsSearchingOnline(true);
    }

    const limit = Math.min(Math.max(start + PAGE_SIZE, PAGE_SIZE), MAX_API_LIMIT);

    try {
      const res = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${limit}&start=${start}`,
      );
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();

      const newIcons = Array.isArray(data.icons) ? data.icons : [];
      const requestLimit = typeof data.limit === 'number' ? data.limit : limit;
      const responseTotal = typeof data.total === 'number' ? data.total : newIcons.length;
      const batchSize = newIcons.length;

      setIconifyResults(prev => (append ? Array.from(new Set([...prev, ...newIcons])) : newIcons));
      setIsOffline(false);

      if (append && batchSize === 0) {
        setHasMoreOnline(false);
      } else {
        setHasMoreOnline(
          batchSize >= PAGE_SIZE &&
            responseTotal === requestLimit &&
            requestLimit < MAX_API_LIMIT,
        );
      }
    } catch {
      setIsOffline(true);
      if (!append) {
        setIconifyResults([]);
        setHasMoreOnline(false);
      }
    } finally {
      loadingMoreRef.current = false;
      setIsSearchingOnline(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) {
      setIconifyResults([]);
      setHasMoreOnline(false);
      setIsSearchingOnline(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchIconifyPage(q, 0, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchIconifyPage]);

  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || isSearchingOnline || !hasMoreOnline) return;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    fetchIconifyPage(q, iconifyCountRef.current, true);
  }, [hasMoreOnline, isSearchingOnline, searchQuery, fetchIconifyPage]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = loadSentinelRef.current;
    if (!root || !sentinel || !hasMoreOnline || isSearchingOnline) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { root, rootMargin: '48px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreOnline, isSearchingOnline, handleLoadMore, iconifyResults.length]);

  const filteredLocalIcons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return POPULAR_OFFLINE_ICONS.filter(item => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchSearch = !q || item.name.includes(q) || item.label.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const isIconifySearch = searchQuery.trim().length >= 2 && !isOffline;
  const showCategoryFilters = !isIconifySearch;

  if (!isOpen) return null;

  const handleApply = () => {
    onSelectIcon(selectedIcon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`flex max-h-[min(92dvh,85vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          isDarkMode ? 'border-gray-800 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
        }`}
      >
        <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 sm:items-center sm:px-6 sm:py-4 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#13C296]/10 text-[#13C296]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-tight sm:text-base">{title}</h2>
              <p className={`mt-0.5 text-[11px] leading-snug sm:text-[12px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="hidden sm:inline">{description}</span>
                <span className="sm:hidden">{descriptionMobile}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`flex-shrink-0 rounded-lg p-2 transition-colors sm:p-1.5 ${
              isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            aria-label="Close icon picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`space-y-3 border-b p-3 sm:p-4 ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl border py-2.5 pl-9 pr-4 text-xs outline-none transition-all sm:py-2 ${
                isDarkMode
                  ? 'border-gray-700 bg-gray-800 text-gray-200 focus:border-[#13C296]'
                  : 'border-gray-200 bg-white text-gray-800 focus:border-[#13C296]'
              }`}
            />
          </div>

          {showCategoryFilters && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
              {ICON_PICKER_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1 text-[11px] font-semibold transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#13C296] text-white'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                        : 'bg-gray-200/70 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {isOffline && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Network Offline — Showing local Lucide icons fallback</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 p-3 sm:space-y-5 sm:p-4">
          {searchQuery.trim().length >= 2 && (
            <div>
              {isSearchingOnline && iconifyResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin text-[#13C296]" />
                  Searching icons...
                </div>
              ) : iconifyResults.length > 0 ? (
                <div ref={containerRef} className={ICON_SCROLL_CLASS}>
                  <div className={ICON_GRID_CLASS}>
                    {iconifyResults.map(iconKey => {
                      const isSelected = selectedIcon === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setSelectedIcon(iconKey)}
                          className={`${ICON_TILE_CLASS} ${
                            isSelected
                              ? 'border-[#13C296] bg-[#13C296]/10 text-[#13C296] ring-2 ring-[#13C296]/30'
                              : isDarkMode
                                ? 'border-gray-800 bg-gray-800/40 text-gray-300 hover:border-gray-700 hover:bg-gray-800'
                                : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <DynamicIcon iconName={iconKey} className="mb-1 h-5 w-5" />
                          <span className="max-w-full truncate text-center font-mono text-[9px] opacity-70">
                            {iconKey.split(':').pop()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div ref={loadSentinelRef} className="mt-4 flex min-h-[44px] items-center justify-center">
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#13C296]" />
                        Loading more icons...
                      </span>
                    ) : !hasMoreOnline && iconifyResults.length > 0 ? (
                      <span className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        All matching icons loaded
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : !isSearchingOnline ? (
                <div className={`py-4 text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No online Iconify icons found for &quot;{searchQuery}&quot;
                </div>
              ) : null}
            </div>
          )}

          {!(searchQuery.trim().length >= 2 && iconifyResults.length > 0) && (
            <div>
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Popular Local Icons ({filteredLocalIcons.length})
              </div>

              <div className={ICON_SCROLL_CLASS}>
                <div className={ICON_GRID_CLASS}>
                  {filteredLocalIcons.map(item => {
                    const isSelected = selectedIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setSelectedIcon(item.name)}
                        className={`${ICON_TILE_CLASS} ${
                          isSelected
                            ? 'border-[#13C296] bg-[#13C296]/10 text-[#13C296] ring-2 ring-[#13C296]/30'
                            : isDarkMode
                              ? 'border-gray-800 bg-gray-800/40 text-gray-300 hover:border-gray-700 hover:bg-gray-800'
                              : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <DynamicIcon iconName={item.name} className="mb-1 h-5 w-5" />
                        <span className="max-w-full truncate text-center font-mono text-[9px] opacity-70">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${isDarkMode ? 'border-gray-800 bg-gray-900/80' : 'border-gray-100 bg-gray-50/80'}`}>
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex-shrink-0 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Selected:</span>
            <div className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-[#13C296]/10 px-2.5 py-1 font-mono text-xs font-semibold text-[#13C296]">
              <DynamicIcon iconName={selectedIcon} className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{selectedIcon}</span>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:py-2 ${
                isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#13C296] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#10b088] sm:flex-none sm:py-2"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{applyLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
