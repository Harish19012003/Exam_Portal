import { useConfirm } from '../../feedback';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  Info,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { BoneSkeleton } from '../../components/ui/BoneSkeleton';
import { CardGridSkeleton } from '../../components/ui/SettingsSkeletons';
import { useUrlParamsPatch, useUrlState } from '../../hooks/useUrlState';
import { SearchableSelect } from '../exams/SearchableSelect';
import { resolveFieldOptions } from '../exams/examFieldTypes';
import {
  bulkSaveExamPresets,
  deleteExamPreset,
  listExamPresets,
} from '../exams/examPresetApi';
import { apiErrorMessage } from '../exams/examTableApi';
import { FieldPresetEditorPage } from './FieldPresetEditorPage';
import './FieldPresetsPanel.css';

// SearchableSelect ignores empty option values, so "All" uses a sentinel.
const ALL_VALUE = '__all__';
const SORT_OPTIONS = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'created-desc', label: 'Newest created' },
  { value: 'created-asc', label: 'Oldest created' },
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'fields-desc', label: 'Most fields' },
  { value: 'fields-asc', label: 'Fewest fields' },
  { value: 'service-asc', label: 'Service (A → Z)' },
];

const NO_PRESETS = [];
const SORT_KEYS = ['default', 'name-asc', 'name-desc', 'created-desc', 'created-asc', 'updated-desc', 'fields-desc', 'fields-asc', 'service-asc'];

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
  headerSlots = null,
}) => {
  const confirm = useConfirm();
  const importFileRef = useRef(null);
  const queryClient = useQueryClient();
  // Shared with the Exam explore page, so presets load once and both pages reuse the cache.
  const presetsQuery = useQuery({ queryKey: queryKeys.exams.presets(), queryFn: listExamPresets });
  const presets = presetsQuery.data ?? NO_PRESETS;
  const loading = presetsQuery.isLoading;
  const [actionError, setActionError] = useState('');
  const loadError = actionError || (presetsQuery.error ? apiErrorMessage(presetsQuery.error, 'Could not load presets') : '');
  const [serviceOptions, setServiceOptions] = useState([]);
  const [query, setQuery] = useUrlState('pq', '');
  const [serviceFilter, setServiceFilter] = useUrlState('psvc', '');
  const [viewFilter, setViewFilter] = useUrlState('pview', '');
  const [sortBy, setSortBy] = useUrlState('psort', 'default', SORT_KEYS);
  const patchUrl = useUrlParamsPatch();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.exams.presets() }),
    [queryClient],
  );

  useEffect(() => {
    loadServiceOptions().then(setServiceOptions);
  }, []);

  useEffect(() => {
    onPresetCountChange?.(presets.length);
  }, [presets.length, onPresetCountChange]);

  // Edit / New open a full page (?edit=<id|new>), pushed to history so browser Back returns here.
  const [editParam] = useUrlState('edit', '');
  const openCreate = useCallback(() => patchUrl({ edit: 'new', fg: '' }, { replace: false }), [patchUrl]);
  const closeEditorPage = useCallback(() => patchUrl({ edit: '', fg: '' }), [patchUrl]);

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

  // Toolbar ticks: act once per click. The handlers change identity on every URL change
  // (setSearchParams) or preset refetch, so without these refs Back from "New preset"
  // re-opened it and Export re-downloaded. Initialised to the mount value so a remount
  // doesn't replay an old click.
  const handledTicks = useRef({ create: createTick, import: importTick, export: exportTick });

  useEffect(() => {
    if (createTick === handledTicks.current.create) return;
    handledTicks.current.create = createTick;
    openCreate();
  }, [createTick, openCreate]);

  useEffect(() => {
    if (importTick === handledTicks.current.import) return;
    handledTicks.current.import = importTick;
    openImport();
  }, [importTick, openImport]);

  useEffect(() => {
    if (exportTick === handledTicks.current.export) return;
    handledTicks.current.export = exportTick;
    handleExport();
  }, [exportTick, handleExport]);

  const openEdit = (preset) => patchUrl({ edit: preset.id, fg: '' }, { replace: false });

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
      setActionError(apiErrorMessage(err, 'Could not delete the preset'));
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
    const time = (v) => (v ? new Date(v).getTime() || 0 : 0);
    const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
    const sorters = {
      'name-asc': byName,
      'name-desc': (a, b) => byName(b, a),
      'created-desc': (a, b) => time(b.createdAt) - time(a.createdAt),
      'created-asc': (a, b) => time(a.createdAt) - time(b.createdAt),
      'updated-desc': (a, b) => time(b.updatedAt) - time(a.updatedAt),
      'fields-desc': (a, b) => (b.fieldCount ?? 0) - (a.fieldCount ?? 0),
      'fields-asc': (a, b) => (a.fieldCount ?? 0) - (b.fieldCount ?? 0),
      'service-asc': (a, b) => String(a.serviceValue || '').localeCompare(String(b.serviceValue || '')) || byName(a, b),
    };
    sorters.default = () => 0;
    return presets.filter((p) => {
      const view = p.view || DEFAULT_EXAM_VIEW;
      if (serviceFilter && p.serviceValue !== serviceFilter) return false;
      if (viewFilter && view !== viewFilter) return false;
      if (!q) return true;
      return [p.name, p.serviceValue, examViewLabel(view), ...(p.fields || []).map((f) => f.label)]
        .some((t) => String(t || '').toLowerCase().includes(q));
    }).sort(sorters[sortBy] || sorters.default);
  }, [presets, query, serviceFilter, viewFilter, sortBy]);
  const filtersActive = Boolean(query || serviceFilter || viewFilter);
  const clearFilters = () => {
    // One URL write — three separate setSearchParams calls can leave stale params behind.
    patchUrl({ pq: '', psvc: '', pview: '' });
  };

  if (editParam) {
    return (
      <FieldPresetEditorPage
        key={editParam}
        presetId={editParam}
        presets={presets}
        presetsLoading={loading}
        serviceOptions={serviceOptions}
        onExit={closeEditorPage}
        onSwitch={(id) => patchUrl({ edit: id, fg: '' })}
        headerSlots={headerSlots}
      />
    );
  }

  return (
    <div className="fpp">
      {loadError && <div className="fpp-error" role="alert">{loadError}</div>}

      <BoneSkeleton name="settings-field-presets" loading={loading} fallback={<CardGridSkeleton count={6} filters />}>
      {loading ? null : presets.length === 0 ? (
        <div className="config-empty-state">
          <LayoutTemplate size={22} />
          <div>
            <h4 className="config-empty-title">No service presets yet</h4>
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
          <SearchableSelect
            className="fpp-filter-select"
            ariaLabel="Filter by service"
            value={serviceFilter || ALL_VALUE}
            onChange={(v) => setServiceFilter(v === ALL_VALUE ? '' : v)}
            options={[{ value: ALL_VALUE, label: 'All services' }, ...filterServices.map((svc) => ({ value: svc, label: svc }))]}
          />
          <SearchableSelect
            className="fpp-filter-select"
            ariaLabel="Filter by exam page"
            value={viewFilter || ALL_VALUE}
            onChange={(v) => setViewFilter(v === ALL_VALUE ? '' : v)}
            options={[{ value: ALL_VALUE, label: 'All pages' }, ...EXAM_VIEWS.map((v) => ({ value: v.key, label: v.label }))]}
          />
          <SearchableSelect
            className="fpp-filter-select"
            ariaLabel="Sort presets"
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
          />
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
              <div className="fpp-card-meta">
                <span className="fpp-meta-badge fpp-meta-badge--accent">
                  {preset.fieldCount} field{preset.fieldCount === 1 ? '' : 's'}
                </span>
                <span className="fpp-meta-badge" title="Service">{preset.serviceValue}</span>
                <span className="fpp-meta-badge" title="Exam page">{viewLabel}</span>
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
      </BoneSkeleton>

      {!loading && presets.length > 0 && missingCenterList.length > 0 && (
        <p className="fpp-notice" role="note">
          <Info size={15} aria-hidden="true" />
          <span>
            No Center list preset yet for <strong>{missingCenterList.join(', ')}</strong>. Those exams start that page empty.
          </span>
        </p>
      )}

      {isImportOpen && (
        <div className="config-modal-overlay" onClick={() => !importing && setIsImportOpen(false)}>
          <div
            className="config-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import service presets"
          >
            <div className="config-drawer-header">
              <h2 className="config-drawer-title">
                <ListPlus size={16} className="config-drawer-title-icon" />
                <span>Import service presets</span>
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
