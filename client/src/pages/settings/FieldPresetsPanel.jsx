import { useConfirm } from '../../feedback';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel } from '@exam-view/shared';
import { apiClient } from '../../api/client';
import { ExamFieldBuilder } from '../exams/ExamFieldBuilder';
import { loadExamFields, resolveFieldOptions } from '../exams/examFieldTypes';
import {
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

/** Settings → Config → Field presets. `createTick` increments when the toolbar button is pressed. */
export const FieldPresetsPanel = ({ createTick = 0 }) => {
  const confirm = useConfirm();
  const formId = useId();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serviceOptions, setServiceOptions] = useState([]);
  const [form, setForm] = useState(null); // null = editor closed
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setFormError('');
  }, []);

  useEffect(() => {
    if (createTick > 0) openCreate();
  }, [createTick, openCreate]);

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
          <button type="button" className="config-add-btn primary" onClick={openCreate}>
            <Plus size={15} />
            <span>New preset</span>
          </button>
        </div>
      ) : (
        <ul className="fpp-grid">
          {presets.map((preset) => (
            <li key={preset.id} className="fpp-card">
              <div className="fpp-card-head">
                <span className="fpp-card-icon" aria-hidden="true"><LayoutTemplate size={18} /></span>
                <div className="fpp-card-titles">
                  <span className="fpp-card-title" title={preset.name}>{preset.name}</span>
                  <span className="fpp-card-service">
                    Service: {preset.serviceValue}
                    <span className="fpp-card-view"> · {examViewLabel(preset.view || DEFAULT_EXAM_VIEW)}</span>
                  </span>
                </div>
                <span className="fpp-count-pill">{preset.fieldCount} fields</span>
                <div className="fpp-card-actions">
                  <button type="button" className="config-icon-btn" title="Edit preset" aria-label={`Edit ${preset.name}`} onClick={() => openEdit(preset)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="config-icon-btn danger" title="Delete preset" aria-label={`Delete ${preset.name}`} onClick={() => handleDelete(preset)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="fpp-card-chips">
                {preset.fields.slice(0, 6).map((f) => (
                  <span key={f.key} className="fpp-chip">{f.label}</span>
                ))}
                {preset.fields.length > 6 && (
                  <span className="fpp-chip fpp-chip--more">+{preset.fields.length - 6} more</span>
                )}
              </div>
            </li>
          ))}
        </ul>
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
    </div>
  );
};
