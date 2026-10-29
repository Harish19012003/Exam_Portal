import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IconButton } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { useNavigate } from 'react-router-dom';
import { Plus, X, FilePlus2, SlidersHorizontal, CalendarDays } from 'lucide-react';
import { DynamicTable } from '../components/DynamicTable';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { ExamCustomFieldInput } from './exams/ExamCustomFieldInput';
import {
  loadExamFields,
  saveExamFields,
  defaultValueForType,
  groupFieldsForLayout,
  buildSameAsFlags,
  DATE_LINK_TYPES,
} from './exams/examFieldTypes';
import {
  loadCreateExamDraft,
  saveCreateExamDraft,
  clearCreateExamDraft,
} from './exams/examDraftStorage';
import {
  listExams,
  createExam,
  deleteExam,
  updateExam,
  importExams,
  migrateLocalExamsToSqlIfNeeded,
} from './exams/examApi';
import { buildExamTableColumns, buildExamTableRows } from './exams/examTableAdapter';
import {
  fetchExamTableConfig,
  publishExamTableConfig,
  getDefaultExamTableConfig,
  recoverFieldsFromExams,
  DEFAULT_EXAM_TABLE_FEATURES,
} from './exams/examTableConfig';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import {
  useAccess,
  applyColumnAccess,
  creatableFields,
  tablePermissions,
} from '../hooks/useAccess';
import { TABLE_IDS } from '../constants/tableIds';
import {
  getSharedViewFeatures,
  replaceSharedViewFeatures,
} from '../components/DynamicData/sharedViewFeaturesStore';
import {
  getSummaryChipsState,
  replaceSummaryChipsState,
} from '../components/DynamicData/summaryChipsStore';
import {
  getQuickFiltersState,
  replaceQuickFiltersState,
} from '../components/DynamicData/quickFiltersStore';
import {
  hydrateFeatureStores,
  buildEmptyForm,
  mergeDraftIntoForm,
  validateFormFields,
} from './exams/examTableHelpers';
import './ExamsPage.css';

