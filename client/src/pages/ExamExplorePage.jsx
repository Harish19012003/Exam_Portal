import { useConfirm } from '../feedback';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../components/Button';
import { PageHeading, PageShell } from '../components/PageHeading';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  FilePlus2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import {
  CALLING_EXPAND_MODES,
  CALLING_LABEL_MODES,
  DEFAULT_EXAM_VIEW,
  EXAM_DAY_META_KEY,
  EXAM_DAY_VIEW,
  examViewLabel,
  isExamDayView,
  isExamViewKey,
  isOperatorGuardCallingView,
  isOwnRowSetView,
  isSharedImportedField,
  normalizeCallingExpand,
  normalizeCallingLabel,
  resolveCallingExpandForLabel,
} from '@exam-view/shared';
import { isCombinedField } from './exams/examCombinedFields';
import { isSummaryField } from './exams/examSummaryFields';
import { useSummaryDisplayRows } from './exams/useSummaryDisplayRows';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { applyFilters, applySearch } from '../components/DynamicData/dataProcessing';
import { useExamRows, useExamTableConfig, useInvalidateExams } from '../hooks/useExamsQuery';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { useAccess, applyColumnAccess, creatableFields, tablePermissions } from '../hooks/useAccess';
import { getExam } from './exams/examApi';
import {
  apiErrorMessage,
  bulkUpdateExamRows,
  createExamRow,
  createExamRowsBulk,
  createExamTable,
  deleteExamRows,
  getExamTable,
  listExamRows,
  saveExamTableConfig,
  syncCallingRows,
  updateExamRow,
  updateExamRowsBulkIndividual,
} from './exams/examTableApi';
import {
  buildMaxStatusFormula,
  examDayFieldKeysForHiddenShifts,
  examDayVisibleStatusKeys,
  expandCenterRowsToExamDay,
  isExamDayDerivedRole,
  isExamDayLiveCountRole,
  parseExamDayRowId,
  splitExamDayPersistPatch,
} from './exams/examDayExpand';
import { getStorageKey, loadTablePrefs } from '../components/DynamicTable/utils/prefsStorage';
import {
  listExamPresets,
  updateExamPreset,
  findPresetForService,
  presetsForView,
  diffPresetAgainstFields,
  fieldsFromPreset,
  mergePresetIntoFields,
} from './exams/examPresetApi';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { DateShiftsSelectModal } from './exams/DateShiftsSelectModal';
import { DateShiftVisibilityBar } from './exams/DateShiftVisibilityBar';
import { ExamCustomFieldInput } from './exams/ExamCustomFieldInput';
import { DEFAULT_EXAM_TABLE_FEATURES } from './exams/examTableConfig';
import { buildExamTableColumns, buildExamTableRows } from './exams/examTableAdapter';
import {
  normalizeUniqueRowAggregates,
  normalizeUniqueRowKeys,
  rollupRowsByUniqueKeys,
  siblingIdsForUniqueRow,
  uniqueAggregateTargetKeys,
} from './exams/examUniqueRows';
import {
  applyDateShiftColumnColors,
  applyDateShiftColumnWidths,
  buildDateShiftVisibilityGroups,
  DATE_SHIFT_ALL_DAY_KEY,
  FOCUS_MAX_ALL_DAY_COLUMN_KEY,
  FOCUS_TOTAL_CENTER_COLUMN_KEY,
  ensureFocusDateFields,
  focusDateColumnLabels,
  hasDateShiftTemplate,
  hiddenShiftIdsFromCenterVisibility,
  orderFocusDateColumns,
  mergeDateShiftFields,
  normalizeDateShiftsConfig,
  resolveDateShiftsConfig,
} from './exams/dateShiftsConfig';
import { clearLookupDisplayOverrides } from '../components/DynamicTable/editors/lookupDisplayOverrides';
import { clearLookupPicksForRow } from '../components/DynamicTable/editors/lookupPicks';
import { restoreAssigneeIds, useAssigneeDisplayRows } from './exams/useAssigneeLabels';
import { resolveAssigneeFieldsForImport } from './exams/resolveAssigneeImport';
import { restoreFromExamValues, useExamValueDisplayRows } from './exams/useExamValueDisplayRows';
import { restoreLookupIds, useLookupDisplayRows } from './exams/useLookupLabels';
import { groupSyncPatch, isFromExamField, isLinkedField, isTableSourceField, isUserTagsField } from './exams/tableLookupApi';
import { usePrefetchAssignablePeople } from './exams/useAssignablePeople';
import { useConfigLists } from './settings/useConfigLists';
import {
  defaultValueForType,
  groupFieldsForLayout,
  buildSameAsFlags,
  DATE_LINK_TYPES,
  loadExamFields,
} from './exams/examFieldTypes';
import {
  buildEmptyForm,
  hydrateFeatureStores,
  normalizeFeaturesDraft,
  restoreFeatureStores,
  snapshotFeatureStores,
  validateFormFields,
} from './exams/examTableHelpers';
import { buildExamLabel } from './exams/examLabel';
import { SearchableSelect } from './exams/SearchableSelect';
import { ExamSubNav } from './exams/ExamSubNav';
import { examIdFromUrl, examPath } from './exams/examUrl';
import './ExamsPage.css';
import './ExamExplorePage.css';

/** Auto-filled, audit and computed fields are never copied when duplicating a row. */
const SKIP_DUPLICATE_KEYS = new Set([
  'created_by', 'createdby', 'created_by_user', 'modify_by', 'modified_by',
  'updated_by', 'modifyby', 'modifiedby', 'created_at', 'updated_at',
]);

const tableFeaturesFor = (saved) => ({
  ...DEFAULT_EXAM_TABLE_FEATURES,
  ...(saved || {}),
  enableAddColumn: false,
  enableAddRow: false,
  enableSubRows: false,
  enableTranspose: false,
  rowActions: (() => {
    const rowActions = {
      ...DEFAULT_EXAM_TABLE_FEATURES.rowActions,
      ...(saved?.rowActions || {}),
      showExplore: false,
    };
    // After forcing explore off, Edit+Delete-only lists must stay compact — don’t
    // keep a saved “default/comfortable” width that looks like left padding.
    if (!rowActions.showDuplicate) {
      rowActions.widthPreset = 'compact';
      rowActions.width = 72;
    }
    return rowActions;
  })(),
});

/**
 * How an admin gives a center list its fields: the preset for the exam's service, any other preset,
 * or (when `onStartBlank` is given) an empty list. Nothing is loaded until one of these is pressed.
 */
