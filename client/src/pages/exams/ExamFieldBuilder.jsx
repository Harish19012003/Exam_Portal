import { useConfirm } from '../../feedback';
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
  PHONE_VALIDATION_PRESETS,
  UNIQUE_FIELD_TYPES,
  emptyFieldForm,
  emptyPhoneValidation,
  isValidRegexPattern,
  slugifyKey,
  normalizeFieldKey,
  isValidFieldKey,
  loadConfigDropdownLists,
  getConfigListOptions,
  getDateLinkCandidates,
} from './examFieldTypes';
import { isLinkedField, isTableSourceField, linkedFieldsOf, listLookupSources } from './tableLookupApi';
import { SearchableSelect } from './SearchableSelect';
import { BulkFieldsModal } from './BulkFieldsModal';
import { ColumnGroupsModal } from './ColumnGroupsModal';
import { humanizeGroup } from './tableLookupApi';

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
  linked: Link2,
};

/**
 * Keep the Linked value fields of one table-column field in step with its ticked columns:
 * add one (right after the field) for each newly ticked column, drop the ones unticked.
 * Linked fields hold no data of their own, so removing one loses nothing.
 */
const syncLinkedFields = (list, source, wantedColumns, columnLabels) => {
  const wanted = source.optionsSource === 'table' ? wantedColumns : [];
  const kept = list.filter((f) => !(isLinkedField(f) && f.linkedFrom.fieldKey === source.key && !wanted.includes(f.linkedFrom.column)));
  const have = new Set(linkedFieldsOf(kept, source.key).map((f) => f.linkedFrom.column));
  const taken = new Set(kept.map((f) => f.key));
  const added = wanted
    .filter((column) => !have.has(column))
    .map((column) => {
      let key = normalizeFieldKey(`${source.key}_${column}`).slice(0, 60) || 'linked';
      for (let n = 2; taken.has(key); n += 1) key = `${key.replace(/_\d+$/, '')}_${n}`;
      taken.add(key);
      return {
        id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: columnLabels[column] || column,
        key,
        dataType: 'linked',
        required: false,
        options: [],
        optionsSource: 'manual',
        configListId: '',
        allowMultiple: false,
        autoFill: 'none',
        layout: 'full',
        sameAsFieldKey: '',
        sameAsDefaultOn: true,
        linkedFrom: { fieldKey: source.key, column },
      };
    });
  if (added.length === 0 && kept.length === list.length) return list;
  const at = kept.findIndex((f) => f.id === source.id);
  const lastLinked = kept.reduce((n, f, i) => (isLinkedField(f) && f.linkedFrom.fieldKey === source.key ? i : n), at);
  const result = [...kept.slice(0, Math.max(at, lastLinked) + 1), ...added, ...kept.slice(Math.max(at, lastLinked) + 1)];
  return result.map((f, i) => ({ ...f, order: i + 1 }));
};

