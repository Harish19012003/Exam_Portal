import { useConfirm } from '../../feedback';
import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  ListChecks,
  Tags,
  Plus,
  X,
  Trash2,
  Pencil,
  GripVertical,
  LayoutTemplate,
  ListPlus,
  Upload,
} from 'lucide-react';
import {
  loadConfigDropdownLists,
  saveConfigDropdownLists,
} from './configStorage';
import { FieldPresetsPanel } from './FieldPresetsPanel';

export const parseBulkOptionsText = (
  rawText,
  { splitCommas = false, removeDuplicates = true } = {}
) => {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (splitCommas) {
      const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
      items.push(...parts);
    } else {
      items.push(trimmed);
    }
  }

  // Clean leading numbering, bullets, and checkboxes (e.g. "1. ", "1) ", "- ", "* ", "• ", "[ ] ")
  const cleaned = items
    .map((item) =>
      item
        .replace(/^\[[ xX]?\]\s*/, '')
        .replace(/^(\d+[\.\)]|[-*•])\s*/, '')
        .trim()
    )
    .filter((item) => item.length > 0);

  if (!removeDuplicates) {
    return cleaned;
  }

  const seen = new Set();
  const unique = [];
  for (const item of cleaned) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(item);
    }
  }
  return unique;
};

export const detectListNameFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;
  const firstLine = rawText.trim().split(/\r?\n/)[0]?.trim() || '';
  const colonMatch = firstLine.match(/^#?\s*([A-Za-z0-9 _-]+):\s*$/);
  if (colonMatch) return colonMatch[1].trim();
  const hashMatch = firstLine.match(/^#+\s*([A-Za-z0-9 _-]+)$/);
  if (hashMatch) return hashMatch[1].trim();
  const listColonMatch = firstLine.match(/^(?:list|name):\s*([A-Za-z0-9 _-]+)$/i);
  if (listColonMatch) return listColonMatch[1].trim();
  return null;
};

export const parseMultipleBulkLists = (text) => {
  if (!text || typeof text !== 'string') return [];

  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && (item.name || item.title))
          .map((item) => ({
            name: String(item.name || item.title).trim(),
            options: Array.isArray(item.options)
              ? item.options
                  .map((o) => (typeof o === 'string' ? o.trim() : o?.label?.trim() || ''))
                  .filter(Boolean)
              : typeof item.options === 'string'
              ? parseBulkOptionsText(item.options, { splitCommas: true })
              : [],
          }))
          .filter((item) => item.name && item.options.length > 0);
      }
    } catch {
      // not JSON, fallback to line parser
    }
  }

  const lines = text.split(/\r?\n/);
  const lists = [];
  let currentList = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch =
      line.match(/^#?\s*([A-Za-z0-9 _-]+):\s*$/) ||
      line.match(/^#+\s*([A-Za-z0-9 _-]+)$/) ||
      line.match(/^(?:list|name):\s*([A-Za-z0-9 _-]+)$/i);

    if (headerMatch) {
      if (currentList && currentList.options.length > 0) {
        lists.push(currentList);
      }
      currentList = {
        name: headerMatch[1].trim(),
        options: [],
      };
      continue;
    }

    if (!currentList) {
      currentList = {
        name: 'Untitled list',
        options: [],
      };
    }

    const cleanedOption = line
      .replace(/^\[[ xX]?\]\s*/, '')
      .replace(/^(\d+[\.\)]|[-*•])\s*/, '')
      .trim();

    if (cleanedOption) {
      currentList.options.push(cleanedOption);
    }
  }

  if (currentList && currentList.options.length > 0) {
    lists.push(currentList);
  }

  return lists;
};

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
  const confirm = useConfirm();
  const formId = useId();
  const [activeSection, setActiveSection] = useState('dropdowns');
  const [dropdowns, setDropdowns] = useState(loadConfigDropdownLists);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyDropdownForm);
  const [formError, setFormError] = useState('');
  const [presetCreateTick, setPresetCreateTick] = useState(0);

  // Bulk options inside the drawer
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [splitCommas, setSplitCommas] = useState(false);
  const [isCommasTouched, setIsCommasTouched] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Bulk multiple lists modal on toolbar
  const [isBulkListsModalOpen, setIsBulkListsModalOpen] = useState(false);
  const [bulkListsText, setBulkListsText] = useState('');
  const [bulkListsError, setBulkListsError] = useState('');

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
    setIsBulkOpen(false);
    setBulkText('');
    setSplitCommas(false);
    setIsCommasTouched(false);
    setReplaceExisting(false);
    setIsDrawerOpen(true);
  };

  const openEditDropdown = (list) => {
    setForm({
      id: list.id,
      name: list.name,
      options: list.options.map((o) => ({ ...o })),
    });
    setFormError('');
    setIsBulkOpen(false);
    setBulkText('');
    setSplitCommas(false);
    setIsCommasTouched(false);
    setReplaceExisting(false);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setForm(emptyDropdownForm());
    setFormError('');
    setIsBulkOpen(false);
    setBulkText('');
    setSplitCommas(false);
    setIsCommasTouched(false);
    setReplaceExisting(false);
  };

  const { detectedItems, duplicateCount, detectedName } = useMemo(() => {
    if (!bulkText.trim()) {
      return { detectedItems: [], duplicateCount: 0, detectedName: null };
    }

    const name = detectListNameFromText(bulkText);
    let textToParse = bulkText;
    if (name) {
      textToParse = bulkText
        .replace(/^#?\s*([A-Za-z0-9 _-]+):\s*\r?\n?/i, '')
        .replace(/^#\s*([A-Za-z0-9 _-]+)\s*\r?\n?/i, '')
        .replace(/^(?:list|name):\s*([A-Za-z0-9 _-]+)\r?\n?/i, '');
    }

    const allItems = parseBulkOptionsText(textToParse, {
      splitCommas,
      removeDuplicates: false,
    });

    const uniqueItems = parseBulkOptionsText(textToParse, {
      splitCommas,
      removeDuplicates: true,
    });

    const duplicates = Math.max(0, allItems.length - uniqueItems.length);

    return {
      detectedItems: removeDuplicates ? uniqueItems : allItems,
      duplicateCount: duplicates,
      detectedName: name,
    };
  }, [bulkText, splitCommas, removeDuplicates]);

  const hasExistingOptions = useMemo(() => {
    return form.options.some((o) => o.label.trim().length > 0);
  }, [form.options]);

  const handleBulkTextChange = (e) => {
    const val = e.target.value;
    setBulkText(val);

    if (!isCommasTouched) {
      const hasNewlines = val.includes('\n');
      const hasCommas = val.includes(',');
      if (hasCommas && !hasNewlines) {
        setSplitCommas(true);
      } else if (hasNewlines) {
        setSplitCommas(false);
      }
    }
  };

  const handleApplyBulk = () => {
    if (detectedItems.length === 0) return;

    const hasOnlyBlankOptions = form.options.every((o) => !o.label.trim());
    const shouldReplace = replaceExisting || hasOnlyBlankOptions;
    const newOptionObjects = detectedItems.map((lbl) => makeOption(lbl));

    const updatedName =
      !form.name.trim() && detectedName ? detectedName : form.name;

    setForm((prev) => {
      let finalOptions;
      if (shouldReplace) {
        finalOptions = newOptionObjects;
      } else {
        const existingNonBlank = prev.options.filter((o) => o.label.trim().length > 0);
        finalOptions = [...existingNonBlank, ...newOptionObjects];
      }
      return {
        ...prev,
        name: updatedName,
        options: finalOptions.length > 0 ? finalOptions : [makeOption()],
      };
    });

    setIsBulkOpen(false);
    setBulkText('');
    setReplaceExisting(false);
    if (formError) setFormError('');
  };

  const handleUseDetectedName = () => {
    if (detectedName) {
      setForm((prev) => ({ ...prev, name: detectedName }));
      if (formError) setFormError('');
    }
  };

  const handleLoadCurrentOptions = () => {
    const existingLabels = form.options
      .map((o) => o.label.trim())
      .filter(Boolean);
    if (existingLabels.length > 0) {
      setBulkText(existingLabels.join('\n'));
      setReplaceExisting(true);
    }
  };

  const handleOptionPaste = (optionId, index, e) => {
    const pasteData = e.clipboardData?.getData('text') || '';
    if (!pasteData) return;

    const hasNewlines = pasteData.includes('\n');
    const hasCommas = pasteData.includes(',') && !hasNewlines;

    if (hasNewlines || (hasCommas && pasteData.split(',').length > 1)) {
      const parsed = parseBulkOptionsText(pasteData, {
        splitCommas: hasCommas,
        removeDuplicates: true,
      });

      if (parsed.length > 1) {
        e.preventDefault();
        setForm((prev) => {
          const nextOptions = [...prev.options];
          nextOptions[index] = { ...nextOptions[index], label: parsed[0] };
          const remaining = parsed.slice(1).map((lbl) => makeOption(lbl));
          nextOptions.splice(index + 1, 0, ...remaining);
          return { ...prev, options: nextOptions };
        });
        if (formError) setFormError('');
      }
    }
  };

  const parsedBulkLists = useMemo(() => {
    return parseMultipleBulkLists(bulkListsText);
  }, [bulkListsText]);

  const handleApplyBulkLists = () => {
    if (parsedBulkLists.length === 0) {
      setBulkListsError('No valid lists found. Format: "List Name:\nOption 1\nOption 2"');
      return;
    }

    const now = new Date().toISOString();
    const newLists = parsedBulkLists.map((l) => ({
      id: `ddl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: l.name,
      options: l.options.map((optLabel) => makeOption(optLabel)),
      createdAt: now,
      updatedAt: now,
    }));

    setDropdowns((prev) => {
      const existingNames = new Set(newLists.map((n) => n.name.toLowerCase()));
      const filteredOld = prev.filter((o) => !existingNames.has(o.name.toLowerCase()));
      return [...newLists, ...filteredOld];
    });

    setIsBulkListsModalOpen(false);
    setBulkListsText('');
    setBulkListsError('');
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

  const handleDeleteDropdown = async (listId) => {
    const target = dropdowns.find((d) => d.id === listId);
    if (!target) return;
    const confirmed = await confirm({
      title: 'Delete dropdown list?',
      message: `Delete the dropdown list "${target.name}"?`,
      confirmLabel: 'Delete list',
      destructive: true,
    });
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

        <div className="config-toolbar-actions">
          {activeSection === 'dropdowns' && (
            <button
              type="button"
              className="config-add-btn secondary"
              title="Bulk import lists"
              onClick={() => {
                setBulkListsText('');
                setBulkListsError('');
                setIsBulkListsModalOpen(true);
              }}
            >
              <Upload size={14} />
              <span>Bulk import</span>
            </button>
          )}

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
                <div className="config-empty-actions">
                  <button
                    type="button"
                    className="config-add-btn secondary"
                    onClick={() => {
                      setBulkListsText('');
                      setBulkListsError('');
                      setIsBulkListsModalOpen(true);
                    }}
                  >
                    <Upload size={14} />
                    <span>Bulk import</span>
                  </button>
                  <button type="button" className="config-add-btn primary" onClick={openCreateDropdown}>
                    <Plus size={15} />
                    <span>{section.actionLabel}</span>
                  </button>
                </div>
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
                    <label>
                      Options <span className="config-options-badge">({form.options.length})</span>
                    </label>
                    <div className="config-options-header-actions">
                      <button
                        type="button"
                        className={`config-bulk-option-btn ${isBulkOpen ? 'active' : ''}`}
                        onClick={() => setIsBulkOpen((prev) => !prev)}
                        title="Add options in bulk"
                        aria-expanded={isBulkOpen}
                      >
                        <ListPlus size={13} />
                        <span>Bulk Add</span>
                      </button>
                      <button
                        type="button"
                        className="config-add-option-btn"
                        onClick={addOption}
                        title="Add single option"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {isBulkOpen && (
                    <div className="config-bulk-card" role="region" aria-label="Bulk add options">
                      <div className="config-bulk-header">
                        <div className="config-bulk-title-group">
                          <ListPlus size={14} className="config-bulk-title-icon" />
                          <span className="config-bulk-title">Bulk Add Options</span>
                        </div>
                        <button
                          type="button"
                          className="config-icon-btn"
                          onClick={() => setIsBulkOpen(false)}
                          title="Close bulk panel"
                          aria-label="Close bulk panel"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <p className="config-bulk-hint">
                        Paste or type options (one per line or comma-separated). Numbering and bullets are automatically cleaned.
                      </p>

                      {detectedName && !form.name.trim() && (
                        <div className="config-bulk-name-suggestion">
                          <span className="config-bulk-name-text">
                            Detected list name: <strong>{detectedName}</strong>
                          </span>
                          <button
                            type="button"
                            className="config-bulk-name-btn"
                            onClick={handleUseDetectedName}
                          >
                            Use as name
                          </button>
                        </div>
                      )}

                      <textarea
                        className="config-bulk-textarea"
                        rows={5}
                        value={bulkText}
                        onChange={handleBulkTextChange}
                        placeholder={"Draft\nIn Review\nPublished\nArchived\n\n...or paste comma separated"}
                        autoFocus
                      />

                      <div className="config-bulk-preview-bar">
                        <div className="config-bulk-stats">
                          <span className="config-bulk-badge">
                            {detectedItems.length} {detectedItems.length === 1 ? 'option' : 'options'} detected
                          </span>
                          {duplicateCount > 0 && removeDuplicates && (
                            <span className="config-bulk-subbadge">
                              ({duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} removed)
                            </span>
                          )}
                        </div>

                        {detectedItems.length > 0 && (
                          <div className="config-bulk-chips-preview">
                            {detectedItems.slice(0, 8).map((item, idx) => (
                              <span key={idx} className="config-bulk-chip">
                                {item}
                              </span>
                            ))}
                            {detectedItems.length > 8 && (
                              <span className="config-bulk-chip more">
                                +{detectedItems.length - 8} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="config-bulk-toggles">
                        <label className="config-bulk-toggle-label">
                          <input
                            type="checkbox"
                            checked={splitCommas}
                            onChange={(e) => {
                              setSplitCommas(e.target.checked);
                              setIsCommasTouched(true);
                            }}
                          />
                          <span>Split by commas</span>
                        </label>

                        <label className="config-bulk-toggle-label">
                          <input
                            type="checkbox"
                            checked={removeDuplicates}
                            onChange={(e) => setRemoveDuplicates(e.target.checked)}
                          />
                          <span>Remove duplicates</span>
                        </label>

                        <label className="config-bulk-toggle-label">
                          <input
                            type="checkbox"
                            checked={replaceExisting}
                            onChange={(e) => setReplaceExisting(e.target.checked)}
                          />
                          <span>Replace existing options</span>
                        </label>
                      </div>

                      {hasExistingOptions && (
                        <div className="config-bulk-load-row">
                          <button
                            type="button"
                            className="config-bulk-text-link"
                            onClick={handleLoadCurrentOptions}
                          >
                            Load current options into editor
                          </button>
                        </div>
                      )}

                      <div className="config-bulk-footer">
                        <button
                          type="button"
                          className="config-btn secondary sm"
                          onClick={() => {
                            setIsBulkOpen(false);
                            setBulkText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="config-btn primary sm"
                          disabled={detectedItems.length === 0}
                          onClick={handleApplyBulk}
                        >
                          <Plus size={13} />
                          <span>
                            {replaceExisting ? 'Replace with' : 'Add'}{' '}
                            {detectedItems.length > 0 ? `${detectedItems.length} ` : ''}Options
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

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
                          onPaste={(e) => handleOptionPaste(opt.id, index, e)}
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

      {isBulkListsModalOpen && (
        <div className="config-modal-overlay" onClick={() => setIsBulkListsModalOpen(false)}>
          <div
            className="config-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Bulk import dropdown lists"
          >
            <div className="config-drawer-header">
              <h2 className="config-drawer-title">
                <ListPlus size={16} className="config-drawer-title-icon" />
                <span>Bulk import dropdown lists</span>
              </h2>
              <button
                type="button"
                className="config-drawer-close"
                onClick={() => setIsBulkListsModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="config-modal-body">
              {bulkListsError && <div className="config-form-error">{bulkListsError}</div>}
              <p className="config-bulk-hint">
                Paste one or multiple lists with their options. You can use header format or raw JSON.
              </p>

              <div className="config-bulk-example-box">
                <span className="config-bulk-example-title">Example format:</span>
                <pre className="config-bulk-example-code">
{`Exam Status:
Draft
Scheduled
In Progress
Completed

Exam Shifts:
Morning
Afternoon
Evening`}
                </pre>
              </div>

              <textarea
                className="config-bulk-textarea large"
                rows={8}
                value={bulkListsText}
                onChange={(e) => {
                  setBulkListsText(e.target.value);
                  if (bulkListsError) setBulkListsError('');
                }}
                placeholder="Paste lists here..."
                autoFocus
              />

              {parsedBulkLists.length > 0 && (
                <div className="config-bulk-parsed-preview">
                  <span className="config-bulk-badge">
                    {parsedBulkLists.length} list{parsedBulkLists.length === 1 ? '' : 's'} detected:
                  </span>
                  <div className="config-bulk-lists-summary">
                    {parsedBulkLists.map((l, i) => (
                      <div key={i} className="config-bulk-list-pill">
                        <strong>{l.name}</strong> ({l.options.length} options)
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
                onClick={() => setIsBulkListsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="config-btn primary"
                disabled={parsedBulkLists.length === 0}
                onClick={handleApplyBulkLists}
              >
                <Upload size={14} />
                <span>Import {parsedBulkLists.length > 0 ? `${parsedBulkLists.length} ` : ''}Lists</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;
