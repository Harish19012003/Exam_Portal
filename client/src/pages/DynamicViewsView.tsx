import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table2, Rows3, LayoutGrid, Columns3, GitBranch, CalendarDays, Check, ChevronDown, Pin, CircleHelp } from 'lucide-react';
import { DynamicTable } from '../components/DynamicTable';
import { DynamicList } from '../components/DynamicList';
import { DynamicCard } from '../components/DynamicCard';
import { DynamicKanban } from '../components/DynamicKanban';
import { DynamicTree } from '../components/DynamicTree';
import { DynamicCalendar } from '../components/DynamicCalendar';
import {
  SummaryChipsChromeProvider,
  SummaryChipsEyeToggle,
} from '../components/DynamicData/SummaryChipsChrome';
import { useSummaryChipsStore, pruneSummaryChipsToColumnKeys } from '../components/DynamicData/summaryChipsStore';
import { useQuickFiltersStore, pruneQuickFilterFieldsToColumnKeys } from '../components/DynamicData/quickFiltersStore';
import { QuickFiltersBar, QuickFiltersVisibilityToggle } from '../components/DynamicData/QuickFiltersBar';
import { SummaryChipsBar } from '../components/DynamicTable/components/SummaryChipsBar';
import {
  useSharedColumns,
  useSharedRowsSnapshot,
  applyFilters,
  COLUMN_CONFIG,
  MOCK_ROWS,
  CustomizationTourProvider,
  useCustomizationTour,
} from '../components/DynamicData';

type ViewKey = 'table' | 'list' | 'card' | 'kanban' | 'tree' | 'calendar';

const DEFAULT_VIEW_STORAGE_KEY = 'dynamic_views_default_v1';

const VIEWS: { key: ViewKey; label: string; icon: typeof Table2 }[] = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'list', label: 'List', icon: Rows3 },
  { key: 'card', label: 'Card', icon: LayoutGrid },
  { key: 'kanban', label: 'Kanban', icon: Columns3 },
  { key: 'tree', label: 'Tree', icon: GitBranch },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const VIEW_KEYS = new Set<ViewKey>(VIEWS.map(v => v.key));

function loadDefaultView(): ViewKey {
  try {
    const raw = localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY);
    if (raw && VIEW_KEYS.has(raw as ViewKey)) return raw as ViewKey;
  } catch {
    // private mode
  }
  return 'table';
}

function saveDefaultView(key: ViewKey) {
  try {
    localStorage.setItem(DEFAULT_VIEW_STORAGE_KEY, key);
  } catch {
    // ignore
  }
}

const TOUR_VIEW: ViewKey = 'list';

