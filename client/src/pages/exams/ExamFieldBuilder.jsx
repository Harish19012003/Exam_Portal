import React, { useEffect, useId, useState } from 'react';
import {
  Settings2,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  Hash,
  Calendar,
  List,
  ToggleLeft,
  Link2,
  Image,
  Paperclip,
  Star,
  Percent,
  Mail,
  Phone,
  Code2,
  Tags,
  Circle,
  Sigma,
  Layers,
  Clock,
  BadgeCheck,
  SquareCheck,
} from 'lucide-react';
import {
  EXAM_FIELD_TYPES,
  AUTO_FILL_OPTIONS,
  OPTIONS_FIELD_TYPES,
  CHOICE_FIELD_TYPES,
  DATE_LINK_TYPES,
  emptyFieldForm,
  slugifyKey,
  loadConfigDropdownLists,
  getConfigListOptions,
  getDateLinkCandidates,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';

const TYPE_ICONS = {
  text: Type,
  code: Code2,
  mono: Code2,
  email: Mail,
  phone: Phone,
  number: Hash,
  currency: Hash,
  date: Calendar,
  datetime: Calendar,
  time: Clock,
  dropdown: List,
  multiselect: List,
  status: BadgeCheck,
  tags: Tags,
  boolean: ToggleLeft,
  checkbox: SquareCheck,
  dot: Circle,
  progress: Percent,
  rating: Star,
  link: Link2,
  image: Image,
  attachment: Paperclip,
  icon: Image,
  formula: Sigma,
  composite: Layers,
};

export const ExamFieldBuilder = ({ open, fields, onClose, onChange }) => {
  const formId = useId();
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyFieldForm);
  const [error, setError] = useState('');
  const [typesOpen, setTypesOpen] = useState(false);

  const isEditing = Boolean(form.id);
  const needsOptions = OPTIONS_FIELD_TYPES.has(form.dataType);
  const isChoiceField = CHOICE_FIELD_TYPES.has(form.dataType);
  const needsFormula = form.dataType === 'formula';
  const isDateLinkable = DATE_LINK_TYPES.has(form.dataType);
  const configLists = loadConfigDropdownLists();
  const configListOptions = configLists.map((l) => ({
    value: l.id,
    label: `${l.name} (${(l.options || []).length})`,
  }));
  const previewConfigOptions =
    form.optionsSource === 'config' && form.configListId
      ? getConfigListOptions(form.configListId)
      : [];
  const dateLinkOptions = [
    { value: '', label: 'None' },
    ...getDateLinkCandidates(fields, form.id).map((f) => ({
      value: f.key,
      label: f.label,
    })),
  ];

  useEffect(() => {
    if (!open) {
      setEditorOpen(false);
      setForm(emptyFieldForm());
      setError('');
      setTypesOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editorOpen) {
          setEditorOpen(false);
          setForm(emptyFieldForm());
          setError('');
        } else {
          onClose();
        }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, editorOpen, onClose]);

  if (!open) return null;

  const typeLabel = (value) =>
    EXAM_FIELD_TYPES.find((t) => t.value === value)?.label || value;

  const fieldMeta = (field) => {
    const parts = [typeLabel(field.dataType)];
    if (field.allowMultiple) parts.push('Multi');
    if (field.optionsSource === 'config') parts.push('Config');
    if (field.autoFill && field.autoFill !== 'none') parts.push('Auto');
    if (field.sameAsFieldKey) parts.push('Same-as');
    if (field.required) parts.push('Required');
    if (field.layout === 'half') parts.push('Half');
    return parts.join(' · ');
  };

  const openCreate = (dataType = 'text') => {
    setForm({
      ...emptyFieldForm(),
      dataType,
      allowMultiple: dataType === 'multiselect',
    });
    setError('');
    setTypesOpen(false);
    setEditorOpen(true);
  };

  const openEdit = (field) => {
    setForm({
      id: field.id,
      label: field.label,
      dataType: field.dataType,
      required: Boolean(field.required),
      optionsText: (field.options || []).join('\n'),
      formula: field.formula || '',
      autoFill: field.autoFill || 'none',
      layout: field.layout || 'full',
      optionsSource: field.optionsSource || 'manual',
      configListId: field.configListId || '',
      allowMultiple: Boolean(field.allowMultiple) || field.dataType === 'multiselect',
      sameAsFieldKey: field.sameAsFieldKey || '',
      sameAsDefaultOn: field.sameAsDefaultOn !== false,
    });
    setError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setForm(emptyFieldForm());
    setError('');
  };

  const parseOptions = (text) =>
    String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = (e) => {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) {
      setError('Field label is required.');
      return;
    }

    const optionsSource = isChoiceField || form.dataType === 'tags'
      ? form.optionsSource || 'manual'
      : 'manual';

    let options = [];
    if (needsOptions) {
      if (optionsSource === 'config') {
        if (!form.configListId) {
          setError('Select a Config dropdown list.');
          return;
        }
        options = getConfigListOptions(form.configListId);
        if (options.length === 0) {
          setError('Selected Config list has no options.');
          return;
        }
      } else {
        options = parseOptions(form.optionsText);
        if (options.length === 0) {
          setError('Add at least one option (one per line).');
          return;
        }
      }
    }

    if (needsFormula && !form.formula.trim()) {
      setError('Formula expression is required.');
      return;
    }

    const key = slugifyKey(label);
    const duplicate = fields.some(
      (f) => f.id !== form.id && (f.key === key || f.label.toLowerCase() === label.toLowerCase())
    );
    if (duplicate) {
      setError('A field with this name already exists.');
      return;
    }

    const allowMultiple = isChoiceField ? Boolean(form.allowMultiple) : false;
    const canLinkDate = DATE_LINK_TYPES.has(form.dataType);

    const payload = {
      label,
      key,
      dataType: form.dataType,
      required: form.autoFill && form.autoFill !== 'none' ? false : form.required,
      options: optionsSource === 'manual' ? options : [],
      optionsSource,
      configListId: optionsSource === 'config' ? form.configListId : '',
      allowMultiple,
      formula: needsFormula ? form.formula.trim() : undefined,
      autoFill: form.autoFill || 'none',
      layout: form.layout || 'full',
      sameAsFieldKey: canLinkDate ? form.sameAsFieldKey || '' : '',
      sameAsDefaultOn: canLinkDate ? form.sameAsDefaultOn !== false : true,
    };

    if (isEditing) {
      onChange(fields.map((f) => (f.id === form.id ? { ...f, ...payload } : f)));
    } else {
      onChange([
        ...fields,
        {
          id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...payload,
          order: fields.length + 1,
        },
      ]);
    }
    closeEditor();
  };

  const handleDelete = (id) => {
    const target = fields.find((f) => f.id === id);
    if (!target) return;
    if (!window.confirm(`Delete field "${target.label}"?`)) return;
    onChange(
      fields
        .filter((f) => f.id !== id)
        .map((f, i) => ({
          ...f,
          order: i + 1,
          sameAsFieldKey: f.sameAsFieldKey === target.key ? '' : f.sameAsFieldKey,
        }))
    );
  };

  const moveField = (id, direction) => {
    const index = fields.findIndex((f) => f.id === id);
    if (index < 0) return;
    const next = index + direction;
    if (next < 0 || next >= fields.length) return;
    const copy = [...fields];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy.map((f, i) => ({ ...f, order: i + 1 })));
  };

  return (
    <div className="exams-drawer-overlay" onClick={onClose}>
      <aside
        className="exams-drawer exams-field-builder"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Field builder"
      >
        <div className="exams-drawer-header exams-drawer-header-compact">
          <div className="exams-field-header-text">
            <h2 className="exams-drawer-title">
              <Settings2 size={16} className="exams-drawer-title-icon" />
              <span>{editorOpen ? (isEditing ? 'Edit field' : 'New field') : 'Fields'}</span>
            </h2>
            {!editorOpen && (
              <p className="exams-field-header-sub">
                {fields.length === 0
                  ? 'Pick a type to add to the create form'
                  : `${fields.length} custom field${fields.length === 1 ? '' : 's'}`}
              </p>
            )}
          </div>
          <button
            type="button"
            className="exams-drawer-close compact"
            onClick={editorOpen ? closeEditor : onClose}
            title={editorOpen ? 'Back' : 'Close'}
            aria-label={editorOpen ? 'Back' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {!editorOpen ? (
          <div className="exams-drawer-body exams-field-list-body">
            {fields.length > 0 && (
              <div className="exams-fields-panel">
                <div className="exams-field-section-bar">
                  <span>Fields · {fields.length}</span>
                  <button
                    type="button"
                    className="exams-text-add-btn"
                    onClick={() => setTypesOpen((v) => !v)}
                    aria-expanded={typesOpen}
                  >
                    <Plus size={13} />
                    {typesOpen ? 'Close' : 'Add'}
                  </button>
                </div>

                <ul className="exams-field-list">
                  {fields.map((field, index) => {
                    const Icon = TYPE_ICONS[field.dataType] || Type;
                    return (
                      <li key={field.id} className="exams-field-row">
                        <button
                          type="button"
                          className="exams-field-row-main"
                          onClick={() => openEdit(field)}
                          title={`Edit ${field.label}`}
                        >
                          <span className="exams-field-index">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="exams-field-icon-wrap" aria-hidden="true">
                            <Icon size={14} strokeWidth={2} />
                          </span>
                          <span className="exams-field-text">
                            <span className="exams-field-row-label">{field.label}</span>
                            <span className="exams-field-row-meta">{fieldMeta(field)}</span>
                          </span>
                        </button>

                        <div className="exams-field-row-actions">
                          <button
                            type="button"
                            className="exams-icon-btn"
                            disabled={index === 0}
                            onClick={() => moveField(field.id, -1)}
                            aria-label="Move up"
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="exams-icon-btn"
                            disabled={index === fields.length - 1}
                            onClick={() => moveField(field.id, 1)}
                            aria-label="Move down"
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="exams-icon-btn"
                            onClick={() => openEdit(field)}
                            aria-label={`Edit ${field.label}`}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="exams-icon-btn danger"
                            onClick={() => handleDelete(field.id)}
                            aria-label={`Delete ${field.label}`}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {(fields.length === 0 || typesOpen) && (
              <div className={`exams-type-picker ${fields.length > 0 ? 'with-fields' : ''}`}>
                <div className="exams-field-section-bar">
                  <span>{fields.length === 0 ? 'Choose a field type' : 'Add field type'}</span>
                </div>
                <div className="exams-type-grid">
                  {EXAM_FIELD_TYPES.map((t) => {
                    const Icon = TYPE_ICONS[t.value] || Type;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        className="exams-type-tile"
                        onClick={() => openCreate(t.value)}
                        title={`Add ${t.label} field`}
                      >
                        <Icon size={14} strokeWidth={2} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form className="exams-drawer-form" onSubmit={handleSave}>
            <div className="exams-drawer-body">
              {error && <div className="exams-form-error">{error}</div>}

              <div className="exams-form-group">
                <label htmlFor={`${formId}-label`}>Label</label>
                <input
                  id={`${formId}-label`}
                  type="text"
                  value={form.label}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, label: e.target.value }));
                    if (error) setError('');
                  }}
                  placeholder="e.g. Exam Type"
                  required
                  autoFocus
                />
              </div>

              <SearchableSelect
                id={`${formId}-type`}
                label="Field type"
                value={form.dataType}
                options={EXAM_FIELD_TYPES}
                searchPlaceholder="Search field types…"
                onChange={(next) => {
                  setForm((p) => ({
                    ...p,
                    dataType: next,
                    allowMultiple: next === 'multiselect' ? true : p.allowMultiple,
                    sameAsFieldKey: DATE_LINK_TYPES.has(next) ? p.sameAsFieldKey : '',
                  }));
                  if (error) setError('');
                }}
              />

              <div className="exams-form-row">
                <SearchableSelect
                  id={`${formId}-autofill`}
                  label="Auto-fill"
                  value={form.autoFill || 'none'}
                  options={AUTO_FILL_OPTIONS}
                  searchPlaceholder="Search…"
                  onChange={(next) =>
                    setForm((p) => ({
                      ...p,
                      autoFill: next,
                      required: next !== 'none' ? false : p.required,
                    }))
                  }
                />
                <div className="exams-form-group">
                  <label htmlFor={`${formId}-layout`}>Width</label>
                  <select
                    id={`${formId}-layout`}
                    value={form.layout || 'full'}
                    onChange={(e) => setForm((p) => ({ ...p, layout: e.target.value }))}
                  >
                    <option value="full">Full width</option>
                    <option value="half">Half (side by side)</option>
                  </select>
                </div>
              </div>

              {(!form.autoFill || form.autoFill === 'none') && (
                <label className="exams-check-row">
                  <input
                    type="checkbox"
                    checked={form.required}
                    onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                  />
                  <span>Required on create form</span>
                </label>
              )}

              {isDateLinkable && (
                <div className="exams-options-block">
                  <SearchableSelect
                    id={`${formId}-same-as`}
                    label="Same as date field"
                    value={form.sameAsFieldKey || ''}
                    options={dateLinkOptions}
                    placeholder="None"
                    searchPlaceholder="Search date fields…"
                    onChange={(next) =>
                      setForm((p) => ({
                        ...p,
                        sameAsFieldKey: next,
                        sameAsDefaultOn: next ? p.sameAsDefaultOn !== false : true,
                      }))
                    }
                  />
                  {form.sameAsFieldKey ? (
                    <label className="exams-check-row">
                      <input
                        type="checkbox"
                        checked={form.sameAsDefaultOn !== false}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sameAsDefaultOn: e.target.checked }))
                        }
                      />
                      <span>Default “same as” ON in create form</span>
                    </label>
                  ) : (
                    <p className="exams-config-empty-hint">
                      {dateLinkOptions.length > 1
                        ? 'Pick another date field to mirror on the create form.'
                        : 'Add another date field first, then you can link this one to it.'}
                    </p>
                  )}
                </div>
              )}

              {needsOptions && (
                <div className="exams-options-block">
                  {(isChoiceField || form.dataType === 'tags') && (
                    <div className="exams-form-group">
                      <span className="exams-audit-label">Options source</span>
                      <div className="exams-source-toggle" role="group" aria-label="Options source">
                        <button
                          type="button"
                          className={`exams-source-btn ${(form.optionsSource || 'manual') === 'manual' ? 'active' : ''}`}
                          onClick={() => {
                            setForm((p) => ({ ...p, optionsSource: 'manual' }));
                            if (error) setError('');
                          }}
                        >
                          Manual
                        </button>
                        <button
                          type="button"
                          className={`exams-source-btn ${form.optionsSource === 'config' ? 'active' : ''}`}
                          onClick={() => {
                            setForm((p) => ({ ...p, optionsSource: 'config' }));
                            if (error) setError('');
                          }}
                        >
                          Config list
                        </button>
                      </div>
                    </div>
                  )}

                  {isChoiceField && (
                    <label className="exams-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(form.allowMultiple)}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, allowMultiple: e.target.checked }))
                        }
                      />
                      <span>Allow multiple selection</span>
                    </label>
                  )}

                  {(form.optionsSource || 'manual') === 'manual' ? (
                    <div className="exams-form-group">
                      <label htmlFor={`${formId}-options`}>Options (one per line)</label>
                      <textarea
                        id={`${formId}-options`}
                        value={form.optionsText}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, optionsText: e.target.value }));
                          if (error) setError('');
                        }}
                        placeholder={'Active\nInactive\nPending'}
                        rows={5}
                      />
                    </div>
                  ) : configListOptions.length === 0 ? (
                    <p className="exams-config-empty-hint">
                      No Config lists yet. Create one in Settings → Config, then come back.
                    </p>
                  ) : (
                    <>
                      <SearchableSelect
                        id={`${formId}-config-list`}
                        label="Config dropdown list"
                        value={form.configListId || ''}
                        options={configListOptions}
                        placeholder="Select a list…"
                        searchPlaceholder="Search lists…"
                        onChange={(next) => {
                          setForm((p) => ({ ...p, configListId: next }));
                          if (error) setError('');
                        }}
                      />
                      {previewConfigOptions.length > 0 && (
                        <div className="exams-config-preview">
                          <span className="exams-audit-label">Live options (follows Config)</span>
                          <div className="exams-options-chips">
                            {previewConfigOptions.map((opt) => (
                              <span key={opt} className="exams-option-chip">
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {needsFormula && (
                <div className="exams-form-group">
                  <label htmlFor={`${formId}-formula`}>Formula</label>
                  <input
                    id={`${formId}-formula`}
                    type="text"
                    value={form.formula}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, formula: e.target.value }));
                      if (error) setError('');
                    }}
                    placeholder="e.g. {shifts} * {centres}"
                  />
                </div>
              )}
            </div>

            <div className="exams-drawer-footer exams-drawer-footer-compact">
              <button type="button" className="exams-btn secondary compact" onClick={closeEditor}>
                Cancel
              </button>
              <button type="submit" className="exams-btn primary compact">
                <Plus size={14} />
                <span>{isEditing ? 'Save' : 'Create'}</span>
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};