export const ExamsPage = () => {
  const navigate = useNavigate();
  const { access, can } = useAccess();
  const canConfigure = can('exams', 'configure');
  const canCreate = can('exams', 'create');
  const {
    layoutReady,
    layoutPrefs,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(TABLE_IDS.EXAMS);
  const [formFields, setFormFields] = useState(loadExamFields);
  const [tableFeatures, setTableFeatures] = useState(() => ({
    ...DEFAULT_EXAM_TABLE_FEATURES,
  }));
  const [configReady, setConfigReady] = useState(false);
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFieldBuilderOpen, setIsFieldBuilderOpen] = useState(false);
  const [form, setForm] = useState(() => buildEmptyForm(loadExamFields()));
  const [sameAsFlags, setSameAsFlags] = useState(() => buildSameAsFlags(loadExamFields()));
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [featuresDirty, setFeaturesDirty] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      localStorage.getItem('theme') === 'dark'
    );
  });
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef(null);
  const publishTimerRef = useRef(null);
  const formRef = useRef(form);
  const sameAsFlagsRef = useRef(sameAsFlags);
  const draftReadyRef = useRef(false);
  const formFieldsRef = useRef(formFields);
  const tableFeaturesRef = useRef(tableFeatures);
  const skipPublishRef = useRef(true);
  const featuresSyncReadyRef = useRef(false);
  const storeSnapshotRef = useRef(null);
  const lastSavedFeaturesRef = useRef(null);

  formRef.current = form;
  sameAsFlagsRef.current = sameAsFlags;
  draftReadyRef.current = draftReady;
  formFieldsRef.current = formFields;
  tableFeaturesRef.current = tableFeatures;

  const tableColumns = useMemo(
    () => applyColumnAccess(buildExamTableColumns(formFields), 'exams', access),
    [formFields, access],
  );
  const tablePerms = useMemo(() => tablePermissions(access, 'exams'), [access]);
  /** Create form shows only the fields this user may fill. */
  const createFields = useMemo(
    () => creatableFields(formFields, 'exams', access),
    [formFields, access],
  );
  const tableRows = useMemo(() => buildExamTableRows(exams), [exams]);

  const handleSaveLayoutAsDefault = useCallback(
    async (prefs) => {
      if (!onSaveLayoutAsDefault) return;
      const result = await onSaveLayoutAsDefault(prefs);
      if (result?.message) setPageMessage(result.message);
    },
    [onSaveLayoutAsDefault],
  );

  const handleResetLayoutToDefault = useCallback(async () => {
    if (!onResetLayoutToDefault) return;
    const result = await onResetLayoutToDefault();
    if (result?.message) setPageMessage(result.message);
  }, [onResetLayoutToDefault]);

  const publishConfig = useCallback(async (fields, features, { announce = false, message } = {}) => {
    if (!canConfigure) return false;
    try {
      await publishExamTableConfig({ fields, features });
      lastSavedFeaturesRef.current = features;
      setFeaturesDirty(false);
      if (announce) {
        setPageMessage(message || 'Exam table settings saved for all members');
      }
      return true;
    } catch {
      setPageMessage('Could not save exam table settings');
      return false;
    }
  }, [canConfigure]);

  const schedulePublish = useCallback((fields, features, options) => {
    if (!canConfigure || skipPublishRef.current) return;
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    publishTimerRef.current = setTimeout(() => {
      publishConfig(fields, features, options);
    }, 700);
  }, [canConfigure, publishConfig]);

  // Field schema changes still auto-publish (Field Builder). Feature toggles need explicit Save.
  useEffect(() => {
    saveExamFields(formFields);
    if (configReady && canConfigure) {
      schedulePublish(formFields, tableFeaturesRef.current, {
        announce: true,
        message: 'Exam fields saved for all members',
      });
    }
  }, [formFields, configReady, canConfigure, schedulePublish]);

  // Prefer compact density for exams table (cleaner alignment with few rows)
  useEffect(() => {
    try {
      const key = 'dynamic_table_prefs_exam_management_v1_v7';
      const raw = localStorage.getItem(key);
      const prefs = raw ? JSON.parse(raw) : {};
      if (!prefs.density) {
        localStorage.setItem(key, JSON.stringify({ ...prefs, density: 'compact' }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      const root = document.documentElement;
      setIsDarkMode(
        root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark'),
      );
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  // Load shared Settings config for everyone; hydrate Feature Builder stores for admins
  useEffect(() => {
    let cancelled = false;
    storeSnapshotRef.current = {
      shared: { ...getSharedViewFeatures() },
      chips: { ...getSummaryChipsState() },
      quick: { ...getQuickFiltersState() },
    };

    (async () => {
      setExamsLoading(true);
      // Push any old IndexedDB exam rows into SQL once (drafts stay local)
      await migrateLocalExamsToSqlIfNeeded();

      let rows = [];
      try {
        const [config, examRows] = await Promise.all([
          fetchExamTableConfig(),
          listExams(),
        ]);
        if (cancelled) return;
        rows = examRows;

        const next = config || getDefaultExamTableConfig();
        let fields = Array.isArray(next.fields) ? next.fields : [];
        let needsPublish = Boolean(next._needsPublish);

        if (fields.length === 0) {
          const recovered = recoverFieldsFromExams(rows);
          if (recovered.length > 0) {
            fields = recovered;
            needsPublish = true;
            saveExamFields(fields);
          }
        }

        const features = next.features || { ...DEFAULT_EXAM_TABLE_FEATURES };
        setFormFields(fields);
        setTableFeatures(features);
        tableFeaturesRef.current = features;
        lastSavedFeaturesRef.current = features;
        setFeaturesDirty(false);
        formFieldsRef.current = fields;
        hydrateFeatureStores(features);
        setExams(rows);
        setExamsLoading(false);
        setConfigReady(true);

        if (canConfigure && needsPublish && fields.length > 0) {
          try {
            await publishExamTableConfig({ fields, features });
            if (!cancelled) setPageMessage('Restored exam fields and saved to Settings');
          } catch {
            // keep local fields even if publish fails
          }
        }
      } catch {
        if (!cancelled) {
          setExams([]);
          setExamsLoading(false);
          setConfigReady(true);
        }
      }

      window.setTimeout(() => {
        if (!cancelled) {
          skipPublishRef.current = false;
          // Allow Feature Builder draft tracking after table finishes hydrating
          featuresSyncReadyRef.current = true;
        }
      }, 1200);
    })();

    return () => {
      cancelled = true;
      featuresSyncReadyRef.current = false;
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      const snap = storeSnapshotRef.current;
      if (snap) {
        replaceSharedViewFeatures(snap.shared);
        replaceSummaryChipsState(snap.chips);
        replaceQuickFiltersState(snap.quick);
      }
    };
  }, []);

  const normalizeFeaturesDraft = useCallback((features) => ({
    ...DEFAULT_EXAM_TABLE_FEATURES,
    ...features,
    enableAddColumn: false,
    enableAddRow: false,
    enableSubRows: false,
    quickFilterFieldKeys: Array.isArray(features.quickFilterFieldKeys)
      ? features.quickFilterFieldKeys
      : getQuickFiltersState().fieldKeys,
    summaryChips: Array.isArray(features.summaryChips)
      ? features.summaryChips
      : getSummaryChipsState().chips,
  }), []);

  /** Live Feature Builder preview only — does not write SQL until Save */
  const handleFeaturesChange = useCallback((features) => {
    if (!canConfigure || !configReady) return;
    const next = normalizeFeaturesDraft(features);
    setTableFeatures(next);
    tableFeaturesRef.current = next;
    // Ignore hydrate sync so we don't mark dirty before the user edits
    if (!featuresSyncReadyRef.current) {
      lastSavedFeaturesRef.current = next;
      setFeaturesDirty(false);
      return;
    }
    const saved = lastSavedFeaturesRef.current;
    setFeaturesDirty(!saved || JSON.stringify(next) !== JSON.stringify(saved));
  }, [canConfigure, configReady, normalizeFeaturesDraft]);

  const handleSaveFeatures = useCallback(async (features) => {
    if (!canConfigure || !configReady) return;
    const next = normalizeFeaturesDraft(features || tableFeaturesRef.current);
    setTableFeatures(next);
    tableFeaturesRef.current = next;
    setIsSavingFeatures(true);
    try {
      const ok = await publishConfig(formFieldsRef.current, next, {
        announce: true,
        message: 'Feature Builder settings saved for everyone',
      });
      if (!ok) setFeaturesDirty(true);
    } finally {
      setIsSavingFeatures(false);
    }
  }, [canConfigure, configReady, normalizeFeaturesDraft, publishConfig]);

  useEffect(() => {
    if (!pageMessage) return undefined;
    const t = setTimeout(() => setPageMessage(''), 4200);
    return () => clearTimeout(t);
  }, [pageMessage]);

  const flushDraft = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveCreateExamDraft({
      values: formRef.current,
      sameAsFlags: sameAsFlagsRef.current,
    });
  };

  const openCreate = async () => {
    skipNextSaveRef.current = true;
    setFormError('');
    const draft = await loadCreateExamDraft();
    const merged = mergeDraftIntoForm(formFields, draft);
    setSameAsFlags(merged.flags);
    setForm(merged.values);
    setDraftReady(true);
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (draftReadyRef.current) flushDraft();
    setIsCreateOpen(false);
    setDraftReady(false);
    setFormError('');
  };

  useEffect(() => {
    if (!isCreateOpen && !isFieldBuilderOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isCreateOpen && !isFieldBuilderOpen) closeCreate();
    };

    if (isCreateOpen || isFieldBuilderOpen) {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      if (!isCreateOpen && !isFieldBuilderOpen) {
        document.body.style.overflow = '';
      }
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isCreateOpen, isFieldBuilderOpen]);

  useEffect(() => {
    if (!isCreateOpen || !draftReady) return undefined;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return undefined;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCreateExamDraft({ values: form, sameAsFlags });
    }, 200);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, sameAsFlags, isCreateOpen, draftReady]);

  const handleFieldChange = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      formFields.forEach((f) => {
        if (
          f.sameAsFieldKey === key &&
          DATE_LINK_TYPES.has(f.dataType) &&
          sameAsFlags[f.key]
        ) {
          next[f.key] = value;
        }
      });
      return next;
    });
    if (formError) setFormError('');
  };

  const handleSameAsToggle = (fieldKey, checked) => {
    setSameAsFlags((prev) => ({ ...prev, [fieldKey]: checked }));
    if (checked) {
      const field = formFields.find((f) => f.key === fieldKey);
      if (!field?.sameAsFieldKey) return;
      setForm((prev) => ({
        ...prev,
        [fieldKey]: prev[field.sameAsFieldKey] ?? '',
      }));
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
      const exam = await createExam({ values: form, fields: formFields });
      setExams((prev) => [exam, ...prev]);
      await clearCreateExamDraft();
      skipNextSaveRef.current = true;
      draftReadyRef.current = false;
      setDraftReady(false);
      setForm(buildEmptyForm(formFields));
      setSameAsFlags(buildSameAsFlags(formFields));
      setIsCreateOpen(false);
      setPageMessage('Exam created');
    } catch {
      setFormError('Could not save exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRowUpdate = async (rowId, updatedValues) => {
    const next = await updateExam(rowId, { values: updatedValues });
    if (!next) {
      setPageMessage('Could not update exam');
      return;
    }
    setExams((prev) => prev.map((exam) => (exam.id === rowId ? next : exam)));
  };

  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    await Promise.all(ids.map((id) => deleteExam(id)));
    setExams((prev) => prev.filter((exam) => !ids.includes(exam.id)));
    setPageMessage(ids.length > 1 ? 'Exams deleted' : 'Exam deleted');
  };

  /** Duplicate row: copy visible field values; skip auto-fill / audit / formula. */
  const handleExploreRow = useCallback(
    (row) => {
      if (row?.id) navigate(`/exams/${encodeURIComponent(row.id)}`);
    },
    [navigate],
  );

  const handleDuplicateRow = useCallback(
    async (row) => {
      const fields = formFieldsRef.current || [];
      const visibility = layoutPrefs?.columnVisibility || {};
      const source =
        row?.values && typeof row.values === 'object' ? row.values : {};
      const skipKeys = new Set([
        'id',
        'created_at',
        'updated_at',
        '__created_by',
        '__updated_by',
        'created_by',
        'createdby',
        'created_by_user',
        'modify_by',
        'modified_by',
        'updated_by',
        'modifyby',
        'modifiedby',
      ]);

      const values = {};
      fields.forEach((field) => {
        if (!field?.key) return;
        const key = String(field.key);
        if (skipKeys.has(key.toLowerCase())) return;
        // Fresh auto values — never copy from source
        if (field.autoFill && field.autoFill !== 'none') {
          values[key] = defaultValueForType(
            field.dataType,
            field.autoFill,
            field.allowMultiple,
          );
          return;
        }
        if (field.dataType === 'formula' || field.dataType === 'composite') return;
        if (visibility[key] === false) return;

        const raw = source[key];
        if (raw === undefined) return;
        values[key] = Array.isArray(raw) ? [...raw] : raw;
      });

      try {
        const exam = await createExam({ values, fields });
        setExams((prev) => [exam, ...prev]);
        setPageMessage('Exam duplicated');
      } catch {
        setPageMessage('Could not duplicate exam');
      }
    },
    [layoutPrefs?.columnVisibility],
  );

  /** Map CSV row objects (keyed by column label or field key) → exam values */
  const handleImportRows = useCallback(
    async (csvRows) => {
      const fields = formFieldsRef.current || [];
      const byLabel = new Map(
        fields.map((f) => [String(f.label || f.key).trim().toLowerCase(), f.key]),
      );
      const byKey = new Map(fields.map((f) => [String(f.key).trim().toLowerCase(), f.key]));
      const skip = new Set([
        'id',
        'created_at',
        'updated_at',
        'created at',
        'updated at',
        'created by',
        'modify by',
        '__created_by',
        '__updated_by',
      ]);

      const exams = (Array.isArray(csvRows) ? csvRows : [])
        .map((row) => {
          const values = {};
          Object.entries(row || {}).forEach(([header, raw]) => {
            const h = String(header || '').trim();
            if (!h || skip.has(h.toLowerCase())) return;
            const key =
              byKey.get(h.toLowerCase()) || byLabel.get(h.toLowerCase()) || null;
            if (!key) return;
            const field = fields.find((f) => f.key === key);
            if (field?.autoFill && field.autoFill !== 'none') return;
            let value = raw;
            if (
              field &&
              (field.dataType === 'tags' ||
                field.dataType === 'multiselect' ||
                field.allowMultiple) &&
              typeof raw === 'string' &&
              raw.includes(',')
            ) {
              value = raw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            }
            values[key] = value;
          });
          return Object.keys(values).length ? { values } : null;
        })
        .filter(Boolean);

      if (!exams.length) {
        throw new Error('CSV columns did not match any exam fields');
      }

      await importExams(exams);
      const rows = await listExams();
      setExams(rows);
      setPageMessage(`Imported ${exams.length} exam${exams.length === 1 ? '' : 's'}`);
    },
    [],
  );

  const fieldRows = groupFieldsForLayout(createFields);
  const fieldByKey = Object.fromEntries(formFields.map((f) => [f.key, f]));

  const renderFieldInput = (field) => {
    const sourceField = field.sameAsFieldKey
      ? fieldByKey[field.sameAsFieldKey]
      : null;
    return (
      <ExamCustomFieldInput
        key={field.id}
        field={field}
        value={form[field.key]}
        onChange={(val) => handleFieldChange(field.key, val)}
        sameAsChecked={Boolean(sameAsFlags[field.key])}
        sameAsSourceLabel={sourceField?.label || ''}
        onSameAsToggle={
          field.sameAsFieldKey
            ? (checked) => handleSameAsToggle(field.key, checked)
            : undefined
        }
      />
    );
  };

  return (
    <div className="exams-page exams-page--table">
      <PageHeading
        title="Exam management"
        actions={
          <>
          {canConfigure && (
            <IconButton label="Field builder (admin)" onClick={() => setIsFieldBuilderOpen(true)}>
              <SlidersHorizontal size={16} strokeWidth={2} />
            </IconButton>
          )}
          {canCreate && (
            <IconButton variant="primary" label="Create exam" onClick={openCreate}>
              <Plus size={16} strokeWidth={2.5} />
            </IconButton>
          )}
          </>
        }
      />

      {pageMessage && (
        <div className="exams-page-toast" role="status" aria-live="polite">
          {pageMessage}
        </div>
      )}

      <div className="exams-table-panel">
        {examsLoading || !configReady || !layoutReady ? (
          <div className="exams-list-empty">Loading exams…</div>
        ) : formFields.length === 0 ? (
          <div className="exams-list-empty">
            <CalendarDays size={22} strokeWidth={1.75} />
            <p>No fields yet</p>
            <p className="exams-create-empty-hint">
              {canConfigure
                ? 'Use the sliders icon to build fields, then create exams with +.'
                : 'Ask a super admin to configure exam fields in Settings / Field builder.'}
            </p>
          </div>
        ) : (
          <div className="exams-dynamic-table-wrap">
            <DynamicTable
              key={`exams_schema_${layoutEpoch}_${formFields.map((f) => `${f.key}:${f.dataType}`).join('|')}`}
              tableId={TABLE_IDS.EXAMS}
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={tableRows}
              layoutPrefs={layoutPrefs}
              onLayoutPrefsChange={onLayoutPrefsChange}
              canSaveLayoutAsDefault={canSaveLayoutAsDefault}
              hasUserLayoutOverride={hasUserLayoutOverride}
              onSaveLayoutAsDefault={
                canSaveLayoutAsDefault ? handleSaveLayoutAsDefault : undefined
              }
              onResetLayoutToDefault={
                hasUserLayoutOverride ? handleResetLayoutToDefault : undefined
              }
              onRowUpdate={handleRowUpdate}
              onRowDelete={handleRowDelete}
              onDuplicateRow={handleDuplicateRow}
              onExploreRow={can('exam_rows', 'view') ? handleExploreRow : undefined}
              onImportRows={handleImportRows}
              showAddRow={false}
              permissions={tablePerms}
              enableFeatureBuilder={canConfigure}
              onFeaturesChange={canConfigure ? handleFeaturesChange : undefined}
              onSaveFeatures={canConfigure ? handleSaveFeatures : undefined}
              isSavingFeatures={isSavingFeatures}
              featuresDirty={featuresDirty}
              features={{
                ...DEFAULT_EXAM_TABLE_FEATURES,
                ...tableFeatures,
                enableAddColumn: false,
                enableAddRow: false,
                enableSubRows: false,
                enableTranspose: false,
              }}
            />
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="exams-drawer-overlay" onClick={closeCreate}>
          <aside
            className="exams-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create exam"
          >
            <div className="exams-drawer-header">
              <div className="exams-drawer-title-group">
                <h2 className="exams-drawer-title">
                  <FilePlus2 size={18} className="exams-drawer-title-icon" />
                  <span>Create exam</span>
                </h2>
                <p className="exams-drawer-subtitle">
                  {formFields.length === 0
                    ? canConfigure
                      ? 'Add fields from the sliders icon first'
                      : 'Exam fields are not configured yet'
                    : 'Add a new exam to the portal'}
                </p>
              </div>
              <button
                type="button"
                className="exams-drawer-close"
                onClick={closeCreate}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form className="exams-drawer-form" onSubmit={handleSubmit} noValidate>
              <div className="exams-drawer-body">
                {formError && <div className="exams-form-error">{formError}</div>}
                {createFields.length === 0 ? (
                  <div className="exams-create-empty">
                    <p>No form fields yet.</p>
                    <p className="exams-create-empty-hint">
                      {canConfigure
                        ? 'Use the sliders icon to add fields for the create form.'
                        : 'A super admin must publish exam fields before you can create exams.'}
                    </p>
                    {canConfigure && (
                      <button
                        type="button"
                        className="exams-btn primary compact"
                        onClick={() => {
                          closeCreate();
                          setIsFieldBuilderOpen(true);
                        }}
                      >
                        <SlidersHorizontal size={14} />
                        <span>Open field builder</span>
                      </button>
                    )}
                  </div>
                ) : (
                  fieldRows.map((row) =>
                    row.length === 2 ? (
                      <div key={`${row[0].id}_${row[1].id}`} className="exams-form-row">
                        {row.map((field) => renderFieldInput(field))}
                      </div>
                    ) : (
                      renderFieldInput(row[0])
                    )
                  )
                )}
              </div>

              <div className="exams-drawer-footer">
                <button type="button" className="exams-btn secondary" onClick={closeCreate}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="exams-btn primary"
                  disabled={createFields.length === 0 || submitting}
                >
                  <Plus size={15} />
                  <span>{submitting ? 'Creating…' : 'Create exam'}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <ExamFieldBuilder
        open={isFieldBuilderOpen}
        fields={formFields}
        onClose={() => setIsFieldBuilderOpen(false)}
        onChange={setFormFields}
      />
    </div>
  );
};