const PresetActions = ({ presets, matched, busy, onLoad, onStartBlank }) => {
  const [picked, setPicked] = useState('');
  const otherPresets = matched ? presets.filter((p) => p.id !== matched.id) : presets;
  const chosen = otherPresets.find((p) => p.id === picked);
  const presetOptions = otherPresets.map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.serviceValue} (${p.fieldCount} fields)`,
  }));

  return (
    <div className="exam-explore-preset-actions">
      {matched && (
        <div className="exam-explore-preset-rec">
          <div className="exam-explore-preset-rec-top">
            <span className="exam-explore-preset-rec-badge">
              <Sparkles size={12} strokeWidth={2.25} aria-hidden="true" />
              Recommended
            </span>
            <span className="exam-explore-preset-rec-count">{matched.fieldCount} fields</span>
          </div>
          <div className="exam-explore-preset-rec-body">
            <p
              className="exam-explore-preset-rec-name"
              title={`Matches this exam’s service “${matched.serviceValue}”`}
            >
              {matched.name || matched.serviceValue}
            </p>
          </div>
          <button
            type="button"
            className="exam-explore-create"
            onClick={() => onLoad(matched)}
            disabled={busy}
          >
            {busy ? 'Loading…' : 'Load preset'}
          </button>
        </div>
      )}

      {/* With a recommended preset the picker is hidden; it stays when nothing matches so a preset can still be chosen. */}
      {!matched && otherPresets.length > 0 && (
        <div className="exam-explore-preset-other">
          <div className="exam-explore-preset-other-row">
            <SearchableSelect
              className="exam-explore-preset-select"
              value={picked}
              options={presetOptions}
              onChange={setPicked}
              placeholder={matched ? 'Or choose another preset…' : 'Choose a preset…'}
              searchPlaceholder="Search by name or service…"
              searchThreshold={1}
              portal
              disabled={busy}
              ariaLabel="Choose a preset to load"
            />
            <button
              type="button"
              className="exam-explore-create secondary"
              onClick={() => chosen && onLoad(chosen)}
              disabled={busy || !chosen}
            >
              Load
            </button>
          </div>
        </div>
      )}

      {onStartBlank && (
        <button
          type="button"
          className="exam-explore-start-blank"
          onClick={onStartBlank}
          disabled={busy}
        >
          Start blank — build fields yourself
        </button>
      )}
    </div>
  );
};

export const ExamExplorePage = () => {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const params = useParams();
  const examId = examIdFromUrl(params.examId);
  const view = isExamViewKey(params.subTab) ? params.subTab : DEFAULT_EXAM_VIEW;
  const viewTitle = examViewLabel(view);
  const navigate = useNavigate();
  const configVersion = useConfigLists();
  const { setBreadcrumbTail } = useOutletContext() || {};
  const { access, can } = useAccess();
  /** Creating the table / changing its columns needs the explore table's configure right. */
  const isAdmin = can('exam_rows', 'configure');
  const canCreateRow = can('exam_rows', 'create');

  const [exam, setExam] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | error
  const [tableInfo, setTableInfo] = useState(null); // exam_tables row, or null when not created
  const [fields, setFields] = useState([]);
  const [features, setFeatures] = useState(() => tableFeaturesFor(null));
  const { invalidateRows, setRows: setRowsCache } = useInvalidateExams();
  const [rowsPage, setRowsPage] = useState(1);
  const [rowsPageSize, setRowsPageSize] = useState(15);
  /** Toolbar search (immediate). Debounced value drives API / unique-row filtering. */
  const [rowsSearchInput, setRowsSearchInput] = useState('');
  const [rowsSearch, setRowsSearch] = useState('');
  /** Header filters — server-applied for normal paging; client-applied in unique-import mode. */
  const [rowsFilters, setRowsFilters] = useState({});
  /** Focus exam date for Unique-import pages (sheet-style Total Center / Max All Day). */
  const [focusDateId, setFocusDateId] = useState('');
  /** Exam Day date filter — empty = Show All (filter expanded center×date rows). */
  const [examDayDateFilterId, setExamDayDateFilterId] = useState('');

  const [tableError, setTableError] = useState('');
  const [creating, setCreating] = useState(false);
  const [presets, setPresets] = useState([]);
  const [message, setMessage] = useState('');
  /** Floating Mass Edit job chip (top-right) while DB update runs after the modal closes. */
  const [massEditJob, setMassEditJob] = useState(null);
  // { status: 'running'|'success'|'error', label, detail?, progress? 0–100 }
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  /** Admin: wipe this page’s fields and load a preset from scratch. */
  const [isReloadPresetOpen, setIsReloadPresetOpen] = useState(false);
  const [reloadPresetId, setReloadPresetId] = useState('');
  const [isDateShiftsOpen, setIsDateShiftsOpen] = useState(false);
  const [isSavingDateShifts, setIsSavingDateShifts] = useState(false);
  const [importingExamDay, setImportingExamDay] = useState(false);
  const [syncingCalling, setSyncingCalling] = useState(false);
  /** { status, progress, detail, created, updated, hidden, centersProcessed, centersTotal } */
  const [callingSyncJob, setCallingSyncJob] = useState(null);
  const [shiftVisBarOpen, setShiftVisBarOpen] = useState(false);
  const [shiftVisApiEpoch, setShiftVisApiEpoch] = useState(0);
  /** Bumped when date×shift template widths/colors save — forces table remount. */
  const [dateShiftLayoutEpoch, setDateShiftLayoutEpoch] = useState(0);
  const tableVisibilityApiRef = useRef(null);
  const examDayPersistRef = useRef(null);
  const examDayTargetsRef = useRef({ all: [], filtered: [] });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({});
  const [sameAsFlags, setSameAsFlags] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [featuresDirty, setFeaturesDirty] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark',
  );

  const serverFieldsRef = useRef([]);
  const fieldsRef = useRef([]);
  const featuresRef = useRef(features);
  const lastSavedFeaturesRef = useRef(null);
  const prefetchAssignable = usePrefetchAssignablePeople();

  // Warm assignee picker cache while the table loads so the first cell open is fast.
  useEffect(() => {
    (fields || []).filter(isUserTagsField).forEach((f) => prefetchAssignable(f.userTagIds));
  }, [fields, prefetchAssignable]);
  const featuresSyncReadyRef = useRef(false);
  const saveTimerRef = useRef(null);
  fieldsRef.current = fields;
  featuresRef.current = features;

  const layoutTableId = tableInfo ? `exam_table_${tableInfo.id}_${view}_v1` : null;
  const {
    layoutReady,
    layoutPrefs: savedLayoutPrefs,
    layoutSource,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(layoutTableId, { enabled: Boolean(layoutTableId) });

  // Exam Day mirrors Center-list shift hide/show (OP S4 off → hide S4 family on Exam Day).
  const centerListLayoutTableId = tableInfo
    ? `exam_table_${tableInfo.id}_${DEFAULT_EXAM_VIEW}_v1`
    : null;
  const { layoutPrefs: centerListLayoutPrefs } = useTableLayoutPrefs(centerListLayoutTableId, {
    enabled: Boolean(isExamDayView(view) && centerListLayoutTableId),
  });

  /** After load/reload preset: force grid order to match fields until the user saves a layout. */
  const [columnOrderOverride, setColumnOrderOverride] = useState(null);
  const [presetOrderEpoch, setPresetOrderEpoch] = useState(0);

  const label = exam ? buildExamLabel(exam) : '';
  const viewPresets = useMemo(() => presetsForView(presets, view), [presets, view]);
  const matchedPreset = useMemo(
    () => findPresetForService(presets, exam?.values?.service, view),
    [presets, exam?.values?.service, view],
  );
  // A table nobody has laid out yet starts with the layout saved on its service's preset.
  const presetLayout = matchedPreset?.layout || null;
  const layoutPrefs = useMemo(() => {
    const base = savedLayoutPrefs || (layoutSource === 'none' ? presetLayout : null);
    if (Array.isArray(columnOrderOverride) && columnOrderOverride.length > 0) {
      return { ...(base && typeof base === 'object' ? base : {}), columnOrder: columnOrderOverride };
    }
    return base;
  }, [savedLayoutPrefs, layoutSource, presetLayout, columnOrderOverride]);

  const handleLayoutPrefsChange = useCallback(
    async (prefs) => {
      // User explicitly saved a layout — stop forcing preset field order.
      setColumnOrderOverride(null);
      return onLayoutPrefsChange?.(prefs);
    },
    [onLayoutPrefsChange],
  );

  /**
   * Load/reload/update preset writes fields[] order, but DynamicTable keeps an older layout
   * columnOrder (user/org/preset layout or browser draft). Align the grid to the applied fields.
   */
  const syncColumnOrderFromPresetFields = useCallback(
    async (snap, { persistUserLayout = true } = {}) => {
      const nextFields = Array.isArray(snap?.fields) ? snap.fields : [];
      const order = nextFields.map((f) => f?.key).filter(Boolean).map(String);
      if (!order.length) return;

      const tableId = snap?.table?.id || tableInfo?.id;
      const tid = tableId ? `exam_table_${tableId}_${view}_v1` : layoutTableId;
      if (tid) {
        try {
          localStorage.removeItem(getStorageKey(tid));
        } catch {
          /* private mode / quota */
        }
      }

      setColumnOrderOverride(order);
      setPresetOrderEpoch((n) => n + 1);

      if (!persistUserLayout || !tid || !onLayoutPrefsChange) return;
      const base =
        (savedLayoutPrefs && typeof savedLayoutPrefs === 'object' ? savedLayoutPrefs : null) ||
        (presetLayout && typeof presetLayout === 'object' ? presetLayout : null) ||
        {};
      try {
        await onLayoutPrefsChange({ ...base, columnOrder: order });
        // Persisted — override still needed until remount reads the new bundle; keep it.
      } catch {
        /* override alone still remounts the table in preset order */
      }
    },
    [tableInfo?.id, view, layoutTableId, onLayoutPrefsChange, savedLayoutPrefs, presetLayout],
  );

  const uniqueRowKeys = useMemo(() => {
    const fromExam = normalizeUniqueRowKeys(features?.uniqueRowKeys);
    if (fromExam.length) return fromExam;
    return normalizeUniqueRowKeys(matchedPreset?.features?.uniqueRowKeys);
  }, [features?.uniqueRowKeys, matchedPreset?.features?.uniqueRowKeys]);
  const uniqueRowAggregates = useMemo(() => {
    const fromExam = normalizeUniqueRowAggregates(features?.uniqueRowAggregates);
    if (fromExam.length) return fromExam;
    // Preset may have Count/Sum before the exam features were refreshed.
    return normalizeUniqueRowAggregates(matchedPreset?.features?.uniqueRowAggregates);
  }, [features?.uniqueRowAggregates, matchedPreset?.features?.uniqueRowAggregates]);
  const uniqueImportActive = uniqueRowKeys.length > 0;
  const aggregateTargetKeys = useMemo(
    () => uniqueAggregateTargetKeys(uniqueRowAggregates),
    [uniqueRowAggregates],
  );

  useEffect(() => {
    setRowsPage(1);
    setRowsFilters({});
    setRowsSearchInput('');
    setRowsSearch('');
    setFocusDateId('');
    setExamDayDateFilterId('');
    setColumnOrderOverride(null);
  }, [examId]);

  const uniqueRowKeysSig = uniqueRowKeys.join('|');
  useEffect(() => {
    if (uniqueImportActive) setRowsPage(1);
  }, [uniqueImportActive, uniqueRowKeysSig]);

  // Honor Feature Builder “Rows shown per page” for server-paginated fetches.
  useEffect(() => {
    const next = Number(features?.defaultPageSize);
    if (![10, 15, 25, 50, 100, 200, 500].includes(next)) return;
    setRowsPageSize(next);
    setRowsPage(1);
  }, [features?.defaultPageSize]);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = String(rowsSearchInput || '').trim();
      setRowsSearch((prev) => {
        if (prev === next) return prev;
        setRowsPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [rowsSearchInput]);

  const rowSearchKeys = useMemo(
    () => (fields || []).map((f) => String(f.key || '').trim()).filter(Boolean),
    [fields],
  );

  const examDayLive = isExamDayView(view);
  const callingLive = isOperatorGuardCallingView(view);
  const callingLabel = useMemo(() => {
    if (features?.callingLabel != null) return normalizeCallingLabel(features.callingLabel);
    return normalizeCallingLabel(matchedPreset?.features?.callingLabel);
  }, [features?.callingLabel, matchedPreset?.features?.callingLabel]);
  const callingExpand = useMemo(() => {
    const raw =
      features?.callingExpand != null
        ? features.callingExpand
        : matchedPreset?.features?.callingExpand;
    return resolveCallingExpandForLabel(raw, callingLabel);
  }, [features?.callingExpand, matchedPreset?.features?.callingExpand, callingLabel]);
  // Unique import / Exam Day: load every shared center (no page-size cap), then page in the UI.
  // Exam Day expands Center list → center×date (same spreadsheet, different view).
  // Op/Guard Calling: own row bag with server pagination (never all:true).
  const rowsQuery = useExamRows(examId, {
    view: examDayLive ? DEFAULT_EXAM_VIEW : view,
    ...(uniqueImportActive || examDayLive
      ? { all: true }
      : {
          page: rowsPage,
          limit: rowsPageSize,
          search: rowsSearch,
          searchKeys: rowSearchKeys,
          filters: rowsFilters,
        }),
    enabled: Boolean(examId) && Boolean(tableInfo),
  });
  const rows = rowsQuery.data?.rows || [];
  const rowsTotal = Number(rowsQuery.data?.total) || 0;
  const rowsLoading =
    Boolean(tableInfo) && rowsQuery.isPending && !rowsQuery.data;
  const rowsPageKey =
    uniqueImportActive || examDayLive
      ? { all: true, view: examDayLive ? DEFAULT_EXAM_VIEW : view }
      : { page: rowsPage, limit: rowsPageSize, view };
  const presetWithDateShifts = useMemo(() => {
    if (matchedPreset && hasDateShiftTemplate(matchedPreset.features?.dateShifts)) {
      return matchedPreset;
    }
    return viewPresets.find((p) => hasDateShiftTemplate(p.features?.dateShifts)) || null;
  }, [matchedPreset, viewPresets]);
  const effectiveDateShifts = useMemo(
    () =>
      resolveDateShiftsConfig(
        features?.dateShifts,
        presetWithDateShifts?.features?.dateShifts,
      ),
    [features?.dateShifts, presetWithDateShifts],
  );
  // Unique-import + Exam Day consume Center list dates/shifts.
  const needsCenterDateShifts =
    (uniqueImportActive && view !== DEFAULT_EXAM_VIEW) || examDayLive;
  const centerTableQuery = useQuery({
    queryKey: queryKeys.exams.table(examId, DEFAULT_EXAM_VIEW),
    queryFn: () => getExamTable(examId, DEFAULT_EXAM_VIEW),
    enabled: Boolean(examId) && needsCenterDateShifts,
    staleTime: 60_000,
  });
  const centerListPreset = useMemo(
    () => findPresetForService(presets, exam?.values?.service, DEFAULT_EXAM_VIEW),
    [presets, exam?.values?.service],
  );
  const centerListDateShifts = useMemo(() => {
    if (!needsCenterDateShifts) return effectiveDateShifts;
    return resolveDateShiftsConfig(
      centerTableQuery.data?.features?.dateShifts,
      centerListPreset?.features?.dateShifts ||
        presetWithDateShifts?.features?.dateShifts ||
        effectiveDateShifts,
    );
  }, [
    needsCenterDateShifts,
    centerTableQuery.data?.features?.dateShifts,
    centerListPreset,
    presetWithDateShifts,
    effectiveDateShifts,
  ]);
  const centerListFields = useMemo(() => {
    const fromTable = centerTableQuery.data?.fields;
    if (Array.isArray(fromTable) && fromTable.length) return fromTable;
    if (Array.isArray(centerListPreset?.fields) && centerListPreset.fields.length) {
      return fieldsFromPreset(centerListPreset.fields);
    }
    return [];
  }, [centerTableQuery.data?.fields, centerListPreset]);
  /** Center-list columnVisibility (saved layout + browser draft) → hidden shift ids for Exam Day. */
  const hiddenExamDayShiftIds = useMemo(() => {
    if (!examDayLive) return new Set();
    const fromServer =
      (centerListLayoutPrefs && typeof centerListLayoutPrefs === 'object'
        ? centerListLayoutPrefs.columnVisibility
        : null) || {};
    const fromDraft =
      (centerListLayoutTableId ? loadTablePrefs(centerListLayoutTableId)?.columnVisibility : null) ||
      {};
    const columnVisibility = { ...fromServer, ...fromDraft };
    return hiddenShiftIdsFromCenterVisibility({
      dateShiftsConfig: centerListDateShifts,
      centerListFields,
      columnVisibility,
    });
  }, [
    examDayLive,
    centerListLayoutPrefs,
    centerListLayoutTableId,
    centerListDateShifts,
    centerListFields,
  ]);
  const focusDateOptions = useMemo(
    () =>
      (centerListDateShifts?.dates || []).map((d) => ({
        value: String(d.id),
        label: String(d.title || d.id),
      })),
    [centerListDateShifts],
  );
  // Focus-date picker is Unique-import only (renames Total Center / Max All Day columns).
  const canFocusExamDate =
    uniqueImportActive &&
    focusDateOptions.length > 0 &&
    hasDateShiftTemplate(centerListDateShifts);
  // Exam Day date filter — Show All by default; optional filter by __examDayDateId.
  const canFilterExamDayDate =
    examDayLive &&
    focusDateOptions.length > 0 &&
    hasDateShiftTemplate(centerListDateShifts);
  const examDayDateFilterOptions = useMemo(
    () => [{ value: '', label: 'Show All' }, ...focusDateOptions],
    [focusDateOptions],
  );
  useEffect(() => {
    if (!canFocusExamDate) {
      if (focusDateId) setFocusDateId('');
      return;
    }
    const stillValid = focusDateOptions.some((o) => o.value === focusDateId);
    if (!stillValid) setFocusDateId(focusDateOptions[0].value);
  }, [canFocusExamDate, focusDateOptions, focusDateId]);
  useEffect(() => {
    if (!canFilterExamDayDate) {
      if (examDayDateFilterId) setExamDayDateFilterId('');
      return;
    }
    if (!examDayDateFilterId) return;
    const stillValid = focusDateOptions.some((o) => o.value === examDayDateFilterId);
    if (!stillValid) setExamDayDateFilterId('');
  }, [canFilterExamDayDate, focusDateOptions, examDayDateFilterId]);
  const focusDateTitle =
    focusDateOptions.find((o) => o.value === focusDateId)?.label || '';
  const focusLabels = useMemo(
    () => (focusDateId && focusDateTitle ? focusDateColumnLabels(focusDateTitle) : null),
    [focusDateId, focusDateTitle],
  );
  const focusCountTargetKey = useMemo(() => {
    const rule = uniqueRowAggregates.find((r) => r.op === 'count');
    return rule?.targetKey || '';
  }, [uniqueRowAggregates]);
  const focusSumTargetKey = useMemo(() => {
    const rule = uniqueRowAggregates.find(
      (r) =>
        r.op === 'sum' &&
        (r.sourceKey === DATE_SHIFT_ALL_DAY_KEY || /allday/i.test(String(r.sourceKey || ''))),
    );
    return rule?.targetKey || '';
  }, [uniqueRowAggregates]);
  const tableColumns = useMemo(() => {
    const cols = applyColumnAccess(
      buildExamTableColumns(fields, { dateShifts: effectiveDateShifts }),
      'exam_rows',
      access,
    );
    const fieldByKey = new Map((fields || []).map((f) => [f.key, f]));
    const hiddenKeys =
      examDayLive && hiddenExamDayShiftIds.size
        ? examDayFieldKeysForHiddenShifts({
            fields,
            centerListDateShifts,
            hiddenShiftIds: hiddenExamDayShiftIds,
          })
        : null;
    const visibleStatusKeys =
      examDayLive && hiddenExamDayShiftIds.size
        ? examDayVisibleStatusKeys({
            fields,
            centerListDateShifts,
            hiddenShiftIds: hiddenExamDayShiftIds,
          })
        : null;
    const maxStatusFormula =
      visibleStatusKeys && visibleStatusKeys.length
        ? buildMaxStatusFormula(visibleStatusKeys)
        : null;
    const mapped = cols
      .filter((c) => !hiddenKeys || !hiddenKeys.has(c.key))
      .map((c) => {
        let next = c;
        if (aggregateTargetKeys.has(c.key)) next = { ...next, editable: false };
        // Exam Day live counts / derived status+timestamps / max come from Center list or Reached.
        if (examDayLive) {
          const field = fieldByKey.get(c.key);
          const role = String(field?.examDayImportRole || '');
          if (isExamDayLiveCountRole(role) || isExamDayDerivedRole(role)) {
            next = { ...next, editable: false };
          }
          // Max Status only rolls up shifts still visible on Center list.
          if (maxStatusFormula && (role === 'maxStatus' || c.key === 'max_status')) {
            next = { ...next, formula: maxStatusFormula, editable: false };
          }
        }
        // Real fields Date Total Center / Date Max All Day → `{date} …` headers.
        if (focusLabels && c.key === FOCUS_TOTAL_CENTER_COLUMN_KEY) {
          next = { ...next, label: focusLabels.totalCenter, editable: false };
        } else if (focusLabels && c.key === FOCUS_MAX_ALL_DAY_COLUMN_KEY) {
          next = { ...next, label: focusLabels.maxAllDay, editable: false };
        }
        return next;
      });
    // Always: Days Total Center → All Day Max → date Total Center → date Max All Day.
    return orderFocusDateColumns(mapped, {
      countTargetKey: focusCountTargetKey,
      sumTargetKey: focusSumTargetKey,
    });
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [
    fields,
    effectiveDateShifts,
    access,
    configVersion,
    aggregateTargetKeys,
    focusLabels,
    focusCountTargetKey,
    focusSumTargetKey,
    examDayLive,
    hiddenExamDayShiftIds,
    centerListDateShifts,
  ]);
  // Exam Day is a live Center-list view — do not offer row delete (would look like wiping centers).
  const tablePerms = useMemo(() => {
    const base = tablePermissions(access, 'exam_rows');
    if (!examDayLive) return base;
    return { ...base, delete: false };
  }, [access, examDayLive]);
  const createFields = useMemo(
    () => creatableFields(fields, 'exam_rows', access).filter((f) => !isCombinedField(f) && !isSummaryField(f)),
    [fields, access],
  );
  const examConfigQuery = useExamTableConfig();
  const examSourceFields = useMemo(() => {
    const fromQuery = examConfigQuery.data?.fields;
    if (Array.isArray(fromQuery) && fromQuery.length) return fromQuery;
    // Fallback while config query loads / if server config is empty but local schema exists.
    return loadExamFields();
  }, [examConfigQuery.data]);
  const savedTableRows = useMemo(() => buildExamTableRows(rows), [rows]);
  // Table-column fields store a row id; the table shows that row's current label.
  const lookupDisplayRows = useLookupDisplayRows(savedTableRows, fields);
  // User-tag assignee fields store user ids; show names.
  const assigneeDisplayRows = useAssigneeDisplayRows(lookupDisplayRows, fields);
  // From-exam fields mirror parent exam.values onto every center row.
  const tableRows = useExamValueDisplayRows(assigneeDisplayRows, fields, exam?.values, examSourceFields);
  const uniqueAllRows = useMemo(() => {
    if (!uniqueImportActive) return tableRows;
    return rollupRowsByUniqueKeys(tableRows, uniqueRowKeys, uniqueRowAggregates, {
      // Prefer Center list dateShifts so focus-date columns use real shift cells.
      dateShifts: centerListDateShifts,
      fields,
      // Full table columns so Where can evaluate formula cells the same way the grid does.
      columns: tableColumns,
      focusDateId: canFocusExamDate ? focusDateId : '',
    });
  }, [
    tableRows,
    uniqueImportActive,
    uniqueRowKeys,
    uniqueRowAggregates,
    centerListDateShifts,
    fields,
    tableColumns,
    canFocusExamDate,
    focusDateId,
  ]);
  // Exam Day: same Center list rows, expanded to one row per center × date.
  const examDayAllRows = useMemo(() => {
    if (!examDayLive) return tableRows;
    const { rows: expanded } = expandCenterRowsToExamDay({
      centerRows: tableRows,
      dateShiftsConfig: centerListDateShifts,
      targetFields: fields,
    });
    return expanded;
  }, [examDayLive, tableRows, centerListDateShifts, fields]);
  const summaryLiveRows = useMemo(() => {
    const map = {};
    if (examDayLive) {
      map[EXAM_DAY_VIEW] = examDayAllRows;
      map[DEFAULT_EXAM_VIEW] = tableRows;
    } else if (uniqueImportActive) {
      map[view] = uniqueAllRows;
    }
    return map;
  }, [examDayLive, examDayAllRows, tableRows, uniqueImportActive, uniqueAllRows, view]);
  const summaryInputRows = examDayLive ? examDayAllRows : uniqueImportActive ? uniqueAllRows : tableRows;
  const rowsWithSummary = useSummaryDisplayRows(summaryInputRows, fields, {
    examId,
    liveRowsByView: summaryLiveRows,
  });
  // Unique / Exam Day: search/filter the full derived set, then page — not only the visible slice.
  const derivedFilteredRows = useMemo(() => {
    if (!uniqueImportActive && !examDayLive) return rowsWithSummary;
    let next = rowsWithSummary;
    if (examDayLive && examDayDateFilterId) {
      next = next.filter(
        (r) => String(r.__examDayDateId || '') === String(examDayDateFilterId),
      );
    }
    if (rowsSearch) next = applySearch(next, rowsSearch, tableColumns, {});
    if (rowsFilters && Object.keys(rowsFilters).length) {
      next = applyFilters(next, rowsFilters, tableColumns);
    }
    return next;
  }, [
    uniqueImportActive,
    examDayLive,
    examDayDateFilterId,
    rowsWithSummary,
    rowsSearch,
    rowsFilters,
    tableColumns,
  ]);
  const displayTableRows = useMemo(() => {
    if (!uniqueImportActive && !examDayLive) return rowsWithSummary;
    const start = (rowsPage - 1) * rowsPageSize;
    return derivedFilteredRows.slice(start, start + rowsPageSize);
  }, [
    uniqueImportActive,
    examDayLive,
    rowsWithSummary,
    derivedFilteredRows,
    rowsPage,
    rowsPageSize,
  ]);
  const displayTotal =
    uniqueImportActive || examDayLive ? derivedFilteredRows.length : rowsTotal;

  const applySnapshot = useCallback((snap) => {
    const nextFields = Array.isArray(snap?.fields) ? snap.fields : [];
    const nextFeatures = tableFeaturesFor(snap?.features);
    serverFieldsRef.current = nextFields;
    if (snap) queryClient.setQueryData(queryKeys.exams.table(examId, view), snap);
    setTableInfo(snap?.exists ? snap.table : null);
    setFields(nextFields);
    setFeatures(nextFeatures);
    featuresRef.current = nextFeatures;
    lastSavedFeaturesRef.current = nextFeatures;
    setFeaturesDirty(false);
    hydrateFeatureStores(nextFeatures);
  }, [queryClient, examId, view]);

  const loadRows = useCallback(async () => {
    try {
      await invalidateRows(examId);
    } catch (err) {
      setMessage(apiErrorMessage(err, `Could not load ${viewTitle.toLowerCase()}`));
    }
  }, [examId, invalidateRows, viewTitle]);

  // Load the exam and this tab's field config; rows are shared across tabs via React Query.
  useEffect(() => {
    let cancelled = false;
    const snapshot = snapshotFeatureStores();
    featuresSyncReadyRef.current = false;
    // Switching between an exam's tabs remounts this page: cached data renders without a spinner.
    if (!queryClient.getQueryData(queryKeys.exams.detail(examId))) setStatus('loading');
    setTableError('');

    (async () => {
      let examData;
      try {
        examData = await queryClient.fetchQuery({
          queryKey: queryKeys.exams.detail(examId),
          queryFn: () => getExam(examId),
        });
      } catch (err) {
        if (!cancelled) setStatus(err?.response?.status === 404 ? 'missing' : 'error');
        return;
      }
      let snap = null;
      try {
        snap = await queryClient.fetchQuery({
          queryKey: queryKeys.exams.table(examId, view),
          queryFn: () => getExamTable(examId, view),
        });
      } catch (err) {
        if (!cancelled) setTableError(apiErrorMessage(err, 'Could not load the exam table'));
      }
      if (cancelled) return;
      setExam(examData);
      applySnapshot(snap);
      setStatus('ready');
      // Presets are offered when there is no table yet, when it is empty, and to spot a preset that
      // has newer field settings than this list's copy.
      queryClient
        .fetchQuery({ queryKey: queryKeys.exams.presets(), queryFn: listExamPresets })
        .then((list) => !cancelled && setPresets(list))
        .catch(() => {});
      window.setTimeout(() => {
        if (!cancelled) featuresSyncReadyRef.current = true;
      }, 1200);
    })();

    return () => {
      cancelled = true;
      featuresSyncReadyRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      restoreFeatureStores(snapshot);
    };
  }, [examId, view, applySnapshot, queryClient]);

  useEffect(() => {
    // Not cleared on unmount: switching sections remounts this page, and the layout ignores a
    // label that belongs to a different exam.
    if (label) setBreadcrumbTail?.(label, examId);
  }, [label, examId, setBreadcrumbTail]);

  useEffect(() => {
    const syncTheme = () => {
      const root = document.documentElement;
      setIsDarkMode(root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark'));
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(''), 4200);
    return () => clearTimeout(t);
  }, [message]);

  /* ---------- Fields drawer: auto-saves field definitions ---------- */

  const fieldsSaveLockRef = useRef(false);
  const saveFields = useCallback(async () => {
    if (fieldsSaveLockRef.current) return;
    const next = fieldsRef.current;
    const nextKeys = new Set(next.map((f) => f.key));
    const removed = serverFieldsRef.current.filter((f) => !nextKeys.has(f.key));
    if (removed.length) {
      fieldsSaveLockRef.current = true;
      const labels = removed.map((f) => f.label || f.key);
      const preview =
        labels.length <= 3
          ? labels.join(', ')
          : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;
      try {
        const ok = await confirm({
          title: labels.length === 1 ? 'Remove column?' : `Remove ${labels.length} columns?`,
          message: `Remove ${preview}?`,
          tertiary:
            'This permanently deletes the column and all data stored in it on this page. This cannot be undone. Tip: to apply a preset, use “Reload from preset” instead of deleting fields one by one.',
          confirmLabel: labels.length === 1 ? 'Remove' : `Remove ${labels.length}`,
          destructive: true,
        });
        if (!ok) {
          setFields(serverFieldsRef.current);
          return;
        }
      } finally {
        fieldsSaveLockRef.current = false;
      }
    }
    fieldsSaveLockRef.current = true;
    try {
      setMessage(removed.length ? `Saving — removing ${removed.length} columns…` : 'Saving fields…');
      const snap = await saveExamTableConfig(examId, {
        fields: next,
        confirmDrops: removed.length > 0,
        view,
      });
      serverFieldsRef.current = snap.fields;
      setMessage(`${viewTitle} fields saved`);
      await loadRows();
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not save the table columns'));
      try {
        applySnapshot(await getExamTable(examId, view));
      } catch {
        // keep local state
      }
    } finally {
      fieldsSaveLockRef.current = false;
    }
  }, [examId, view, viewTitle, applySnapshot, loadRows, confirm]);

  const handleFieldsChange = useCallback(
    (nextFields) => {
      setFields(nextFields);
      fieldsRef.current = nextFields;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveFields, 700);
    },
    [saveFields],
  );

  // Persist Date Total Center / Date Max All Day (for formulas) in fixed order after count/sum.
  useEffect(() => {
    if (!isAdmin || !uniqueImportActive || !fields.length) return;
    if (!focusCountTargetKey && !focusSumTargetKey) return;
    const { fields: next, changed } = ensureFocusDateFields(fields, {
      countTargetKey: focusCountTargetKey,
      sumTargetKey: focusSumTargetKey,
    });
    if (!changed) return;
    handleFieldsChange(next);
  }, [
    isAdmin,
    uniqueImportActive,
    fields,
    focusCountTargetKey,
    focusSumTargetKey,
    handleFieldsChange,
  ]);

  /** Apply selected dates → expand/replace date-shift columns from the Bulk-add template. */
  const handleApplyDateShifts = useCallback(
    async (nextDateShifts) => {
      if (!isAdmin) return;
      const cfg = normalizeDateShiftsConfig(nextDateShifts);
      const nextFields = mergeDateShiftFields(fieldsRef.current, cfg);
      if (nextFields.length > 100) {
        setMessage('Too many columns (max 100). Remove some dates or shifts and try again.');
        return;
      }
      const nextFeatures = { ...featuresRef.current, dateShifts: cfg };
      setIsSavingDateShifts(true);
      try {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        const snap = await saveExamTableConfig(examId, {
          fields: nextFields,
          features: nextFeatures,
          confirmDrops: true,
          view,
        });
        serverFieldsRef.current = snap.fields;
        setFields(snap.fields);
        fieldsRef.current = snap.fields;
        const savedFeatures = tableFeaturesFor(snap.features);
        setFeatures(savedFeatures);
        featuresRef.current = savedFeatures;
        lastSavedFeaturesRef.current = savedFeatures;
        setFeaturesDirty(false);
        setIsDateShiftsOpen(false);
        const n = (cfg.dates || []).length;
        setMessage(
          n
            ? `Date shifts applied · ${n} date${n === 1 ? '' : 's'}`
            : 'Date-shift columns cleared',
        );
        await loadRows();
      } catch (err) {
        setMessage(apiErrorMessage(err, 'Could not apply date shifts'));
      } finally {
        setIsSavingDateShifts(false);
      }
    },
    [isAdmin, examId, view, loadRows],
  );

  /* ---------- Feature Builder ---------- */

  const handleFeaturesChange = useCallback((draft) => {
    if (!isAdmin) return;
    // Feature Builder drafts omit dateShifts — keep the exam's template/colors.
    const next = tableFeaturesFor(
      normalizeFeaturesDraft({
        ...featuresRef.current,
        ...(draft || {}),
        dateShifts: draft?.dateShifts ?? featuresRef.current?.dateShifts,
      }),
    );
    setFeatures(next);
    featuresRef.current = next;
    if (!featuresSyncReadyRef.current) {
      lastSavedFeaturesRef.current = next;
      setFeaturesDirty(false);
      return;
    }
    setFeaturesDirty(JSON.stringify(next) !== JSON.stringify(lastSavedFeaturesRef.current));
  }, [isAdmin]);

  const handleSaveFeatures = useCallback(async (draft) => {
    if (!isAdmin) return;
    const source = draft || featuresRef.current;
    const next = tableFeaturesFor(
      normalizeFeaturesDraft({
        ...featuresRef.current,
        ...(source || {}),
        dateShifts: source?.dateShifts ?? featuresRef.current?.dateShifts,
      }),
    );
    setFeatures(next);
    featuresRef.current = next;
    setIsSavingFeatures(true);
    try {
      await saveExamTableConfig(examId, { features: next, view });
      lastSavedFeaturesRef.current = next;
      setFeaturesDirty(false);
      setMessage(`Feature Builder settings saved for ${viewTitle}`);
    } catch (err) {
      setFeaturesDirty(true);
      setMessage(apiErrorMessage(err, 'Could not save the settings'));
    } finally {
      setIsSavingFeatures(false);
    }
  }, [isAdmin, examId, view, viewTitle]);

  const handleSaveLayoutAsDefault = useCallback(
    async (prefs) => {
      const result = await onSaveLayoutAsDefault?.(prefs);
      if (result?.message) setMessage(result.message);
      if (!result?.ok || !matchedPreset) return;
      const ok = await confirm({
        title: 'Also save to the preset?',
        message: `Use this table layout for every new exam list that loads the “${matchedPreset.name}” preset?`,
        tertiary: 'Lists that already have their own saved layout are not changed.',
        confirmLabel: 'Save to preset',
      });
      if (!ok) return;
      try {
        const saved = await updateExamPreset(matchedPreset.id, {
          name: matchedPreset.name,
          serviceValue: matchedPreset.serviceValue,
          view: matchedPreset.view,
          fields: matchedPreset.fields,
          features: matchedPreset.features ?? undefined,
          layout: prefs,
        });
        setPresets((list) => list.map((p) => (p.id === matchedPreset.id ? { ...p, ...saved } : p)));
        queryClient.setQueryData(queryKeys.exams.presets(), (list) =>
          Array.isArray(list) ? list.map((p) => (p.id === matchedPreset.id ? { ...p, ...saved } : p)) : list,
        );
        setMessage(`Layout saved to the “${matchedPreset.name}” preset`);
      } catch {
        setMessage('Could not save the layout to the preset');
      }
    },
    [onSaveLayoutAsDefault, matchedPreset, confirm, queryClient],
  );

  const handleResetLayoutToDefault = useCallback(async () => {
    setColumnOrderOverride(null);
    const result = await onResetLayoutToDefault?.();
    if (result?.message) setMessage(result.message);
  }, [onResetLayoutToDefault]);

  /* ---------- Rows ---------- */

  /**
   * Persist a row patch. Shared imports (Vendor Code, …) are writable on their home tab only —
   * Mass Edit used to strip them here, so the UI filled then cleared after save.
   * Exam Day virtual rows write back to the Center list source row (+ `__exam_day` per date).
   */
  const persistRowValues = async (rowId, values) => {
    // —— Exam Day live view: center×date row → patch Center list source ——
    if (examDayLive) {
      const parsed = parseExamDayRowId(rowId);
      if (!parsed) throw new Error('Invalid Exam Day row');
      const source = rows.find((r) => String(r.id) === String(parsed.sourceRowId));
      if (!source) throw new Error('Center row not found');
      const restored = restoreFromExamValues(
        restoreAssigneeIds(
          restoreLookupIds(values, source.values, fields, parsed.sourceRowId),
          source.values,
          fields,
          parsed.sourceRowId,
        ),
        source.values,
        fields,
      );
      const fieldByKey = new Map((fields || []).map((f) => [f.key, f]));
      const rawPatch = {};
      Object.entries(restored).forEach(([key, val]) => {
        const f = fieldByKey.get(key);
        if (!f || isCombinedField(f) || isSummaryField(f) || isFromExamField(f)) return;
        rawPatch[key] = val;
      });
      const { rootPatch, nextMeta } = splitExamDayPersistPatch({
        fields,
        dateId: parsed.dateId,
        previousCenterValues: source.values || {},
        patch: rawPatch,
        dateShiftsConfig: centerListDateShifts,
      });
      const centerPatch = { ...rootPatch };
      if (nextMeta) centerPatch[EXAM_DAY_META_KEY] = nextMeta;
      if (!Object.keys(centerPatch).length) return source;

      const touchedAt = new Date().toISOString();
      setRowsCache(
        examId,
        (prev) =>
          prev.map((r) =>
            String(r.id) === String(parsed.sourceRowId)
              ? {
                  ...r,
                  updatedAt: touchedAt,
                  values: {
                    ...(r.values || {}),
                    ...centerPatch,
                    updated_at: touchedAt,
                  },
                }
              : r,
          ),
        rowsPageKey,
      );
      const next = await updateExamRow(
        examId,
        parsed.sourceRowId,
        centerPatch,
        DEFAULT_EXAM_VIEW,
      );
      setRowsCache(
        examId,
        (prev) =>
          prev.map((r) =>
            String(r.id) === String(parsed.sourceRowId)
              ? {
                  ...(next || r),
                  values: {
                    ...((next || r).values || {}),
                    ...centerPatch,
                  },
                }
              : r,
          ),
        rowsPageKey,
      );
      return next;
    }

    const original = rows.find((r) => r.id === rowId);
    const restored = restoreFromExamValues(
      restoreAssigneeIds(
        restoreLookupIds(values, original?.values, fields, rowId),
        original?.values,
        fields,
        rowId,
      ),
      original?.values,
      fields,
    );

    const localPatch = {};
    const sharedByView = new Map();
    const fieldByKey = new Map((fields || []).map((f) => [f.key, f]));
    // Calling rows live in a separate collection — never PATCH exam_rows with a Calling id.
    const ownRowSet = isOwnRowSetView(view);
    Object.entries(restored).forEach(([key, val]) => {
      const f = fieldByKey.get(key);
      if (!f || isCombinedField(f) || isSummaryField(f) || isFromExamField(f)) return;
      if (isSharedImportedField(f)) {
        const home = String(f.sharedFromView || '').trim();
        // Same tab, or Calling/own-row: keep the value on this row (phone sync, linked fills, …).
        if (!home || home === view || ownRowSet) {
          localPatch[key] = val;
          return;
        }
        if (!sharedByView.has(home)) sharedByView.set(home, {});
        sharedByView.get(home)[key] = val;
        return;
      }
      localPatch[key] = val;
    });

    // Unique-key rollup shows one row per group — write the patch to every sibling
    // so refresh still shows the value no matter which member becomes the representative.
    const targetIds = uniqueImportActive
      ? siblingIdsForUniqueRow(rows, rowId, uniqueRowKeys)
      : [String(rowId)];
    const idSet = new Set(targetIds.map(String));
    const mergedPatch = { ...localPatch };
    for (const patch of sharedByView.values()) Object.assign(mergedPatch, patch);

    // Optimistic paint on every sibling (and every cached page size) before API returns.
    const touchedAt = new Date().toISOString();
    const optimisticValues = { ...restored, ...mergedPatch };
    setRowsCache(
      examId,
      (prev) =>
        prev.map((r) =>
          idSet.has(String(r.id))
            ? {
                ...r,
                updatedAt: touchedAt,
                values: {
                  ...(r.values || {}),
                  ...optimisticValues,
                  updated_at: touchedAt,
                },
              }
            : r,
        ),
      rowsPageKey,
    );

    let next = original;
    // One round-trip: single row PATCH, or one bulk for the whole unique group.
    if (Object.keys(localPatch).length) {
      if (targetIds.length > 1) {
        await bulkUpdateExamRows(examId, { ids: targetIds, values: localPatch, view });
        next = { ...original, values: { ...(original?.values || {}), ...localPatch } };
      } else {
        next = await updateExamRow(examId, rowId, localPatch, view);
      }
    }
    for (const [homeView, patch] of sharedByView) {
      // Home-tab write uses this page's row ids (same spreadsheet). Never replace `next` with
      // another view's row document — that wiped Calling cells after a secondary PATCH.
      if (targetIds.length > 1) {
        await bulkUpdateExamRows(examId, { ids: targetIds, values: patch, view: homeView });
      } else {
        await updateExamRow(examId, rowId, patch, homeView);
      }
      next = {
        ...(next || original),
        values: { ...((next || original)?.values || {}), ...patch },
      };
    }
    clearLookupPicksForRow(String(rowId));
    clearLookupDisplayOverrides(String(rowId));
    if (Object.keys(mergedPatch).length) {
      // Merge the patch onto every sibling in cache (not only the edited id).
      setRowsCache(
        examId,
        (prev) =>
          prev.map((r) => {
            if (!idSet.has(String(r.id))) return r;
            if (String(r.id) === String(rowId) && next) {
              return { ...next, values: { ...(next.values || {}), ...mergedPatch } };
            }
            return { ...r, values: { ...(r.values || {}), ...mergedPatch } };
          }),
        rowsPageKey,
      );
    }
    return next;
  };
  examDayPersistRef.current = persistRowValues;

  const handleRowUpdate = async (rowId, values, row) => {
    const examDayParsed = examDayLive ? parseExamDayRowId(rowId) : null;
    const original = examDayParsed
      ? rows.find((r) => String(r.id) === String(examDayParsed.sourceRowId))
      : rows.find((r) => r.id === rowId);
    try {
      // Cell saves often send only the changed key — merge full Exam Day row so
      // Requested counts are available when deriving Status from Reached.
      const payload =
        examDayLive && row?.values && typeof row.values === 'object'
          ? { ...row.values, ...(values || {}) }
          : values;
      await persistRowValues(rowId, payload);
    } catch (err) {
      if (original) {
        const matchId = String(original.id);
        setRowsCache(
          examId,
          (prev) => prev.map((r) => (String(r.id) === matchId ? original : r)),
          rowsPageKey,
        );
      }
      setMessage(apiErrorMessage(err, 'Could not update the center'));
    }
  };

  /** Mass Edit (legacy path): one pass per selected/loaded row. */
  const handleBulkUpdate = async (items) => {
    if (!Array.isArray(items) || !items.length) return;
    const results = await Promise.allSettled(
      items.map((item) => persistRowValues(item.rowId, item.values || {})),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) {
      setMessage(
        failed === items.length
          ? 'Could not update the selected rows'
          : `${failed} of ${items.length} rows could not be updated`,
      );
    }
  };

  examDayTargetsRef.current = { all: examDayAllRows, filtered: derivedFilteredRows };

  /**
   * Mass Edit against the database (modal already closed — progress chip top-right):
   * - Selected → checked row ids
   * - Filtered → server matches search/filters, then updates
   * - All rows → every record in this exam table
   */
  const handleBulkUpdateByScope = useCallback(
    async ({
      updates,
      scope,
      selectedRowIds,
      filters,
      search,
      columns,
      columnVisibility,
      lookupPicks,
      assigneePicks,
    }) => {
      const scopeLabel =
        scope === 'selected' ? 'selected rows' : scope === 'filtered' ? 'filtered rows' : 'all rows';
      setMassEditJob({
        status: 'running',
        label: 'Mass edit',
        detail: `Preparing ${scopeLabel}…`,
        progress: 8,
      });

      try {
        // Persist lookup source ids + assignee id[] (not display labels).
        let values = { ...(updates || {}) };
        (lookupPicks || []).forEach((pick) => {
          if (!pick?.columnKey) return;
          values[pick.columnKey] = pick.id ?? '';
          Object.assign(values, groupSyncPatch(fieldsRef.current, pick.columnKey, pick.id ?? ''));
        });
        (assigneePicks || []).forEach((pick) => {
          if (!pick?.columnKey) return;
          values[pick.columnKey] =
            Array.isArray(pick.ids) && pick.ids.length > 1
              ? pick.ids
              : pick.ids?.[0] || (Array.isArray(values[pick.columnKey]) ? [] : '');
        });
        values = restoreAssigneeIds(values, {}, fieldsRef.current);

        const fieldByKey = new Map((fieldsRef.current || []).map((f) => [f.key, f]));
        const localPatch = {};
        Object.entries(values).forEach(([key, val]) => {
          const f = fieldByKey.get(key);
          if (!f || isCombinedField(f) || isSummaryField(f) || isFromExamField(f) || isLinkedField(f)) return;
          if (isSharedImportedField(f)) return; // home-tab only — skip in bulk for now
          // Exam Day live counts + auto status/timestamps — never mass-write them.
          if (
            isExamDayLiveCountRole(f.examDayImportRole) ||
            isExamDayDerivedRole(f.examDayImportRole)
          ) {
            return;
          }
          localPatch[key] = val;
        });
        if (!Object.keys(localPatch).length) {
          setMassEditJob({
            status: 'error',
            label: 'Mass edit',
            detail: 'Nothing to update on this tab',
            progress: 100,
          });
          return;
        }

        // Exam Day: virtual center×date rows → persist onto Center list (+ per-date meta).
        if (isExamDayView(view)) {
          const { all, filtered } = examDayTargetsRef.current;
          let targets = all;
          if (scope === 'selected') {
            const idSet = new Set((selectedRowIds || []).map(String));
            targets = all.filter((r) => idSet.has(String(r.id)));
          } else if (scope === 'filtered') {
            targets = filtered;
          }
          if (!targets.length) {
            setMassEditJob({
              status: 'error',
              label: 'Mass edit',
              detail: 'No Exam Day rows to update',
              progress: 100,
            });
            return;
          }
          setMassEditJob({
            status: 'running',
            label: 'Mass edit',
            detail: `Updating ${targets.length.toLocaleString()} Exam Day row${targets.length === 1 ? '' : 's'}…`,
            progress: 45,
          });
          const persist = examDayPersistRef.current;
          const results = await Promise.allSettled(
            targets.map((row) =>
              persist?.(String(row.id), { ...(row.values || {}), ...localPatch }),
            ),
          );
          const failed = results.filter((r) => r.status === 'rejected').length;
          await invalidateRows(examId);
          if (failed) {
            setMassEditJob({
              status: 'error',
              label: 'Mass edit failed',
              detail:
                failed === targets.length
                  ? 'Could not update Exam Day rows'
                  : `${failed} of ${targets.length} rows could not be updated`,
              progress: 100,
            });
            return;
          }
          setMassEditJob({
            status: 'success',
            label: 'Mass edit complete',
            detail:
              targets.length === 1
                ? 'Updated 1 Exam Day row'
                : `Updated ${targets.length.toLocaleString()} Exam Day rows`,
            progress: 100,
          });
          return;
        }

        let result;
        if (scope === 'all') {
          setMassEditJob({
            status: 'running',
            label: 'Mass edit',
            detail: 'Updating all rows in the database…',
            progress: 45,
          });
          result = await bulkUpdateExamRows(examId, { values: localPatch, all: true, view });
        } else if (scope === 'selected') {
          const ids = (selectedRowIds || []).map(String).filter(Boolean);
          if (!ids.length) {
            setMassEditJob({
              status: 'error',
              label: 'Mass edit',
              detail: 'No rows selected',
              progress: 100,
            });
            return;
          }
          setMassEditJob({
            status: 'running',
            label: 'Mass edit',
            detail: `Updating ${ids.length.toLocaleString()} selected row${ids.length === 1 ? '' : 's'}…`,
            progress: 45,
          });
          result = await bulkUpdateExamRows(examId, { values: localPatch, ids, view });
        } else {
          // Filtered: server applies the same search/filters (no full-table download).
          const hasFilter =
            Boolean(String(search || '').trim()) ||
            Object.values(filters || {}).some((f) => f != null && f !== '');
          if (!hasFilter) {
            setMassEditJob({
              status: 'running',
              label: 'Mass edit',
              detail: 'Updating all rows in the database…',
              progress: 45,
            });
            result = await bulkUpdateExamRows(examId, { values: localPatch, all: true, view });
          } else {
            const searchKeys = [];
            (columns || []).forEach((col) => {
              if (!col?.key || columnVisibility?.[col.key] === false) return;
              if (Array.isArray(col.composedOf) && col.composedOf.length) {
                col.composedOf.forEach((part) => {
                  if (part?.field) searchKeys.push(String(part.field));
                });
              } else {
                searchKeys.push(String(col.key));
              }
            });
            setMassEditJob({
              status: 'running',
              label: 'Mass edit',
              detail: 'Matching filters on the server…',
              progress: 40,
            });
            result = await bulkUpdateExamRows(examId, {
              values: localPatch,
              filters: filters || {},
              search: search || '',
              searchKeys,
              view,
            });
            if (!Number(result?.updated)) {
              setMassEditJob({
                status: 'error',
                label: 'Mass edit',
                detail: 'No rows match the current filters',
                progress: 100,
              });
              return;
            }
          }
        }

        setMassEditJob({
          status: 'running',
          label: 'Mass edit',
          detail: 'Refreshing table…',
          progress: 90,
        });
        await invalidateRows(examId);
        const n = Number(result?.updated) || 0;
        setMassEditJob({
          status: 'success',
          label: 'Mass edit complete',
          detail: n === 1 ? 'Updated 1 row' : `Updated ${n.toLocaleString()} rows`,
          progress: 100,
        });
      } catch (err) {
        setMassEditJob({
          status: 'error',
          label: 'Mass edit failed',
          detail: apiErrorMessage(err, 'Could not update rows'),
          progress: 100,
        });
        await invalidateRows(examId);
      }
    },
    [examId, view, invalidateRows],
  );

  // Auto-dismiss success / error chip after a few seconds.
  useEffect(() => {
    if (!massEditJob || massEditJob.status === 'running') return undefined;
    const t = window.setTimeout(() => setMassEditJob(null), massEditJob.status === 'success' ? 4200 : 6500);
    return () => window.clearTimeout(t);
  }, [massEditJob]);

  useEffect(() => {
    if (!callingSyncJob || callingSyncJob.status === 'running') return undefined;
    const t = window.setTimeout(
      () => setCallingSyncJob(null),
      callingSyncJob.status === 'success' ? 5000 : 8000,
    );
    return () => window.clearTimeout(t);
  }, [callingSyncJob]);

  const pushDeleteJob = useCallback((job) => {
    setMassEditJob(job);
  }, []);

  const handleRowDelete = async (rowIds) => {
    if (examDayLive) {
      setMessage('Delete centers on Center list — Exam Day is a live view of those rows.');
      return;
    }
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    pushDeleteJob({
      status: 'running',
      label: 'Deleting rows',
      detail:
        ids.length === 1
          ? 'Deleting 1 row…'
          : `Deleting ${ids.length.toLocaleString()} rows…`,
      progress: 40,
      kind: 'delete',
    });
    try {
      await deleteExamRows(examId, { ids, view });
      setRowsCache(examId, (prev) => prev.filter((r) => !ids.includes(r.id)), rowsPageKey);
      pushDeleteJob({
        status: 'success',
        label: 'Delete complete',
        detail: ids.length === 1 ? 'Deleted 1 row' : `Deleted ${ids.length.toLocaleString()} rows`,
        progress: 100,
        kind: 'delete',
      });
    } catch (err) {
      pushDeleteJob({
        status: 'error',
        label: 'Delete failed',
        detail: apiErrorMessage(err, 'Could not delete the center'),
        progress: 100,
        kind: 'delete',
      });
    }
  };

  /** Bulk delete Selected / Filtered / All against the database (same scopes as Mass Edit). */
  const handleRowDeleteByScope = useCallback(
    async ({ scope, selectedRowIds, filters, search, columns, columnVisibility }) => {
      if (examDayLive) {
        setMessage('Delete centers on Center list — Exam Day is a live view of those rows.');
        await invalidateRows(examId);
        return;
      }

      const scopeLabel =
        scope === 'selected' ? 'selected rows' : scope === 'filtered' ? 'filtered rows' : 'all rows';
      // Paint progress (modal “Deleting…” + top-right bar) before any network work.
      pushDeleteJob({
        status: 'running',
        label: 'Deleting rows',
        detail: `Preparing ${scopeLabel}…`,
        progress: 8,
        kind: 'delete',
      });
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });

      try {
        const hasFilter =
          Boolean(String(search || '').trim()) ||
          Object.values(filters || {}).some((f) => f != null && f !== '');
        const wipeAll = scope === 'all' || (scope === 'filtered' && !hasFilter);

        // Full table: one Mongo wipe — no download of 15k ids.
        if (wipeAll) {
          pushDeleteJob({
            status: 'running',
            label: 'Deleting rows',
            detail: 'Deleting all rows in the database…',
            progress: 45,
            kind: 'delete',
          });
          const result = await deleteExamRows(examId, { all: true, view });
          const deleted = Number(result?.deleted) || 0;
          pushDeleteJob({
            status: 'running',
            label: 'Deleting rows',
            detail: 'Refreshing table…',
            progress: 90,
            kind: 'delete',
          });
          setRowsCache(examId, () => [], rowsPageKey);
          await invalidateRows(examId);
          pushDeleteJob({
            status: 'success',
            label: 'Delete complete',
            detail: deleted === 1 ? 'Deleted 1 row' : `Deleted ${deleted.toLocaleString()} rows`,
            progress: 100,
            kind: 'delete',
          });
          return;
        }

        const searchKeys = [];
        (columns || []).forEach((col) => {
          if (!col?.key || columnVisibility?.[col.key] === false) return;
          if (Array.isArray(col.composedOf) && col.composedOf.length) {
            col.composedOf.forEach((part) => {
              if (part?.field) searchKeys.push(String(part.field));
            });
          } else {
            searchKeys.push(String(col.key));
          }
        });

        let ids = [];
        if (scope === 'selected') {
          ids = (selectedRowIds || []).map(String).filter(Boolean);
        } else {
          pushDeleteJob({
            status: 'running',
            label: 'Deleting rows',
            detail: 'Matching filters on the server…',
            progress: 25,
            kind: 'delete',
          });
          const collected = [];
          let page = 1;
          const limit = 500;
          for (;;) {
            const res = await listExamRows(examId, {
              page,
              limit,
              view,
              search: search || '',
              searchKeys,
              filters: filters || {},
            });
            const batch = Array.isArray(res?.rows) ? res.rows : [];
            batch.forEach((r) => {
              const id = String(r?.id || '').trim();
              if (id) collected.push(id);
            });
            const total = Number(res?.total) || collected.length;
            pushDeleteJob({
              status: 'running',
              label: 'Deleting rows',
              detail: `Matched ${collected.toLocaleString()} of ${total.toLocaleString()}…`,
              progress: 25 + Math.min(30, Math.round((collected.length / Math.max(total, 1)) * 30)),
              kind: 'delete',
            });
            if (batch.length < limit || collected.length >= total) break;
            page += 1;
            if (page > 200) break;
          }
          ids = collected;
        }

        if (!ids.length) {
          pushDeleteJob({
            status: 'error',
            label: 'Delete failed',
            detail: 'No rows to delete',
            progress: 100,
            kind: 'delete',
          });
          await invalidateRows(examId);
          return;
        }

        pushDeleteJob({
          status: 'running',
          label: 'Deleting rows',
          detail: `Deleting ${ids.length.toLocaleString()} row${ids.length === 1 ? '' : 's'}…`,
          progress: 55,
          kind: 'delete',
        });

        const DELETE_CHUNK = 500;
        let deleted = 0;
        for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
          const chunk = ids.slice(i, i + DELETE_CHUNK);
          await deleteExamRows(examId, { ids: chunk, view });
          deleted += chunk.length;
          pushDeleteJob({
            status: 'running',
            label: 'Deleting rows',
            detail: `Deleted ${deleted.toLocaleString()} of ${ids.length.toLocaleString()}…`,
            progress: 55 + Math.round((deleted / ids.length) * 35),
            kind: 'delete',
          });
        }

        setRowsCache(
          examId,
          (prev) => prev.filter((r) => !ids.includes(String(r.id))),
          rowsPageKey,
        );
        await invalidateRows(examId);
        pushDeleteJob({
          status: 'success',
          label: 'Delete complete',
          detail: deleted === 1 ? 'Deleted 1 row' : `Deleted ${deleted.toLocaleString()} rows`,
          progress: 100,
          kind: 'delete',
        });
      } catch (err) {
        pushDeleteJob({
          status: 'error',
          label: 'Delete failed',
          detail: apiErrorMessage(err, 'Could not delete rows'),
          progress: 100,
          kind: 'delete',
        });
        await invalidateRows(examId);
      }
    },
    [examDayLive, examId, view, invalidateRows, rowsPageKey, setRowsCache, pushDeleteJob],
  );

  const handleDuplicateRow = async (row) => {
    const source = row?.rawValues || row?.values || {};
    const values = {};
    fieldsRef.current.forEach((f) => {
      if (SKIP_DUPLICATE_KEYS.has(String(f.key).toLowerCase())) return;
      if (f.dataType === 'formula' || f.dataType === 'composite') return;
      if (isFromExamField(f) || isLinkedField(f)) return;
      if (f.autoFill && f.autoFill !== 'none') {
        values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
      } else if (source[f.key] !== undefined) {
        values[f.key] = Array.isArray(source[f.key]) ? [...source[f.key]] : source[f.key];
      }
    });
    try {
      const created = await createExamRow(examId, values, view);
      setRowsCache(examId, (prev) => [created, ...prev], rowsPageKey);
      setMessage('Center duplicated');
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not duplicate the center'));
    }
  };

  /* ---------- Create-row drawer (same inputs as the exam create form) ---------- */

  const openCreate = () => {
    setFormError('');
    setForm(buildEmptyForm(fields));
    setSameAsFlags(buildSameAsFlags(fields));
    setIsCreateOpen(true);
  };

  const handleFieldChange = (key, value) => {
    setForm((prev) => {
      // Column group: picking a row in one member sets the same row in the others.
      const next = { ...prev, [key]: value, ...groupSyncPatch(fields, key, value) };
      fields.forEach((f) => {
        if (f.sameAsFieldKey === key && DATE_LINK_TYPES.has(f.dataType) && sameAsFlags[f.key]) {
          next[f.key] = value;
        }
      });
      return next;
    });
    if (formError) setFormError('');
  };

  const handleSameAsToggle = (fieldKey, checked) => {
    setSameAsFlags((prev) => ({ ...prev, [fieldKey]: checked }));
    if (!checked) return;
    const field = fields.find((f) => f.key === fieldKey);
    if (field?.sameAsFieldKey) {
      setForm((prev) => ({ ...prev, [fieldKey]: prev[field.sameAsFieldKey] ?? '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateFormFields(createFields, form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      // fromExam / linked are display-only — never persist painted values on the row.
      const values = { ...form };
      fields.forEach((f) => {
        if (isFromExamField(f) || isLinkedField(f)) delete values[f.key];
      });
      const created = await createExamRow(examId, values, view);
      setRowsCache(examId, (prev) => [created, ...prev], rowsPageKey);
      setIsCreateOpen(false);
      setMessage('Center added');
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the center. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTable = async (presetId) => {
    setCreating(true);
    setTableError('');
    try {
      const snap = await createExamTable(examId, { presetId, view });
      applySnapshot(snap);
      await syncColumnOrderFromPresetFields(snap);
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not create the table'));
    } finally {
      setCreating(false);
    }
  };

  /** Bring this list's fields up to date with its preset: types, options and new fields. Nothing is removed. */
  const handleUpdateFromPreset = async (preset) => {
    const ok = await confirm({
      title: 'Update fields from preset?',
      message: `Apply the current “${preset.name}” field settings to ${viewTitle}?`,
      tertiary: 'Fields follow the preset’s order, matching fields take its type and options, and missing fields are added. Centers and their values are kept, and no field is removed.',
      confirmLabel: 'Update fields',
    });
    if (!ok) return;
    setCreating(true);
    setTableError('');
    try {
      const nextFeatures = {
        ...(featuresRef.current || {}),
        ...(preset.features && typeof preset.features === 'object' ? preset.features : {}),
        // Keep this exam’s selected dates; refresh shift format from the preset.
        dateShifts: resolveDateShiftsConfig(
          {
            ...(preset.features?.dateShifts || {}),
            dates: featuresRef.current?.dateShifts?.dates,
          },
          preset.features?.dateShifts,
        ),
      };
      const snap = await saveExamTableConfig(examId, {
        fields: mergePresetIntoFields(preset.fields, fields),
        features: nextFeatures,
        view,
      });
      applySnapshot(snap);
      await syncColumnOrderFromPresetFields(snap);
      setMessage('Fields updated from the preset');
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not update the fields'));
    } finally {
      setCreating(false);
    }
  };

  /** Fill this tab's empty field list with a preset's fields (and Feature Builder settings). */
  const handleLoadPreset = async (preset) => {
    if (!preset) return;
    setCreating(true);
    setTableError('');
    try {
      // Ensure the shared table shell exists, then write this tab's fields.
      if (!tableInfo) await createExamTable(examId, { view });
      const snap = await saveExamTableConfig(examId, {
        fields: preset.fields,
        features: preset.features ?? undefined,
        view,
      });
      applySnapshot(snap);
      await syncColumnOrderFromPresetFields(snap);
      setMessage(`Loaded ${preset.fieldCount} fields from “${preset.name}”`);
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not load the preset'));
    } finally {
      setCreating(false);
    }
  };

  const openReloadPreset = (presetId = '') => {
    const preferred =
      String(presetId || '').trim() ||
      matchedPreset?.id ||
      viewPresets[0]?.id ||
      '';
    setReloadPresetId(preferred);
    setIsReloadPresetOpen(true);
  };

  /**
   * Replace this page’s fields + Feature Builder / Unique import with the preset as if loading
   * from scratch. Extra fields on the page are removed. Center-list exam dates are kept.
   */
  const handleReloadFromPreset = async (preset) => {
    if (!preset) return;
    const ok = await confirm({
      title: 'Reload this page from preset?',
      message: `Replace everything on ${viewTitle} with “${preset.name}”?`,
      tertiary:
        'All current fields on this page are removed and replaced with the preset. Unique import and Feature Builder settings reset from the preset. Center rows stay; values for removed fields are no longer shown. Exam dates on Center list are kept.',
      confirmLabel: 'Reload from start',
      destructive: true,
    });
    if (!ok) return;
    setCreating(true);
    setTableError('');
    setIsReloadPresetOpen(false);
    try {
      const nextFeatures = {
        ...(preset.features && typeof preset.features === 'object' ? { ...preset.features } : {}),
      };
      // Keep selected exam dates when reloading Center list (or any tab that already has dates).
      const keepDates = featuresRef.current?.dateShifts?.dates;
      if (keepDates?.length || view === DEFAULT_EXAM_VIEW) {
        nextFeatures.dateShifts = resolveDateShiftsConfig(
          {
            ...(preset.features?.dateShifts || {}),
            dates: keepDates,
          },
          preset.features?.dateShifts,
        );
      }
      const snap = await saveExamTableConfig(examId, {
        fields: fieldsFromPreset(preset.fields),
        features: nextFeatures,
        confirmDrops: true,
        view,
      });
      applySnapshot(snap);
      await syncColumnOrderFromPresetFields(snap);
      setMessage(`Reloaded ${viewTitle} from “${preset.name}”`);
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not reload from the preset'));
    } finally {
      setCreating(false);
    }
  };

  const importMatchKeys = useMemo(() => {
    const importable = createFields.filter(
      (f) =>
        !(f.autoFill && f.autoFill !== 'none') &&
        f.dataType !== 'formula' &&
        f.dataType !== 'composite' &&
        !isLinkedField(f) &&
        !isFromExamField(f) &&
        !isTableSourceField(f),
    );
    return importable.map((f) => ({ key: f.key, label: f.label || f.key }));
  }, [createFields]);

  const importDefaultMatchKey = useMemo(() => {
    const keys = new Set(importMatchKeys.map((m) => m.key));
    const fromUnique = uniqueRowKeys.find((k) => keys.has(k));
    if (fromUnique) return fromUnique;
    const byCode = importMatchKeys.find((m) =>
      /code/i.test(`${m.key} ${m.label}`),
    );
    return byCode?.key || importMatchKeys[0]?.key || '';
  }, [importMatchKeys, uniqueRowKeys]);

  const importExistingRows = useMemo(
    () =>
      (rows || []).map((r) => ({
        id: String(r.id),
        values: r.values && typeof r.values === 'object' ? r.values : {},
      })),
    [rows],
  );

  /** Exam Day is a live view of Center list — refresh reloads shared centers + expand. */
  const handleRefreshExamDayView = useCallback(async () => {
    if (!examDayLive || !examId) return;
    setImportingExamDay(true);
    try {
      await Promise.all([
        loadRows(),
        queryClient.invalidateQueries({ queryKey: queryKeys.exams.table(examId, DEFAULT_EXAM_VIEW) }),
      ]);
      setMessage(
        hasDateShiftTemplate(centerListDateShifts)
          ? 'Exam Day refreshed from Center list (live view)'
          : 'Add exam dates on Center list (Date shifts) to see Exam Day rows.',
      );
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not refresh Exam Day'));
    } finally {
      setImportingExamDay(false);
    }
  }, [examDayLive, examId, loadRows, centerListDateShifts, queryClient]);

  /** Expand / soft-hide Calling rows — chunked sync with progress popup. */
  const handleSyncCalling = useCallback(async () => {
    if (!callingLive || !examId || syncingCalling) return;
    setSyncingCalling(true);
    setCallingSyncJob({
      status: 'running',
      progress: 0,
      detail: 'Preparing…',
      created: 0,
      updated: 0,
      hidden: 0,
      centersProcessed: 0,
      centersTotal: 0,
    });
    try {
      const nextFeatures = tableFeaturesFor({
        ...(features || {}),
        callingExpand,
        callingLabel,
      });
      const dirty =
        JSON.stringify(nextFeatures.callingExpand) !== JSON.stringify(features?.callingExpand) ||
        JSON.stringify(nextFeatures.callingLabel) !== JSON.stringify(features?.callingLabel);
      if (dirty) {
        await saveExamTableConfig(examId, {
          fields,
          features: nextFeatures,
          view,
        });
        setFeatures(nextFeatures);
        lastSavedFeaturesRef.current = nextFeatures;
        setFeaturesDirty(false);
        queryClient.setQueryData(queryKeys.exams.table(examId, view), (prev) =>
          prev ? { ...prev, features: nextFeatures } : prev,
        );
      }

      const batchSize = 200;
      let offset = 0;
      let totals = { created: 0, updated: 0, hidden: 0 };
      let last = null;
      let done = false;
      while (!done) {
        const result = await syncCallingRows(examId, {
          centerOffset: offset,
          centerLimit: batchSize,
        });
        last = result;
        totals = {
          created: totals.created + (Number(result?.created) || 0),
          updated: totals.updated + (Number(result?.updated) || 0),
          hidden: totals.hidden + (Number(result?.hidden) || 0),
        };
        const centersTotal = Number(result?.centersTotal) || 0;
        const centersProcessed = Number(result?.centersProcessed) || 0;
        const progress = Number(result?.progress) || 0;
        setCallingSyncJob({
          status: 'running',
          progress,
          detail:
            centersTotal > 0
              ? `Centers ${centersProcessed.toLocaleString()} / ${centersTotal.toLocaleString()} · +${totals.created} created · ${totals.updated} updated`
              : 'Syncing…',
          created: totals.created,
          updated: totals.updated,
          hidden: totals.hidden,
          centersProcessed,
          centersTotal,
        });
        done = Boolean(result?.done) || result?.nextOffset == null;
        if (!done) offset = Number(result.nextOffset) || offset + batchSize;
      }

      await loadRows();
      const modeLabel =
        last?.mode === CALLING_EXPAND_MODES.PER_SHIFT
          ? 'per shift'
          : last?.mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS
            ? 'category counts'
            : 'Max Day N';
      setCallingSyncJob({
        status: 'success',
        progress: 100,
        detail: `${modeLabel}: +${totals.created} created · ${totals.updated} updated · ${totals.hidden} hidden`,
        created: totals.created,
        updated: totals.updated,
        hidden: totals.hidden,
        centersProcessed: last?.centersProcessed || 0,
        centersTotal: last?.centersTotal || 0,
      });
      setMessage(
        `Calling synced (${modeLabel}): +${totals.created} created · ${totals.updated} updated · ${totals.hidden} hidden`,
      );
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not sync Op/Guard Calling from Center list');
      setCallingSyncJob({
        status: 'error',
        progress: 0,
        detail: msg,
        created: 0,
        updated: 0,
        hidden: 0,
        centersProcessed: 0,
        centersTotal: 0,
      });
      setMessage(msg);
    } finally {
      setSyncingCalling(false);
    }
  }, [
    callingLive,
    examId,
    syncingCalling,
    callingExpand,
    callingLabel,
    features,
    fields,
    view,
    loadRows,
    queryClient,
  ]);

  const handleCallingExpandModeChange = useCallback(
    async (mode) => {
      if (!callingLive || !examId) return;
      let nextMode = CALLING_EXPAND_MODES.MAX_DAY_N;
      if (mode === CALLING_EXPAND_MODES.PER_SHIFT) nextMode = CALLING_EXPAND_MODES.PER_SHIFT;
      else if (mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
        nextMode = CALLING_EXPAND_MODES.CATEGORY_COUNTS;
      }
      const nextExpand = normalizeCallingExpand({
        ...callingExpand,
        mode: nextMode,
      });
      let nextLabel = callingLabel;
      if (
        nextMode === CALLING_EXPAND_MODES.CATEGORY_COUNTS &&
        callingLabel.mode === CALLING_LABEL_MODES.NONE
      ) {
        nextLabel = normalizeCallingLabel({
          ...callingLabel,
          mode: CALLING_LABEL_MODES.CATEGORY_HEAD,
        });
      }
      const nextFeatures = tableFeaturesFor({
        ...(features || {}),
        callingExpand: nextExpand,
        callingLabel: nextLabel,
      });
      setFeatures(nextFeatures);
      setFeaturesDirty(true);
      try {
        await saveExamTableConfig(examId, {
          fields,
          features: nextFeatures,
          view,
        });
        lastSavedFeaturesRef.current = nextFeatures;
        setFeaturesDirty(false);
        queryClient.setQueryData(queryKeys.exams.table(examId, view), (prev) =>
          prev ? { ...prev, features: nextFeatures } : prev,
        );
        const msg =
          nextExpand.mode === CALLING_EXPAND_MODES.PER_SHIFT
            ? 'Per shift'
            : nextExpand.mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS
              ? 'Category counts'
              : 'Max Day N';
        setMessage(`Calling expand set to ${msg} — run Sync from Center list`);
      } catch (err) {
        setMessage(apiErrorMessage(err, 'Could not save Calling expand mode'));
      }
    },
    [callingLive, examId, callingExpand, callingLabel, features, fields, view, queryClient],
  );

  /** CSV / paste import: add, update / upsert by key, or replace all with incoming. */
  const handleImportRows = async (csvRows, handlers) => {
    const mode = handlers?.mode || 'add';
    const matchKey = String(handlers?.matchKey || '').trim();
    // Only columns this user may fill. Auto-filled, computed and table-lookup fields (they hold a
    // row id, not text) are left out.
    const importable = createFields.filter(
      (f) =>
        !(f.autoFill && f.autoFill !== 'none') &&
        f.dataType !== 'formula' &&
        f.dataType !== 'composite' &&
        !isLinkedField(f) &&
        !isFromExamField(f) &&
        !isTableSourceField(f),
    );
    const byKey = new Map(importable.map((f) => [String(f.key).trim().toLowerCase(), f]));
    const byLabel = new Map(importable.map((f) => [String(f.label || f.key).trim().toLowerCase(), f]));

    const prepared = (Array.isArray(csvRows) ? csvRows : [])
      .map((row) => {
        const values = {};
        Object.entries(row || {}).forEach(([header, raw]) => {
          const h = String(header || '').trim().toLowerCase();
          const field = byKey.get(h) || byLabel.get(h);
          if (!field || raw === '' || raw == null) return;
          const multi =
            field.dataType === 'tags' ||
            field.dataType === 'multiselect' ||
            (field.optionsSource !== 'userTags' && field.allowMultiple);
          values[field.key] =
            multi && typeof raw === 'string'
              ? raw.split(',').map((x) => x.trim()).filter(Boolean)
              : raw;
        });
        return Object.keys(values).length ? values : null;
      })
      .filter(Boolean);

    if (!prepared.length) throw new Error('CSV columns did not match any field of this center list');

    // People columns (user tags): resolve pasted user codes / emails / names → user ids.
    // Codes alone are enough (e.g. AAD5005), including chip text like "Aadarsh · AAD5005".
    const resolvedImport = await resolveAssigneeFieldsForImport(prepared, importable);
    const workRows = resolvedImport.rows;
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    // Unmatched codes are skips (field left as-is); unknown names stay as soft failures in the toast.
    const failures = [
      ...(resolvedImport.failures || []),
      ...(resolvedImport.skipped || []),
    ];
    let created = 0;
    let updated = 0;
    let deleted = 0;
    const totalIncoming = workRows.length;

    const createBatches = async (rowsToCreate) => {
      if (!rowsToCreate.length) return;
      const { importRowsInChunks } = await import('../components/DynamicTable/export/parseImportInWorker');
      await importRowsInChunks(
        rowsToCreate,
        async (batch, { offset }) => {
          try {
            const res = await createExamRowsBulk(examId, batch, view);
            created += res?.created ?? 0;
            (res?.failures || []).forEach((f) =>
              failures.push(`row ${offset + f.index + 1}: ${f.message}`),
            );
          } catch (err) {
            failures.push(
              `rows ${offset + 1}-${offset + batch.length}: ${apiErrorMessage(err, 'could not be saved')}`,
            );
          }
        },
        {
          chunkSize: 200,
          // `done` is already cumulative rows sent — don't also add created/updated.
          onProgress: (done) =>
            handlers?.onProgress?.(Math.min(done + updated, totalIncoming), totalIncoming),
        },
      );
    };

    /** Load every existing row for this tab (paginated) for match or replace. */
    const loadAllExisting = async () => {
      const allExisting = [];
      let page = 1;
      const limit = 500;
      for (;;) {
        const res = await listExamRows(examId, { page, limit, view });
        const batch = Array.isArray(res?.rows) ? res.rows : [];
        allExisting.push(...batch);
        const total = Number(res?.total) || allExisting.length;
        if (batch.length < limit || allExisting.length >= total) break;
        page += 1;
        if (page > 200) break;
      }
      return allExisting;
    };

    if (mode === 'replace') {
      const allExisting = await loadAllExisting();
      const ids = allExisting.map((r) => String(r.id)).filter(Boolean);
      const DELETE_CHUNK = 200;
      // Keep progress total = incoming rows only (not deletes + imports).
      handlers?.onProgress?.(0, totalIncoming);
      for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        const chunk = ids.slice(i, i + DELETE_CHUNK);
        try {
          await deleteExamRows(examId, chunk);
          deleted += chunk.length;
        } catch (err) {
          throw new Error(
            `Could not clear existing rows (${deleted} removed before failure): ${apiErrorMessage(err, 'delete failed')}`,
          );
        }
      }
      await createBatches(workRows);
      await loadRows();
      if (created === 0 && totalIncoming > 0) {
        throw new Error(`Existing rows were cleared (${deleted}), but nothing was imported. ${failures[0] || ''}`.trim());
      }
      setMessage(
        failures.length
          ? `Replaced all — removed ${deleted}, imported ${created} of ${totalIncoming}. ${failures.length} failed (${failures[0]})`
          : `Replaced all — removed ${deleted}, imported ${created} center${created === 1 ? '' : 's'}`,
      );
      return;
    }

    if (mode === 'add' || !matchKey) {
      await createBatches(workRows);
      await loadRows();
      if (created === 0) throw new Error(`Nothing was imported. ${failures[0] || ''}`.trim());
      setMessage(
        failures.length
          ? `Imported ${created} of ${totalIncoming} centers. ${failures.length} failed (${failures[0]})`
          : `Imported ${created} center${created === 1 ? '' : 's'}`,
      );
      return;
    }

    // Load every existing row so Update / Upsert can match beyond the current page.
    const allExisting = await loadAllExisting();

    const lookup = new Map();
    allExisting.forEach((r) => {
      const v = norm(r?.values?.[matchKey]);
      if (!v || lookup.has(v)) return;
      lookup.set(v, String(r.id));
    });

    const toUpdate = [];
    const toCreate = [];
    workRows.forEach((values) => {
      const v = norm(values[matchKey]);
      // Skip rows with an empty match key — nothing reliable to join on.
      if (!v) return;
      const id = lookup.get(v);
      if (id) toUpdate.push({ id, values });
      else if (mode === 'upsert') toCreate.push(values);
    });

    if (mode === 'update' && !toUpdate.length) {
      throw new Error(`No existing rows matched on “${matchKey}”. Nothing was updated.`);
    }

    const totalWork = toUpdate.length + toCreate.length;
    let finished = 0;
    const bump = () => {
      finished += 1;
      handlers?.onProgress?.(finished, Math.max(totalWork, 1));
    };

    // Batch updates in chunks of 200 for high speed and minimal backend load
    const BATCH_SIZE = 200;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      try {
        const res = await updateExamRowsBulkIndividual(examId, batch, view);
        updated += res?.updated ?? batch.length;
      } catch (err) {
        // Fallback to per-row updates if batch endpoint encounters an error
        for (const item of batch) {
          try {
            await updateExamRow(examId, item.id, item.values, view);
            updated += 1;
          } catch (subErr) {
            failures.push(`${item.id}: ${apiErrorMessage(subErr, 'could not be updated')}`);
          }
        }
      } finally {
        finished += batch.length;
        handlers?.onProgress?.(Math.min(finished, totalWork), Math.max(totalWork, 1));
      }
    }

    await createBatches(toCreate);
    await loadRows();

    if (updated === 0 && created === 0) {
      throw new Error(`Nothing was saved. ${failures[0] || ''}`.trim());
    }
    const parts = [];
    if (updated) parts.push(`updated ${updated}`);
    if (created) parts.push(`added ${created}`);
    setMessage(
      failures.length
        ? `${parts.join(', ')} (${failures.length} failed — ${failures[0]})`
        : parts.join(', '),
    );
  };

  const fieldByKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);

  const renderFieldInput = (field) => {
    const source = field.sameAsFieldKey ? fieldByKey[field.sameAsFieldKey] : null;
    return (
      <ExamCustomFieldInput
        key={field.id}
        field={field}
        value={form[field.key]}
        onChange={(val) => handleFieldChange(field.key, val)}
        sameAsChecked={Boolean(sameAsFlags[field.key])}
        sameAsSourceLabel={source?.label || ''}
        linkedSourceField={field.linkedFrom ? fieldByKey[field.linkedFrom.fieldKey] : null}
        linkedSourceValue={field.linkedFrom ? form[field.linkedFrom.fieldKey] : undefined}
        examValue={exam?.values?.[field.examFieldKey]}
        examSourceDataType={
          examSourceFields.find((f) => f.key === field.examFieldKey)?.dataType
        }
        onSameAsToggle={field.sameAsFieldKey ? (checked) => handleSameAsToggle(field.key, checked) : undefined}
      />
    );
  };

  const backButton = (
    <button
      type="button"
      className="exam-explore-back"
      onClick={() => navigate('/exams')}
      aria-label="Back to exam management"
      title="Back to exam management"
    >
      <ArrowLeft size={18} strokeWidth={2} />
    </button>
  );

  if (status === 'loading') {
    return <div className="exam-explore-page exam-explore-state">Loading {viewTitle.toLowerCase()}…</div>;
  }

  if (status !== 'ready') {
    return (
      <div className="exam-explore-page">
        <PageHeading leading={backButton} />
        <div className="exam-explore-panel exam-explore-state" role="alert">
          {status === 'missing' ? 'This exam no longer exists.' : 'Could not load this exam. Please try again.'}
        </div>
      </div>
    );
  }

  const hasTable = Boolean(tableInfo);
  const shiftVisGroups =
    view === DEFAULT_EXAM_VIEW
      ? buildDateShiftVisibilityGroups(effectiveDateShifts, fields)
      : [];
  const canToggleShiftColumns = shiftVisGroups.length > 0;
  // Plain computation (not a hook): this runs after the early returns above.
  const presetDiff = matchedPreset && fields.length ? diffPresetAgainstFields(matchedPreset.fields, fields) : null;
  const presetOutdated = Boolean(presetDiff && (presetDiff.changed.length || presetDiff.added.length || presetDiff.reordered));
  return (
    <PageShell className="exams-page exams-page--table exam-explore-page">
      {/* Title/subtitle omitted — ExamSubNav (next to back) names the current tab. */}
      <PageHeading
        leading={
          <>
            {backButton}
            <ExamSubNav examId={examId} />
          </>
        }
        actions={
          hasTable ? (
            <>
              {canFocusExamDate && (
                <label className="exam-explore-focus-date">
                  <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
                  <span className="exam-explore-focus-date-label">Exam date</span>
                  <SearchableSelect
                    ariaLabel="Exam date — updates date Total Center and date Max All Day columns"
                    value={focusDateId}
                    onChange={setFocusDateId}
                    options={focusDateOptions}
                    searchThreshold={8}
                    placeholder="Select date…"
                  />
                </label>
              )}
              {canFilterExamDayDate && (
                <label className="exam-explore-focus-date">
                  <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
                  <span className="exam-explore-focus-date-label">Exam date</span>
                  <SearchableSelect
                    ariaLabel="Filter Exam Day by exam date"
                    value={examDayDateFilterId}
                    onChange={(v) => {
                      setExamDayDateFilterId(v == null ? '' : String(v));
                      setRowsPage(1);
                    }}
                    options={examDayDateFilterOptions}
                    searchThreshold={8}
                    placeholder="Show All"
                  />
                </label>
              )}
              {view === DEFAULT_EXAM_VIEW && canToggleShiftColumns && (
                <IconButton
                  label={shiftVisBarOpen ? 'Hide shift filters' : 'Show / hide shift columns'}
                  onClick={() => setShiftVisBarOpen((v) => !v)}
                  aria-pressed={shiftVisBarOpen}
                >
                  <Eye size={16} strokeWidth={2} />
                </IconButton>
              )}
              {isAdmin && (
                <>
                  {view === DEFAULT_EXAM_VIEW && (
                    <IconButton
                      label={
                        hasDateShiftTemplate(effectiveDateShifts)
                          ? 'Date shifts — select exam dates and create columns'
                          : 'Date shifts — add shift format in Field builder → Bulk add first'
                      }
                      onClick={() => setIsDateShiftsOpen(true)}
                    >
                      <CalendarDays size={16} strokeWidth={2} />
                    </IconButton>
                  )}
                  {viewPresets.length > 0 && (
                    <IconButton
                      label="Reload this page from a preset (replace fields)"
                      onClick={() => openReloadPreset()}
                      disabled={creating}
                    >
                      <RotateCcw size={16} strokeWidth={2} />
                    </IconButton>
                  )}
                  <IconButton label="Field builder (admin)" onClick={() => setIsBuilderOpen(true)}>
                    <SlidersHorizontal size={16} strokeWidth={2} />
                  </IconButton>
                  {examDayLive && (
                    <IconButton
                      label="Refresh Exam Day from Center list (live view)"
                      onClick={handleRefreshExamDayView}
                      disabled={importingExamDay || !fields.length}
                    >
                      {importingExamDay ? (
                        <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} strokeWidth={2} />
                      )}
                    </IconButton>
                  )}
                  {callingLive && (
                    <>
                      <label className="exam-explore-focus-date">
                        <span className="exam-explore-focus-date-label">Expand by</span>
                        <SearchableSelect
                          ariaLabel="Calling expand mode from Center list"
                          value={callingExpand.mode}
                          onChange={handleCallingExpandModeChange}
                          options={[
                            {
                              value: CALLING_EXPAND_MODES.MAX_DAY_N,
                              label: 'Max Day N slots',
                            },
                            {
                              value: CALLING_EXPAND_MODES.PER_SHIFT,
                              label: 'Per shift',
                            },
                            {
                              value: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
                              label: 'Category counts',
                            },
                          ]}
                          searchThreshold={99}
                          placeholder="Expand mode…"
                        />
                      </label>
                      <IconButton
                        label="Sync Calling rows from Center list (add / soft-hide)"
                        onClick={handleSyncCalling}
                        disabled={syncingCalling || !fields.length}
                      >
                        {syncingCalling ? (
                          <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                        ) : (
                          <RefreshCw size={16} strokeWidth={2} />
                        )}
                      </IconButton>
                    </>
                  )}
                </>
              )}
              {canCreateRow && !examDayLive && (
                <IconButton
                  variant="primary"
                  label={callingLive ? 'Add calling row' : 'Add center'}
                  onClick={openCreate}
                  disabled={createFields.length === 0}
                >
                  <Plus size={16} strokeWidth={2.5} />
                </IconButton>
              )}
            </>
          ) : null
        }
      />

      {message && (
        <div className="exams-page-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}

      {massEditJob &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              top: 72,
              right: 16,
              zIndex: 10090,
              width: 'min(380px, calc(100vw - 32px))',
            }}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl
              ${
                massEditJob.kind === 'delete'
                  ? isDarkMode
                    ? 'border-rose-500/40 bg-[#1a0f12] text-gray-100'
                    : 'border-rose-200 bg-white text-gray-900'
                  : isDarkMode
                    ? 'border-gray-600 bg-[#0f1c18] text-gray-100'
                    : 'border-gray-200 bg-white text-gray-900'
              }`}
          >
            {massEditJob.status === 'running' ? (
              <Loader2
                className={`mt-0.5 h-5 w-5 shrink-0 animate-spin ${
                  massEditJob.kind === 'delete' ? 'text-rose-500' : 'text-[#13C296]'
                }`}
              />
            ) : massEditJob.status === 'success' ? (
              <Check
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  massEditJob.kind === 'delete' ? 'text-rose-500' : 'text-[#13C296]'
                }`}
                strokeWidth={2.5}
              />
            ) : (
              <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" strokeWidth={2.5} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{massEditJob.label}</p>
              {massEditJob.detail ? (
                <p className={`mt-0.5 text-[12px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {massEditJob.detail}
                </p>
              ) : null}
              {massEditJob.status === 'running' ? (
                <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      massEditJob.kind === 'delete' ? 'bg-rose-500' : 'bg-[#13C296]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, massEditJob.progress || 0))}%` }}
                  />
                </div>
              ) : null}
            </div>
            {massEditJob.status !== 'running' ? (
              <button
                type="button"
                onClick={() => setMassEditJob(null)}
                className={`-mr-1 -mt-1 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg
                  ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>,
          document.body,
        )}

      {callingSyncJob &&
        createPortal(
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Calling sync progress"
          >
            <div
              className={`w-full max-w-[min(420px,92vw)] rounded-2xl border px-5 py-5 shadow-2xl
                ${isDarkMode ? 'border-gray-600 bg-[#0f1c18] text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}
            >
              <div className="flex items-start gap-3">
                {callingSyncJob.status === 'running' ? (
                  <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-[#5c43fa]" />
                ) : callingSyncJob.status === 'success' ? (
                  <Check className="mt-0.5 h-6 w-6 shrink-0 text-[#13C296]" strokeWidth={2.5} />
                ) : (
                  <X className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" strokeWidth={2.5} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">
                    {callingSyncJob.status === 'running'
                      ? 'Syncing Op/Guard Calling'
                      : callingSyncJob.status === 'success'
                        ? 'Calling sync complete'
                        : 'Calling sync failed'}
                  </p>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {callingSyncJob.detail || 'Working…'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                    <span>
                      {Math.min(100, Math.max(0, callingSyncJob.progress || 0))}% complete
                    </span>
                    {callingSyncJob.centersTotal > 0 ? (
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                        {callingSyncJob.centersProcessed.toLocaleString()} /{' '}
                        {callingSyncJob.centersTotal.toLocaleString()} centers
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`mt-2 h-2.5 overflow-hidden rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        callingSyncJob.status === 'error' ? 'bg-rose-500' : 'bg-[#5c43fa]'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, callingSyncJob.progress || 0))}%`,
                      }}
                    />
                  </div>
                  {callingSyncJob.status !== 'running' ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="exams-btn secondary compact"
                        onClick={() => setCallingSyncJob(null)}
                      >
                        Close
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isAdmin && hasTable && presetOutdated && matchedPreset && (
        <div className="exam-explore-preset-banner" role="status">
          <span>
            The “{matchedPreset.name}” preset has newer field settings
            {presetDiff.changed.length > 0 && (
              <>
                : {presetDiff.changed.length} field{presetDiff.changed.length === 1 ? '' : 's'} change
                {presetDiff.changed.length === 1 ? 's' : ''} (e.g. {presetDiff.changed[0].label}: {presetDiff.changed[0].from} → {presetDiff.changed[0].to})
              </>
            )}
            {presetDiff.added.length > 0 && (
              <>
                {presetDiff.changed.length > 0 ? ' and ' : ': '}
                {presetDiff.added.length} new field{presetDiff.added.length === 1 ? '' : 's'}
              </>
            )}
            {presetDiff.reordered && (
              <>
                {presetDiff.changed.length > 0 || presetDiff.added.length > 0 ? '. The fields are also in a different order' : ': the fields are in a different order'}
              </>
            )}
            .
          </span>
          <div className="exam-explore-preset-banner-actions">
            <button type="button" className="exam-explore-create" onClick={() => handleUpdateFromPreset(matchedPreset)} disabled={creating}>
              {creating ? 'Updating…' : 'Update from preset'}
            </button>
            <button
              type="button"
              className="exam-explore-create secondary"
              onClick={() => openReloadPreset(matchedPreset.id)}
              disabled={creating}
            >
              Reload from start
            </button>
          </div>
        </div>
      )}

      {view === DEFAULT_EXAM_VIEW &&
        shiftVisBarOpen &&
        canToggleShiftColumns &&
        hasTable &&
        fields.length > 0 &&
        !rowsLoading &&
        layoutReady && (
        <DateShiftVisibilityBar
          key={shiftVisApiEpoch}
          dateShifts={effectiveDateShifts}
          fields={fields}
          visibilityApiRef={tableVisibilityApiRef}
        />
      )}

      <div className="exams-table-panel">
        {!hasTable ? (
          <div className="exam-explore-state">
            <div className="exam-explore-empty-icon" aria-hidden="true">
              <Table2 size={22} strokeWidth={1.75} />
            </div>
            <p className="exam-explore-empty-title">No {viewTitle.toLowerCase()} yet</p>
            <p className="exam-explore-empty-hint">
              {!isAdmin
                ? `An admin needs to set up ${viewTitle.toLowerCase()} for this exam first.`
                : examDayLive
                  ? 'Load the Exam Day preset for columns. Data comes live from Center list (one row per center × exam date).'
                  : callingLive
                    ? 'Load an Op/Guard Calling preset (set Expand by: Max Day N or Per shift), then Sync from Center list.'
                  : matchedPreset
                    ? 'Use the recommended preset for this exam’s service, pick another, or start blank.'
                    : `${exam?.values?.service ? `No preset matches “${exam.values.service}”. ` : ''}Pick a preset to start from, or build the fields yourself.`}
            </p>
            {tableError && <p className="exam-explore-error" role="alert">{tableError}</p>}
            {isAdmin && (
              <PresetActions
                presets={viewPresets}
                matched={matchedPreset}
                busy={creating}
                onLoad={(preset) => handleCreateTable(preset.id)}
                onStartBlank={() => handleCreateTable()}
              />
            )}
          </div>
        ) : fields.length === 0 ? (
          <div className="exams-list-empty exam-explore-state">
            <div className="exam-explore-empty-icon" aria-hidden="true">
              <Table2 size={22} strokeWidth={1.75} />
            </div>
            <p className="exam-explore-empty-title">No fields yet</p>
            <p className="exam-explore-empty-hint">
              {isAdmin
                ? examDayLive
                  ? 'Load the Exam Day preset. Rows expand live from Center list — no separate import.'
                  : 'Load a preset to get started.'
                : `Ask an admin to build the fields for this exam’s ${viewTitle.toLowerCase()}.`}
            </p>
            {tableError && <p className="exam-explore-error" role="alert">{tableError}</p>}
            {isAdmin && (
              <PresetActions
                presets={viewPresets}
                matched={matchedPreset}
                busy={creating}
                onLoad={handleLoadPreset}
              />
            )}
          </div>
        ) : rowsLoading || !layoutReady ? (
          <TableSkeleton isDarkMode={isDarkMode} columns={Math.max(4, fields.length || 5)} />
        ) : (
          <div className="exams-dynamic-table-wrap">
            <DynamicTable
              key={`exam_table_${layoutEpoch}_${presetOrderEpoch}_${savedLayoutPrefs || !presetLayout ? 0 : 1}_${dateShiftLayoutEpoch}_${configVersion}_${fields.map((f) => f.key).join('|')}`}
              tableId={layoutTableId}
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={displayTableRows}
              onRefresh={examDayLive ? handleRefreshExamDayView : loadRows}
              layoutPrefs={layoutPrefs}
              defaultDensity="compact"
              visibilityApiRef={view === DEFAULT_EXAM_VIEW ? tableVisibilityApiRef : undefined}
              onVisibilityApiReady={
                view === DEFAULT_EXAM_VIEW
                  ? () => setShiftVisApiEpoch((n) => n + 1)
                  : undefined
              }
              onLayoutPrefsChange={handleLayoutPrefsChange}
              canSaveLayoutAsDefault={canSaveLayoutAsDefault}
              hasUserLayoutOverride={hasUserLayoutOverride}
              onSaveLayoutAsDefault={canSaveLayoutAsDefault ? handleSaveLayoutAsDefault : undefined}
              onResetLayoutToDefault={hasUserLayoutOverride ? handleResetLayoutToDefault : undefined}
              onRowUpdate={handleRowUpdate}
              onBulkUpdate={handleBulkUpdate}
              onBulkUpdateByScope={handleBulkUpdateByScope}
              onRowDelete={examDayLive ? undefined : handleRowDelete}
              onRowDeleteByScope={examDayLive ? undefined : handleRowDeleteByScope}
              onDuplicateRow={examDayLive ? undefined : handleDuplicateRow}
              onImportRows={examDayLive ? undefined : handleImportRows}
              importMatchKeys={importMatchKeys}
              importDefaultMatchKey={importDefaultMatchKey}
              importExistingRows={importExistingRows}
              importAllowReplaceAll={!examDayLive}
              showAddRow={false}
              permissions={tablePerms}
              enableFeatureBuilder={isAdmin}
              onFeaturesChange={isAdmin ? handleFeaturesChange : undefined}
              onSaveFeatures={isAdmin ? handleSaveFeatures : undefined}
              isSavingFeatures={isSavingFeatures}
              featuresDirty={featuresDirty}
              features={features}
              serverPagination={{
                totalRowCount: displayTotal,
                page: rowsPage,
                pageSize: rowsPageSize,
                onPageChange: setRowsPage,
                onPageSizeChange: (size) => {
                  setRowsPageSize(size);
                  setRowsPage(1);
                },
                search: rowsSearchInput,
                onSearchChange: setRowsSearchInput,
                filters: rowsFilters,
                onFiltersChange: (next) => {
                  setRowsFilters(next && typeof next === 'object' ? next : {});
                  setRowsPage(1);
                },
              }}
            />
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="exams-drawer-overlay" onClick={() => setIsCreateOpen(false)}>
          <aside className="exams-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add center">
            <div className="exams-drawer-header">
              <div className="exams-drawer-title-group">
                <h2 className="exams-drawer-title">
                  <FilePlus2 size={18} className="exams-drawer-title-icon" />
                  <span>Add center</span>
                </h2>
                <p className="exams-drawer-subtitle">{label}</p>
              </div>
              <button type="button" className="exams-drawer-close" onClick={() => setIsCreateOpen(false)} title="Close" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form className="exams-drawer-form" onSubmit={handleSubmit} noValidate>
              <div className="exams-drawer-body">
                {formError && <div className="exams-form-error">{formError}</div>}
                {groupFieldsForLayout(createFields).map((row) =>
                  row.length === 2 ? (
                    <div key={`${row[0].id}_${row[1].id}`} className="exams-form-row">
                      {row.map((field) => renderFieldInput(field))}
                    </div>
                  ) : (
                    renderFieldInput(row[0])
                  ),
                )}
              </div>
              <div className="exams-drawer-footer">
                <button type="button" className="exams-btn secondary" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="exams-btn primary" disabled={submitting}>
                  <Plus size={15} />
                  <span>{submitting ? 'Saving…' : 'Add center'}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {isReloadPresetOpen &&
        createPortal(
          <div
            className="exam-explore-reload-overlay"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget && !creating) setIsReloadPresetOpen(false);
            }}
          >
            <div
              className="exam-explore-reload-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exam-explore-reload-title"
            >
              <div className="exam-explore-reload-head">
                <h2 id="exam-explore-reload-title">
                  <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
                  Reload {viewTitle} from preset
                </h2>
                <button
                  type="button"
                  className="exams-drawer-close"
                  onClick={() => setIsReloadPresetOpen(false)}
                  disabled={creating}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="exam-explore-reload-copy">
                Removes this page’s current fields and Unique import settings, then loads the
                chosen preset from scratch. Center rows stay; values for removed columns are
                hidden. Pick the preset for this page, then confirm.
              </p>
              <label className="exam-explore-reload-field">
                <span>Preset</span>
                <SearchableSelect
                  ariaLabel="Preset to reload from"
                  value={reloadPresetId}
                  onChange={setReloadPresetId}
                  options={viewPresets.map((p) => ({
                    value: p.id,
                    label: `${p.name || p.serviceValue} · ${p.fieldCount ?? (p.fields || []).length} fields`,
                  }))}
                  searchThreshold={6}
                  placeholder="Choose a preset…"
                />
              </label>
              <div className="exam-explore-reload-actions">
                <button
                  type="button"
                  className="exams-btn secondary"
                  onClick={() => setIsReloadPresetOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="exams-btn primary"
                  disabled={creating || !reloadPresetId}
                  onClick={() => {
                    const preset = viewPresets.find((p) => p.id === reloadPresetId);
                    if (preset) handleReloadFromPreset(preset);
                  }}
                >
                  {creating ? 'Reloading…' : 'Continue…'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <ExamFieldBuilder
        open={isBuilderOpen}
        fields={fields}
        examSourceFields={examSourceFields}
        enableFromExam
        examId={examId}
        currentView={view}
        hiddenExamDayShiftIds={examDayLive ? hiddenExamDayShiftIds : null}
        bulkWorkingContext={[label || 'Exam', viewTitle].filter(Boolean).join(' · ')}
        onClose={() => setIsBuilderOpen(false)}
        onChange={handleFieldsChange}
        dateShifts={view === DEFAULT_EXAM_VIEW ? effectiveDateShifts : null}
        onDateShiftsChange={
          view === DEFAULT_EXAM_VIEW
            ? (dateShifts) => {
                // Preserve selected exam dates when editing the format from the builder.
                const merged = normalizeDateShiftsConfig({
                  ...dateShifts,
                  dates: featuresRef.current?.dateShifts?.dates ?? dateShifts?.dates ?? [],
                });
                const nextFeatures = { ...featuresRef.current, dateShifts: merged };
                // Stamp All day / Summary colors onto existing columns (and remesh if dates exist).
                let nextFields = applyDateShiftColumnWidths(
                  applyDateShiftColumnColors(fieldsRef.current, merged),
                  merged,
                );
                if ((merged.dates || []).length && hasDateShiftTemplate(merged)) {
                  const remeshed = mergeDateShiftFields(nextFields, merged);
                  if (remeshed.length <= 100) nextFields = remeshed;
                }
                if (nextFields !== fieldsRef.current) {
                  handleFieldsChange(nextFields);
                }
                setDateShiftLayoutEpoch((n) => n + 1);
                handleSaveFeatures(nextFeatures);
              }
            : null
        }
        uniqueRowKeys={features?.uniqueRowKeys}
        uniqueRowAggregates={features?.uniqueRowAggregates}
        onUniqueImportChange={(payload) => {
          handleSaveFeatures({
            ...featuresRef.current,
            ...(payload?.uniqueRowKeys !== undefined
              ? { uniqueRowKeys: normalizeUniqueRowKeys(payload.uniqueRowKeys) }
              : {}),
            ...(payload?.uniqueRowAggregates !== undefined
              ? {
                  uniqueRowAggregates: normalizeUniqueRowAggregates(
                    payload.uniqueRowAggregates,
                  ),
                }
              : {}),
          });
        }}
      />

      {view === DEFAULT_EXAM_VIEW && isDateShiftsOpen && (
        <DateShiftsSelectModal
          dateShifts={effectiveDateShifts}
          presets={viewPresets}
          fields={fields}
          visibilityApiRef={tableVisibilityApiRef}
          templateSource={
            hasDateShiftTemplate(features?.dateShifts)
              ? 'this exam'
              : presetWithDateShifts
                ? `preset · ${presetWithDateShifts.name}`
                : null
          }
          saving={isSavingDateShifts}
          onClose={() => !isSavingDateShifts && setIsDateShiftsOpen(false)}
          onSave={handleApplyDateShifts}
        />
      )}
    </PageShell>
  );
};
