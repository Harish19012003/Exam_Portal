import { useConfirm } from '../../feedback';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
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

const emptyForm = () => ({ id: null, name: '', serviceValue: '', fields: [] });

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
    setForm({ id: preset.id, name: preset.name, serviceValue: preset.serviceValue, fields: preset.fields });
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
    setSaving(true);
    try {
      const payload = { name: form.name, serviceValue: form.serviceValue, fields: form.fields };
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

  const usedServices = new Set(presets.filter((p) => p.id !== form?.id).map((p) => p.serviceValue.toLowerCase()));
  const serviceChoices = serviceOptions.filter((o) => !usedServices.has(String(o).toLowerCase()));
  const hasCurrentInChoices = !form?.serviceValue || serviceChoices.includes(form.serviceValue);
  const missingServices = serviceOptions.filter((o) => !presets.some((p) => p.serviceValue.toLowerCase() === String(o).toLowerCase()));

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
              Create one preset per service. New exams of that service get their table pre-filled with its fields.
            </p>
          </div>
          <button type="button" className="config-add-btn primary" onClick={openCreate}>
            <Plus size={15} />
            <span>New preset</span>
          </button>
        </div>
      ) : (
        <ul className="config-dropdown-list">
          {presets.map((preset) => (
            <li key={preset.id} className="config-dropdown-row">
              <div className="config-dropdown-row-main">
                <div className="config-dropdown-row-meta">
                  <span className="config-dropdown-card-title">{preset.name}</span>
                  <span className="config-dropdown-card-count">{preset.fieldCount} fields</span>
                </div>
                <div className="config-dropdown-options-preview">
                  <span className="config-option-chip">Service: {preset.serviceValue}</span>
                  {preset.fields.slice(0, 6).map((f) => (
                    <span key={f.key} className="config-option-chip">{f.label}</span>
                  ))}
                  {preset.fields.length > 6 && (
                    <span className="config-option-chip">+{preset.fields.length - 6} more</span>
                  )}
                </div>
              </div>
              <div className="config-dropdown-card-actions">
                <button type="button" className="config-icon-btn" title="Edit preset" aria-label={`Edit ${preset.name}`} onClick={() => openEdit(preset)}>
                  <Pencil size={13} />
                </button>
                <button type="button" className="config-icon-btn danger" title="Delete preset" aria-label={`Delete ${preset.name}`} onClick={() => handleDelete(preset)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && presets.length > 0 && missingServices.length > 0 && (
        <p className="fpp-muted">
          No preset yet for: {missingServices.join(', ')}. Exams of these services start with an empty table.
        </p>
      )}

      <ExamFieldBuilder
        open={Boolean(form)}
        fields={form?.fields || []}
        title={form?.id ? 'Edit preset' : 'New preset'}
        subtitle={
          form
            ? `${form.fields.length} field${form.fields.length === 1 ? '' : 's'} · new exams of this service start with them`
            : undefined
        }
        examSourceFields={loadExamFields()}
        enableFromExam
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
                  placeholder="e.g. Frisking fields"
                  maxLength={120}
                  autoFocus
                />
              </div>

              <div className="config-form-group">
                <label htmlFor={`${formId}-service`}>Service</label>
                {serviceOptions.length > 0 ? (
                  <select
                    id={`${formId}-service`}
                    value={form.serviceValue}
                    onChange={(e) => patchForm({ serviceValue: e.target.value })}
                  >
                    <option value="">Select a service…</option>
                    {!hasCurrentInChoices && <option value={form.serviceValue}>{form.serviceValue}</option>}
                    {serviceChoices.map((o) => <option key={o} value={o}>{o}</option>)}
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
                <p className="fpp-muted">Each service can have one preset.</p>
              </div>
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