function TourHelpButton({ isDarkMode }: { isDarkMode: boolean }) {
  const { startTour } = useCustomizationTour();
  return (
    <button
      type="button"
      onClick={startTour}
      title="Customization tour"
      aria-label="Start customization tour for Feature Builder and Record Designer"
      className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
        isDarkMode
          ? 'text-gray-500 hover:text-[#13C296] hover:bg-white/5'
          : 'text-gray-400 hover:text-[#0f9f7a] hover:bg-gray-50'
      }`}
    >
      <CircleHelp className="w-4 h-4" />
    </button>
  );
}

function DynamicViewsChrome({ isDarkMode }: { isDarkMode: boolean }) {
  const [defaultView, setDefaultView] = useState<ViewKey>(() => loadDefaultView());
  const [activeView, setActiveView] = useState<ViewKey>(() => loadDefaultView());
  const [mountedViews, setMountedViews] = useState<Set<ViewKey>>(
    () => new Set([loadDefaultView()]),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const summaryChips = useSummaryChipsStore();
  const quickFilters = useQuickFiltersStore();
  const columns = useSharedColumns(COLUMN_CONFIG);
  const liveRows = useSharedRowsSnapshot(MOCK_ROWS);
  const chipRows = useMemo(
    () => applyFilters(liveRows, quickFilters.activeFilters, columns),
    [liveRows, quickFilters.activeFilters, columns],
  );
  const showChipsBar =
    summaryChips.enabled && summaryChips.chips.length > 0 && summaryChips.visible;
  const showQuickFiltersBar =
    quickFilters.enabled && quickFilters.fieldKeys.length > 0 && quickFilters.visible;

  // Drop persisted chip/filter fields that no longer exist in the schema.
  useEffect(() => {
    const keys = columns.map(c => c.key);
    pruneSummaryChipsToColumnKeys(keys);
    pruneQuickFilterFieldsToColumnKeys(keys);
  }, [columns]);

  const switchView = (key: ViewKey) => {
    setActiveView(key);
    setMenuOpen(false);
    setMountedViews(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const makeDefault = (key: ViewKey) => {
    setDefaultView(key);
    saveDefaultView(key);
  };

  const prepareTourView = useCallback(() => {
    setActiveView(TOUR_VIEW);
    setMountedViews(prev => {
      const next = new Set(prev);
      next.add(TOUR_VIEW);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const active = VIEWS.find(v => v.key === activeView) ?? VIEWS[0];
  const ActiveIcon = active.icon;

  return (
    <CustomizationTourProvider
      isDarkMode={isDarkMode}
      autoStart
      onRequestTourView={prepareTourView}
    >
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden gap-2 lg:gap-3 max-lg:px-0 max-lg:pb-0 px-3 sm:px-4 lg:px-5 pb-3">
      {/* View switcher + shared chrome toggles (single instance — avoid mobile/desktop duplicates). */}
      <div className="flex-shrink-0 flex items-center gap-2 min-w-0 w-full max-lg:px-3">
        {/* Mobile: compact view dropdown */}
        <div className="sm:hidden relative w-fit" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            className={`flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[13px] font-semibold transition-colors ${
              isDarkMode
                ? 'bg-[#0e1a17] border-gray-800 text-gray-100'
                : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#13C296] text-white">
              <ActiveIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
            </span>
            {active.label}
            {defaultView === activeView && (
              <Pin className="w-3 h-3 text-[#13C296] fill-[#13C296]" aria-label="Default view" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          </button>

          {menuOpen && (
            <div
              role="listbox"
              className={`absolute left-0 top-full mt-1.5 z-30 min-w-[220px] rounded-xl border py-1 shadow-lg ${
                isDarkMode ? 'bg-[#0B1E19] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              {VIEWS.map(({ key, label, icon: Icon }) => {
                const selected = key === activeView;
                const isDefault = key === defaultView;
                return (
                  <div
                    key={key}
                    className={`flex w-full items-center gap-1 pr-1 ${
                      selected
                        ? isDarkMode
                          ? 'bg-[#13C296]/15'
                          : 'bg-[#13C296]/10'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => switchView(key)}
                      className={`flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                        selected
                          ? isDarkMode
                            ? 'text-[#13C296]'
                            : 'text-[#0f9f7a]'
                          : isDarkMode
                            ? 'text-gray-300 hover:bg-white/5'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
                      <span className="flex-1 truncate">{label}</span>
                      {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                    <button
                      type="button"
                      title={isDefault ? 'Default view on load' : 'Set as default view'}
                      aria-label={isDefault ? `${label} is the default view` : `Set ${label} as default view`}
                      onClick={() => makeDefault(key)}
                      className={`p-1.5 rounded-md flex-shrink-0 transition-colors ${
                        isDefault
                          ? 'text-[#13C296]'
                          : isDarkMode
                            ? 'text-gray-600 hover:text-gray-300 hover:bg-white/5'
                            : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Pin className={`w-3.5 h-3.5 ${isDefault ? 'fill-[#13C296]' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop: horizontal tabs */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar -mx-1 px-1 min-w-0">
          <div className={`flex items-center gap-1 p-1 rounded-xl border w-max ${isDarkMode ? 'bg-[#0e1a17] border-gray-800' : 'bg-white border-gray-200'}`}>
            {VIEWS.map(({ key, label, icon: Icon }) => {
              const isActive = activeView === key;
              const isDefault = defaultView === key;
              return (
                <div
                  key={key}
                  className={`group flex items-center rounded-lg ${
                    isActive
                      ? 'bg-[#13C296] text-white shadow-sm'
                      : isDarkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => switchView(key)}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-[13px] font-semibold transition-colors whitespace-nowrap"
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                    {label}
                  </button>
                  <button
                    type="button"
                    title={isDefault ? 'Default view on load' : 'Set as default view'}
                    aria-label={isDefault ? `${label} is the default view` : `Set ${label} as default view`}
                    onClick={() => makeDefault(key)}
                    className={`pr-2.5 py-1.5 transition-opacity ${
                      isDefault
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-50 hover:!opacity-100'
                    }`}
                  >
                    <Pin
                      className={`w-3 h-3 ${
                        isDefault
                          ? isActive
                            ? 'fill-white text-white'
                            : 'fill-[#13C296] text-[#13C296]'
                          : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex-shrink-0 flex items-center gap-0.5">
          <TourHelpButton isDarkMode={isDarkMode} />
          <QuickFiltersVisibilityToggle isDarkMode={isDarkMode} />
          <SummaryChipsEyeToggle isDarkMode={isDarkMode} />
        </div>
      </div>

      {showChipsBar && (
        <div className="flex-shrink-0 min-w-0 max-lg:px-3">
          <SummaryChipsBar
            chips={summaryChips.chips}
            columns={columns}
            rows={chipRows}
            isDarkMode={isDarkMode}
            visible
            hideToggle
          />
        </div>
      )}

      {showQuickFiltersBar && (
        <div className="flex-shrink-0 min-w-0 max-lg:px-3">
          <QuickFiltersBar columns={columns} rows={liveRows} isDarkMode={isDarkMode} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {mountedViews.has('table') && (
          <div className={activeView === 'table' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'} aria-hidden={activeView !== 'table'}>
            <DynamicTable isDarkMode={isDarkMode} />
          </div>
        )}
        {mountedViews.has('list') && (
          <div
            className={activeView === 'list' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}
            aria-hidden={activeView !== 'list'}
            {...(activeView === 'list' ? { 'data-tour-active-root': '' } : {})}
          >
            <DynamicList isDarkMode={isDarkMode} isTourHost />
          </div>
        )}
        {mountedViews.has('card') && (
          <div className={activeView === 'card' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'} aria-hidden={activeView !== 'card'}>
            <DynamicCard isDarkMode={isDarkMode} />
          </div>
        )}
        {mountedViews.has('kanban') && (
          <div className={activeView === 'kanban' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'} aria-hidden={activeView !== 'kanban'}>
            <DynamicKanban isDarkMode={isDarkMode} />
          </div>
        )}
        {mountedViews.has('tree') && (
          <div className={activeView === 'tree' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'} aria-hidden={activeView !== 'tree'}>
            <DynamicTree isDarkMode={isDarkMode} />
          </div>
        )}
        {mountedViews.has('calendar') && (
          <div className={activeView === 'calendar' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'} aria-hidden={activeView !== 'calendar'}>
            <DynamicCalendar isDarkMode={isDarkMode} />
          </div>
        )}
      </div>
    </div>
    </CustomizationTourProvider>
  );
}

export function DynamicViewsView({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <SummaryChipsChromeProvider>
      <DynamicViewsChrome isDarkMode={isDarkMode} />
    </SummaryChipsChromeProvider>
  );
}