export const ExamFieldBuilder = ({
  open,
  fields,
  onClose,
  onChange,
  title = 'Fields',
  subtitle,
  topSlot = null,
  footer = null,
  reservedKeys = [],
  deleteConfirm,
  bulkModalProps = {},
  startWithNewField = false,
  allowUnique = false,
}) => {
  const formId = useId();
  const confirm = useConfirm();
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyFieldForm);
  const [error, setError] = useState('');
  const [typesOpen, setTypesOpen] = useState(false);
  const [dragFieldId, setDragFieldId] = useState(null);
  const [dragOverFieldId, setDragOverFieldId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [lookupSources, setLookupSources] = useState([]);

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
  const lookupColumns = lookupSources.find((t) => t.table === form.lookupTable)?.columns || [];
  // Linked value: the table-column fields it can read from, and that table's columns.
  const linkSourceFields = fields.filter((f) => isTableSourceField(f) && f.id !== form.id);
  const linkSource = linkSourceFields.find((f) => f.key === form.linkedFieldKey);
  const linkColumns = lookupSources.find((t) => t.table === linkSource?.tableSource?.table)?.columns || [];
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
    }
  }, [open]);

  // Opened from an "Add field" button: jump straight into the new-field form.
  useEffect(() => {
    if (open && startWithNewField) {
      setForm({ ...emptyFieldForm(), dataType: 'text' });
      setError('');
      setTypesOpen(false);
      setEditorOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startWithNewField]);

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

  // Tables a field can read options from (only fetched once the editor shows the "Table column" source).
  const wantsLookupSources = open && editorOpen && (form.optionsSource === 'table' || form.dataType === 'linked');
  useEffect(() => {
    if (!wantsLookupSources || lookupSources.length > 0) return undefined;
    let cancelled = false;
    listLookupSources()
      .then((rows) => {
        if (!cancelled) setLookupSources(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wantsLookupSources, lookupSources.length]);

  if (!open) return null;

  const typeLabel = (value) =>
    EXAM_FIELD_TYPES.find((t) => t.value === value)?.label || value;

  const fieldMeta = (field) => {
    const parts = [];
    if (field.key) parts.push(field.key);
    parts.push(typeLabel(field.dataType));
    if (field.allowMultiple) parts.push('Multi');
    if (field.optionsSource === 'config') parts.push('Config');
    if (field.optionsSource === 'table') parts.push(field.lookupGroup ? `Group · ${humanizeGroup(field.lookupGroup)}` : 'Table');
    if (isLinkedField(field)) parts.push(`from ${field.linkedFrom.fieldKey}.${field.linkedFrom.column}`);
    if (field.autoFill && field.autoFill !== 'none') parts.push('Auto');
    if (field.sameAsFieldKey) parts.push('Same-as');
    if (field.required) parts.push('Required');
    if (field.unique) parts.push('Unique');
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
    const phoneVal = field.phoneValidation || emptyPhoneValidation();
    setForm({
      id: field.id,
      label: field.label,
      key: field.key || '',
      keyTouched: true,
      dataType: field.dataType,
      required: Boolean(field.required),
      unique: Boolean(field.unique),
      optionsText: (field.options || []).join('\n'),
      formula: field.formula || '',
      autoFill: field.autoFill || 'none',
      layout: field.layout || 'full',
      optionsSource: field.optionsSource || 'manual',
      configListId: field.configListId || '',
      lookupTable: field.tableSource?.table || '',
      lookupColumn: field.tableSource?.column || '',
      lookupDetail: field.tableSource?.detailColumn || '',
      fillColumns: linkedFieldsOf(fields, field.key).map((f) => f.linkedFrom.column),
      linkedFieldKey: field.linkedFrom?.fieldKey || '',
      linkedColumn: field.linkedFrom?.column || '',
      allowMultiple: Boolean(field.allowMultiple) || field.dataType === 'multiselect',
      sameAsFieldKey: field.sameAsFieldKey || '',
      sameAsDefaultOn: field.sameAsDefaultOn !== false,
      phoneValidation: {
        mode: phoneVal.mode || 'none',
        pattern: phoneVal.pattern || '',
        message: phoneVal.message || '',
      },
    });
    setError('');
    setEditorOpen(true);
  };

  const openBulk = () => {
    setTypesOpen(false);
    setBulkOpen(true);
  };

  const closeBulk = () => setBulkOpen(false);

  const handleBulkAdd = (newFields, updatedFields = [], removedIds = []) => {
    const updatedById = new Map(updatedFields.map((f) => [f.id, f]));
    const gone = new Set(removedIds);
    onChange(
      [...fields.map((f) => updatedById.get(f.id) || f), ...newFields]
        .filter((f) => !gone.has(f.id))
        .map((f, i) => ({ ...f, order: i + 1 })),
    );
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
      } else if (optionsSource === 'table') {
        if (!form.lookupTable || !form.lookupColumn) {
          setError('Choose the table and column to read options from.');
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

    if (form.dataType === 'linked' && (!form.linkedFieldKey || !form.linkedColumn)) {
      setError('Choose the field to read from and which of its columns to show.');
      return;
    }

    if (needsFormula && !form.formula.trim()) {
      setError('Formula expression is required.');
      return;
    }

    if (form.dataType === 'phone' && form.phoneValidation?.mode === 'custom') {
      const pattern = String(form.phoneValidation.pattern || '').trim();
      if (!pattern) {
        setError('Enter a custom regex pattern for phone validation.');
        return;
      }
      if (!isValidRegexPattern(pattern)) {
        setError('Custom phone regex is invalid.');
        return;
      }
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

    if (key === 'id' || key.startsWith('sys_') || reservedKeys.includes(key)) {
      setError('This key is reserved. Please choose another.');
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

    const phoneValidation =
      form.dataType === 'phone'
        ? {
            mode: form.phoneValidation?.mode || 'none',
            pattern:
              form.phoneValidation?.mode === 'custom'
                ? String(form.phoneValidation.pattern || '').trim()
                : '',
            message: String(form.phoneValidation?.message || '').trim(),
          }
        : undefined;

    const payload = {
      label,
      key,
      dataType: form.dataType,
      required:
        form.dataType === 'linked' || (form.autoFill && form.autoFill !== 'none') ? false : form.required,
      linkedFrom:
        form.dataType === 'linked' ? { fieldKey: form.linkedFieldKey, column: form.linkedColumn } : undefined,
      ...(allowUnique ? { unique: UNIQUE_FIELD_TYPES.has(form.dataType) && Boolean(form.unique) } : {}),
      options: optionsSource === 'manual' ? options : [],
      optionsSource,
      configListId: optionsSource === 'config' ? form.configListId : '',
      lookupGroup: optionsSource === 'table' ? fields.find((f) => f.id === form.id)?.lookupGroup : undefined,
      tableSource:
        optionsSource === 'table'
          ? {
              table: form.lookupTable,
              column: form.lookupColumn,
              ...(form.lookupDetail ? { detailColumn: form.lookupDetail } : {}),
            }
          : undefined,
      allowMultiple,
      formula: needsFormula ? form.formula.trim() : undefined,
      autoFill: form.autoFill || 'none',
      layout: form.layout || 'full',
      sameAsFieldKey: canLinkDate ? form.sameAsFieldKey || '' : '',
      sameAsDefaultOn: canLinkDate ? form.sameAsDefaultOn !== false : true,
      ...(phoneValidation ? { phoneValidation } : { phoneValidation: undefined }),
    };

    const savedField = isEditing
      ? { ...fields.find((f) => f.id === form.id), ...payload }
      : {
          id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...payload,
          order: fields.length + 1,
        };
    const base = isEditing ? fields.map((f) => (f.id === form.id ? savedField : f)) : [...fields, savedField];
    // A table-column field can also fill other fields from the same row (Linked values).
    const columnLabels = Object.fromEntries(lookupColumns.map((c) => [c.key, c.label]));
    onChange(
      form.dataType === 'linked'
        ? base
        : syncLinkedFields(base, savedField, optionsSource === 'table' ? form.fillColumns || [] : [], columnLabels),
    );
    closeEditor();
  };

  const handleDelete = async (id) => {
    const target = fields.find((f) => f.id === id);
    if (!target) return;
    const message = deleteConfirm ? deleteConfirm(target) : `Delete field "${target.label}"?`;
    const ok = await confirm({ title: 'Delete field?', message, confirmLabel: 'Delete field', destructive: true });
    if (!ok) return;
    onChange(
      fields
        .filter((f) => f.id !== id && !(isLinkedField(f) && f.linkedFrom.fieldKey === target.key))
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
    <>
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
              <span>{editorOpen ? (isEditing ? 'Edit field' : 'New field') : title}</span>
            </h2>
            {!editorOpen && (
              <p className="exams-field-header-sub">
                {subtitle ??
                  (fields.length === 0
                    ? 'Pick a type to add to the create form'
                    : `${fields.length} custom field${fields.length === 1 ? '' : 's'}`)}
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
          <>
          <div className="exams-drawer-body exams-field-list-body">
            {topSlot}
            {fields.length > 0 && (
              <div className="exams-fields-panel">
                <div className="exams-field-section-bar">
                  <span>Fields · {fields.length}</span>
                  <span className="exams-field-section-actions">
                    <button type="button" className="exams-text-add-btn" onClick={openBulk}>
                      <ListPlus size={13} />
                      Bulk add
                    </button>
                    <button type="button" className="exams-text-add-btn" onClick={() => setGroupsOpen(true)}>
                      <Link2 size={13} />
                      Groups
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
          {footer && <div className="exams-drawer-footer exams-drawer-footer-compact">{footer}</div>}
          </>
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
                    phoneValidation:
                      next === 'phone'
                        ? p.phoneValidation || emptyPhoneValidation()
                        : emptyPhoneValidation(),
                  }));
                  if (error) setError('');
                }}
              />

              {form.dataType === 'phone' && (
                <div className="exams-options-block">
                  <SearchableSelect
                    id={`${formId}-phone-validation`}
                    label="Phone validation"
                    value={form.phoneValidation?.mode || 'none'}
                    options={PHONE_VALIDATION_PRESETS}
                    searchPlaceholder="Search rules…"
                    onChange={(next) =>
                      setForm((p) => ({
                        ...p,
                        phoneValidation: {
                          mode: next,
                          pattern: next === 'custom' ? p.phoneValidation?.pattern || '' : '',
                          message: p.phoneValidation?.message || '',
                        },
                      }))
                    }
                  />
                  {(form.phoneValidation?.mode || 'none') !== 'none' &&
                    form.phoneValidation?.mode !== 'custom' && (
                      <p className="exams-config-empty-hint">
                        {
                          PHONE_VALIDATION_PRESETS.find(
                            (p) => p.value === form.phoneValidation?.mode,
                          )?.message
                        }
                      </p>
                    )}
                  {form.phoneValidation?.mode === 'custom' && (
                    <>
                      <div className="exams-form-group">
                        <label htmlFor={`${formId}-phone-regex`}>Custom regex *</label>
                        <input
                          id={`${formId}-phone-regex`}
                          type="text"
                          value={form.phoneValidation?.pattern || ''}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              phoneValidation: {
                                ...p.phoneValidation,
                                mode: 'custom',
                                pattern: e.target.value,
                              },
                            }))
                          }
                          placeholder="e.g. ^[6-9]\d{9}$"
                          spellCheck={false}
                          required
                        />
                      </div>
                      <div className="exams-form-group">
                        <label htmlFor={`${formId}-phone-msg`}>Error message</label>
                        <input
                          id={`${formId}-phone-msg`}
                          type="text"
                          value={form.phoneValidation?.message || ''}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              phoneValidation: {
                                ...p.phoneValidation,
                                mode: 'custom',
                                message: e.target.value,
                              },
                            }))
                          }
                          placeholder="Shown when the number does not match"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

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

              {allowUnique && UNIQUE_FIELD_TYPES.has(form.dataType) && (
                <label className="exams-check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(form.unique)}
                    onChange={(e) => setForm((p) => ({ ...p, unique: e.target.checked }))}
                  />
                  <span>Unique: no two records can have the same value</span>
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
                        {isChoiceField && (
                          <button
                            type="button"
                            className={`exams-source-btn ${form.optionsSource === 'table' ? 'active' : ''}`}
                            onClick={() => {
                              setForm((p) => ({ ...p, optionsSource: 'table' }));
                              if (error) setError('');
                            }}
                          >
                            Table column
                          </button>
                        )}
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

                  {form.optionsSource === 'table' ? (
                    <>
                      <SearchableSelect
                        id={`${formId}-lookup-table`}
                        label="Read from table"
                        value={form.lookupTable}
                        options={lookupSources.map((t) => ({ value: t.table, label: t.label }))}
                        placeholder={lookupSources.length ? 'Select a table…' : 'Loading tables…'}
                        searchThreshold={8}
                        onChange={(next) => {
                          setForm((p) => ({ ...p, lookupTable: next, lookupColumn: '', lookupDetail: '' }));
                          if (error) setError('');
                        }}
                      />
                      {form.lookupTable && (
                        <>
                          <SearchableSelect
                            id={`${formId}-lookup-column`}
                            label="Show this column"
                            value={form.lookupColumn}
                            options={lookupColumns.map((c) => ({ value: c.key, label: c.label }))}
                            placeholder="Select a column…"
                            searchPlaceholder="Search columns…"
                            onChange={(next) => {
                              setForm((p) => ({ ...p, lookupColumn: next }));
                              if (error) setError('');
                            }}
                          />
                          <SearchableSelect
                            id={`${formId}-lookup-detail`}
                            label="Also show (optional)"
                            value={form.lookupDetail}
                            options={[
                              { value: '', label: 'None' },
                              ...lookupColumns.filter((c) => c.key !== form.lookupColumn).map((c) => ({ value: c.key, label: c.label })),
                            ]}
                            placeholder="None"
                            searchPlaceholder="Search columns…"
                            onChange={(next) => setForm((p) => ({ ...p, lookupDetail: next }))}
                          />
                        </>
                      )}
                      {form.lookupTable && form.lookupColumn && (
                        <div className="exams-fill-columns">
                          <span className="exams-audit-label">Also fill from the same row</span>
                          <p className="exams-config-empty-hint">
                            Each ticked column becomes a read-only field that shows that column of the row picked here.
                          </p>
                          <div className="exams-fill-grid">
                            {lookupColumns
                              .filter((c) => c.key !== form.lookupColumn)
                              .map((c) => (
                                <label key={c.key} className="exams-check-row">
                                  <input
                                    type="checkbox"
                                    checked={(form.fillColumns || []).includes(c.key)}
                                    onChange={(e) =>
                                      setForm((p) => ({
                                        ...p,
                                        fillColumns: e.target.checked
                                          ? [...(p.fillColumns || []), c.key]
                                          : (p.fillColumns || []).filter((k) => k !== c.key),
                                      }))
                                    }
                                  />
                                  <span>{c.label}</span>
                                </label>
                              ))}
                          </div>
                        </div>
                      )}
                      <p className="exams-config-empty-hint">
                        Read live from that table each time the form opens. The field stores only the row, so a
                        rename there shows up here. Nothing is copied.
                      </p>
                    </>
                  ) : (form.optionsSource || 'manual') === 'manual' ? (
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

              {form.dataType === 'linked' && (
                <div className="exams-options-block">
                  {linkSourceFields.length === 0 ? (
                    <p className="exams-config-empty-hint">
                      Add a field that reads from a table (options source “Table column”) first, then link to it here.
                    </p>
                  ) : (
                    <>
                      <SearchableSelect
                        id={`${formId}-linked-field`}
                        label="Read from field"
                        value={form.linkedFieldKey}
                        options={linkSourceFields.map((f) => ({ value: f.key, label: f.label }))}
                        placeholder="Select a field…"
                        searchThreshold={8}
                        onChange={(next) => {
                          setForm((p) => ({ ...p, linkedFieldKey: next, linkedColumn: '' }));
                          if (error) setError('');
                        }}
                      />
                      {linkSource && (
                        <SearchableSelect
                          id={`${formId}-linked-column`}
                          label="Show this column"
                          value={form.linkedColumn}
                          options={linkColumns.map((c) => ({ value: c.key, label: c.label }))}
                          placeholder={linkColumns.length ? 'Select a column…' : 'Loading columns…'}
                          searchPlaceholder="Search columns…"
                          onChange={(next) => {
                            setForm((p) => ({ ...p, linkedColumn: next }));
                            if (error) setError('');
                          }}
                        />
                      )}
                      <p className="exams-config-empty-hint">
                        Read-only. Shows that column of the row picked in the field above, and follows it live.
                      </p>
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
    {groupsOpen && (
      <ColumnGroupsModal
        fields={fields}
        onClose={() => setGroupsOpen(false)}
        onSave={(next) => onChange(next)}
      />
    )}
    {bulkOpen && (
      <BulkFieldsModal
        fields={fields}
        reservedKeys={reservedKeys}
        allowUnique={allowUnique}
        {...bulkModalProps}
        onClose={closeBulk}
        onAdd={handleBulkAdd}
      />
    )}
    </>
  );
};
