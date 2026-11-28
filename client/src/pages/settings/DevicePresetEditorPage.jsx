import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronRight, Save, Smartphone } from 'lucide-react';
import {
  DEFAULT_DEVICE_MASTER_VIEW,
  DEVICE_MASTER_VIEWS,
  EXAM_DAY_VIEW,
  deviceMasterViewLabel,
} from '@exam-view/shared';
import { useConfirm } from '../../feedback';
import { queryKeys } from '../../api/queryKeys';
import { useToast } from '../../components/ui/Toast';
import { InfoTip } from '../../components/PageHeading';
import { ExamFieldBuilder } from '../exams/ExamFieldBuilder';
import { SearchableSelect } from '../exams/SearchableSelect';
import { apiErrorMessage } from '../exams/examTableApi';
import { createDevicePreset, updateDevicePreset } from '../devices/devicePresetApi';
import { listExamPresets } from '../exams/examPresetApi';
import { useDevicesConfig } from '../../hooks/useDevicesQuery';
import {
  CENTER_CSR_FIXED_KEY_SET,
  CENTER_CSR_FIXED_KEYS,
  CENTER_CSR_RESERVED_KEYS,
  stripCenterCsrFixedFields,
  withHardcodedCenterCsrFields,
} from '../centerCsrMatchingColumns';
import {
  DEVICE_REPORT_FIXED_KEY_SET,
  DEVICE_REPORT_FIXED_KEYS,
  DEVICE_REPORT_RESERVED_KEYS,
  isDeviceReportFixedView,
  stripDeviceReportFixedFields,
  withHardcodedDeviceReportFields,
} from '../deviceReportFixedColumns';
import { PresetSwitcher } from './PresetSwitcher';
import { FIELD_GROUP_ALL, FIELD_GROUP_DETAILS } from '../exams/fieldGroups';
import { useUrlState } from '../../hooks/useUrlState';

/** Synthetic import source id for live Device Master → Param fields (`/devices/config`). */
const LIVE_PARAM_SOURCE_ID = 'live:param';

const SYSTEM_RESERVED = ['id', 'version', 'created_at', 'updated_at'];

const emptyForm = () => ({
  id: null,
  name: '',
  view: 'center-csr-matching',
  fields: [],
  features: {},
});

const plainFeatures = (features) =>
  features != null && typeof features === 'object' && !Array.isArray(features) ? features : {};

const fieldsForView = (view, fields) => {
  if (view === 'center-csr-matching') return stripCenterCsrFixedFields(fields);
  if (isDeviceReportFixedView(view)) return stripDeviceReportFixedFields(fields);
  return Array.isArray(fields) ? fields : [];
};

const presetToForm = (preset) => {
  const view = preset.view || DEFAULT_DEVICE_MASTER_VIEW;
  return {
    id: preset.id,
    name: preset.name || '',
    view,
    fields: fieldsForView(view, preset.fields),
    features: { ...plainFeatures(preset.features) },
  };
};

const snapshot = (form) =>
  form
    ? JSON.stringify({
        name: form.name,
        view: form.view,
        fields: form.fields,
        features: form.features,
      })
    : '';

/**
 * Settings → Config → Device Preset → Edit / New.
 * URL: ?section=device-presets&edit=<id|new>
 */
