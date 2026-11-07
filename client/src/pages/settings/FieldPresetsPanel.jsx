import { useConfirm } from '../../feedback';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  LayoutTemplate,
  ListPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel, isExamViewKey } from '@exam-view/shared';
import { apiClient } from '../../api/client';
import { ExamFieldBuilder } from '../exams/ExamFieldBuilder';
import { loadExamFields, resolveFieldOptions } from '../exams/examFieldTypes';
import {
  bulkSaveExamPresets,
  createExamPreset,
  deleteExamPreset,
  listExamPresets,
  updateExamPreset,
} from '../exams/examPresetApi';
import { apiErrorMessage } from '../exams/examTableApi';
import './FieldPresetsPanel.css';

const emptyForm = () => ({
  id: null,
  name: '',
  serviceValue: '',
  view: DEFAULT_EXAM_VIEW,
  fields: [],
});

const pairKey = (serviceValue, view) =>
  `${String(serviceValue || '').trim().toLowerCase()}::${String(view || DEFAULT_EXAM_VIEW)}`;

/** Stable JSON payload for Export / Import round-trips. */
export const buildFieldPresetsExportPayload = (presets) =>
  (Array.isArray(presets) ? presets : [])
    .map((p) => {
      const name = String(p?.name || '').trim();
      const serviceValue = String(p?.serviceValue || '').trim();
      const view = String(p?.view || DEFAULT_EXAM_VIEW).trim() || DEFAULT_EXAM_VIEW;
      if (!name || !serviceValue) return null;
      const row = {
        name,
        serviceValue,
        view,
        fields: Array.isArray(p.fields) ? p.fields : [],
      };
      if (p.features != null && typeof p.features === 'object' && !Array.isArray(p.features)) {
        row.features = p.features;
      }
      return row;
    })
    .filter(Boolean);

const mapImportPresetItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name || item.title || '').trim();
  const serviceValue = String(item.serviceValue || item.service || '').trim();
  const viewRaw = String(item.view || item.page || DEFAULT_EXAM_VIEW).trim() || DEFAULT_EXAM_VIEW;
  if (!name || !serviceValue) return null;
  if (!isExamViewKey(viewRaw)) return null;
  const fields = Array.isArray(item.fields) ? item.fields : [];
  if (fields.length === 0) return null;
  const row = { name, serviceValue, view: viewRaw, fields };
  if (item.features != null && typeof item.features === 'object' && !Array.isArray(item.features)) {
    row.features = item.features;
  }
  return row;
};

/** Accepts Export JSON array, `{ presets: [...] }`, or a single preset object. */
export const parseFieldPresetsImportText = (text) => {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.presets)
        ? parsed.presets
        : parsed?.name || parsed?.serviceValue
          ? [parsed]
          : [];
    return items.map(mapImportPresetItem).filter(Boolean);
  } catch {
    return [];
  }
};

/** Service choices come from the exam form's "service" field (its Config dropdown list). */
const loadServiceOptions = async () => {
  try {
    const { data } = await apiClient.get('/settings/exam-table-config');
    const fields = (data?.data ?? data)?.fields;
    const field = Array.isArray(fields) ? fields.find((f) => f.key === 'service') : null;
    return field ? resolveFieldOptions(field) : [];
  } catch {
    return [];
  }
};

/**
 * Settings → Config → Field presets.
 * Toolbar ticks: create / import / export from ConfigTab.
 */
