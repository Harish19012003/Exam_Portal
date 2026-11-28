import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../feedback';
import { IconButton } from '../components/Button';
import { PageHeading, PageShell } from '../components/PageHeading';
import { DynamicTable, TableSkeleton } from '../components/DynamicTable';
import { Settings, SlidersHorizontal } from 'lucide-react';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { useTableLayoutPrefs } from '../hooks/useTableLayoutPrefs';
import { useAccess, applyColumnAccess, tablePermissions } from '../hooks/useAccess';
import { usePortalTableFeatures, withPortalFeatureLocks } from '../hooks/usePortalTableFeatures';
import {
  useInvalidateCenterCsrMatching,
  useCenterCsrMatchingConfig,
  useCenterCsrMatchingList,
} from '../hooks/useCenterCsrMatchingQuery';
import { useDevicesConfig } from '../hooks/useDevicesQuery';
import { useDeviceMasterBioExam } from '../hooks/useDeviceMasterBioExam.jsx';
import { TABLE_IDS } from '../constants/tableIds';
import { ExamFieldBuilder } from './exams/ExamFieldBuilder';
import { buildFieldColumns } from './exams/examTableAdapter';
import {
  importMatchKeysFromFields,
  pickDefaultMatchKey,
  runModeAwareImport,
} from './exams/runModeAwareImport';
import {
  diffPresetAgainstFields,
  fieldsFromPreset,
  mergePresetIntoFields,
} from './exams/examPresetApi';
import { SearchableSelect } from './exams/SearchableSelect';
import {
  listDevicePresets,
  presetsForDeviceView,
  updateDevicePreset,
} from './devices/devicePresetApi';
import { useConfigLists } from './settings/useConfigLists';
import {
  CENTER_CSR_FIXED_KEYS,
  CENTER_CSR_RESERVED_KEYS,
  stripCenterCsrFixedFields,
  withHardcodedCenterCsrFields,
} from './centerCsrMatchingColumns';
import { DeviceApiModal } from './DeviceApiModal';
import { deviceMasterViewMeta } from './deviceMasterViews';
import './ExamsPage.css';
import './ExamExplorePage.css';

const SYSTEM_VALUE_KEYS = new Set(['id', 'version', 'created_at', 'updated_at', 'exam_id']);
const FIXED_KEY_SET = new Set(CENTER_CSR_FIXED_KEYS);
const VIEW = deviceMasterViewMeta('center-csr-matching');
const PRESET_VIEW = 'center-csr-matching';

