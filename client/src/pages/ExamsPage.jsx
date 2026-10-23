import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  migrateLocalExamsToSqlIfNeeded,
} from './exams/examApi';
import { buildExamTableColumns, buildExamTableRows } from './exams/examTableAdapter';
import {
  canConfigureExamTable,
  fetchExamTableConfig,
  publishExamTableConfig,
  getDefaultExamTableConfig,
  recoverFieldsFromExams,
  DEFAULT_EXAM_TABLE_FEATURES,
} from './exams/examTableConfig';
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
import './ExamsPage.css';

const hydrateFeatureStores = (features = {}) => {
  replaceSharedViewFeatures({
    enableSearch: Boolean(features.enableSearch),
    enableRefresh: Boolean(features.enableRefresh),
    enableExport: Boolean(features.enableExport),
    enableFullScreen: Boolean(features.enableFullScreen),
    enableDensity: Boolean(features.enableDensity),
    enableOpenDetail: Boolean(features.enableOpenDetail),
  });
  replaceSummaryChipsState({
    enabled: Boolean(features.enableSummaryChips),
    chips: Array.isArray(features.summaryChips) ? features.summaryChips : [],
    visible: true,
  });
  replaceQuickFiltersState({
    enabled: Boolean(features.enableQuickFilters),
    fieldKeys: Array.isArray(features.quickFilterFieldKeys)
      ? features.quickFilterFieldKeys
      : [],
    visible: true,
    values: {},
  });
};

const applySameAsDefaults = (fields, values, flags) => {
  const next = { ...values };
  fields.forEach((f) => {
    if (
      f.sameAsFieldKey &&
      DATE_LINK_TYPES.has(f.dataType) &&
      flags[f.key]
    ) {
      next[f.key] = next[f.sameAsFieldKey] ?? '';
    }
  });
  return next;
};

const buildEmptyForm = (fields = []) => {
  const values = {};
  fields.forEach((f) => {
    values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
  });
  return applySameAsDefaults(fields, values, buildSameAsFlags(fields));
};

/** Merge a saved draft onto current field defs (drops removed keys, keeps user edits) */
const mergeDraftIntoForm = (fields, draft) => {
  const baseFlags = buildSameAsFlags(fields);
  const flags = { ...baseFlags };
  if (draft?.sameAsFlags) {
    fields.forEach((f) => {
      if (f.sameAsFieldKey && DATE_LINK_TYPES.has(f.dataType)) {
        if (typeof draft.sameAsFlags[f.key] === 'boolean') {
          flags[f.key] = draft.sameAsFlags[f.key];
        }
      }
    });
  }

  const values = {};
  fields.forEach((f) => {
    const isAuto = f.autoFill && f.autoFill !== 'none';
    if (isAuto) {
      values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
      return;
    }
    if (draft?.values && Object.prototype.hasOwnProperty.call(draft.values, f.key)) {
      values[f.key] = draft.values[f.key];
      return;
    }
    values[f.key] = defaultValueForType(f.dataType, f.autoFill, f.allowMultiple);
  });

  return {
    values: applySameAsDefaults(fields, values, flags),
    flags,
  };
};

const isEmptyValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const validateRequiredFields = (fields, values) => {
  for (const field of fields) {
    if (!field.required) continue;
    if (field.autoFill && field.autoFill !== 'none') continue;
    if (isEmptyValue(values[field.key])) {
      return `${field.label} is required.`;
    }
  }
  return '';
};

export const ExamsPage = () => {
  const canConfigure = useMemo(() => canConfigureExamTable(), []);
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
  const storeSnapshotRef = useRef(null);

  formRef.current = form;
  sameAsFlagsRef.current = sameAsFlags;
  draftReadyRef.current = draftReady;
  formFieldsRef.current = formFields;
  tableFeaturesRef.current = tableFeatures;

  const tableColumns = useMemo(() => buildExamTableColumns(formFields), [formFields]);
  const tableRows = useMemo(() => buildExamTableRows(exams), [exams]);

  const publishConfig = useCallback(async (fields, features, { announce = false } = {}) => {
    if (!canConfigure) return;
    try {
      await publishExamTableConfig({ fields, features });
      if (announce) setPageMessage('Exam table settings saved for all members');
    } catch {
      setPageMessage('Could not save exam table settings');
    }
  }, [canConfigure]);

  const schedulePublish = useCallback((fields, features, options) => {
    if (!canConfigure || skipPublishRef.current) return;
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    publishTimerRef.current = setTimeout(() => {
      publishConfig(fields, features, options);
    }, 700);
  }, [canConfigure, publishConfig]);

  useEffect(() => {
    saveExamFields(formFields);
    if (configReady && canConfigure) {
      schedulePublish(formFields, tableFeaturesRef.current, { announce: true });
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
        const [config, sqlRows] = await Promise.all([
          fetchExamTableConfig(),
          listExams(),
        ]);
        if (cancelled) return;
        rows = sqlRows;

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
        if (!cancelled) skipPublishRef.current = false;
      }, 800);
    })();

    return () => {
      cancelled = true;
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      const snap = storeSnapshotRef.current;
      if (snap) {
        replaceSharedViewFeatures(snap.shared);
        replaceSummaryChipsState(snap.chips);
        replaceQuickFiltersState(snap.quick);
      }
    };
  }, []);

  const handleFeaturesChange = useCallback((features) => {
    if (!canConfigure || !configReady) return;
    const next = {
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
    };
    setTableFeatures(next);
    tableFeaturesRef.current = next;
    schedulePublish(formFieldsRef.current, next, { announce: false });
  }, [canConfigure, configReady, schedulePublish]);

  useEffect(() => {
    if (!pageMessage) return undefined;
    const t = setTimeout(() => setPageMessage(''), 3200);
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
    const validationError = validateRequiredFields(formFields, form);
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

  const fieldRows = groupFieldsForLayout(formFields);
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
      <div className="exams-header-bar">
        <h1 className="exams-title">Exam management</h1>

        <div className="exams-header-actions">
          {canConfigure && (
            <button
              type="button"
              className="exams-settings-btn"
              onClick={() => setIsFieldBuilderOpen(true)}
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
            title="Create exam"
            aria-label="Create exam"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {pageMessage && <div className="exams-page-toast">{pageMessage}</div>}

      <div className="exams-table-panel">
        {examsLoading || !configReady ? (
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
              key={`exams_schema_${formFields.map((f) => `${f.key}:${f.dataType}`).join('|')}`}
              tableId="exam_management_v1"
              shareState={false}
              usePortalFeatures
              isDarkMode={isDarkMode}
              initialColumns={tableColumns}
              initialRows={tableRows}
              onRowUpdate={handleRowUpdate}
              onRowDelete={handleRowDelete}
              showAddRow={false}
              enableFeatureBuilder={canConfigure}
              onFeaturesChange={canConfigure ? handleFeaturesChange : undefined}
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
                {formFields.length === 0 ? (
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
                  disabled={formFields.length === 0 || submitting}
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
