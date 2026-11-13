import { useConfirm } from '../feedback';
import { useQueryClient } from '@tanstack/react-query';
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
  SlidersHorizontal,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { DEFAULT_EXAM_VIEW, examViewLabel, isExamViewKey, isSharedImportedField } from '@exam-view/shared';
import { isCombinedField } from './exams/examCombinedFields';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { applySearch } from '../components/DynamicData/dataProcessing';
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
  updateExamRow,
} from './exams/examTableApi';
import {
  listExamPresets,
  updateExamPreset,
  findPresetForService,
  presetsForView,
  diffPresetAgainstFields,
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
  hasDateShiftTemplate,
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

  const [tableError, setTableError] = useState('');
  const [creating, setCreating] = useState(false);
  const [presets, setPresets] = useState([]);
  const [message, setMessage] = useState('');
  /** Floating Mass Edit job chip (top-right) while DB update runs after the modal closes. */
  const [massEditJob, setMassEditJob] = useState(null);
  // { status: 'running'|'success'|'error', label, detail?, progress? 0–100 }
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isDateShiftsOpen, setIsDateShiftsOpen] = useState(false);
  const [isSavingDateShifts, setIsSavingDateShifts] = useState(false);
  const [shiftVisBarOpen, setShiftVisBarOpen] = useState(false);
  const [shiftVisApiEpoch, setShiftVisApiEpoch] = useState(0);
  /** Bumped when date×shift template widths/colors save — forces table remount. */
  const [dateShiftLayoutEpoch, setDateShiftLayoutEpoch] = useState(0);
  const tableVisibilityApiRef = useRef(null);
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

  const label = exam ? buildExamLabel(exam) : '';
  const viewPresets = useMemo(() => presetsForView(presets, view), [presets, view]);
  const matchedPreset = useMemo(
    () => findPresetForService(presets, exam?.values?.service, view),
    [presets, exam?.values?.service, view],
  );
  // A table nobody has laid out yet starts with the layout saved on its service's preset.
  const presetLayout = matchedPreset?.layout || null;
  const layoutPrefs = savedLayoutPrefs || (layoutSource === 'none' ? presetLayout : null);

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

  // Unique import needs the full center set to dedupe; page after collapsing duplicates.
  // Non-unique: server search scans every center, then returns the requested page.
  const rowsQuery = useExamRows(examId, {
    page: uniqueImportActive ? 1 : rowsPage,
    limit: uniqueImportActive ? 500 : rowsPageSize,
    search: uniqueImportActive ? '' : rowsSearch,
    searchKeys: uniqueImportActive ? undefined : rowSearchKeys,
    enabled: Boolean(examId) && Boolean(tableInfo),
  });
  const rows = rowsQuery.data?.rows || [];
  const rowsTotal = Number(rowsQuery.data?.total) || 0;
  const rowsLoading =
    Boolean(tableInfo) && rowsQuery.isPending && !rowsQuery.data;
  const rowsPageKey = uniqueImportActive
    ? { page: 1, limit: 500 }
    : { page: rowsPage, limit: rowsPageSize };
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
  const tableColumns = useMemo(() => {
    const cols = applyColumnAccess(
      buildExamTableColumns(fields, { dateShifts: effectiveDateShifts }),
      'exam_rows',
      access,
    );
    if (!aggregateTargetKeys.size) return cols;
    return cols.map((c) =>
      aggregateTargetKeys.has(c.key) ? { ...c, editable: false } : c,
    );
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fields, effectiveDateShifts, access, configVersion, aggregateTargetKeys]);
  const tablePerms = useMemo(() => tablePermissions(access, 'exam_rows'), [access]);
  const createFields = useMemo(
    () => creatableFields(fields, 'exam_rows', access).filter((f) => !isCombinedField(f)),
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
  const uniqueAllRows = useMemo(
    () =>
      uniqueImportActive
        ? rollupRowsByUniqueKeys(tableRows, uniqueRowKeys, uniqueRowAggregates, {
            // Max all day is formula-only — sum from Center shift cells on each row.
            dateShifts: effectiveDateShifts,
            fields: fields,
          })
        : tableRows,
    [tableRows, uniqueImportActive, uniqueRowKeys, uniqueRowAggregates, effectiveDateShifts, fields],
  );
  // Unique mode: search the full rolled-up set, then page — not only the visible slice.
  const uniqueFilteredRows = useMemo(() => {
    if (!uniqueImportActive) return uniqueAllRows;
    if (!rowsSearch) return uniqueAllRows;
    return applySearch(uniqueAllRows, rowsSearch, tableColumns, {});
  }, [uniqueImportActive, uniqueAllRows, rowsSearch, tableColumns]);
  const displayTableRows = useMemo(() => {
    if (!uniqueImportActive) return tableRows;
    const start = (rowsPage - 1) * rowsPageSize;
    return uniqueFilteredRows.slice(start, start + rowsPageSize);
  }, [uniqueImportActive, tableRows, uniqueFilteredRows, rowsPage, rowsPageSize]);
  const displayTotal = uniqueImportActive ? uniqueFilteredRows.length : rowsTotal;

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

  const saveFields = useCallback(async () => {
    const next = fieldsRef.current;
    const nextKeys = new Set(next.map((f) => f.key));
    const removed = serverFieldsRef.current.filter((f) => !nextKeys.has(f.key));
    if (removed.length) {
      const names = removed.map((f) => f.label || f.key).join(', ');
      const ok = await confirm({
        title: 'Remove column?',
        message: `Remove ${names}?`,
        tertiary: 'This permanently deletes the column and all data stored in it. This cannot be undone.',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (!ok) {
        setFields(serverFieldsRef.current);
        return;
      }
    }
    try {
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
    const result = await onResetLayoutToDefault?.();
    if (result?.message) setMessage(result.message);
  }, [onResetLayoutToDefault]);

  /* ---------- Rows ---------- */

  /**
   * Persist a row patch. Shared imports (Vendor Code, …) are writable on their home tab only —
   * Mass Edit used to strip them here, so the UI filled then cleared after save.
   */
  const persistRowValues = async (rowId, values) => {
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
    Object.entries(restored).forEach(([key, val]) => {
      const f = fieldByKey.get(key);
      if (!f || isCombinedField(f) || isFromExamField(f)) return;
      if (isSharedImportedField(f)) {
        const home = String(f.sharedFromView || '').trim();
        if (!home) return;
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

    // Optimistic paint on every sibling (and every cached page size) before API returns.
    const touchedAt = new Date().toISOString();
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
                  ...restored,
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
      if (targetIds.length > 1) {
        await bulkUpdateExamRows(examId, { ids: targetIds, values: patch, view: homeView });
        next = { ...(next || original), values: { ...((next || original)?.values || {}), ...patch } };
      } else {
        next = await updateExamRow(examId, rowId, patch, homeView);
      }
    }
    clearLookupPicksForRow(String(rowId));
    clearLookupDisplayOverrides(String(rowId));
    if (Object.keys(localPatch).length || sharedByView.size) {
      // Merge the patch onto every sibling in cache (not only the edited id).
      setRowsCache(
        examId,
        (prev) =>
          prev.map((r) => {
            if (!idSet.has(String(r.id))) return r;
            if (String(r.id) === String(rowId) && next) {
              return { ...next, values: { ...(next.values || {}), ...localPatch } };
            }
            return { ...r, values: { ...(r.values || {}), ...localPatch } };
          }),
        rowsPageKey,
      );
    }
    return next;
  };

  const handleRowUpdate = async (rowId, values) => {
    const original = rows.find((r) => r.id === rowId);
    try {
      await persistRowValues(rowId, values);
    } catch (err) {
      if (original) {
        setRowsCache(examId, (prev) => prev.map((r) => (r.id === rowId ? original : r)), rowsPageKey);
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
          if (!f || isCombinedField(f) || isFromExamField(f) || isLinkedField(f)) return;
          if (isSharedImportedField(f)) return; // home-tab only — skip in bulk for now
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

  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    try {
      await deleteExamRows(examId, ids);
      setRowsCache(examId, (prev) => prev.filter((r) => !ids.includes(r.id)), rowsPageKey);
      setMessage(ids.length > 1 ? 'Centers deleted' : 'Center deleted');
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not delete the center'));
    }
  };

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
      applySnapshot(await createExamTable(examId, { presetId, view }));
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
      applySnapshot(
        await saveExamTableConfig(examId, {
          fields: preset.fields,
          features: preset.features ?? undefined,
          view,
        }),
      );
      setMessage(`Loaded ${preset.fieldCount} fields from “${preset.name}”`);
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not load the preset'));
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

    /** Load every existing row (paginated) for match or replace. */
    const loadAllExisting = async () => {
      const allExisting = [];
      let page = 1;
      const limit = 500;
      for (;;) {
        const res = await listExamRows(examId, { page, limit });
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

    // Parallelism capped so we don’t stampede the API.
    const UPDATE_CONCURRENCY = 6;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
      const slice = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
      await Promise.all(
        slice.map(async ({ id, values }) => {
          try {
            await updateExamRow(examId, id, values, view);
            updated += 1;
          } catch (err) {
            failures.push(`${id}: ${apiErrorMessage(err, 'could not be updated')}`);
          } finally {
            bump();
          }
        }),
      );
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
                  <IconButton label="Field builder (admin)" onClick={() => setIsBuilderOpen(true)}>
                    <SlidersHorizontal size={16} strokeWidth={2} />
                  </IconButton>
                </>
              )}
              {canCreateRow && (
                <IconButton variant="primary" label="Add center" onClick={openCreate} disabled={createFields.length === 0}>
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
            className={`fixed top-4 right-4 z-[10001] flex max-w-[min(360px,92vw)] items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl
              ${isDarkMode ? 'border-gray-600 bg-[#0f1c18] text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}
            role="status"
            aria-live="polite"
          >
            {massEditJob.status === 'running' ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#13C296]" />
            ) : massEditJob.status === 'success' ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#13C296]" strokeWidth={2.5} />
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
                    className="h-full rounded-full bg-[#13C296] transition-[width] duration-300"
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
          <button type="button" className="exam-explore-create" onClick={() => handleUpdateFromPreset(matchedPreset)} disabled={creating}>
            {creating ? 'Updating…' : 'Update from preset'}
          </button>
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
                ? 'Load a preset to get started.'
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
              key={`exam_table_${layoutEpoch}_${savedLayoutPrefs || !presetLayout ? 0 : 1}_${dateShiftLayoutEpoch}_${configVersion}_${fields.map((f) => `${f.key}:${f.dataType}`).join('|')}`}
              tableId={layoutTableId}
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={displayTableRows}
              layoutPrefs={layoutPrefs}
              defaultDensity="compact"
              visibilityApiRef={view === DEFAULT_EXAM_VIEW ? tableVisibilityApiRef : undefined}
              onVisibilityApiReady={
                view === DEFAULT_EXAM_VIEW
                  ? () => setShiftVisApiEpoch((n) => n + 1)
                  : undefined
              }
              onLayoutPrefsChange={onLayoutPrefsChange}
              canSaveLayoutAsDefault={canSaveLayoutAsDefault}
              hasUserLayoutOverride={hasUserLayoutOverride}
              onSaveLayoutAsDefault={canSaveLayoutAsDefault ? handleSaveLayoutAsDefault : undefined}
              onResetLayoutToDefault={hasUserLayoutOverride ? handleResetLayoutToDefault : undefined}
              onRowUpdate={handleRowUpdate}
              onBulkUpdate={handleBulkUpdate}
              onBulkUpdateByScope={handleBulkUpdateByScope}
              onRowDelete={handleRowDelete}
              onDuplicateRow={handleDuplicateRow}
              onImportRows={handleImportRows}
              importMatchKeys={importMatchKeys}
              importDefaultMatchKey={importDefaultMatchKey}
              importExistingRows={importExistingRows}
              importAllowReplaceAll
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

      <ExamFieldBuilder
        open={isBuilderOpen}
        fields={fields}
        examSourceFields={examSourceFields}
        enableFromExam
        examId={examId}
        currentView={view}
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
