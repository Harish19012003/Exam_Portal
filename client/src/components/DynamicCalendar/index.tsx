import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react';
import {
  RecordDetail,
  RecordItem,
  RecordDesignSidebar,
  SoftRangeSlider,
  SettingRow,
  SettingToggle,
  DesignSectionLabel,
  ViewFeatureBuilder,
  DesignFooterButton,
  ViewToolbarActions,
  SummaryChipsEditor,
  QuickFiltersEditor,
  useFilteredRows,
  useRecordDesign,
  useSharedColumns,
  useSharedRows,
  useViewFeatures,
  useSummaryChipsStore,
  useQuickFiltersStore,
  COLUMN_CONFIG,
  MOCK_ROWS,
  isFieldColumn,
  ViewCountFooter,
  GlobalSearchInput,
  CALENDAR_FEATURE_ITEMS,
  CALENDAR_FEATURES_STORAGE_KEY,
} from '../DynamicData';
import {
  VIEW_TOOLBAR_BANNER_CLASS,
  viewToolbarBorderClass,
} from '../DynamicData/viewToolbarChrome';
import type { ColumnConfig, DataRow, FieldColumn } from '../DynamicData';
import { FieldCombobox } from '../DynamicTable/components/FieldCombobox';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboardTSV,
  handlePrint,
} from '../DynamicTable/export';
import { DEFAULT_CALENDAR_FEATURES } from './types';
import type { DynamicCalendarProps } from './types';
import {
  CALENDAR_DESIGN_STORAGE_KEY,
  CALENDAR_LAYOUTS,
  CALENDAR_OVERLAY_LAYOUT,
  createDefaultCalendarDesign,
} from './design';
import type { CalendarDesignConfig, CalendarLayoutKind } from './design';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_MOBILE = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface SelectedDay {
  key: string;
  date: Date;
}

function resolveDateColumn(columns: ColumnConfig[], dateFieldKey?: string): FieldColumn | undefined {
  if (dateFieldKey) {
    const col = columns.find(c => c.key === dateFieldKey);
    if (col && isFieldColumn(col)) return col;
  }
  const found = columns.find(c => isFieldColumn(c) && (c.dataType === 'date' || c.dataType === 'datetime'));
  return found && isFieldColumn(found) ? found : undefined;
}

