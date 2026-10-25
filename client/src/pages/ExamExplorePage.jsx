import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Plus, SlidersHorizontal, Table2, X } from 'lucide-react';
import { DynamicTable } from '../components/DynamicTable';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { getExam } from './exams/examApi';
import {
  apiErrorMessage,
  createExamRow,
  createExamTable,
  deleteExamRows,
  getExamTable,
  listExamRows,
  saveExamTableConfig,
  updateExamRow,
} from './exams/examTableApi';
import { listExamPresets, findPresetForService } from './exams/examPresetApi';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { ExamCustomFieldInput } from './exams/ExamCustomFieldInput';
import { DEFAULT_EXAM_TABLE_FEATURES } from './exams/examTableConfig';
import { buildExamTableColumns, buildExamTableRows } from './exams/examTableAdapter';
import { defaultValueForType, groupFieldsForLayout, buildSameAsFlags, DATE_LINK_TYPES } from './exams/examFieldTypes';
import {
  buildEmptyForm,
  hydrateFeatureStores,
  normalizeFeaturesDraft,
  restoreFeatureStores,
  snapshotFeatureStores,
  validateRequiredFields,
} from './exams/examTableHelpers';
import './ExamsPage.css';
import './ExamExplorePage.css';

const pick = (values, keys) => {
  for (const key of keys) {
    const v = values?.[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

/** "UPPSC (Bio-Metric - abc)" — service / project code parts are optional. */
export const buildExamLabel = (exam) => {
  const values = exam?.values || {};
  const name = pick(values, ['exam_name', 'name', 'title']) || 'Untitled exam';
  const detail = [pick(values, ['service']), pick(values, ['project_code'])]
    .filter(Boolean)
    .join(' - ');
  return detail ? `${name} (${detail})` : name;
};

const ADMIN_ROLES = new Set(['super_admin', 'global_admin', 'admin']);

/** Mirrors the server: only admin roles may create tables or change columns. */
const canBuildTable = () => {
  try {
    return ADMIN_ROLES.has(JSON.parse(localStorage.getItem('user') || '{}')?.role);
  } catch {
    return false;
  }
};

/** Auto-filled, audit and computed fields are never copied when duplicating a row. */
const SKIP_DUPLICATE_KEYS = new Set([
  'created_by', 'createdby', 'created_by_user', 'modify_by', 'modified_by',
  'updated_by', 'modifyby', 'modifiedby', 'created_at', 'updated_at',
]);

const tableFeaturesFor = (saved) => ({
  ...DEFAULT_EXAM_TABLE_FEATURES,
  enableImport: false,
  ...(saved || {}),
  enableAddColumn: false,
  enableAddRow: false,
  enableSubRows: false,
  enableTranspose: false,
  rowActions: { ...DEFAULT_EXAM_TABLE_FEATURES.rowActions, ...(saved?.rowActions || {}), showExplore: false },
});

export const ExamExplorePage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { setBreadcrumbTail } = useOutletContext() || {};
  const isAdmin = useMemo(() => canBuildTable(), []);

  const [exam, setExam] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | error
  const [tableInfo, setTableInfo] = useState(null); // exam_tables row, or null when not created
  const [fields, setFields] = useState([]);
  const [features, setFeatures] = useState(() => tableFeaturesFor(null));
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
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
  const tableColumns = useMemo(() => buildExamTableColumns(fields), [fields]);
  const tableRows = useMemo(() => buildExamTableRows(rows), [rows]);

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
    setRowsLoading(true);
    try {
      const data = await listExamRows(examId);
      setRows(data.rows);
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not load rows'));
    } finally {
      setRowsLoading(false);
    }
  }, [examId]);

  // Load the exam, its table definition and rows
  useEffect(() => {
    let cancelled = false;
    const snapshot = snapshotFeatureStores();
    featuresSyncReadyRef.current = false;
    setStatus('loading');
    setTableError('');
    setRows([]);

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
      if (snap?.exists) await loadRows();
      else listExamPresets().then((list) => !cancelled && setPresets(list)).catch(() => {});
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
  }, [examId, applySnapshot, loadRows]);

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

  /* ---------- Fields drawer: auto-saves, syncing real SQL columns ---------- */

  const saveFields = useCallback(async () => {
    const next = fieldsRef.current;
    const nextKeys = new Set(next.map((f) => f.key));
    const removed = serverFieldsRef.current.filter((f) => !nextKeys.has(f.key));
    if (removed.length) {
      const names = removed.map((f) => f.label || f.key).join(', ');
      const ok = window.confirm(
        `Remove ${names}?\n\nThis permanently deletes the column and all data stored in it. This cannot be undone.`,
      );
      if (!ok) {
        setFields(serverFieldsRef.current);
        return;
      }
    }
    try {
      const snap = await saveExamTableConfig(examId, { fields: next, confirmDrops: removed.length > 0 });
      serverFieldsRef.current = snap.fields;
      setMessage('Table columns saved');
      await loadRows();
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not save the table columns'));
      try {
        applySnapshot(await getExamTable(examId));
      } catch {
        // keep local state
      }
    }
  }, [examId, applySnapshot, loadRows]);

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
    try {
      const next = await updateExamRow(examId, rowId, values);
      setRows((prev) => prev.map((r) => (r.id === rowId ? next : r)));
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not update the row'));
    }
  };

  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    try {
      await deleteExamRows(examId, ids);
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setMessage(ids.length > 1 ? 'Rows deleted' : 'Row deleted');
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not delete the row'));
    }
  };

  const handleDuplicateRow = async (row) => {
    const source = row?.values || {};
    const values = {};
    fieldsRef.current.forEach((f) => {
      if (SKIP_DUPLICATE_KEYS.has(String(f.key).toLowerCase())) return;
      if (f.dataType === 'formula' || f.dataType === 'composite') return;
      if (f.autoFill && f.autoFill !== 'none') {
        values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
      } else if (source[f.key] !== undefined) {
        values[f.key] = Array.isArray(source[f.key]) ? [...source[f.key]] : source[f.key];
      }
    });
    try {
      const created = await createExamRow(examId, values);
      setRows((prev) => [created, ...prev]);
      setMessage('Row duplicated');
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not duplicate the row'));
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
      const next = { ...prev, [key]: value };
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
    const validationError = validateRequiredFields(fields, form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const created = await createExamRow(examId, form);
      setRows((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setMessage('Row added');
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the row. Please try again.'));
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
    return <div className="exam-explore-page exam-explore-state">Loading exam…</div>;
  }

  if (status !== 'ready') {
    return (
      <div className="exam-explore-page">
        <div className="exam-explore-header">
          {backButton}
          <h1 className="exam-explore-title">Exam</h1>
        </div>
        <div className="exam-explore-panel exam-explore-state" role="alert">
          {status === 'missing' ? 'This exam no longer exists.' : 'Could not load this exam. Please try again.'}
        </div>
      </div>
    );
  }

  const hasTable = Boolean(tableInfo);
  const matchedPreset = findPresetForService(presets, exam?.values?.service);

  return (
    <div className="exams-page exams-page--table exam-explore-page">
      <div className="exams-header-bar">
        <div className="exam-explore-header">
          {backButton}
          <h1 className="exam-explore-title">Exam : {label}</h1>
        </div>
        {hasTable && (
          <div className="exams-header-actions">
            {isAdmin && (
              <button
                type="button"
                className="exams-settings-btn"
                onClick={() => setIsBuilderOpen(true)}
                title="Field builder (admin)"
                aria-label="Field builder"
              >
                <SlidersHorizontal size={18} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              className="exams-create-btn"
              onClick={openCreate}
              disabled={fields.length === 0}
              title="Add row"
              aria-label="Add row"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="exams-page-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}

      <div className="exams-table-panel">
        {!hasTable ? (
          <div className="exam-explore-state">
            <Table2 size={22} strokeWidth={1.75} />
            <p className="exam-explore-empty-title">No table created for this exam yet</p>
            <p className="exam-explore-empty-hint">
              {!isAdmin
                ? 'An admin needs to create this exam’s table first.'
                : matchedPreset
                  ? `There is a field preset for ${matchedPreset.serviceValue}. Create the table from it to start with those ${matchedPreset.fieldCount} fields.`
                  : 'Each exam gets its own table with its own fields. Create the table, then build its fields.'}
            </p>
            {tableError && <p className="exam-explore-error" role="alert">{tableError}</p>}
            {isAdmin && (
              <div className="exam-explore-create-row">
                {matchedPreset && (
                  <button type="button" className="exam-explore-create" onClick={() => handleCreateTable(matchedPreset.id)} disabled={creating}>
                    {creating ? 'Creating…' : `Create from “${matchedPreset.name}”`}
                  </button>
                )}
                <button
                  type="button"
                  className={matchedPreset ? 'exam-explore-create secondary' : 'exam-explore-create'}
                  onClick={() => handleCreateTable()}
                  disabled={creating}
                >
                  {creating && !matchedPreset ? 'Creating…' : matchedPreset ? 'Start blank' : 'Create table'}
                </button>
              </div>
            )}
          </div>
        ) : fields.length === 0 ? (
          <div className="exams-list-empty">
            <Table2 size={22} strokeWidth={1.75} />
            <p>No fields yet</p>
            <p className="exams-create-empty-hint">
              {isAdmin
                ? 'Use the sliders icon to build fields, then add rows with +.'
                : 'Ask an admin to build the fields for this exam’s table.'}
            </p>
          </div>
        ) : rowsLoading || !layoutReady ? (
          <div className="exams-list-empty">Loading…</div>
        ) : (
          <div className="exams-dynamic-table-wrap">
            <DynamicTable
              key={`exam_table_${layoutEpoch}_${fields.map((f) => `${f.key}:${f.dataType}`).join('|')}`}
              tableId={layoutTableId}
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={tableRows}
              layoutPrefs={layoutPrefs}
              onLayoutPrefsChange={onLayoutPrefsChange}
              canSaveLayoutAsDefault={canSaveLayoutAsDefault}
              hasUserLayoutOverride={hasUserLayoutOverride}
              onSaveLayoutAsDefault={canSaveLayoutAsDefault ? handleSaveLayoutAsDefault : undefined}
              onResetLayoutToDefault={hasUserLayoutOverride ? handleResetLayoutToDefault : undefined}
              onRowUpdate={handleRowUpdate}
              onRowDelete={handleRowDelete}
              onDuplicateRow={handleDuplicateRow}
              showAddRow={false}
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
          <aside className="exams-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add row">
            <div className="exams-drawer-header">
              <div className="exams-drawer-title-group">
                <h2 className="exams-drawer-title">
                  <FilePlus2 size={18} className="exams-drawer-title-icon" />
                  <span>Add row</span>
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
                {groupFieldsForLayout(fields).map((row) =>
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
                  <span>{submitting ? 'Saving…' : 'Add row'}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <ExamFieldBuilder
        open={isBuilderOpen}
        fields={fields}
        onClose={() => setIsBuilderOpen(false)}
        onChange={handleFieldsChange}
      />
    </div>
  );
};
