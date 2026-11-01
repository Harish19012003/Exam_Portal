import { useConfirm } from '../feedback';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Plus, SlidersHorizontal, Sparkles, Table2, X } from 'lucide-react';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { useExamRows, useExamTableConfig, useInvalidateExams } from '../hooks/useExamsQuery';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { useAccess, applyColumnAccess, creatableFields, tablePermissions } from '../hooks/useAccess';
import { getExam } from './exams/examApi';
import {
  apiErrorMessage,
  createExamRow,
  createExamTable,
  deleteExamRows,
  getExamTable,
  saveExamTableConfig,
  updateExamRow,
} from './exams/examTableApi';
import {
  listExamPresets,
  findPresetForService,
  diffPresetAgainstFields,
  mergePresetIntoFields,
} from './exams/examPresetApi';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { ExamCustomFieldInput } from './exams/ExamCustomFieldInput';
import { DEFAULT_EXAM_TABLE_FEATURES } from './exams/examTableConfig';
import { buildExamTableColumns, buildExamTableRows } from './exams/examTableAdapter';
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
            <p className="exam-explore-preset-rec-name">{matched.name || matched.serviceValue}</p>
            <p className="exam-explore-preset-rec-meta">
              Matches this exam’s service “{matched.serviceValue}”
            </p>
          </div>
          <button
            type="button"
            className="exam-explore-create"
            onClick={() => onLoad(matched)}
            disabled={busy}
          >
            {busy ? 'Loading…' : `Load “${matched.serviceValue}” preset`}
          </button>
        </div>
      )}

      {otherPresets.length > 0 && (
        <div className="exam-explore-preset-other">
          <p className="exam-explore-preset-other-label">
            {matched ? 'Or choose another preset' : 'Choose a preset'}
          </p>
          <div className="exam-explore-preset-other-row">
            <SearchableSelect
              className="exam-explore-preset-select"
              value={picked}
              options={presetOptions}
              onChange={setPicked}
              placeholder={matched ? 'Search presets…' : 'Search or select a preset…'}
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
  const { examId } = useParams();
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
  const rowsQuery = useExamRows(examId, { enabled: Boolean(examId) && Boolean(tableInfo) });
  const rows = rowsQuery.data || [];
  const rowsLoading = Boolean(tableInfo) && rowsQuery.isPending && !rowsQuery.data;
  const [tableError, setTableError] = useState('');
  const [creating, setCreating] = useState(false);
  const [presets, setPresets] = useState([]);
  const [message, setMessage] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
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

  const layoutTableId = tableInfo ? `exam_table_${tableInfo.id}_v1` : null;
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
  const tableColumns = useMemo(
    () => applyColumnAccess(buildExamTableColumns(fields), 'exam_rows', access),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, access, configVersion],
  );
  const tablePerms = useMemo(() => tablePermissions(access, 'exam_rows'), [access]);
  const createFields = useMemo(() => creatableFields(fields, 'exam_rows', access), [fields, access]);
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

  const applySnapshot = useCallback((snap) => {
    const nextFields = Array.isArray(snap?.fields) ? snap.fields : [];
    const nextFeatures = tableFeaturesFor(snap?.features);
    serverFieldsRef.current = nextFields;
    setTableInfo(snap?.exists ? snap.table : null);
    setFields(nextFields);
    setFeatures(nextFeatures);
    featuresRef.current = nextFeatures;
    lastSavedFeaturesRef.current = nextFeatures;
    setFeaturesDirty(false);
    hydrateFeatureStores(nextFeatures);
  }, []);

  const loadRows = useCallback(async () => {
    try {
      await invalidateRows(examId);
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not load the center list'));
    }
  }, [examId, invalidateRows]);

  // Load the exam and its table definition; rows come from React Query once the table exists.
  useEffect(() => {
    let cancelled = false;
    const snapshot = snapshotFeatureStores();
    featuresSyncReadyRef.current = false;
    setStatus('loading');
    setTableError('');

    (async () => {
      let examData;
      try {
        examData = await getExam(examId);
      } catch (err) {
        if (!cancelled) setStatus(err?.response?.status === 404 ? 'missing' : 'error');
        return;
      }
      let snap = null;
      try {
        snap = await getExamTable(examId);
      } catch (err) {
        if (!cancelled) setTableError(apiErrorMessage(err, 'Could not load the exam table'));
      }
      if (cancelled) return;
      setExam(examData);
      applySnapshot(snap);
      setStatus('ready');
      // Presets are offered when there is no table yet, when it is empty, and to spot a preset that
      // has newer field settings than this list's copy.
      listExamPresets().then((list) => !cancelled && setPresets(list)).catch(() => {});
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
  }, [examId, applySnapshot]);

  useEffect(() => {
    setBreadcrumbTail?.(label || null);
    return () => setBreadcrumbTail?.(null);
  }, [label, setBreadcrumbTail]);

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
      const snap = await saveExamTableConfig(examId, { fields: next, confirmDrops: removed.length > 0 });
      serverFieldsRef.current = snap.fields;
      setMessage('Center list fields saved');
      await loadRows();
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not save the table columns'));
      try {
        applySnapshot(await getExamTable(examId));
      } catch {
        // keep local state
      }
    }
  }, [examId, applySnapshot, loadRows, confirm]);

  const handleFieldsChange = useCallback(
    (nextFields) => {
      setFields(nextFields);
      fieldsRef.current = nextFields;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveFields, 700);
    },
    [saveFields],
  );

  /* ---------- Feature Builder ---------- */

  const handleFeaturesChange = useCallback((draft) => {
    if (!isAdmin) return;
    const next = tableFeaturesFor(normalizeFeaturesDraft(draft));
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
    const next = tableFeaturesFor(normalizeFeaturesDraft(draft || featuresRef.current));
    setFeatures(next);
    featuresRef.current = next;
    setIsSavingFeatures(true);
    try {
      await saveExamTableConfig(examId, { features: next });
      lastSavedFeaturesRef.current = next;
      setFeaturesDirty(false);
      setMessage('Feature Builder settings saved for everyone');
    } catch (err) {
      setFeaturesDirty(true);
      setMessage(apiErrorMessage(err, 'Could not save the settings'));
    } finally {
      setIsSavingFeatures(false);
    }
  }, [isAdmin, examId]);

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
    // Apply lookup ids (and group siblings) immediately so seeded labels paint before the API returns.
    setRowsCache(examId, (prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, values: { ...(r.values || {}), ...patched } } : r)),
    );
    try {
      const next = await updateExamRow(examId, rowId, patched);
      clearLookupPicksForRow(String(rowId));
      clearLookupDisplayOverrides(String(rowId));
      setRowsCache(examId, (prev) => prev.map((r) => (r.id === rowId ? next : r)));
    } catch (err) {
      if (original) setRowsCache(examId, (prev) => prev.map((r) => (r.id === rowId ? original : r)));
      setMessage(apiErrorMessage(err, 'Could not update the center'));
    }
  };

  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    try {
      await deleteExamRows(examId, ids);
      setRowsCache(examId, (prev) => prev.filter((r) => !ids.includes(r.id)));
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
      const created = await createExamRow(examId, values);
      setRowsCache(examId, (prev) => [created, ...prev]);
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
      const created = await createExamRow(examId, values);
      setRowsCache(examId, (prev) => [created, ...prev]);
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
      applySnapshot(await createExamTable(examId, { presetId }));
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
      message: `Apply the current “${preset.name}” field settings to this center list?`,
      tertiary: 'Fields follow the preset’s order, matching fields take its type and options, and missing fields are added. Centers and their values are kept, and no field is removed.',
      confirmLabel: 'Update fields',
    });
    if (!ok) return;
    setCreating(true);
    setTableError('');
    try {
      const snap = await saveExamTableConfig(examId, { fields: mergePresetIntoFields(preset.fields, fields) });
      applySnapshot(snap);
      setMessage('Fields updated from the preset');
      await loadRows();
    } catch (err) {
      setTableError(apiErrorMessage(err, 'Could not update the fields'));
    } finally {
      setCreating(false);
    }
  };

  /** Fill this exam's empty table with a preset's fields (and Feature Builder settings). */
  const handleLoadPreset = async (preset) => {
    if (!preset) return;
    setCreating(true);
    setTableError('');
    try {
      applySnapshot(await saveExamTableConfig(examId, { fields: preset.fields, features: preset.features ?? undefined }));
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
    let next = 0;
    const report = () => handlers?.onProgress?.(done, prepared.length);
    const worker = async () => {
      while (next < prepared.length) {
        const index = next;
        next += 1;
        try {
          await createExamRow(examId, prepared[index]);
          done += 1;
          report();
        } catch (err) {
          failures.push(`row ${index + 1}: ${apiErrorMessage(err, 'could not be saved')}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, prepared.length) }, worker));
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
    return <div className="exam-explore-page exam-explore-state">Loading center list…</div>;
  }

  if (status !== 'ready') {
    return (
      <div className="exam-explore-page">
        <PageHeading title="Center list" leading={backButton} />
        <div className="exam-explore-panel exam-explore-state" role="alert">
          {status === 'missing' ? 'This exam no longer exists.' : 'Could not load this exam. Please try again.'}
        </div>
      </div>
    );
  }

  const hasTable = Boolean(tableInfo);
  const matchedPreset = findPresetForService(presets, exam?.values?.service);
  // Plain computation (not a hook): this runs after the early returns above.
  const presetDiff = matchedPreset && fields.length ? diffPresetAgainstFields(matchedPreset.fields, fields) : null;
  const presetOutdated = Boolean(presetDiff && (presetDiff.changed.length || presetDiff.added.length || presetDiff.reordered));

  return (
    <div className="exams-page exams-page--table exam-explore-page">
      <PageHeading
        title="Center list"
        subtitle={`Exam : ${label}`}
        leading={backButton}
        actions={
          hasTable ? (
            <>
              {isAdmin && (
                <IconButton label="Field builder (admin)" onClick={() => setIsBuilderOpen(true)}>
                  <SlidersHorizontal size={16} strokeWidth={2} />
                </IconButton>
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

      <div className="exams-table-panel">
        {!hasTable ? (
          <div className="exam-explore-state">
            <div className="exam-explore-empty-icon" aria-hidden="true">
              <Table2 size={22} strokeWidth={1.75} />
            </div>
            <p className="exam-explore-empty-title">No center list yet</p>
            <p className="exam-explore-empty-hint">
              {!isAdmin
                ? 'An admin needs to create this exam’s center list first.'
                : matchedPreset
                  ? 'Use the recommended preset for this exam’s service, pick another, or start blank.'
                  : `${exam?.values?.service ? `No preset matches “${exam.values.service}”. ` : ''}Pick a preset to start from, or build the fields yourself.`}
            </p>
            {tableError && <p className="exam-explore-error" role="alert">{tableError}</p>}
            {isAdmin && (
              <PresetActions
                presets={presets}
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
                ? matchedPreset
                  ? 'Load the recommended preset, choose another, or use the sliders icon to build your own fields.'
                  : 'Load a preset, or use the sliders icon to build fields, then add centers with +.'
                : 'Ask an admin to build the fields for this exam’s center list.'}
            </p>
            {tableError && <p className="exam-explore-error" role="alert">{tableError}</p>}
            {isAdmin && (
              <PresetActions presets={presets} matched={matchedPreset} busy={creating} onLoad={handleLoadPreset} />
            )}
          </div>
        ) : rowsLoading || !layoutReady ? (
          <TableSkeleton isDarkMode={isDarkMode} columns={Math.max(4, fields.length || 5)} />
        ) : (
          <div className="exams-dynamic-table-wrap">
            <DynamicTable
              key={`exam_table_${layoutEpoch}_${configVersion}_${fields.map((f) => `${f.key}:${f.dataType}`).join('|')}`}
              tableId={layoutTableId}
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={tableRows}
              layoutPrefs={layoutPrefs}
              defaultDensity="compact"
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
        onClose={() => setIsBuilderOpen(false)}
        onChange={handleFieldsChange}
      />
    </div>
  );
};