export const CenterCsrMatchingPage = () => {
  const configVersion = useConfigLists();
  const { examId: bioExamId } = useDeviceMasterBioExam();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('theme') === 'dark';
  });

  const {
    layoutReady,
    layoutPrefs,
    hasUserLayoutOverride,
    layoutEpoch,
    canSaveLayoutAsDefault,
    onLayoutPrefsChange,
    onSaveLayoutAsDefault,
    onResetLayoutToDefault,
  } = useTableLayoutPrefs(TABLE_IDS.CENTER_CSR_MATCHING);

  const listQuery = useCenterCsrMatchingList(bioExamId);
  const configQuery = useCenterCsrMatchingConfig();
  const { invalidateList, refetchList, setList, setConfigFields } = useInvalidateCenterCsrMatching(bioExamId);
  const rows = listQuery.data || [];
  const customFields = Array.isArray(configQuery.data?.fields) ? configQuery.data.fields : [];
  const showSkeleton =
    !layoutReady ||
    (Boolean(bioExamId) && listQuery.isPending && !listQuery.data) ||
    (configQuery.isPending && !configQuery.data);

  const { addToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const setSuccessMsg = useCallback((message) => { if (message) addToast(message, 'success'); }, [addToast]);
  const setErrorMsg = useCallback((message) => { if (message) addToast(message, 'error'); }, [addToast]);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [manageStartNew, setManageStartNew] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [matchedPresetId, setMatchedPresetId] = useState('');
  const saveChain = useRef(Promise.resolve());
  const { access, can } = useAccess();
  const canConfigure = can('center_csr_matching', 'configure');
  const canApiFetch = canConfigure || can('devices', 'configure');
  const tablePerms = useMemo(() => tablePermissions(access, 'center_csr_matching'), [access]);
  const persistFeatures = useCallback(async (features) => {
    const res = await apiClient.put('/center-csr-matching/config', { features });
    setSuccessMsg('Feature Builder settings saved for everyone');
    return res;
  }, [setSuccessMsg]);
  const portalFeatures = usePortalTableFeatures({ canConfigure, persist: persistFeatures });
  const hydratedFeaturesRef = useRef(false);

  const presetsQuery = useQuery({
    queryKey: queryKeys.devicePresets.list(),
    queryFn: listDevicePresets,
    enabled: canConfigure,
  });
  const paramConfigQuery = useDevicesConfig();
  const fieldImportSources = useMemo(() => {
    const sources = [];
    const paramFields = Array.isArray(paramConfigQuery.data?.fields) ? paramConfigQuery.data.fields : [];
    if (paramFields.length) {
      sources.push({
        id: 'live:param',
        name: 'Param (live)',
        view: 'devices',
        fields: paramFields,
        fieldCount: paramFields.length,
      });
    }
    for (const p of presetsQuery.data || []) {
      sources.push(p);
    }
    return sources;
  }, [paramConfigQuery.data?.fields, presetsQuery.data]);
  const viewPresets = useMemo(
    () => presetsForDeviceView(presetsQuery.data || [], PRESET_VIEW),
    [presetsQuery.data],
  );
  useEffect(() => {
    if (!viewPresets.length) {
      setMatchedPresetId('');
      return;
    }
    setMatchedPresetId((prev) =>
      prev && viewPresets.some((p) => String(p.id) === String(prev))
        ? prev
        : String(viewPresets[0].id),
    );
  }, [viewPresets]);
  const matchedPreset = useMemo(
    () => viewPresets.find((p) => String(p.id) === String(matchedPresetId)) || viewPresets[0] || null,
    [viewPresets, matchedPresetId],
  );
  const pageExtras = useMemo(() => stripCenterCsrFixedFields(customFields), [customFields]);
  const presetExtras = useMemo(
    () => stripCenterCsrFixedFields(matchedPreset?.fields || []),
    [matchedPreset],
  );
  const presetDiff = useMemo(
    () => (matchedPreset ? diffPresetAgainstFields(presetExtras, pageExtras) : null),
    [matchedPreset, presetExtras, pageExtras],
  );
  const pageDiff = useMemo(
    () => (matchedPreset ? diffPresetAgainstFields(pageExtras, presetExtras) : null),
    [matchedPreset, pageExtras, presetExtras],
  );
  const presetOutdated = Boolean(
    presetDiff && (presetDiff.changed.length || presetDiff.added.length || presetDiff.reordered),
  );
  const pageAhead = Boolean(
    pageDiff && (pageDiff.changed.length || pageDiff.added.length || pageDiff.reordered),
  );
  const presetBannerVisible = canConfigure && matchedPreset && (presetOutdated || pageAhead);

  useEffect(() => {
    if (!configQuery.data || hydratedFeaturesRef.current) return;
    portalFeatures.hydrate(configQuery.data.features);
    hydratedFeaturesRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data]);

  useEffect(() => {
    if (configQuery.isError) {
      setErrorMsg(configQuery.error?.response?.data?.message || 'Failed to load Center-CSR-Matching field configuration.');
    }
  }, [configQuery.isError, configQuery.error, setErrorMsg]);

  useEffect(() => {
    if (listQuery.isError) {
      setErrorMsg(listQuery.error?.response?.data?.message || 'Failed to load Center-CSR-Matching rows.');
    }
  }, [listQuery.isError, listQuery.error, setErrorMsg]);

  const refreshRows = useCallback(async () => {
    await refetchList();
  }, [refetchList]);

  const openManageFields = () => {
    setManageStartNew(false);
    setManageFieldsOpen(true);
  };

  const columns = useMemo(
    () => applyColumnAccess(buildFieldColumns(customFields), 'center_csr_matching', access),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customFields, access, configVersion],
  );

  const persistFields = (next) => {
    const keyById = new Map(customFields.map((f) => [f.id, f.key]));
    if (next.some((f) => keyById.has(f.id) && keyById.get(f.id) !== f.key)) {
      setErrorMsg('A field key cannot be changed after it is created because its data would be lost. Create a new field instead.');
      return;
    }
    const previous = customFields;
    const removed = previous.filter((f) => !next.some((n) => n.id === f.id));
    if (removed.some((f) => FIXED_KEY_SET.has(f.key))) {
      setErrorMsg('Hardcoded columns cannot be removed: Exam Date, Exam Shift, Center Code, Client Code.');
      return;
    }
    const added = next.some((n) => !previous.some((f) => f.id === n.id));
    setConfigFields(next);

    saveChain.current = saveChain.current.then(async () => {
      try {
        const res = await apiClient.put('/center-csr-matching/config', {
          fields: next,
          confirmDrops: removed.length > 0,
        });
        const data = res.data?.data || res.data || {};
        if (Array.isArray(data.fields)) setConfigFields(data.fields);
        if (removed.length || added) await invalidateList();
      } catch (err) {
        setConfigFields(previous);
        setErrorMsg(err.response?.data?.message || err.message || 'Could not save the field change.');
      }
    });
  };

  const writeConfig = useCallback(
    async ({ fields, features, confirmDrops = false }) => {
      const res = await apiClient.put('/center-csr-matching/config', {
        ...(fields !== undefined ? { fields, confirmDrops } : {}),
        ...(features !== undefined ? { features } : {}),
      });
      const data = res.data?.data || res.data || {};
      if (Array.isArray(data.fields)) setConfigFields(data.fields);
      if (data.features) portalFeatures.hydrate(data.features);
      return data;
    },
    [portalFeatures, setConfigFields],
  );

  const handleUpdateFromPreset = useCallback(async () => {
    if (!matchedPreset) return;
    const ok = await confirm({
      title: 'Update fields from preset?',
      message: `Apply the current “${matchedPreset.name}” field settings to Center-CSR-Matching?`,
      tertiary:
        'Matching fields take the preset’s type and options, missing fields are added, and field order follows the preset. Rows and their values are kept. No field is removed.',
      confirmLabel: 'Update from preset',
    });
    if (!ok) return;
    setPresetBusy(true);
    try {
      const nextExtras = mergePresetIntoFields(presetExtras, pageExtras);
      const nextFields = withHardcodedCenterCsrFields(nextExtras);
      const nextFeatures = {
        ...(portalFeatures.features || {}),
        ...(matchedPreset.features && typeof matchedPreset.features === 'object'
          ? matchedPreset.features
          : {}),
      };
      await writeConfig({ fields: nextFields, features: nextFeatures, confirmDrops: false });
      setSuccessMsg(`Fields updated from “${matchedPreset.name}”`);
      await invalidateList();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Could not update from the preset.');
    } finally {
      setPresetBusy(false);
    }
  }, [
    matchedPreset,
    confirm,
    presetExtras,
    pageExtras,
    portalFeatures.features,
    writeConfig,
    setSuccessMsg,
    setErrorMsg,
    invalidateList,
  ]);

  const handleSaveToPreset = useCallback(async () => {
    if (!matchedPreset) return;
    const ok = await confirm({
      title: 'Save to preset?',
      message: `Write this page’s current fields into “${matchedPreset.name}”?`,
      tertiary:
        'The Device Preset is replaced with these columns and Feature Builder settings. Hardcoded Exam Date / Shift / Center Code / Client Code stay on the page and are not stored in the preset.',
      confirmLabel: 'Save to preset',
    });
    if (!ok) return;
    setPresetBusy(true);
    try {
      const saved = await updateDevicePreset(matchedPreset.id, {
        name: matchedPreset.name,
        view: PRESET_VIEW,
        fields: pageExtras,
        features: portalFeatures.features ?? matchedPreset.features ?? undefined,
        layout: matchedPreset.layout ?? undefined,
      });
      queryClient.setQueryData(queryKeys.devicePresets.list(), (list) =>
        Array.isArray(list)
          ? list.map((p) => (String(p.id) === String(matchedPreset.id) ? { ...p, ...saved } : p))
          : list,
      );
      setSuccessMsg(`Preset “${matchedPreset.name}” updated`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Could not save the preset.');
    } finally {
      setPresetBusy(false);
    }
  }, [
    matchedPreset,
    confirm,
    pageExtras,
    portalFeatures.features,
    queryClient,
    setSuccessMsg,
    setErrorMsg,
  ]);

  const handleReloadFromPreset = useCallback(async () => {
    if (!matchedPreset) return;
    const ok = await confirm({
      title: 'Reload this page from preset?',
      message: `Replace Center-CSR-Matching fields with “${matchedPreset.name}”?`,
      tertiary:
        'Extra columns not in the preset are removed. Rows stay; values for removed fields are no longer shown. Hardcoded columns stay.',
      confirmLabel: 'Reload from start',
      destructive: true,
    });
    if (!ok) return;
    setPresetBusy(true);
    try {
      const nextFields = withHardcodedCenterCsrFields(fieldsFromPreset(presetExtras));
      const nextFeatures =
        matchedPreset.features && typeof matchedPreset.features === 'object'
          ? { ...matchedPreset.features }
          : {};
      await writeConfig({ fields: nextFields, features: nextFeatures, confirmDrops: true });
      setSuccessMsg(`Reloaded from “${matchedPreset.name}”`);
      await invalidateList();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Could not reload from the preset.');
    } finally {
      setPresetBusy(false);
    }
  }, [
    matchedPreset,
    confirm,
    presetExtras,
    writeConfig,
    setSuccessMsg,
    setErrorMsg,
    invalidateList,
  ]);

  const handleLoadPreset = useCallback(async () => {
    if (!matchedPreset) return;
    setPresetBusy(true);
    try {
      const nextFields = withHardcodedCenterCsrFields(fieldsFromPreset(presetExtras));
      const nextFeatures =
        matchedPreset.features && typeof matchedPreset.features === 'object'
          ? { ...matchedPreset.features }
          : {};
      await writeConfig({ fields: nextFields, features: nextFeatures, confirmDrops: false });
      setSuccessMsg(`Loaded ${presetExtras.length} field${presetExtras.length === 1 ? '' : 's'} from “${matchedPreset.name}”`);
      await invalidateList();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Could not load the preset.');
    } finally {
      setPresetBusy(false);
    }
  }, [
    matchedPreset,
    presetExtras,
    writeConfig,
    setSuccessMsg,
    setErrorMsg,
    invalidateList,
  ]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleBulkUpdate = async (items) => {
    if (!items?.length) return;
    const results = await Promise.allSettled(
      items.map((item) =>
        apiClient.patch(`/center-csr-matching/${encodeURIComponent(item.rowId)}`, {
          values: item.values,
          version: item.row?.version,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    const done = items.length - failed.length;
    if (done) setSuccessMsg(`${done} row${done === 1 ? '' : 's'} updated.`);
    if (failed.length) {
      const reason = failed[0].reason;
      setErrorMsg(
        `${failed.length} row${failed.length === 1 ? '' : 's'} could not be updated` +
          (reason?.response?.data?.message ? `: ${reason.response.data.message}` : '.'),
      );
    }
    await invalidateList();
  };

  const handleRowUpdate = async (rowId, updatedValues, updatedRow) => {
    try {
      const res = await apiClient.patch(`/center-csr-matching/${encodeURIComponent(rowId)}`, {
        values: updatedValues,
        version: updatedRow?.version,
      });
      const saved = res.data?.data || res.data || {};

      setList((prev) =>
        prev.map((r) =>
          r.rowId === String(rowId)
            ? {
                ...r,
                version: saved.version || (r.version || 1) + 1,
                values: {
                  ...r.values,
                  ...Object.fromEntries(Object.entries(saved).filter(([k]) => !SYSTEM_VALUE_KEYS.has(k))),
                },
              }
            : r,
        ),
      );
      setSuccessMsg('Row updated successfully.');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update row.');
      await invalidateList();
    }
  };

  const handleRowDelete = async (rowIds) => {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    if (ids.length === 0) return;

    try {
      await apiClient.post('/center-csr-matching/delete', { ids });
      const idSet = new Set(ids.map(String));
      setList((prev) => prev.filter((r) => !idSet.has(r.rowId)));
      setSuccessMsg(ids.length === 1 ? 'Row deleted successfully.' : `${ids.length} rows deleted successfully.`);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to delete row.');
      await invalidateList();
    }
  };

  const importMatchKeys = useMemo(() => importMatchKeysFromFields(customFields), [customFields]);
  const importDefaultMatchKey = useMemo(
    () => pickDefaultMatchKey(importMatchKeys, ['center_code', 'client_code', 'exam_date']),
    [importMatchKeys],
  );
  const importExistingRows = useMemo(
    () =>
      (rows || []).map((r) => ({
        id: String(r.rowId || r.id),
        values: r.values && typeof r.values === 'object' ? r.values : {},
      })),
    [rows],
  );

  const handleImportRows = async (csvRows, handlers) => {
    if (!bioExamId) {
      const msg = 'Select a bio exam before importing Center-CSR-Matching rows.';
      setErrorMsg(msg);
      throw new Error(msg);
    }
    const mode = handlers?.mode || 'add';
    const matchKey = String(handlers?.matchKey || '').trim();
    const byHeader = new Map();
    customFields.forEach((f) => {
      byHeader.set(String(f.key).toLowerCase(), f.key);
      byHeader.set(String(f.label).toLowerCase(), f.key);
    });

    const importRows = (Array.isArray(csvRows) ? csvRows : [])
      .map((row) => {
        const v = {};
        Object.entries(row || {}).forEach(([header, raw]) => {
          const key = byHeader.get(String(header).trim().toLowerCase());
          if (key) v[key] = raw;
        });
        return v;
      })
      .filter((v) => Object.values(v).some((x) => String(x ?? '').trim() !== ''));

    if (importRows.length === 0) {
      const msg = 'No rows matched your Center-CSR-Matching fields. CSV headers must be a field label or key.';
      setErrorMsg(msg);
      throw new Error(msg);
    }

    try {
      const result = await runModeAwareImport({
        mode,
        matchKey: matchKey || importDefaultMatchKey,
        rows: importRows,
        existingRows: importExistingRows,
        chunkSize: 400,
        onProgress: handlers?.onProgress,
        createBatch: async (batch) => {
          await apiClient.post('/center-csr-matching/import', { examId: bioExamId, rows: batch });
        },
        updateOne: async (id, values) => {
          await apiClient.patch(`/center-csr-matching/${encodeURIComponent(id)}`, { values });
        },
        deleteMany: async (ids) => {
          await apiClient.post('/center-csr-matching/delete', { ids });
        },
      });
      setErrorMsg('');
      const { created, updated, deleted, failures } = result;
      const failHint = failures.length ? ` (${failures.length} failed)` : '';
      if (mode === 'replace') {
        setSuccessMsg(`Replace all — removed ${deleted}, created ${created} row${created === 1 ? '' : 's'}${failHint}.`);
      } else if (mode === 'update') {
        setSuccessMsg(`Updated ${updated} matching row${updated === 1 ? '' : 's'}${failHint}.`);
      } else if (mode === 'upsert') {
        setSuccessMsg(`Upserted rows — updated ${updated}, created ${created}${failHint}.`);
      } else {
        setSuccessMsg(`Imported ${created} row${created === 1 ? '' : 's'}${failHint}.`);
      }
      await invalidateList();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to import rows.');
      throw err;
    }
  };

  const presetBannerText = (() => {
    if (!matchedPreset || !presetBannerVisible) return '';
    const bits = [];
    if (presetOutdated) {
      if (presetDiff.changed.length) {
        bits.push(
          `${presetDiff.changed.length} field${presetDiff.changed.length === 1 ? '' : 's'} differ` +
            ` (e.g. ${presetDiff.changed[0].label}: ${presetDiff.changed[0].from} → ${presetDiff.changed[0].to})`,
        );
      }
      if (presetDiff.added.length) {
        bits.push(
          `${presetDiff.added.length} field${presetDiff.added.length === 1 ? '' : 's'} on the preset are missing here`,
        );
      }
      if (presetDiff.reordered) bits.push('field order differs');
    }
    if (pageAhead) {
      if (pageDiff.added.length) {
        bits.push(
          `${pageDiff.added.length} field${pageDiff.added.length === 1 ? '' : 's'} on this page are not in the preset`,
        );
      } else if (!presetOutdated && pageDiff.changed.length) {
        bits.push('this page’s field settings differ from the preset');
      } else if (!presetOutdated && pageDiff.reordered) {
        bits.push('this page’s field order differs from the preset');
      }
    }
    return bits.length
      ? `“${matchedPreset.name}” and this page are out of sync: ${bits.join('; ')}.`
      : `“${matchedPreset.name}” and this page are out of sync.`;
  })();

  return (
    <PageShell fill className="tables-page--dynamic">
      <PageHeading
        title={VIEW.title}
        subtitle={VIEW.subtitle}
        actions={
          canConfigure || canApiFetch ? (
            <>
              {canConfigure && viewPresets.length > 1 ? (
                <SearchableSelect
                  ariaLabel="Center-CSR-Matching device preset"
                  value={String(matchedPreset?.id || '')}
                  onChange={setMatchedPresetId}
                  options={viewPresets.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (${p.fieldCount ?? p.fields?.length ?? 0})`,
                  }))}
                  searchThreshold={6}
                  portal
                />
              ) : null}
              {canConfigure && matchedPreset && pageExtras.length === 0 ? (
                <button
                  type="button"
                  className="exam-explore-create"
                  onClick={handleLoadPreset}
                  disabled={presetBusy}
                >
                  {presetBusy ? 'Loading…' : 'Load preset'}
                </button>
              ) : null}
              {canApiFetch ? (
                <IconButton label="API fetch (admin)" onClick={() => setApiOpen(true)}>
                  <Settings size={16} strokeWidth={2} />
                </IconButton>
              ) : null}
              {canConfigure ? (
                <IconButton label="Field builder (admin)" onClick={openManageFields}>
                  <SlidersHorizontal size={16} strokeWidth={2} />
                </IconButton>
              ) : null}
            </>
          ) : null
        }
      />

      {presetBannerVisible ? (
        <div className="exam-explore-preset-banner" role="status">
          <span>{presetBannerText}</span>
          <div className="exam-explore-preset-banner-actions">
            {presetOutdated ? (
              <button
                type="button"
                className="exam-explore-create"
                onClick={handleUpdateFromPreset}
                disabled={presetBusy}
              >
                {presetBusy ? 'Updating…' : 'Update from preset'}
              </button>
            ) : null}
            {pageAhead ? (
              <button
                type="button"
                className="exam-explore-create"
                onClick={handleSaveToPreset}
                disabled={presetBusy}
              >
                {presetBusy ? 'Saving…' : 'Save to preset'}
              </button>
            ) : null}
            <button
              type="button"
              className="exam-explore-create secondary"
              onClick={handleReloadFromPreset}
              disabled={presetBusy}
            >
              Reload from start
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {showSkeleton ? (
          <TableSkeleton isDarkMode={isDarkMode} columns={Math.max(4, customFields.length || 4)} />
        ) : (
          <DynamicTable
            key={`center_csr_layout_${layoutEpoch}_${configVersion}_${customFields.map((f) => f.key).join(',')}`}
            tableId={TABLE_IDS.CENTER_CSR_MATCHING}
            shareState={false}
            initialColumns={columns}
            initialRows={rows}
            layoutPrefs={layoutPrefs}
            onLayoutPrefsChange={onLayoutPrefsChange}
            canSaveLayoutAsDefault={canSaveLayoutAsDefault}
            hasUserLayoutOverride={hasUserLayoutOverride}
            onSaveLayoutAsDefault={
              canSaveLayoutAsDefault
                ? async (prefs) => {
                    const result = await onSaveLayoutAsDefault?.(prefs);
                    if (result?.message) {
                      if (result.ok) setSuccessMsg(result.message);
                      else setErrorMsg(result.message);
                    }
                  }
                : undefined
            }
            onResetLayoutToDefault={
              hasUserLayoutOverride
                ? async () => {
                    const result = await onResetLayoutToDefault?.();
                    if (result?.message) {
                      if (result.ok) setSuccessMsg(result.message);
                      else setErrorMsg(result.message);
                    }
                  }
                : undefined
            }
            onRowUpdate={handleRowUpdate}
            onBulkUpdate={handleBulkUpdate}
            onRowDelete={handleRowDelete}
            onRefresh={refreshRows}
            onImportRows={handleImportRows}
            importMatchKeys={importMatchKeys}
            importDefaultMatchKey={importDefaultMatchKey}
            importExistingRows={importExistingRows}
            importAllowReplaceAll
            showAddRow={false}
            permissions={tablePerms}
            isDarkMode={isDarkMode}
            usePortalFeatures
            enableFeatureBuilder={canConfigure}
            onFeaturesChange={canConfigure ? portalFeatures.onChange : undefined}
            onSaveFeatures={canConfigure ? portalFeatures.save : undefined}
            isSavingFeatures={portalFeatures.saving}
            featuresDirty={portalFeatures.dirty}
            features={withPortalFeatureLocks(portalFeatures.features)}
          />
        )}
      </div>

      <DeviceApiModal
        open={apiOpen}
        onClose={() => setApiOpen(false)}
        onFetched={refreshRows}
        onNotify={setSuccessMsg}
        examId={bioExamId}
        view="center-csr-matching"
        title="Center-CSR-Matching · API request"
      />

      <ExamFieldBuilder
        open={manageFieldsOpen}
        fields={customFields}
        startWithNewField={manageStartNew}
        onClose={() => { setManageFieldsOpen(false); setManageStartNew(false); }}
        onChange={persistFields}
        title="Center-CSR-Matching fields"
        reservedKeys={CENTER_CSR_RESERVED_KEYS}
        allowUnique
        currentView={PRESET_VIEW}
        presetSources={fieldImportSources}
        sourcesEmptyHint="No Param fields yet. Open Device Master → Param, add columns there, then import them here."
        deleteConfirm={(f) =>
          FIXED_KEY_SET.has(f.key)
            ? `"${f.label}" is hardcoded and cannot be deleted.`
            : `Delete field "${f.label}"? Its column and all data stored in it will be permanently removed.`
        }
        bulkModalProps={{
          title: 'Bulk add / edit Center-CSR-Matching fields',
          labelPlaceholder: 'e.g. CSR Name',
          keyPlaceholder: 'csr_name',
        }}
      />
    </PageShell>
  );
};

export default CenterCsrMatchingPage;