export const FieldPresetsPanel = ({
  createTick = 0,
  importTick = 0,
  exportTick = 0,
  onPresetCountChange,
}) => {
  const confirm = useConfirm();
  const formId = useId();
  const importFileRef = useRef(null);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serviceOptions, setServiceOptions] = useState([]);
  const [form, setForm] = useState(null); // null = editor closed
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setPresets(await listExamPresets());
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load presets'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadServiceOptions().then(setServiceOptions);
  }, [load]);

  useEffect(() => {
    onPresetCountChange?.(presets.length);
  }, [presets.length, onPresetCountChange]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setFormError('');
  }, []);

  const openImport = useCallback(() => {
    setImportText('');
    setImportError('');
    setIsImportOpen(true);
  }, []);

  const downloadPresetsJson = useCallback((list, filename) => {
    const payload = buildFieldPresetsExportPayload(list);
    if (payload.length === 0) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const slugPart = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'preset';

  const handleExport = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadPresetsJson(presets, `field-presets-${stamp}.json`);
  }, [presets, downloadPresetsJson]);

  const handleExportOne = (preset) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const name = slugPart(preset.name);
    const view = slugPart(preset.view || DEFAULT_EXAM_VIEW);
    downloadPresetsJson([preset], `field-preset-${name}-${view}-${stamp}.json`);
  };

  useEffect(() => {
    if (createTick > 0) openCreate();
  }, [createTick, openCreate]);

  useEffect(() => {
    if (importTick > 0) openImport();
  }, [importTick, openImport]);

  useEffect(() => {
    if (exportTick > 0) handleExport();
  }, [exportTick, handleExport]);

  const openEdit = (preset) => {
    setForm({
      id: preset.id,
      name: preset.name,
      serviceValue: preset.serviceValue,
      view: preset.view || DEFAULT_EXAM_VIEW,
      fields: preset.fields,
    });
    setFormError('');
  };

  const closeEditor = () => {
    setForm(null);
    setFormError('');
  };

  const patchForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (formError) setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setFormError('Preset name is required.');
    if (!form.serviceValue.trim()) return setFormError('Choose the service this preset is for.');
    if (!form.view) return setFormError('Choose the exam page this preset is for.');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        serviceValue: form.serviceValue,
        view: form.view,
        fields: form.fields,
      };
      if (form.id) await updateExamPreset(form.id, payload);
      else await createExamPreset(payload);
      closeEditor();
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the preset'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (preset) => {
    const ok = await confirm({
      title: 'Delete preset?',
      message: `Delete the preset "${preset.name}"?`,
      tertiary: 'Exam tables already created from it are not affected.',
      confirmLabel: 'Delete preset',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteExamPreset(preset.id);
      await load();
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not delete the preset'));
    }
  };

  const parsedImportPresets = useMemo(() => parseFieldPresetsImportText(importText), [importText]);

  const handleImportFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImportText(await file.text());
      setImportError('');
    } catch {
      setImportError('Could not read that file.');
    }
  };

  const handleApplyImport = async () => {
    if (parsedImportPresets.length === 0) {
      setImportError('No valid presets found. Upload an Export JSON file.');
      return;
    }
    setImporting(true);
    try {
      await bulkSaveExamPresets(parsedImportPresets);
      setIsImportOpen(false);
      setImportText('');
      setImportError('');
      await load();
    } catch (err) {
      setImportError(apiErrorMessage(err, 'Could not import presets'));
    } finally {
      setImporting(false);
    }
  };

  // One preset per (service, page). Same service can have presets on other pages.
  const usedPairs = new Set(
    presets.filter((p) => p.id !== form?.id).map((p) => pairKey(p.serviceValue, p.view || DEFAULT_EXAM_VIEW)),
  );
  const serviceChoices = serviceOptions.filter((o) => {
    if (!form?.view) return true;
    return !usedPairs.has(pairKey(o, form.view));
  });
  const hasCurrentInChoices = !form?.serviceValue || serviceChoices.includes(form.serviceValue);

  const missingCenterList = serviceOptions.filter(
    (o) => !presets.some(
      (p) => p.serviceValue.toLowerCase() === String(o).toLowerCase()
        && String(p.view || DEFAULT_EXAM_VIEW) === DEFAULT_EXAM_VIEW,
    ),
  );

  // Filter bar: free-text search plus service and page filters.
  const filterServices = useMemo(
    () => [...new Set(presets.map((p) => p.serviceValue).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [presets],
  );
  const visiblePresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets.filter((p) => {
      const view = p.view || DEFAULT_EXAM_VIEW;
      if (serviceFilter && p.serviceValue !== serviceFilter) return false;
      if (viewFilter && view !== viewFilter) return false;
      if (!q) return true;
      return [p.name, p.serviceValue, examViewLabel(view), ...(p.fields || []).map((f) => f.label)]
        .some((t) => String(t || '').toLowerCase().includes(q));
    });
  }, [presets, query, serviceFilter, viewFilter]);
  const filtersActive = Boolean(query || serviceFilter || viewFilter);
  const clearFilters = () => {
    setQuery('');
    setServiceFilter('');
    setViewFilter('');
  };

  return (
    <div className="fpp">
      {loadError && <div className="fpp-error" role="alert">{loadError}</div>}

      {loading ? (
        <p className="fpp-muted">Loading presets…</p>
      ) : presets.length === 0 ? (
        <div className="config-empty-state">
          <LayoutTemplate size={22} />
          <div>
            <h4 className="config-empty-title">No field presets yet</h4>
            <p className="config-empty-hint">
              Create one preset per service and exam page. Opening that page on a matching exam
              recommends this field set.
            </p>
          </div>
          <div className="config-empty-actions">
            <button type="button" className="config-add-btn secondary" onClick={openImport}>
              <Upload size={14} />
              <span>Import</span>
            </button>
            <button type="button" className="config-add-btn primary" onClick={openCreate}>
              <Plus size={15} />
              <span>New preset</span>
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="fpp-filters" role="search">
          <label className="fpp-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search presets, services or fields…"
              aria-label="Search presets"
            />
            {query && (
              <button type="button" className="fpp-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <select className="fpp-filter-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} aria-label="Filter by service">
            <option value="">All services</option>
            {filterServices.map((svc) => <option key={svc} value={svc}>{svc}</option>)}
          </select>
          <select className="fpp-filter-select" value={viewFilter} onChange={(e) => setViewFilter(e.target.value)} aria-label="Filter by exam page">
            <option value="">All pages</option>
            {EXAM_VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <span className="fpp-filter-count" aria-live="polite">
            {visiblePresets.length} of {presets.length}
          </span>
          {filtersActive && (
            <button type="button" className="fpp-filter-clear" onClick={clearFilters}>Clear</button>
          )}
        </div>

        {visiblePresets.length === 0 ? (
          <p className="fpp-muted fpp-no-match">No presets match these filters.</p>
        ) : (
        <ul className="fpp-grid fpp-grid--compact">
          {visiblePresets.map((preset) => {
            const viewLabel = examViewLabel(preset.view || DEFAULT_EXAM_VIEW);
            return (
            <li key={preset.id} className="fpp-card">
              <div className="fpp-card-head">
                <span className="fpp-card-icon" aria-hidden="true"><LayoutTemplate size={18} /></span>
                <div className="fpp-card-titles">
                  <span className="fpp-card-title" title={preset.name}>{preset.name}</span>
                  <span className="fpp-card-service" title={`${preset.serviceValue} · ${viewLabel}`}>
                    {preset.fieldCount} field{preset.fieldCount === 1 ? '' : 's'}
                    <span className="fpp-card-view"> · {preset.serviceValue} · {viewLabel}</span>
                  </span>
                </div>
                <div className="fpp-card-actions">
                  <button
                    type="button"
                    className="config-icon-btn"
                    title="Export this preset"
                    aria-label={`Export ${preset.name}`}
                    onClick={() => handleExportOne(preset)}
                  >
                    <Download size={14} />
                  </button>
                  <button type="button" className="config-icon-btn" title="Edit preset" aria-label={`Edit ${preset.name}`} onClick={() => openEdit(preset)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="config-icon-btn danger" title="Delete preset" aria-label={`Delete ${preset.name}`} onClick={() => handleDelete(preset)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="fpp-card-chips">
                {preset.fields.slice(0, 5).map((f) => (
                  <span key={f.key} className="fpp-chip">{f.label}</span>
                ))}
                {preset.fields.length > 5 && (
                  <span className="fpp-chip fpp-chip--more">+{preset.fields.length - 5} more</span>
                )}
              </div>
            </li>
            );
          })}
        </ul>
        )}
        </>
      )}

      {!loading && presets.length > 0 && missingCenterList.length > 0 && (
        <p className="fpp-muted">
          No Center list preset yet for: {missingCenterList.join(', ')}. Those exams start that page empty.
        </p>
      )}

      <ExamFieldBuilder
        open={Boolean(form)}
        fields={form?.fields || []}
        title={form?.id ? 'Edit preset' : 'New preset'}
        subtitle={
          form
            ? `${form.fields.length} field${form.fields.length === 1 ? '' : 's'} · ${examViewLabel(form.view)} · ${form.serviceValue || 'service'}`
            : undefined
        }
        examSourceFields={loadExamFields()}
        enableFromExam
        currentView={form?.view}
        presetSources={presets.filter((p) => p.id !== form?.id)}
        bulkWorkingContext={
          form
            ? [
                'Field preset',
                form.name?.trim() || null,
                form.serviceValue?.trim() || null,
                examViewLabel(form.view),
              ]
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        onClose={() => !saving && closeEditor()}
        onChange={(fields) => patchForm({ fields })}
        topSlot={
          form && (
            <div className="fpp-meta">
              {formError && <div className="config-form-error" role="alert">{formError}</div>}

              <div className="config-form-group">
                <label htmlFor={`${formId}-name`}>Preset name</label>
                <input
                  id={`${formId}-name`}
                  type="text"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  placeholder="e.g. Bio-Metric · Mock Day"
                  maxLength={120}
                  autoFocus
                />
              </div>

              <div className="fpp-meta-row">
                <div className="config-form-group">
                  <label htmlFor={`${formId}-service`}>Service</label>
                  {serviceOptions.length > 0 ? (
                    <select
                      id={`${formId}-service`}
                      value={form.serviceValue}
                      onChange={(e) => patchForm({ serviceValue: e.target.value })}
                    >
                      <option value="">Select a service…</option>
                      {!hasCurrentInChoices && form.serviceValue && (
                        <option value={form.serviceValue}>{form.serviceValue}</option>
                      )}
                      {serviceChoices.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`${formId}-service`}
                      type="text"
                      value={form.serviceValue}
                      onChange={(e) => patchForm({ serviceValue: e.target.value })}
                      placeholder="Must match the exam's Service value"
                      maxLength={191}
                    />
                  )}
                </div>

                <div className="config-form-group">
                  <label htmlFor={`${formId}-view`}>Exam page</label>
                  <select
                    id={`${formId}-view`}
                    value={form.view}
                    onChange={(e) => patchForm({ view: e.target.value })}
                  >
                    {EXAM_VIEWS.map((v) => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="fpp-muted">
                One preset per service and page. An exam only recommends the preset that matches both.
              </p>
            </div>
          )
        }
        footer={
          <>
            <button type="button" className="exams-btn secondary compact" onClick={closeEditor} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="exams-btn primary compact" onClick={handleSave} disabled={saving}>
              <span>{saving ? 'Saving…' : form?.id ? 'Save' : 'Create'}</span>
            </button>
          </>
        }
      />

      {isImportOpen && (
        <div className="config-modal-overlay" onClick={() => !importing && setIsImportOpen(false)}>
          <div
            className="config-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import field presets"
          >
            <div className="config-drawer-header">
              <h2 className="config-drawer-title">
                <ListPlus size={16} className="config-drawer-title-icon" />
                <span>Import field presets</span>
              </h2>
              <button
                type="button"
                className="config-drawer-close"
                onClick={() => !importing && setIsImportOpen(false)}
                title="Close"
                aria-label="Close"
                disabled={importing}
              >
                <X size={16} />
              </button>
            </div>

            <div className="config-modal-body">
              {importError && <div className="config-form-error">{importError}</div>}
              <p className="config-bulk-hint">
                Upload an Export JSON file. Matching service + exam page updates the existing
                preset; new pairs create presets.
              </p>

              <div className="config-bulk-file-row">
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json,application/json,text/plain"
                  className="config-bulk-file-input"
                  onChange={handleImportFileSelected}
                />
                <button
                  type="button"
                  className="config-add-btn secondary"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                >
                  <FileUp size={14} />
                  <span>Choose file</span>
                </button>
                <span className="config-bulk-file-hint">.json from Export</span>
              </div>

              <div className="config-bulk-example-box">
                <span className="config-bulk-example-title">JSON shape:</span>
                <pre className="config-bulk-example-code">
{`[
  {
    "name": "Bio Exam",
    "serviceValue": "Bio-Metric",
    "view": "exam-day",
    "fields": [ /* field defs */ ]
  }
]`}
                </pre>
              </div>

              <textarea
                className="config-bulk-textarea large"
                rows={8}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (importError) setImportError('');
                }}
                placeholder="Paste Export JSON here, or choose a file…"
                autoFocus
              />

              {parsedImportPresets.length > 0 && (
                <div className="config-bulk-parsed-preview">
                  <span className="config-bulk-badge">
                    {parsedImportPresets.length} preset
                    {parsedImportPresets.length === 1 ? '' : 's'} detected:
                  </span>
                  <div className="config-bulk-lists-summary">
                    {parsedImportPresets.map((p, i) => (
                      <div key={`${p.serviceValue}-${p.view}-${i}`} className="config-bulk-list-pill">
                        <strong>{p.name}</strong>
                        {' '}({p.serviceValue} · {examViewLabel(p.view)} · {p.fields.length} fields)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="config-drawer-footer">
              <button
                type="button"
                className="config-btn secondary"
                onClick={() => setIsImportOpen(false)}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="config-btn primary"
                disabled={parsedImportPresets.length === 0 || importing}
                onClick={handleApplyImport}
              >
                <Upload size={14} />
                <span>
                  {importing
                    ? 'Importing…'
                    : `Import ${parsedImportPresets.length > 0 ? `${parsedImportPresets.length} ` : ''}Presets`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
