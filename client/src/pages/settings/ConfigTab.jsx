import React, { useState, useEffect, useId } from 'react';
import {
  ListChecks,
  Tags,
  Plus,
  X,
  Trash2,
  Pencil,
  GripVertical,
  LayoutTemplate,
} from 'lucide-react';
import {
  loadConfigDropdownLists,
  saveConfigDropdownLists,
} from './configStorage';
import { FieldPresetsPanel } from './FieldPresetsPanel';

const SECTIONS = [
  {
    id: 'dropdowns',
    title: 'Dropdown lists',
    icon: ListChecks,
    emptyTitle: 'No dropdown lists yet',
    emptyHint: 'Create lists like Status, Exam Type, Shift, Centre Category.',
    actionLabel: 'New list',
  },
  {
    id: 'values',
    title: 'Generic settings',
    icon: Tags,
    emptyTitle: 'No settings values yet',
    emptyHint: 'Add portal-wide defaults and other config values here.',
    actionLabel: 'New value',
  },
  {
    id: 'presets',
    title: 'Field presets',
    icon: LayoutTemplate,
    emptyTitle: 'No field presets yet',
    emptyHint: 'Create one preset per service; new exams of that service start with its fields.',
    actionLabel: 'New preset',
  },
];

const makeOption = (label = '') => ({
  id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  label,
});

const emptyDropdownForm = () => ({
  id: null,
  name: '',
  options: [makeOption(), makeOption()],
});