function toDayKey(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonthGrid(monthDate: Date): { date: Date; inMonth: boolean }[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

/** Prefer today, else first day with events, else the 1st — always a day in `month`. */
function pickDayInMonth(
  month: Date,
  rowsByDay: Record<string, DataRow[]>,
  preferDayOfMonth?: number,
): SelectedDay {
  const y = month.getFullYear();
  const m = month.getMonth();
  const today = new Date();
  if (today.getFullYear() === y && today.getMonth() === m) {
    const date = new Date(y, m, today.getDate());
    return { key: toDayKey(date)!, date };
  }
  if (preferDayOfMonth != null) {
    const last = new Date(y, m + 1, 0).getDate();
    const date = new Date(y, m, Math.min(preferDayOfMonth, last));
    return { key: toDayKey(date)!, date };
  }
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const firstBusy = Object.keys(rowsByDay)
    .filter(k => k.startsWith(prefix))
    .sort()[0];
  if (firstBusy) {
    const [yy, mm, dd] = firstBusy.split('-').map(Number);
    return { key: firstBusy, date: new Date(yy, mm - 1, dd) };
  }
  const date = new Date(y, m, 1);
  return { key: toDayKey(date)!, date };
}

export function DynamicCalendar({ isDarkMode, initialColumns, initialRows, features }: DynamicCalendarProps) {
  const { features: cfg, toggleFeature } = useViewFeatures(
    CALENDAR_FEATURES_STORAGE_KEY,
    DEFAULT_CALENDAR_FEATURES,
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
  /** Mobile only: day list is a sheet; desktop keeps the side card always open. */
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  const { design, updateDesign, resetDesign } = useRecordDesign<CalendarDesignConfig>(
    CALENDAR_DESIGN_STORAGE_KEY,
    () => createDefaultCalendarDesign('chip', features?.dateFieldKey),
    Object.keys(CALENDAR_LAYOUTS) as CalendarLayoutKind[],
  );

  const patchDesign = useCallback(
    (patch: Partial<CalendarDesignConfig>) => {
      if (patch.layout === 'stack') {
        updateDesign({
          ...patch,
          subtitle: { ...(patch.subtitle ?? design.subtitle), show: true },
        });
        return;
      }
      if (patch.layout === 'chip') {
        updateDesign({
          ...patch,
          subtitle: { ...(patch.subtitle ?? design.subtitle), show: false },
        });
        return;
      }
      updateDesign(patch);
    },
    [design.subtitle, updateDesign],
  );

  const layoutDef = CALENDAR_LAYOUTS[design.layout as CalendarLayoutKind] ?? CALENDAR_LAYOUTS.chip;
  // Day list prefers email as subtitle — never an image URL (composites
  // sometimes bind the avatar field as secondary).
  const overlayDesign = useMemo(() => {
    const emailCol = columns.find(c => isFieldColumn(c) && c.dataType === 'email');
    const subtitleKey = design.subtitle.fieldKey;
    const subtitleCol = subtitleKey ? columns.find(c => c.key === subtitleKey) : undefined;
    const safeKey =
      subtitleCol && (subtitleCol.dataType === 'image' || subtitleCol.dataType === 'attachment')
        ? emailCol?.key
        : (subtitleKey ?? emailCol?.key);

    return {
      ...design,
      subtitle: { show: true, fieldKey: safeKey },
      status: { ...design.status, show: true },
    };
  }, [columns, design]);

  const cardClass = isDarkMode
    ? 'bg-[#0B1E19] border-gray-800'
    : 'bg-white border-gray-200';

  const dateColumn = useMemo(
    () => resolveDateColumn(columns, design.dateFieldKey ?? features?.dateFieldKey),
    [columns, design.dateFieldKey, features?.dateFieldKey],
  );

  const dateFields = useMemo(
    () =>
      columns.filter(
        c => isFieldColumn(c) && c.visible !== false && (c.dataType === 'date' || c.dataType === 'datetime'),
      ),
    [columns],
  );

  const filteredRows = useFilteredRows(rows, columns, {
    search: cfg.enableSearch ? search : '',
    filters: quickFilters.activeFilters,
  });

  const rowsByDay = useMemo(() => {
    const map: Record<string, DataRow[]> = {};
    if (!dateColumn) return map;
    filteredRows.forEach(r => {
      const key = toDayKey(r.values[dateColumn.key]);
      if (!key) return;
      (map[key] ??= []).push(r);
    });
    return map;
  }, [filteredRows, dateColumn]);

  const busiestMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(rowsByDay).forEach(dayKey => {
      const monthKey = dayKey.slice(0, 7);
      counts[monthKey] = (counts[monthKey] ?? 0) + rowsByDay[dayKey].length;
    });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!best) return new Date();
    const [y, m] = best[0].split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [rowsByDay]);

  const [currentMonth, setCurrentMonth] = useState<Date>(busiestMonth);
  const [selectedDay, setSelectedDay] = useState<SelectedDay>(() =>
    pickDayInMonth(busiestMonth, rowsByDay),
  );

  const grid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = toDayKey(new Date());
  const maxEvents = Math.min(6, Math.max(1, design.maxEventsPerDay || 3));

  const previewRow = useMemo(
    () => filteredRows[0] ?? rows[0] ?? null,
    [filteredRows, rows],
  );

  const shellClass = isDarkMode
    ? 'bg-transparent border-transparent hover:bg-white/10'
    : 'bg-transparent border-transparent hover:bg-gray-100';

  const goToMonth = useCallback((delta: number) => {
    setCurrentMonth(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      setSelectedDay(sel => pickDayInMonth(next, rowsByDay, sel.date.getDate()));
      return next;
    });
  }, [rowsByDay]);

  // Date input needs a full day — keep it locked to the focused day.
  const toolbarDateValue = selectedDay.key;

  /** Open / replace the focused day and keep the month grid aligned. */
  const goToSelectedDay = useCallback((date: Date) => {
    const key = toDayKey(date);
    if (!key) return;
    setSelectedDay({ key, date });
    setDaySheetOpen(true);
    setCurrentMonth(prev =>
      prev.getFullYear() === date.getFullYear() && prev.getMonth() === date.getMonth()
        ? prev
        : new Date(date.getFullYear(), date.getMonth(), 1),
    );
  }, []);

  /** Calendar cell: select day; on mobile, re-tap closes the sheet. */
  const focusDay = useCallback((date: Date) => {
    const key = toDayKey(date);
    if (!key) return;
    setSelectedDay(prev => {
      if (prev.key === key) {
        setDaySheetOpen(open => !open);
        return prev;
      }
      setDaySheetOpen(true);
      return { key, date };
    });
    setCurrentMonth(m =>
      m.getFullYear() === date.getFullYear() && m.getMonth() === date.getMonth()
        ? m
        : new Date(date.getFullYear(), date.getMonth(), 1),
    );
  }, []);

  const shiftSelectedDay = useCallback(
    (delta: number) => {
      const next = new Date(
        selectedDay.date.getFullYear(),
        selectedDay.date.getMonth(),
        selectedDay.date.getDate() + delta,
      );
      goToSelectedDay(next);
    },
    [goToSelectedDay, selectedDay],
  );

  const selectedDayRows = useMemo(
    () => rowsByDay[selectedDay.key] ?? [],
    [selectedDay, rowsByDay],
  );

  const selectedDayLabel = selectedDay.date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handleSaveRecord = useCallback((updated: DataRow) => {
    setRows(prev => prev.map(r => (r.rowId === updated.rowId ? updated : r)));
    setActiveRow(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  }, []);

  const monthNavButtons = (compact: boolean) => (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <button
        type="button"
        onClick={() => goToMonth(-1)}
        title="Previous month"
        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="relative inline-flex items-center justify-center px-1">
        <span
          className={`pointer-events-none font-bold tabular-nums whitespace-nowrap ${compact ? 'text-[12.5px]' : 'text-[13px]'} ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
        >
          {compact
            ? currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : monthLabel}
        </span>
        <input
          type="date"
          value={toolbarDateValue}
          onChange={e => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split('-').map(Number);
            goToSelectedDay(new Date(y, m - 1, d));
          }}
          onClick={e => {
            const el = e.currentTarget;
            try {
              if (typeof el.showPicker === 'function') {
                e.preventDefault();
                el.showPicker();
              }
            } catch {
              // Native date picker fallback
            }
          }}
          title="Jump to date"
          aria-label="Jump to date"
          className="absolute inset-0 z-10 cursor-pointer opacity-0
            [&::-webkit-calendar-picker-indicator]:absolute
            [&::-webkit-calendar-picker-indicator]:inset-0
            [&::-webkit-calendar-picker-indicator]:h-full
            [&::-webkit-calendar-picker-indicator]:w-full
            [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </div>
      <button
        type="button"
        onClick={() => goToMonth(1)}
        title="Next month"
        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (!dateColumn) {
    return (
      <div
        className={`flex h-full items-center justify-center rounded-2xl border ${isDarkMode ? 'bg-[#0B1E19] border-gray-800 text-gray-500' : 'bg-white border-gray-200 text-gray-400'}`}
      >
        <p className="text-[13px] font-medium">No date/datetime column available to plot.</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={
          isFullScreen
            ? `fixed inset-0 z-[9999] flex flex-col gap-2 sm:gap-3 overflow-hidden ${isDarkMode ? 'bg-[#0B1E19]' : 'bg-white'}`
            : 'relative flex h-full min-w-0 flex-1 flex-col gap-2 sm:gap-3 overflow-hidden'
        }
      >
        <div className="relative flex flex-1 min-h-0 gap-3 overflow-hidden">
          {/* Calendar card */}
          <div
            className={`relative flex min-w-0 flex-1 flex-col overflow-hidden max-lg:rounded-none max-lg:border-0 lg:rounded-2xl lg:border ${cardClass} ${isFullScreen ? 'rounded-none border-0' : ''}`}
          >
            {/* Toolbar: search + actions on row 1; month nav on its own mobile row */}
            <div
              className={`${VIEW_TOOLBAR_BANNER_CLASS} ${viewToolbarBorderClass(isDarkMode)} ${
                isDarkMode ? 'max-lg:bg-[#0B1E19]' : 'max-lg:bg-white'
              } lg:bg-transparent`}
            >
              {cfg.enableSearch && (
                <GlobalSearchInput
                  isDarkMode={isDarkMode}
                  value={search}
                  onChange={setSearch}
                  className="w-full sm:flex-1 sm:min-w-0 sm:max-w-[320px]"
                />
              )}

              {/* Desktop: month nav before actions */}
              <div className="hidden sm:flex items-center flex-shrink-0">
                {monthNavButtons(false)}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                <ViewToolbarActions
                  isDarkMode={isDarkMode}
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
                />
                {cfg.enableRefresh && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    title="Refresh"
                    className={`relative flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all active:scale-90 duration-200 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Mobile: month nav centered on its own row */}
              <div className="order-2 flex w-full basis-full items-center justify-center sm:hidden">
                {monthNavButtons(true)}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-1.5 sm:p-3">
              <p
                className={`px-1 pb-1.5 text-[10.5px] sm:text-[11px] font-medium truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
              >
                Plotted by{' '}
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{dateColumn.label}</span>
              </p>
              <div className="grid grid-cols-7 flex-shrink-0">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center font-bold uppercase tracking-wide py-1 sm:py-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                  >
                    <span className="text-[10px] sm:hidden">{WEEKDAYS_MOBILE[i]}</span>
                    <span className="hidden sm:inline text-[10.5px]">{d}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 grid-rows-6 gap-0.5 sm:gap-1 flex-1 min-h-0">
                {grid.map(({ date, inMonth }) => {
                  const key = toDayKey(date)!;
                  const dayRows = rowsByDay[key] ?? [];
                  const isToday = key === todayKey;
                  const isFocused = selectedDay.key === key;
                  const visible = dayRows.slice(0, maxEvents);
                  const overflow = dayRows.length - visible.length;
                  const mobileDots = dayRows.slice(0, 3);
                  const mobileExtra = dayRows.length - mobileDots.length;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => focusDay(date)}
                      className={`flex flex-col rounded-md sm:rounded-lg border p-0.5 sm:p-1.5 min-h-0 overflow-hidden text-left transition-colors
                        ${isFocused
                          ? isDarkMode
                            ? 'bg-[#13C296]/10 border-[#13C296]/50 ring-1 ring-[#13C296]/40'
                            : 'bg-[#13C296]/5 border-[#13C296]/40 ring-1 ring-[#13C296]/25'
                          : inMonth
                            ? isDarkMode
                              ? 'bg-[#0e1a17]/50 border-gray-800 hover:border-gray-700'
                              : 'bg-gray-50/80 border-gray-100 hover:border-gray-200'
                            : isDarkMode
                              ? 'bg-transparent border-gray-900 hover:border-gray-800'
                              : 'bg-gray-50/40 border-gray-100 hover:border-gray-200'
                        }`}
                    >
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold mb-0.5 sm:mb-1 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full self-start
                          ${isToday
                            ? 'bg-[#13C296] text-white'
                            : inMonth
                              ? isDarkMode
                                ? 'text-gray-300'
                                : 'text-gray-700'
                              : isDarkMode
                                ? 'text-gray-700'
                                : 'text-gray-300'
                          }`}
                      >
                        {date.getDate()}
                      </span>

                      {/* Mobile: event dots (cells are too narrow for chips) */}
                      <div className="sm:hidden flex-1 min-h-0 flex flex-col items-center justify-end gap-0.5 pb-0.5">
                        {dayRows.length > 0 && (
                          <div className="flex items-center justify-center gap-0.5">
                            {mobileDots.map(row => (
                              <span
                                key={row.rowId}
                                className="w-1.5 h-1.5 rounded-full bg-[#13C296] flex-shrink-0"
                              />
                            ))}
                            {mobileExtra > 0 && (
                              <span
                                className={`text-[8px] font-bold leading-none ml-0.5 ${isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}`}
                              >
                                +{mobileExtra}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Desktop: event chips */}
                      <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden flex-1 min-h-0">
                        {visible.map(row => (
                          <div
                            key={row.rowId}
                            className="flex-shrink-0"
                            onClick={e => {
                              e.stopPropagation();
                              if (cfg.enableOpenDetail) setActiveRow(row);
                            }}
                          >
                            <RecordItem
                              row={row}
                              columns={columns}
                              design={design}
                              layout={layoutDef}
                              isDarkMode={isDarkMode}
                              shellClass={shellClass}
                            />
                          </div>
                        ))}
                        {overflow > 0 && (
                          <span
                            className={`text-[9.5px] font-bold text-left px-1 flex-shrink-0 ${isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}`}
                          >
                            +{overflow} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredRows.length === 0 && (
              <div className="absolute inset-x-0 bottom-14 flex justify-center pointer-events-none px-3">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium ${isDarkMode ? 'bg-black/40 text-gray-400' : 'bg-white/90 text-gray-500'} shadow`}
                >
                  <Icon icon="hugeicons:search-01" className="w-3.5 h-3.5 opacity-60" />
                  No records match your search.
                </div>
              </div>
            )}

            <ViewCountFooter
              isDarkMode={isDarkMode}
              filteredCount={filteredRows.length}
              totalCount={rows.length}
              search={search}
              extras={
                <DesignFooterButton
                  isDarkMode={isDarkMode}
                  active={designOpen}
                  title="Design calendar"
                  onClick={() => {
                    setFeatureBuilderOpen(false);
                    setDesignOpen(o => !o);
                  }}
                />
              }
            />
          </div>

          {/* Mobile backdrop for day sheet */}
          {daySheetOpen && (
            <button
              type="button"
              aria-label="Close day list"
              onClick={() => setDaySheetOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-black/35"
            />
          )}

          {/* Day list — always beside calendar on desktop; bottom sheet on mobile */}
          <aside
            className={`flex flex-col flex-shrink-0 overflow-hidden border
              ${daySheetOpen
                ? 'fixed inset-x-0 bottom-0 z-40 max-h-[75vh] rounded-t-2xl shadow-2xl'
                : 'hidden'}
              md:relative md:inset-auto md:z-auto md:flex md:max-h-none md:w-[300px] lg:w-[320px]
              md:rounded-2xl md:shadow-sm md:border
              ${cardClass}`}
          >
            {/* Mobile drag affordance */}
            <div className="md:hidden flex justify-center pt-2 pb-0.5 flex-shrink-0">
              <span
                className={`w-9 h-1 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
              />
            </div>

            <div
              className={`relative flex items-center justify-between px-2.5 sm:px-3 py-2.5 sm:py-3 border-b flex-shrink-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}
            >
              <button
                type="button"
                onClick={() => shiftSelectedDay(-1)}
                title="Previous day"
                className={`relative z-10 p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Dead-centered; picker input sits on top of the label (same box) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="pointer-events-auto flex w-fit flex-col items-center">
                  <div className="relative inline-flex w-fit items-center gap-1.5 px-1 py-0.5">
                    <CalendarDays
                      className={`pointer-events-none w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-[#13C296]' : 'text-[#0f9f7a]'}`}
                    />
                    <span
                      className={`pointer-events-none text-[13px] font-bold tabular-nums leading-none ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
                    >
                      {selectedDayLabel}
                    </span>
                    <input
                      type="date"
                      value={selectedDay.key}
                      onChange={e => {
                        if (!e.target.value) return;
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        goToSelectedDay(new Date(y, m - 1, d));
                      }}
                      onClick={e => {
                        // Prefer showPicker while the input is laid out on the label
                        // so the popup anchors here — not at a detached off-screen node.
                        const el = e.currentTarget;
                        try {
                          if (typeof el.showPicker === 'function') {
                            e.preventDefault();
                            el.showPicker();
                          }
                        } catch {
                          // Native click / default picker is fine as fallback.
                        }
                      }}
                      title="Change date"
                      aria-label="Change date"
                      className="absolute inset-0 z-10 cursor-pointer opacity-0
                          [&::-webkit-calendar-picker-indicator]:absolute
                          [&::-webkit-calendar-picker-indicator]:inset-0
                          [&::-webkit-calendar-picker-indicator]:h-full
                          [&::-webkit-calendar-picker-indicator]:w-full
                          [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <p className={`text-[11px] mt-1 leading-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {selectedDayRows.length === 0
                      ? 'No records this day'
                      : `${selectedDayRows.length} ${selectedDayRows.length === 1 ? 'record' : 'records'}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => shiftSelectedDay(1)}
                title="Next day"
                className={`relative z-10 p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2.5 overscroll-contain">
              {selectedDayRows.length === 0 ? (
                <div
                  className={`flex flex-col items-center justify-center gap-2 py-10 px-4 text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
                >
                  <CalendarDays className="w-7 h-7 opacity-50" />
                  <p className="text-[12px] font-medium">Nothing plotted on this date.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pb-[env(safe-area-inset-bottom)]">
                  {selectedDayRows.map(row => (
                    <RecordItem
                      key={row.rowId}
                      row={row}
                      columns={columns}
                      design={overlayDesign}
                      layout={CALENDAR_OVERLAY_LAYOUT}
                      isDarkMode={isDarkMode}
                      shellClass={`${isDarkMode ? 'bg-[#0e1a17]/60 border-gray-800 hover:bg-[#122420]' : 'bg-gray-50/80 border-gray-100 hover:bg-gray-50'} border rounded-xl`}
                      onClick={
                        cfg.enableOpenDetail
                          ? () => setActiveRow(row)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {activeRow && (
          <RecordDetail
            row={activeRow}
            columns={columns}
            isDarkMode={isDarkMode}
            enableSubRows={false}
            onSave={handleSaveRecord}
            onClose={() => setActiveRow(null)}
          />
        )}

        <ViewFeatureBuilder
          isDarkMode={isDarkMode}
          isOpen={featureBuilderOpen}
          onToggleOpen={() => {
            setDesignOpen(false);
            setFeatureBuilderOpen(o => !o);
          }}
          onClose={() => setFeatureBuilderOpen(false)}
          items={CALENDAR_FEATURE_ITEMS}
          values={
            {
              ...cfg,
              enableSummaryChips: summaryChips.enabled,
              enableQuickFilters: quickFilters.enabled,
            } as Record<string, boolean | undefined>
          }
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
      </div>

      {designOpen && (
        <RecordDesignSidebar
          isDarkMode={isDarkMode}
          columns={columns}
          design={design}
          onChange={patchDesign}
          onReset={resetDesign}
          onClose={() => setDesignOpen(false)}
          layouts={CALENDAR_LAYOUTS}
          title="Calendar design"
          previewVariant="card"
          extras={
            <div>
              <DesignSectionLabel icon={CalendarDays} isDarkMode={isDarkMode}>
                Calendar
              </DesignSectionLabel>

              <div className="space-y-2.5">
                <SettingRow label="Date field" isDarkMode={isDarkMode}>
                  <FieldCombobox
                    value={dateColumn.key}
                    fields={dateFields}
                    isDarkMode={isDarkMode}
                    onChange={key => updateDesign({ dateFieldKey: key })}
                  />
                </SettingRow>

                <div
                  className={`rounded-xl border px-2.5 py-2 ${
                    isDarkMode ? 'border-gray-800 bg-[#0e1a17]/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <SettingRow
                    label="Events per day"
                    info='Extra events show as “+N more” — click the day for the full list'
                    isDarkMode={isDarkMode}
                    trailing={
                      <span className={`text-[11px] tabular-nums ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {maxEvents}
                      </span>
                    }
                  >
                    <SoftRangeSlider
                      isDarkMode={isDarkMode}
                      min={1}
                      max={6}
                      value={maxEvents}
                      onChange={v => updateDesign({ maxEventsPerDay: v })}
                      className="w-full"
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          }
          preview={
            previewRow ? (
              <div
                className={`rounded-lg border p-2 w-[140px] ${isDarkMode ? 'bg-[#0e1a17]/50 border-gray-800' : 'bg-white border-gray-100'}`}
              >
                <span
                  className={`text-[11px] font-bold mb-1.5 flex w-5 h-5 items-center justify-center rounded-full bg-[#13C296] text-white`}
                >
                  15
                </span>
                <div className="flex flex-col gap-0.5">
                  <RecordItem
                    row={previewRow}
                    columns={columns}
                    design={design}
                    layout={layoutDef}
                    isDarkMode={isDarkMode}
                    shellClass={shellClass}
                  />
                  {filteredRows[1] && (
                    <RecordItem
                      row={filteredRows[1]}
                      columns={columns}
                      design={design}
                      layout={layoutDef}
                      isDarkMode={isDarkMode}
                      shellClass={shellClass}
                    />
                  )}
                </div>
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