export const DevicePresetEditorPage = ({
  presetId,
  presets,
  presetsLoading,
  onExit,
  onSwitch,
  headerSlots = null,
}) => {
  const isNew = presetId === 'new';
  const formId = useId();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const examPresetsQuery = useQuery({
    queryKey: queryKeys.exams.presets(),
    queryFn: listExamPresets,
  });
  const paramConfigQuery = useDevicesConfig();
  const preset = isNew ? null : presets.find((p) => String(p.id) === String(presetId)) || null;

  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useUrlState('fg', isNew ? FIELD_GROUP_DETAILS : FIELD_GROUP_ALL);

  useEffect(() => {
    if (form) return;
    const next = isNew ? emptyForm() : preset ? presetToForm(preset) : null;
    if (!next) return;
    setForm(next);
    setBaseline(snapshot(next));
  }, [form, isNew, preset]);

  const dirty = Boolean(form) && snapshot(form) !== baseline;

  const bypassRef = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypassRef.current || !dirty) return false;
    if (currentLocation.pathname !== nextLocation.pathname) return true;
    const cur = new URLSearchParams(currentLocation.search);
    const next = new URLSearchParams(nextLocation.search);
    return cur.get('edit') !== next.get('edit') || cur.get('tab') !== next.get('tab') || cur.get('section') !== next.get('section');
  });
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    confirm({
      title: 'Discard unsaved changes?',
      message: 'This preset has changes that have not been saved.',
      confirmLabel: 'Discard changes',
      destructive: true,
    }).then((ok) => {
      if (cancelled) return;
      const b = blockerRef.current;
      if (b.state !== 'blocked') return;
      if (ok) b.proceed();
      else b.reset();
    });
    return () => {
      cancelled = true;
    };
  }, [blocker.state, confirm]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const exit = useCallback(() => {
    bypassRef.current = true;
    onExit();
  }, [onExit]);

  const leave = async () => {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'This preset has changes that have not been saved.',
        confirmLabel: 'Discard changes',
        destructive: true,
      });
      if (!ok) return;
    }
    exit();
  };

  const patchForm = useCallback((patch) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (patch.view !== undefined || patch.fields !== undefined) {
        next.fields = fieldsForView(next.view, next.fields);
      }
      return next;
    });
    setFormError('');
  }, []);

  const onFieldsChange = useCallback((next) => {
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.view === 'center-csr-matching') {
        const nextKeys = new Set((next || []).map((f) => f.key));
        if (CENTER_CSR_FIXED_KEYS.some((k) => !nextKeys.has(k))) {
          queueMicrotask(() =>
            setFormError(
              'Hardcoded columns cannot be removed: Exam Date, Exam Shift, Center Code, Client Code.',
            ),
          );
          return prev;
        }
        queueMicrotask(() => setFormError(''));
        return { ...prev, fields: stripCenterCsrFixedFields(next) };
      }
      if (isDeviceReportFixedView(prev.view)) {
        const nextKeys = new Set((next || []).map((f) => f.key));
        if (DEVICE_REPORT_FIXED_KEYS.some((k) => !nextKeys.has(k))) {
          queueMicrotask(() =>
            setFormError('Hardcoded columns cannot be removed: Date, Shift indicate.'),
          );
          return prev;
        }
        queueMicrotask(() => setFormError(''));
        return { ...prev, fields: stripDeviceReportFixedFields(next) };
      }
      queueMicrotask(() => setFormError(''));
      return { ...prev, fields: Array.isArray(next) ? next : [] };
    });
  }, []);

  const handleSave = async () => {
    if (!form || saving) return;
    const invalid = !form.name.trim()
      ? 'Preset name is required.'
      : !form.view
        ? 'Choose the Device Master page this preset is for.'
        : '';
    if (invalid) {
      setFormError(invalid);
      setActiveGroup(FIELD_GROUP_DETAILS);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        view: form.view,
        fields: fieldsForView(form.view, form.fields),
        features: plainFeatures(form.features),
      };
      if (form.id) await updateDevicePreset(form.id, payload);
      else await createDevicePreset(payload);
      await queryClient.invalidateQueries({ queryKey: queryKeys.devicePresets.list() });
      addToast(form.id ? `Saved "${form.name.trim()}"` : `Created "${form.name.trim()}"`, 'success');
      exit();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the preset'));
      setActiveGroup(FIELD_GROUP_DETAILS);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const reservedKeys = useMemo(() => {
    if (form?.view === 'center-csr-matching') return CENTER_CSR_RESERVED_KEYS;
    if (isDeviceReportFixedView(form?.view)) return DEVICE_REPORT_RESERVED_KEYS;
    return SYSTEM_RESERVED;
  }, [form?.view]);

  const otherPresets = useMemo(
    () => presets.filter((p) => String(p.id) !== String(form?.id)),
    [presets, form?.id],
  );

  /** Live Param columns from Device Master (not a saved device preset). */
  const liveParamSource = useMemo(() => {
    const fields = Array.isArray(paramConfigQuery.data?.fields) ? paramConfigQuery.data.fields : [];
    if (!fields.length) return null;
    return {
      id: LIVE_PARAM_SOURCE_ID,
      name: 'Param (live)',
      view: DEFAULT_DEVICE_MASTER_VIEW,
      fields,
      fieldCount: fields.length,
    };
  }, [paramConfigQuery.data?.fields]);

  /**
   * Import sources for other Device Master tabs:
   * - always offer live Param fields when configured
   * - Center-CSR-Matching also gets Exam Day service presets
   * - plus every other device preset
   */
  const importSources = useMemo(() => {
    const param = liveParamSource ? [liveParamSource] : [];
    if (form?.view !== 'center-csr-matching') return [...param, ...otherPresets];
    const examDay = (examPresetsQuery.data || [])
      .filter((p) => String(p.view || '') === EXAM_DAY_VIEW)
      .map((p) => ({
        ...p,
        id: `exam-day:${p.id}`,
        fields: Array.isArray(p.fields) ? p.fields : [],
      }));
    return [...param, ...examDay, ...otherPresets];
  }, [form?.view, otherPresets, examPresetsQuery.data, liveParamSource]);

  /** Hardcoded columns are always shown in the builder; form.fields stores extras only. */
  const displayFields = useMemo(() => {
    if (!form) return [];
    if (form.view === 'center-csr-matching') return withHardcodedCenterCsrFields(form.fields);
    if (isDeviceReportFixedView(form.view)) return withHardcodedDeviceReportFields(form.fields);
    return form.fields || [];
  }, [form]);

  const detailsIncomplete = Boolean(formError) || !form?.name?.trim() || !form?.view;

  if (!form) {
    const missing = !isNew && !presetsLoading && !preset;
    return (
      <div className="fpe">
        <div className="fpe-head">
          <button type="button" className="fpe-back" onClick={exit}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Device Preset</span>
          </button>
        </div>
        <div className="fpe-state" role={missing ? 'alert' : 'status'}>
          {missing ? <AlertCircle size={22} aria-hidden="true" /> : <Smartphone size={22} aria-hidden="true" />}
          <p>{missing ? 'This preset no longer exists. It may have been deleted.' : 'Loading preset…'}</p>
          {missing && (
            <button type="button" className="exams-btn secondary compact" onClick={exit}>
              Back to Device Preset
            </button>
          )}
        </div>
      </div>
    );
  }

  const fieldCount = displayFields.length;
  const subtitle = [
    deviceMasterViewLabel(form.view),
    `${fieldCount} field${fieldCount === 1 ? '' : 's'}`,
    form.view === 'center-csr-matching'
      ? '4 hardcoded + extras'
      : isDeviceReportFixedView(form.view)
        ? '2 hardcoded (Date, Shift indicate) + extras'
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const backButton = (inline) => (
    <button
      type="button"
      className={`fpe-back${inline ? ' fpe-back--icon' : ''}`}
      onClick={leave}
      disabled={saving}
      title="Back to Device Preset"
      aria-label="Back to Device Preset"
    >
      <ArrowLeft size={inline ? 18 : 16} aria-hidden="true" />
      {!inline && <span>Device Preset</span>}
    </button>
  );
  const presetTitle = form.name.trim() || (isNew ? 'New preset' : 'Untitled preset');
  const currentValue = isNew ? 'new' : String(form.id);
  const titleNode =
    onSwitch && presets.length > 0 ? (
      <PresetSwitcher
        value={currentValue}
        title={presetTitle}
        presets={presets}
        disabled={saving}
        onSelect={onSwitch}
        labelView={deviceMasterViewLabel}
        defaultView={DEFAULT_DEVICE_MASTER_VIEW}
        showService={false}
      />
    ) : (
      presetTitle
    );
  const titleBlock = (inline) => (
    <div className="fpe-titles">
      <div className="fpe-crumbs">
        {inline && (
          <>
            <button type="button" className="fpe-crumb" onClick={leave} disabled={saving}>
              Device Preset
            </button>
            <ChevronRight size={16} className="fpe-crumb-sep" aria-hidden="true" />
          </>
        )}
        <h2 className="fpe-title" title={presetTitle}>{titleNode}</h2>
        {dirty && (
          <span className="fpe-dirty" role="status" title="You have unsaved changes">
            <span className="fpe-dirty-dot" aria-hidden="true" />
            Unsaved
          </span>
        )}
      </div>
      <div className="fpe-tags" title={subtitle}>
        <span className="fpe-tag">{deviceMasterViewLabel(form.view)}</span>
        <span className="fpe-tag">{fieldCount} field{fieldCount === 1 ? '' : 's'}</span>
      </div>
    </div>
  );

  return (
    <div className="fpe">
      {headerSlots ? (
        <>
          {createPortal(backButton(true), headerSlots.lead)}
          {createPortal(<div className="fpe-head fpe-head--inline">{titleBlock(true)}</div>, headerSlots.title)}
        </>
      ) : (
        <div className="fpe-head">
          {backButton(false)}
          {titleBlock(false)}
        </div>
      )}

      <ExamFieldBuilder
        variant="page"
        open
        activeGroup={activeGroup}
        onActiveGroupChange={setActiveGroup}
        detailsLabel="Preset details"
        detailsAlert={detailsIncomplete}
        fields={displayFields}
        title={isNew ? 'New device preset' : 'Edit device preset'}
        subtitle={subtitle}
        reservedKeys={reservedKeys}
        allowUnique
        currentView={form.view}
        presetSources={importSources}
        sourcesEmptyHint={
          form.view === 'center-csr-matching'
            ? 'No Param fields or Exam Day preset yet. Add columns on Device Master → Param, or create an Exam Day service preset, then import them here.'
            : 'No Param fields yet. Open Device Master → Param, add columns there, then import them here into this tab’s preset.'
        }
        bulkWorkingContext={['Device Preset', form.name?.trim() || null, deviceMasterViewLabel(form.view)]
          .filter(Boolean)
          .join(' · ')}
        bulkModalProps={{
          enableApiHeader: true,
          title: 'Bulk add fields',
          labelPlaceholder: 'e.g. Centre Code',
          keyPlaceholder: 'centre_code',
        }}
        onClose={leave}
        onChange={onFieldsChange}
        deleteConfirm={(f) =>
          CENTER_CSR_FIXED_KEY_SET.has(f.key) || DEVICE_REPORT_FIXED_KEY_SET.has(f.key)
            ? `"${f.label}" is hardcoded and cannot be deleted.`
            : `Delete field "${f.label}"?`
        }
        topSlot={
          <div className="fpp-meta fpe-meta">
            <div className="fpe-pane-head">
              <h3 className="fpe-pane-title">Preset details</h3>
              <p className="fpe-pane-hint">
                Name and Device Master page. Report tabs always include Date and Shift indicate from the
                Param row used on fetch (hardcoded). Center-CSR-Matching keeps Exam Date, Exam Shift,
                Center Code, and Client Code. Add extra columns under All fields.
              </p>
            </div>
            {formError && <div className="config-form-error" role="alert">{formError}</div>}

            <div className="config-form-group">
              <label htmlFor={`${formId}-name`}>Preset name</label>
              <input
                id={`${formId}-name`}
                type="text"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                placeholder="e.g. Center CSR Matching layout"
                maxLength={120}
                autoFocus={isNew}
              />
            </div>

            <div className="config-form-group">
              <div className="fpp-label-row">
                <label htmlFor={`${formId}-view`}>Device Master page</label>
                <InfoTip label="About Device Master page" className="fpp-info">
                  Which Device Master tab this field layout is for.
                </InfoTip>
              </div>
              <SearchableSelect
                id={`${formId}-view`}
                portal
                ariaLabel="Device Master page"
                value={form.view}
                onChange={(v) => patchForm({ view: v })}
                options={DEVICE_MASTER_VIEWS.map((v) => ({ value: v.key, label: v.label }))}
              />
            </div>
          </div>
        }
        footer={
          <>
            <span className={`fpe-save-hint${dirty ? ' is-dirty' : ''}`} role="status">
              {dirty ? 'You have unsaved changes' : isNew ? 'New preset — not saved yet' : 'No changes'}
            </span>
            <button type="button" className="exams-btn secondary compact" onClick={leave} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="exams-btn primary compact"
              onClick={handleSave}
              disabled={saving || (!isNew && !dirty)}
            >
              <Save size={14} aria-hidden="true" />
              <span>{saving ? 'Saving…' : isNew ? 'Create preset' : 'Save changes'}</span>
            </button>
          </>
        }
      />
    </div>
  );
};
