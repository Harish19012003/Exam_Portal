import { useConfirm } from '../feedback';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Eye, FilePlus2, Plus, SlidersHorizontal, Sparkles, Table2, X } from 'lucide-react';
import { DEFAULT_EXAM_VIEW, examViewLabel, isExamViewKey, isSharedImportedField } from '@exam-view/shared';
import { isCombinedField } from './exams/examCombinedFields';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { useExamRows, useExamTableConfig, useInvalidateExams } from '../hooks/useExamsQuery';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { useAccess, applyColumnAccess, creatableFields, tablePermissions } from '../hooks/useAccess';
import { getExam } from './exams/examApi';
import {
  apiErrorMessage,
  createExamRow,
  createExamRowsBulk,
  createExamTable,
  deleteExamRows,
  getExamTable,
  saveExamTableConfig,
  updateExamRow,
} from './exams/examTableApi';
import {
  listExamPresets,
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
  dedupeRowsByUniqueKeys,
  normalizeUniqueRowKeys,
  uniqueRowKeysLabel,
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
import { restoreFromExamValues, useExamValueDisplayRows } from './exams/useExamValueDisplayRows';
import { restoreLookupIds, useLookupDisplayRows } from './exams/useLookupLabels';
import { groupSyncPatch, isFromExamField, isLinkedField, isTableSourceField } from './exams/tableLookupApi';
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
  rowActions: { ...DEFAULT_EXAM_TABLE_FEATURES.rowActions, ...(saved?.rowActions || {}), showExplore: false },
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

      {otherPresets.length > 0 && (
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

  const uniqueRowKeys = useMemo(
    () => normalizeUniqueRowKeys(features?.uniqueRowKeys),
    [features?.uniqueRowKeys],
  );
  const uniqueImportActive = uniqueRowKeys.length > 0;

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
  // Unique import needs the full center set to dedupe; page after collapsing duplicates.
  const rowsQuery = useExamRows(examId, {
    page: uniqueImportActive ? 1 : rowsPage,
    limit: uniqueImportActive ? 500 : rowsPageSize,
    enabled: Boolean(examId) && Boolean(tableInfo),
  });
  const rows = rowsQuery.data?.rows || [];
  const rowsTotal = Number(rowsQuery.data?.total) || 0;
  const rowsLoading =
    Boolean(tableInfo) && rowsQuery.isPending && !rowsQuery.data;
  const rowsPageKey = uniqueImportActive
    ? { page: 1, limit: 500 }
    : { page: rowsPage, limit: rowsPageSize };
  const [tableError, setTableError] = useState('');
  const [creating, setCreating] = useState(false);
  const [presets, setPresets] = useState([]);
  const [message, setMessage] = useState('');
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
  const featuresSyncReadyRef = useRef(false);
  const saveTimerRef = useRef(null);
  fieldsRef.current = fields;
  featuresRef.current = features;

  const layoutTableId = tableInfo ? `exam_table_${tableInfo.id}_${view}_v1` : null;
  const {
    layoutReady,
    layoutPrefs,
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
  const tableColumns = useMemo(
    () =>
      applyColumnAccess(
        buildExamTableColumns(fields, { dateShifts: effectiveDateShifts }),
        'exam_rows',
        access,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, effectiveDateShifts, access, configVersion],
  );
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
    () => (uniqueImportActive ? dedupeRowsByUniqueKeys(tableRows, uniqueRowKeys) : tableRows),
    [tableRows, uniqueImportActive, uniqueRowKeys],
  );
  const displayTableRows = useMemo(() => {
    if (!uniqueImportActive) return tableRows;
    const start = (rowsPage - 1) * rowsPageSize;
    return uniqueAllRows.slice(start, start + rowsPageSize);
  }, [uniqueImportActive, tableRows, uniqueAllRows, rowsPage, rowsPageSize]);
  const displayTotal = uniqueImportActive ? uniqueAllRows.length : rowsTotal;
  const uniqueImportLabel = useMemo(
    () => (uniqueImportActive ? uniqueRowKeysLabel(fields, uniqueRowKeys) : ''),
    [uniqueImportActive, fields, uniqueRowKeys],
  );

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
    },
    [onSaveLayoutAsDefault],
  );

  const handleResetLayoutToDefault = useCallback(async () => {
    const result = await onResetLayoutToDefault?.();
    if (result?.message) setMessage(result.message);
  }, [onResetLayoutToDefault]);

  /* ---------- Rows ---------- */

  const handleRowUpdate = async (rowId, values) => {
    const original = rows.find((r) => r.id === rowId);
    const patched = restoreFromExamValues(
      restoreAssigneeIds(
        restoreLookupIds(values, original?.values, fields, rowId),
        original?.values,
        fields,
        rowId,
      ),
      original?.values,
      fields,
    );
    // Shared / combined columns are display-only on this tab — don't persist them here.
    fields.forEach((f) => {
      if (isSharedImportedField(f) || isCombinedField(f)) delete patched[f.key];
    });
    // Apply lookup ids (and group siblings) immediately so seeded labels paint before the API returns.
    setRowsCache(
      examId,
      (prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, values: { ...(r.values || {}), ...patched } } : r)),
      rowsPageKey,
    );
    try {
      const next = await updateExamRow(examId, rowId, patched, view);
      clearLookupPicksForRow(String(rowId));
      clearLookupDisplayOverrides(String(rowId));
      setRowsCache(examId, (prev) => prev.map((r) => (r.id === rowId ? next : r)), rowsPageKey);
    } catch (err) {
      if (original) {
        setRowsCache(examId, (prev) => prev.map((r) => (r.id === rowId ? original : r)), rowsPageKey);
      }
      setMessage(apiErrorMessage(err, 'Could not update the center'));
    }
  };

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

  /** CSV import: columns are matched to fields by key or label, then each row is created. */
  const handleImportRows = async (csvRows, handlers) => {
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
          const multi = field.dataType === 'tags' || field.dataType === 'multiselect' || field.allowMultiple;
          values[field.key] =
            multi && typeof raw === 'string'
              ? raw.split(',').map((x) => x.trim()).filter(Boolean)
              : raw;
        });
        return Object.keys(values).length ? values : null;
      })
      .filter(Boolean);

    if (!prepared.length) throw new Error('CSV columns did not match any field of this center list');

    let done = 0;
    const failures = [];
    const { importRowsInChunks } = await import('../components/DynamicTable/export/parseImportInWorker');
    await importRowsInChunks(
      prepared,
      async (batch, { offset }) => {
        try {
          const res = await createExamRowsBulk(examId, batch, view);
          done += res?.created ?? 0;
          (res?.failures || []).forEach((f) =>
            failures.push(`row ${offset + f.index + 1}: ${f.message}`),
          );
        } catch (err) {
          failures.push(`rows ${offset + 1}-${offset + batch.length}: ${apiErrorMessage(err, 'could not be saved')}`);
        }
      },
      { chunkSize: 200, onProgress: handlers?.onProgress },
    );
    await loadRows();

    if (done === 0) throw new Error(`Nothing was imported. ${failures[0] || ''}`.trim());
    setMessage(
      failures.length
        ? `Imported ${done} of ${prepared.length} centers. ${failures.length} failed (${failures[0]})`
        : `Imported ${done} center${done === 1 ? '' : 's'}`,
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
        <PageHeading title={viewTitle} leading={backButton} />
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
    <div className="exams-page exams-page--table exam-explore-page">
      <PageHeading
        title={viewTitle}
        subtitle={`Exam : ${label}`}
        leading={backButton}
        actions={
          <>
            <ExamSubNav examId={examId} />
            {hasTable ? (
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
            ) : null}
          </>
        }
      />

      {message && (
        <div className="exams-page-toast" role="status" aria-live="polite">
          {message}
        </div>
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
            {uniqueImportActive && uniqueImportLabel ? (
              <p className="exam-explore-unique-banner" role="status">
                Unique import · one row per <strong>{uniqueImportLabel}</strong>
                {rowsTotal > uniqueAllRows.length
                  ? ` · ${uniqueAllRows.length} of ${rowsTotal} centers`
                  : null}
              </p>
            ) : null}
            <DynamicTable
              key={`exam_table_${layoutEpoch}_${dateShiftLayoutEpoch}_${configVersion}_${fields.map((f) => `${f.key}:${f.dataType}:${f.width || ''}`).join('|')}_${JSON.stringify(effectiveDateShifts?.columnWidths || {})}_${JSON.stringify((effectiveDateShifts?.shifts || []).map((s) => `${s?.id}:${s?.width || ''}`))}`}
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
              onRowDelete={handleRowDelete}
              onDuplicateRow={handleDuplicateRow}
              onImportRows={handleImportRows}
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
        onUniqueRowKeysChange={(keys) => {
          handleSaveFeatures({
            ...featuresRef.current,
            uniqueRowKeys: normalizeUniqueRowKeys(keys),
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
    </div>
  );
};