export const ConfigTab = () => {
  const formId = useId();
  const [activeSection, setActiveSection] = useState('dropdowns');
  const [dropdowns, setDropdowns] = useState(loadConfigDropdownLists);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyDropdownForm);
  const [formError, setFormError] = useState('');
  const [presetCreateTick, setPresetCreateTick] = useState(0);

  const section = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];
  const SectionIcon = section.icon;
  const isEditing = Boolean(form.id);

  useEffect(() => {
    saveConfigDropdownLists(dropdowns);
  }, [dropdowns]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDrawerOpen]);

  const openCreateDropdown = () => {
    setForm(emptyDropdownForm());
    setFormError('');
    setIsDrawerOpen(true);
  };

  const openEditDropdown = (list) => {
    setForm({
      id: list.id,
      name: list.name,
      options: list.options.map((o) => ({ ...o })),
    });
    setFormError('');
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setForm(emptyDropdownForm());
    setFormError('');
  };

  const handleNameChange = (e) => {
    setForm((prev) => ({ ...prev, name: e.target.value }));
    if (formError) setFormError('');
  };

  const handleOptionChange = (optionId, value) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.id === optionId ? { ...o, label: value } : o)),
    }));
    if (formError) setFormError('');
  };

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, makeOption()],
    }));
  };

  const removeOption = (optionId) => {
    setForm((prev) => {
      if (prev.options.length <= 1) return prev;
      return {
        ...prev,
        options: prev.options.filter((o) => o.id !== optionId),
      };
    });
  };

  const handleSaveDropdown = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const cleanedOptions = form.options
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label.length > 0);

    if (!name) {
      setFormError('List name is required.');
      return;
    }

    if (cleanedOptions.length === 0) {
      setFormError('Add at least one option.');
      return;
    }

    const duplicateName = dropdowns.some(
      (d) => d.name.toLowerCase() === name.toLowerCase() && d.id !== form.id
    );
    if (duplicateName) {
      setFormError('A dropdown list with this name already exists.');
      return;
    }

    if (isEditing) {
      setDropdowns((prev) =>
        prev.map((d) =>
          d.id === form.id
            ? { ...d, name, options: cleanedOptions, updatedAt: new Date().toISOString() }
            : d
        )
      );
    } else {
      const newList = {
        id: `ddl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        options: cleanedOptions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDropdowns((prev) => [newList, ...prev]);
    }

    closeDrawer();
  };

  const handleDeleteDropdown = (listId) => {
    const target = dropdowns.find((d) => d.id === listId);
    if (!target) return;
    const confirmed = window.confirm(`Delete dropdown list "${target.name}"?`);
    if (!confirmed) return;
    setDropdowns((prev) => prev.filter((d) => d.id !== listId));
  };

  const handleSectionAction = () => {
    if (activeSection === 'dropdowns') {
      openCreateDropdown();
    } else if (activeSection === 'presets') {
      setPresetCreateTick((t) => t + 1);
    }
  };

  return (
    <div className="config-tab">
      <div className="config-toolbar">
        <div className="config-section-tabs" role="tablist" aria-label="Config sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === activeSection;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`config-section-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <Icon size={14} />
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="config-add-btn primary"
          title={section.actionLabel}
          onClick={handleSectionAction}
          disabled={activeSection === 'values'}
        >
          <Plus size={15} />
          <span>{section.actionLabel}</span>
        </button>
      </div>

      <div className="config-section-panel" role="tabpanel">
        {activeSection === 'dropdowns' && (
          <>
            {dropdowns.length === 0 ? (
              <div className="config-empty-state">
                <SectionIcon size={22} />
                <div>
                  <h4 className="config-empty-title">{section.emptyTitle}</h4>
                  <p className="config-empty-hint">{section.emptyHint}</p>
                </div>
                <button type="button" className="config-add-btn primary" onClick={openCreateDropdown}>
                  <Plus size={15} />
                  <span>{section.actionLabel}</span>
                </button>
              </div>
            ) : (
              <ul className="config-dropdown-list">
                {dropdowns.map((list) => (
                  <li key={list.id} className="config-dropdown-row">
                    <div className="config-dropdown-row-main">
                      <div className="config-dropdown-row-meta">
                        <span className="config-dropdown-card-title">{list.name}</span>
                        <span className="config-dropdown-card-count">
                          {list.options.length} opt
                        </span>
                      </div>
                      <div className="config-dropdown-options-preview">
                        {list.options.map((opt) => (
                          <span key={opt.id} className="config-option-chip">
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="config-dropdown-card-actions">
                      <button
                        type="button"
                        className="config-icon-btn"
                        title="Edit list"
                        aria-label={`Edit ${list.name}`}
                        onClick={() => openEditDropdown(list)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="config-icon-btn danger"
                        title="Delete list"
                        aria-label={`Delete ${list.name}`}
                        onClick={() => handleDeleteDropdown(list.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {activeSection === 'presets' && <FieldPresetsPanel createTick={presetCreateTick} />}

        {activeSection === 'values' && (
          <div className="config-empty-state">
            <SectionIcon size={22} />
            <div>
              <h4 className="config-empty-title">{section.emptyTitle}</h4>
              <p className="config-empty-hint">{section.emptyHint}</p>
            </div>
          </div>
        )}
      </div>

      {isDrawerOpen && (
        <div className="config-drawer-overlay" onClick={closeDrawer}>
          <aside
            className="config-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isEditing ? 'Edit dropdown list' : 'Create dropdown list'}
          >
            <div className="config-drawer-header">
              <h2 className="config-drawer-title">
                <ListChecks size={16} className="config-drawer-title-icon" />
                <span>{isEditing ? 'Edit list' : 'New list'}</span>
              </h2>
              <button
                type="button"
                className="config-drawer-close"
                onClick={closeDrawer}
                title="Close"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form className="config-drawer-form" onSubmit={handleSaveDropdown}>
              <div className="config-drawer-body">
                {formError && <div className="config-form-error">{formError}</div>}

                <div className="config-form-group">
                  <label htmlFor={`${formId}-name`}>List name</label>
                  <input
                    id={`${formId}-name`}
                    type="text"
                    value={form.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Exam Status"
                    required
                    autoFocus
                  />
                </div>

                <div className="config-options-block">
                  <div className="config-options-header">
                    <label>Options</label>
                    <button type="button" className="config-add-option-btn" onClick={addOption}>
                      <Plus size={13} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="config-options-list">
                    {form.options.map((opt, index) => (
                      <div key={opt.id} className="config-option-row">
                        <span className="config-option-grip" aria-hidden="true">
                          <GripVertical size={13} />
                        </span>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          aria-label={`Option ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="config-icon-btn danger"
                          onClick={() => removeOption(opt.id)}
                          disabled={form.options.length <= 1}
                          title="Remove option"
                          aria-label={`Remove option ${index + 1}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="config-drawer-footer">
                <button type="button" className="config-btn secondary" onClick={closeDrawer}>
                  Cancel
                </button>
                <button type="submit" className="config-btn primary">
                  <Plus size={14} />
                  <span>{isEditing ? 'Save' : 'Create'}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;
