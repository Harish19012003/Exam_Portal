import React, { useEffect, useId, useState } from 'react';
import {
  Settings2,
  Plus,
  X,
  Pencil,
  Trash2,
  GripVertical,
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
  ListPlus,
} from 'lucide-react';
import {
  EXAM_FIELD_TYPES,
  AUTO_FILL_OPTIONS,
  OPTIONS_FIELD_TYPES,
  CHOICE_FIELD_TYPES,
  DATE_LINK_TYPES,
  emptyFieldForm,
  slugifyKey,
  normalizeFieldKey,
  isValidFieldKey,
  loadConfigDropdownLists,
  getConfigListOptions,
  getDateLinkCandidates,
} from './examFieldTypes';
import { SearchableSelect } from './SearchableSelect';
import { parseBulkFields, toFieldDefinition } from './examBulkFields';

const BULK_PLACEHOLDER = `Roll No*
Candidate Name*
Marks | number
Exam Date | date
Center | dropdown | Lucknow, Delhi, Noida
Present | yes/no`;

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
  const [dragFieldId, setDragFieldId] = useState(null);
  const [dragOverFieldId, setDragOverFieldId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('text');
  const bulkTypes = EXAM_FIELD_TYPES.filter((t) => t.value !== 'formula' && t.value !== 'composite');
  const bulkResult = bulkOpen
    ? parseBulkFields(bulkText, fields, { defaultType: bulkType, types: EXAM_FIELD_TYPES })
    : { items: [], valid: [] };

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
      setBulkOpen(false);
      setBulkText('');
      setBulkType('text');
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
        } else if (bulkOpen) {
          setBulkOpen(false);
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
  }, [open, editorOpen, bulkOpen, onClose]);

  if (!open) return null;

  const typeLabel = (value) =>
    EXAM_FIELD_TYPES.find((t) => t.value === value)?.label || value;

  const fieldMeta = (field) => {
    const parts = [];
    if (field.key) parts.push(field.key);
    parts.push(typeLabel(field.dataType));
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
      key: field.key || '',
      keyTouched: true,
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

  const openBulk = () => {
    setTypesOpen(false);
    setBulkOpen(true);
  };

  const closeBulk = () => {
    setBulkOpen(false);
    setBulkText('');
  };

  const handleBulkAdd = (e) => {
    e.preventDefault();
    if (!bulkResult.valid.length) return;
    onChange([
      ...fields,
      ...bulkResult.valid.map((item, i) => toFieldDefinition(item, fields.length + i + 1)),
    ]);
    closeBulk();
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

    // Key is locked after create — editing keeps the existing key forever
    const existing = isEditing ? fields.find((f) => f.id === form.id) : null;
    const key = isEditing
      ? existing?.key || normalizeFieldKey(form.key) || slugifyKey(label)
      : normalizeFieldKey(form.key) || slugifyKey(label);

    if (!isValidFieldKey(key)) {
      setError('Key must start with a letter and use only a–z, 0–9, underscore.');
      return;
    }

    const duplicateKey = fields.some((f) => f.id !== form.id && f.key === key);
    const duplicateLabel = fields.some(
      (f) => f.id !== form.id && f.label.toLowerCase() === label.toLowerCase(),
    );
    if (duplicateKey) {
      setError('A field with this key already exists.');
      return;
    }
    if (duplicateLabel) {
      setError('A field with this label already exists.');
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

  const reorderFields = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = fields.findIndex((f) => f.id === fromId);
    const toIndex = fields.findIndex((f) => f.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const copy = [...fields];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
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
              <span>{editorOpen ? (isEditing ? 'Edit field' : 'New field') : bulkOpen ? 'Bulk add fields' : 'Fields'}</span>
            </h2>
            {!editorOpen && !bulkOpen && (
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
            onClick={editorOpen ? closeEditor : bulkOpen ? closeBulk : onClose}
            title={editorOpen || bulkOpen ? 'Back' : 'Close'}
            aria-label={editorOpen || bulkOpen ? 'Back' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {bulkOpen ? (
          <form className="exams-drawer-form" onSubmit={handleBulkAdd}>
            <div className="exams-drawer-body">
              <div className="exams-form-group">
                <label htmlFor={`${formId}-bulk`}>Fields (one per line)</label>
                <textarea
                  id={`${formId}-bulk`}
                  rows={9}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={BULK_PLACEHOLDER}
                  spellCheck={false}
                  autoFocus
                />
                <p className="exams-config-empty-hint">
                  Format: <code>Name | type | options</code>. Add <code>*</code> after a name to make it
                  required. Type is optional (uses the default below). You can paste a column from Excel.
                </p>
              </div>

              <div className="exams-form-group">
                <label htmlFor={`${formId}-bulk-type`}>Default type</label>
                <select id={`${formId}-bulk-type`} value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
                  {bulkTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {bulkResult.items.length > 0 && (
                <ul className="exams-field-list exams-bulk-preview" aria-label="Preview">
                  {bulkResult.items.map((item) => (
                    <li key={`${item.line}-${item.label}`} className={`exams-bulk-item${item.error ? ' has-error' : ''}`}>
                      <span className="exams-field-row-label">{item.label || '(empty)'}</span>
                      <span className="exams-field-row-meta">
                        {item.error
                          ? `Line ${item.line}: ${item.error} — skipped`
                          : [item.key, typeLabel(item.dataType), item.required ? 'Required' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="exams-drawer-footer exams-drawer-footer-compact">
              <button type="button" className="exams-btn secondary compact" onClick={closeBulk}>
                Cancel
              </button>
              <button type="submit" className="exams-btn primary compact" disabled={bulkResult.valid.length === 0}>
                <ListPlus size={14} />
                <span>
                  {bulkResult.valid.length === 0
                    ? 'Add fields'
                    : `Add ${bulkResult.valid.length} field${bulkResult.valid.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
          </form>
        ) : !editorOpen ? (
          <div className="exams-drawer-body exams-field-list-body">
            {fields.length > 0 && (
              <div className="exams-fields-panel">
                <div className="exams-field-section-bar">
                  <span>Fields · {fields.length}</span>
                  <span className="exams-field-section-actions">
                    <button type="button" className="exams-text-add-btn" onClick={openBulk}>
                      <ListPlus size={13} />
                      Bulk add
                    </button>
                    <button
                      type="button"
                      className="exams-text-add-btn"
                      onClick={() => setTypesOpen((v) => !v)}
                      aria-expanded={typesOpen}
                    >
                      <Plus size={13} />
                      {typesOpen ? 'Close' : 'Add'}
                    </button>
                  </span>
                </div>

                <ul className="exams-field-list">
                  {fields.map((field) => {
                    const Icon = TYPE_ICONS[field.dataType] || Type;
                    const isDragging = dragFieldId === field.id;
                    const isDragOver = dragOverFieldId === field.id && dragFieldId !== field.id;
                    return (
                      <li
                        key={field.id}
                        className={`exams-field-row${isDragging ? ' is-dragging' : ''}${isDragOver ? ' is-drag-over' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverFieldId !== field.id) setDragOverFieldId(field.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverFieldId === field.id) setDragOverFieldId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromId = e.dataTransfer.getData('text/plain') || dragFieldId;
                          reorderFields(fromId, field.id);
                          setDragFieldId(null);
                          setDragOverFieldId(null);
                        }}
                      >
                        <button
                          type="button"
                          className="exams-field-drag-handle"
                          draggable
                          title="Drag to reorder"
                          aria-label={`Drag to reorder ${field.label}`}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', field.id);
                            setDragFieldId(field.id);
                          }}
                          onDragEnd={() => {
                            setDragFieldId(null);
                            setDragOverFieldId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={16} strokeWidth={2} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          className="exams-field-row-main"
                          onClick={() => openEdit(field)}
                          title={`Edit ${field.label}`}
                        >
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
                  {fields.length === 0 && (
                    <button type="button" className="exams-text-add-btn" onClick={openBulk}>
                      <ListPlus size={13} />
                      Bulk add
                    </button>
                  )}
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
                    const nextLabel = e.target.value;
                    setForm((p) => {
                      const next = { ...p, label: nextLabel };
                      // Auto-fill key from label until the user edits the key (create only)
                      if (!isEditing && !p.keyTouched) {
                        next.key = slugifyKey(nextLabel);
                      }
                      return next;
                    });
                    if (error) setError('');
                  }}
                  placeholder="e.g. Exam Type"
                  required
                  autoFocus
                />
              </div>

              <div className="exams-form-group">
                <label htmlFor={`${formId}-key`}>
                  Key{!isEditing ? ' *' : ''}
                </label>
                <input
                  id={`${formId}-key`}
                  type="text"
                  value={form.key}
                  onChange={(e) => {
                    if (isEditing) return;
                    // Allow typing underscores; full normalize runs on save
                    const raw = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '_')
                      .slice(0, 40);
                    setForm((p) => ({
                      ...p,
                      key: raw,
                      keyTouched: true,
                    }));
                    if (error) setError('');
                  }}
                  placeholder="e.g. exam_type"
                  required={!isEditing}
                  readOnly={isEditing}
                  disabled={isEditing}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={`${formId}-key-hint`}
                />
                <p id={`${formId}-key-hint`} className="exams-field-key-hint">
                  {isEditing
                    ? 'Key is locked after create (used in SQL form values).'
                    : 'Stable id for SQL — letters, numbers, underscore. Auto-filled from label.'}
                </p>
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
