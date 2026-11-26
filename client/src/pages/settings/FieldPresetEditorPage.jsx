import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronRight, KeyRound, LayoutTemplate, Save } from 'lucide-react';
import {
  CALLING_EXPAND_MODES,
  CALLING_LABEL_DEFAULT_TARGET_KEY,
  CALLING_LABEL_MODES,
  DEFAULT_EXAM_VIEW,
  EXAM_VIEWS,
  OPERATOR_GUARD_CALLING_VIEW,
  emptyCallingLabelCategory,
  examViewLabel,
  normalizeCallingExpand,
  normalizeCallingLabel,
} from '@exam-view/shared';
import { useConfirm } from '../../feedback';
import { queryKeys } from '../../api/queryKeys';
import { useToast } from '../../components/ui/Toast';
import { InfoTip } from '../../components/PageHeading';
import { ExamFieldBuilder } from '../exams/ExamFieldBuilder';
import { SearchableSelect } from '../exams/SearchableSelect';
import { loadExamFields } from '../exams/examFieldTypes';
import { createExamPreset, updateExamPreset } from '../exams/examPresetApi';
import { ensureFocusDateFields } from '../exams/dateShiftsConfig';
import { focusDateTargetsFromAggregates } from '../exams/examUniqueRows';
import { apiErrorMessage } from '../exams/examTableApi';
import { PresetSwitcher } from './PresetSwitcher';
import { FIELD_GROUP_ALL, FIELD_GROUP_DETAILS } from '../exams/fieldGroups';
import { useUrlState } from '../../hooks/useUrlState';

const NONE_VALUE = '__none__';

/** Quick picks shown in the left rail for Op/Guard Calling presets. */
const CALLING_RULE_BIO = 'bio';
const CALLING_RULE_GUARD = 'guard';
const CALLING_RULE_NONE = 'none';

const defaultFriskingCategories = () => [
  {
    ...emptyCallingLabelCategory(),
    id: 'male',
    matchLabel: 'Male',
    headCandidate: true,
    headLabel: 'H M Guard',
    itemPrefix: 'M Guard',
    priority: 10,
  },
  {
    ...emptyCallingLabelCategory(),
    id: 'female',
    matchLabel: 'Female',
    headCandidate: true,
    headLabel: 'H F Guard',
    itemPrefix: 'F Guard',
    priority: 20,
  },
  {
    ...emptyCallingLabelCategory(),
    id: 'baggage',
    matchLabel: 'Baggage',
    headCandidate: false,
    headLabel: '',
    itemPrefix: 'Baggage',
    priority: 30,
  },
];

/** Prefer biometric_designation / designation if those columns exist on the preset. */
const resolveCallingLabelTargetKey = (fields, currentKey = '') => {
  const keys = new Set((fields || []).map((f) => String(f?.key || '').trim()).filter(Boolean));
  const want = String(currentKey || '').trim();
  if (want && keys.has(want)) return want;
  if (keys.has('biometric_designation')) return 'biometric_designation';
  if (keys.has(CALLING_LABEL_DEFAULT_TARGET_KEY)) return CALLING_LABEL_DEFAULT_TARGET_KEY;
  const byLabel = (fields || []).find((f) =>
    /designation/i.test(String(f?.label || f?.key || '')),
  );
  if (byLabel?.key) return byLabel.key;
  return want || CALLING_LABEL_DEFAULT_TARGET_KEY;
};

const callingRuleIdFromFeatures = (features) => {
  const label = normalizeCallingLabel(features?.callingLabel);
  if (label.mode === CALLING_LABEL_MODES.FIRST_NUMBERED) return CALLING_RULE_BIO;
  if (label.mode === CALLING_LABEL_MODES.CATEGORY_HEAD) return CALLING_RULE_GUARD;
  return CALLING_RULE_NONE;
};

const emptyForm = () => ({
  id: null,
  name: '',
  serviceValue: '',
  view: DEFAULT_EXAM_VIEW,
  fields: [],
  features: {},
});

const pairKey = (serviceValue, view) =>
  `${String(serviceValue || '').trim().toLowerCase()}::${String(view || DEFAULT_EXAM_VIEW)}`;

const plainFeatures = (features) =>
  features != null && typeof features === 'object' && !Array.isArray(features) ? features : {};

/** Saved preset → editable form (adds the focus-date columns its unique-row aggregates need). */
const presetToForm = (preset) => {
  const features = { ...plainFeatures(preset.features) };
  const { countTargetKey, sumTargetKey } = focusDateTargetsFromAggregates(features.uniqueRowAggregates);
  const { fields } = ensureFocusDateFields(preset.fields || [], { countTargetKey, sumTargetKey });
  return {
    id: preset.id,
    name: preset.name || '',
    serviceValue: preset.serviceValue || '',
    view: preset.view || DEFAULT_EXAM_VIEW,
    fields,
    features,
  };
};

/** Comparable snapshot for the unsaved-changes check. */
const snapshot = (form) =>
  form
    ? JSON.stringify({
        name: form.name,
        serviceValue: form.serviceValue,
        view: form.view,
        fields: form.fields,
        features: form.features,
      })
    : '';

/**
 * Settings → Config → Field presets → Edit / New.
 * Full-page editor (replaces the old side drawer): name, service, page, fields, Bulk add and
 * Dependencies, with a sticky Cancel / Save bar. URL: ?section=presets&edit=<id|new>.
 */
export const FieldPresetEditorPage = ({
  presetId,
  presets,
  presetsLoading,
  serviceOptions,
  onExit,
  onSwitch,
  headerSlots = null,
}) => {
  const isNew = presetId === 'new';
  const formId = useId();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const preset = isNew ? null : presets.find((p) => String(p.id) === String(presetId)) || null;

  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // Rail selection (Preset details / a field group) survives refresh via ?fg=.
  const [activeGroup, setActiveGroup] = useUrlState('fg', isNew ? FIELD_GROUP_DETAILS : FIELD_GROUP_ALL);

  // Build the form once its source is known (immediately for New, after the list loads for Edit).
  useEffect(() => {
    if (form) return;
    const next = isNew ? emptyForm() : preset ? presetToForm(preset) : null;
    if (!next) return;
    setForm(next);
    setBaseline(snapshot(next));
  }, [form, isNew, preset]);

  const dirty = Boolean(form) && snapshot(form) !== baseline;

  // ── Leave guards ─────────────────────────────────────────────────────────
  // Our own Back / Cancel / Save confirm first and then skip the router blocker.
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
    setForm((prev) => ({ ...prev, ...patch }));
    setFormError('');
  }, []);
  const onFieldsChange = useCallback((fields) => patchForm({ fields }), [patchForm]);

  /** Left-rail quick pick: Bio (Supervisor/Bio Opr) or Guard (H M / H F). */
  const applyCallingRule = useCallback(
    (ruleId) => {
      setForm((prev) => {
        if (!prev) return prev;
        const expand = normalizeCallingExpand(prev.features?.callingExpand);
        const label = normalizeCallingLabel(prev.features?.callingLabel);
        const targetKey = resolveCallingLabelTargetKey(prev.fields, label.targetKey);
        let nextExpand = { ...expand };
        let nextLabel = { ...label, targetKey };

        if (ruleId === CALLING_RULE_BIO) {
          nextExpand = { ...expand, mode: CALLING_EXPAND_MODES.MAX_DAY_N };
          nextLabel = {
            ...label,
            mode: CALLING_LABEL_MODES.FIRST_NUMBERED,
            targetKey,
            firstLabel: label.firstLabel || 'Supervisor',
            restPrefix: label.restPrefix || 'Bio Opr',
          };
        } else if (ruleId === CALLING_RULE_GUARD) {
          nextExpand = { ...expand, mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS };
          nextLabel = {
            ...label,
            mode: CALLING_LABEL_MODES.CATEGORY_HEAD,
            targetKey,
            categories:
              label.categories?.length > 0 ? label.categories : defaultFriskingCategories(),
          };
        } else {
          nextLabel = {
            ...label,
            mode: CALLING_LABEL_MODES.NONE,
            targetKey,
          };
        }

        return {
          ...prev,
          features: {
            ...plainFeatures(prev.features),
            callingExpand: nextExpand,
            callingLabel: nextLabel,
          },
        };
      });
      setFormError('');
    },
    [],
  );

  const handleSave = async () => {
    if (!form || saving) return;
    const invalid = !form.name.trim()
      ? 'Preset name is required.'
      : !form.serviceValue.trim()
        ? 'Choose the service this preset is for.'
        : !form.view
          ? 'Choose the exam page this preset is for.'
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
        serviceValue: form.serviceValue,
        view: form.view,
        fields: form.fields,
        features: plainFeatures(form.features),
      };
      if (form.id) await updateExamPreset(form.id, payload);
      else await createExamPreset(payload);
      await queryClient.invalidateQueries({ queryKey: queryKeys.exams.presets() });
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

  // One preset per (service, page). Same service can have presets on other pages.
  const usedPairs = useMemo(
    () =>
      new Set(
        presets
          .filter((p) => String(p.id) !== String(form?.id))
          .map((p) => pairKey(p.serviceValue, p.view || DEFAULT_EXAM_VIEW)),
      ),
    [presets, form?.id],
  );
  const serviceChoices = serviceOptions.filter((o) => !form?.view || !usedPairs.has(pairKey(o, form.view)));
  const hasCurrentInChoices = !form?.serviceValue || serviceChoices.includes(form.serviceValue);
  const otherPresets = useMemo(
    () => presets.filter((p) => String(p.id) !== String(form?.id)),
    [presets, form?.id],
  );
  const detailsIncomplete = Boolean(formError) || !form?.name?.trim() || !form?.serviceValue?.trim();

  // ── Not ready / not found ────────────────────────────────────────────────
  if (!form) {
    const missing = !isNew && !presetsLoading && !preset;
    return (
      <div className="fpe">
        <div className="fpe-head">
          <button type="button" className="fpe-back" onClick={exit}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Service preset</span>
          </button>
        </div>
        <div className="fpe-state" role={missing ? 'alert' : 'status'}>
          {missing ? <AlertCircle size={22} aria-hidden="true" /> : <LayoutTemplate size={22} aria-hidden="true" />}
          <p>{missing ? 'This preset no longer exists. It may have been deleted.' : 'Loading preset…'}</p>
          {missing && (
            <button type="button" className="exams-btn secondary compact" onClick={exit}>
              Back to Service preset
            </button>
          )}
        </div>
      </div>
    );
  }

  const fieldCount = form.fields.length;
  const uniqueKeys = Array.isArray(form.features?.uniqueRowKeys) ? form.features.uniqueRowKeys : [];
  const expandLabel =
    form.view === OPERATOR_GUARD_CALLING_VIEW
      ? normalizeCallingExpand(form.features?.callingExpand).mode === CALLING_EXPAND_MODES.PER_SHIFT
        ? 'Per shift'
        : 'Max Day N'
      : '';
  const subtitle = [
    form.serviceValue || 'No service yet',
    examViewLabel(form.view),
    `${fieldCount} field${fieldCount === 1 ? '' : 's'}`,
    Array.isArray(form.features?.uniqueRowKeys) && form.features.uniqueRowKeys.length
      ? `unique · ${form.features.uniqueRowKeys.join(' · ')}`
      : null,
    form.view === OPERATOR_GUARD_CALLING_VIEW
      ? `expand · ${
          normalizeCallingExpand(form.features?.callingExpand).mode === CALLING_EXPAND_MODES.PER_SHIFT
            ? 'per shift'
            : 'Max Day N'
        }`
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
      title="Back to Service preset"
      aria-label="Back to Service preset"
    >
      <ArrowLeft size={inline ? 18 : 16} aria-hidden="true" />
      {!inline && <span>Service preset</span>}
    </button>
  );
  const presetTitle = form.name.trim() || (isNew ? 'New preset' : 'Untitled preset');
  const currentValue = isNew ? 'new' : String(form.id);
  // Title doubles as a preset switcher. Leaving a dirty form goes through the router blocker
  // → "Discard unsaved changes?".
  const titleNode =
    onSwitch && presets.length > 0 ? (
      <PresetSwitcher
        value={currentValue}
        title={presetTitle}
        presets={presets}
        disabled={saving}
        onSelect={onSwitch}
      />
    ) : (
      presetTitle
    );
  const titleBlock = (inline) => (
    <>
      <div className="fpe-titles">
        <div className="fpe-crumbs">
          {inline && (
            <>
              <button type="button" className="fpe-crumb" onClick={leave} disabled={saving}>
                Service preset
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
          <span className={`fpe-tag${form.serviceValue ? ' is-service' : ' is-missing'}`}>
            {form.serviceValue || 'No service'}
          </span>
          <span className="fpe-tag">{examViewLabel(form.view)}</span>
          {expandLabel && <span className="fpe-tag">Expand · {expandLabel}</span>}
          {uniqueKeys.length > 0 && (
            <span className="fpe-tag-text">
              <KeyRound size={12} aria-hidden="true" />
              {uniqueKeys.join(' + ')}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="fpe">
      {headerSlots ? (
        // Wide screens: [← Field presets] Config | CSO OP List … chips — all on the Settings title row.
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
        railExtra={
          form.view === OPERATOR_GUARD_CALLING_VIEW ? (
            <div className="efb-rail-section efb-rail-calling-rule">
              <div className="efb-rail-title">Op/Guard Calling rule</div>
              <SearchableSelect
                id={`${formId}-rail-calling-rule`}
                portal
                ariaLabel="Op/Guard Calling rule"
                value={callingRuleIdFromFeatures(form.features)}
                onChange={(v) => applyCallingRule(v)}
                options={[
                  { value: CALLING_RULE_BIO, label: 'Supervisor + Bio Opr' },
                  { value: CALLING_RULE_GUARD, label: 'H M / H F Guard' },
                  { value: CALLING_RULE_NONE, label: 'None (manual)' },
                ]}
              />
            </div>
          ) : null
        }
        fields={form.fields}
        title={isNew ? 'New preset' : 'Edit preset'}
        subtitle={subtitle}
        examSourceFields={loadExamFields()}
        enableFromExam
        currentView={form.view}
        presetSources={otherPresets}
        currentServiceValue={form.serviceValue || ''}
        bulkWorkingContext={['Service preset', form.name?.trim() || null, form.serviceValue?.trim() || null, examViewLabel(form.view)]
          .filter(Boolean)
          .join(' · ')}
        onClose={leave}
        onChange={onFieldsChange}
        // Center list presets: Bulk add → Date shifts (shift format for exams).
        enableDateShifts={form.view === DEFAULT_EXAM_VIEW}
        dateShifts={form.view === DEFAULT_EXAM_VIEW ? form.features?.dateShifts || null : null}
        onDateShiftsChange={
          form.view === DEFAULT_EXAM_VIEW
            ? (dateShifts) => patchForm({ features: { ...plainFeatures(form.features), dateShifts } })
            : null
        }
        uniqueRowKeys={form.features?.uniqueRowKeys}
        uniqueRowAggregates={form.features?.uniqueRowAggregates}
        onUniqueImportChange={(payload) => {
          const nextFeatures = {
            ...plainFeatures(form.features),
            ...(payload?.uniqueRowKeys !== undefined ? { uniqueRowKeys: payload.uniqueRowKeys } : {}),
            ...(payload?.uniqueRowAggregates !== undefined ? { uniqueRowAggregates: payload.uniqueRowAggregates } : {}),
          };
          const { countTargetKey, sumTargetKey } = focusDateTargetsFromAggregates(nextFeatures.uniqueRowAggregates);
          const { fields: nextFields, changed } = ensureFocusDateFields(form.fields || [], {
            countTargetKey,
            sumTargetKey,
          });
          patchForm({ features: nextFeatures, ...(changed ? { fields: nextFields } : {}) });
        }}
        topSlot={
          <div className="fpp-meta fpe-meta">
            <div className="fpe-pane-head">
              <h3 className="fpe-pane-title">Preset details</h3>
              <p className="fpe-pane-hint">
                Name, the service and exam page this preset applies to, and page-specific rules.
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
                placeholder="e.g. Bio-Metric · Mock Day"
                maxLength={120}
                autoFocus={isNew}
              />
            </div>

            <div className="fpp-meta-row">
              <div className="config-form-group">
                <div className="fpp-label-row">
                  <label htmlFor={`${formId}-service`}>Service</label>
                  <InfoTip label="About service and page" className="fpp-info">
                    One preset per service and page. An exam only recommends the preset that matches both.
                  </InfoTip>
                </div>
                {serviceOptions.length > 0 ? (
                  <SearchableSelect
                    id={`${formId}-service`}
                    portal
                    value={form.serviceValue || NONE_VALUE}
                    onChange={(v) => patchForm({ serviceValue: v === NONE_VALUE ? '' : v })}
                    options={[
                      { value: NONE_VALUE, label: 'Select a service…' },
                      ...(!hasCurrentInChoices && form.serviceValue ? [{ value: form.serviceValue, label: form.serviceValue }] : []),
                      ...serviceChoices.map((o) => ({ value: o, label: o })),
                    ]}
                  />
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
                <SearchableSelect
                  id={`${formId}-view`}
                  portal
                  value={form.view}
                  onChange={(v) => patchForm({ view: v })}
                  options={EXAM_VIEWS.map((v) => ({ value: v.key, label: v.label }))}
                />
              </div>
            </div>

            {form.view === OPERATOR_GUARD_CALLING_VIEW && (() => {
              const expand = normalizeCallingExpand(form.features?.callingExpand);
              const label = normalizeCallingLabel(form.features?.callingLabel);
              const patchCallingFeatures = (patch) => {
                const prev =
                  form.features && typeof form.features === 'object' ? form.features : {};
                patchForm({
                  features: {
                    ...prev,
                    ...patch,
                  },
                });
              };
              return (
                <div className="fpp-calling-features">
                  <div className="config-form-group fpp-calling-expand">
                    <div className="fpp-label-row">
                      <label htmlFor={`${formId}-calling-expand`}>Expand by (from Center list)</label>
                      <InfoTip label="About expand by" className="fpp-info">
                        Sync creates/hides rows from Center list. Lowering counts hides rows — does
                        not delete them.
                      </InfoTip>
                    </div>
                    <SearchableSelect
                      id={`${formId}-calling-expand`}
                      portal
                      value={
                        label.mode === CALLING_LABEL_MODES.CATEGORY_HEAD
                          ? CALLING_EXPAND_MODES.CATEGORY_COUNTS
                          : expand.mode
                      }
                      onChange={(mode) => {
                        let nextMode = CALLING_EXPAND_MODES.MAX_DAY_N;
                        if (mode === CALLING_EXPAND_MODES.PER_SHIFT) {
                          nextMode = CALLING_EXPAND_MODES.PER_SHIFT;
                        } else if (mode === CALLING_EXPAND_MODES.CATEGORY_COUNTS) {
                          nextMode = CALLING_EXPAND_MODES.CATEGORY_COUNTS;
                        }
                        patchCallingFeatures({
                          callingExpand: { ...expand, mode: nextMode },
                          ...(nextMode === CALLING_EXPAND_MODES.CATEGORY_COUNTS &&
                          label.mode === CALLING_LABEL_MODES.NONE
                            ? {
                                callingLabel: {
                                  ...label,
                                  mode: CALLING_LABEL_MODES.CATEGORY_HEAD,
                                  categories:
                                    label.categories.length > 0
                                      ? label.categories
                                      : defaultFriskingCategories(),
                                },
                              }
                            : {}),
                        });
                      }}
                      options={[
                        {
                          value: CALLING_EXPAND_MODES.MAX_DAY_N,
                          label: 'Max Day N slots (center × date × N)',
                        },
                        {
                          value: CALLING_EXPAND_MODES.PER_SHIFT,
                          label: 'Per shift (center × date × shift)',
                        },
                        {
                          value: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
                          label: 'Category counts (Male + Female + Baggage…)',
                        },
                      ]}
                    />
                  </div>

                  <div className="config-form-group">
                    <label htmlFor={`${formId}-calling-label-mode`}>Row label rule</label>
                    <SearchableSelect
                      id={`${formId}-calling-label-mode`}
                      portal
                      value={label.mode}
                      onChange={(mode) => {
                        let nextMode = CALLING_LABEL_MODES.NONE;
                        if (mode === CALLING_LABEL_MODES.FIRST_NUMBERED) {
                          nextMode = CALLING_LABEL_MODES.FIRST_NUMBERED;
                        } else if (mode === CALLING_LABEL_MODES.CATEGORY_HEAD) {
                          nextMode = CALLING_LABEL_MODES.CATEGORY_HEAD;
                        } else if (mode === CALLING_LABEL_MODES.CONSTANT) {
                          nextMode = CALLING_LABEL_MODES.CONSTANT;
                        }
                        const nextLabel = {
                          ...label,
                          mode: nextMode,
                          ...(nextMode === CALLING_LABEL_MODES.CATEGORY_HEAD &&
                          !label.categories.length
                            ? { categories: defaultFriskingCategories() }
                            : {}),
                        };
                        patchCallingFeatures({
                          callingLabel: nextLabel,
                          ...(nextMode === CALLING_LABEL_MODES.CATEGORY_HEAD
                            ? {
                                callingExpand: {
                                  ...expand,
                                  mode: CALLING_EXPAND_MODES.CATEGORY_COUNTS,
                                },
                              }
                            : {}),
                        });
                      }}
                      options={[
                        { value: CALLING_LABEL_MODES.NONE, label: 'None (manual labels)' },
                        {
                          value: CALLING_LABEL_MODES.FIRST_NUMBERED,
                          label: 'First + numbered (Supervisor, Bio Opr 1…)',
                        },
                        {
                          value: CALLING_LABEL_MODES.CATEGORY_HEAD,
                          label: 'Category head (H M Guard / F Guard / Baggage…)',
                        },
                        {
                          value: CALLING_LABEL_MODES.CONSTANT,
                          label: 'Constant (same value on every row)',
                        },
                      ]}
                    />
                  </div>

                  <div className="config-form-group">
                    <div className="fpp-label-row">
                      <label htmlFor={`${formId}-calling-label-key`}>Label column key</label>
                      <InfoTip label="About label column key" className="fpp-info">
                        Pick the Calling field that receives the generated row labels.
                      </InfoTip>
                    </div>
                    <SearchableSelect
                      id={`${formId}-calling-label-key`}
                      portal
                      value={label.targetKey || ''}
                      placeholder="Select a field…"
                      searchPlaceholder="Search by name or key…"
                      onChange={(key) =>
                        patchCallingFeatures({
                          callingLabel: { ...label, targetKey: key },
                        })
                      }
                      options={(() => {
                        const opts = (form.fields || [])
                          .filter((f) => f?.key)
                          .map((f) => ({
                            value: f.key,
                            label: f.label && f.label !== f.key ? `${f.label} · ${f.key}` : f.key,
                          }));
                        // Keep a saved key selectable even if its field was removed from the preset.
                        if (label.targetKey && !opts.some((o) => o.value === label.targetKey)) {
                          opts.unshift({ value: label.targetKey, label: `${label.targetKey} (not in this preset)` });
                        }
                        return opts;
                      })()}
                    />
                  </div>

                  {label.mode === CALLING_LABEL_MODES.CONSTANT && (
                    <div className="config-form-group">
                      <label htmlFor={`${formId}-calling-constant`}>Constant value</label>
                      <input
                        id={`${formId}-calling-constant`}
                        type="text"
                        value={label.constantValue}
                        onChange={(e) =>
                          patchCallingFeatures({
                            callingLabel: { ...label, constantValue: e.target.value },
                          })
                        }
                        placeholder="e.g. abc"
                        maxLength={120}
                      />
                    </div>
                  )}

                  {label.mode === CALLING_LABEL_MODES.FIRST_NUMBERED && (
                    <div className="fpp-meta-row">
                      <div className="config-form-group">
                        <label htmlFor={`${formId}-calling-first`}>First row label</label>
                        <input
                          id={`${formId}-calling-first`}
                          type="text"
                          value={label.firstLabel}
                          onChange={(e) =>
                            patchCallingFeatures({
                              callingLabel: { ...label, firstLabel: e.target.value },
                            })
                          }
                          placeholder="Supervisor"
                          maxLength={80}
                        />
                      </div>
                      <div className="config-form-group">
                        <label htmlFor={`${formId}-calling-rest`}>Rest prefix</label>
                        <input
                          id={`${formId}-calling-rest`}
                          type="text"
                          value={label.restPrefix}
                          onChange={(e) =>
                            patchCallingFeatures({
                              callingLabel: { ...label, restPrefix: e.target.value },
                            })
                          }
                          placeholder="Bio Opr"
                          maxLength={80}
                        />
                      </div>
                    </div>
                  )}

                  {label.mode === CALLING_LABEL_MODES.CATEGORY_HEAD && (
                    <div className="fpp-calling-cats">
                      <div className="fpp-calling-cats-head">
                        <div className="fpp-label-row">
                          <strong>Categories</strong>
                          <InfoTip label="About categories" className="fpp-info">
                            matchLabel should match Center list shift names (Male, Female,
                            Baggage/Crowd). One head only — highest priority head-candidate with
                            count &gt; 0.
                          </InfoTip>
                        </div>
                        <button
                          type="button"
                          className="exams-btn secondary compact"
                          onClick={() =>
                            patchCallingFeatures({
                              callingLabel: {
                                ...label,
                                categories: [
                                  ...label.categories,
                                  {
                                    ...emptyCallingLabelCategory(),
                                    id: `cat_${label.categories.length + 1}`,
                                    priority: (label.categories.length + 1) * 10,
                                  },
                                ],
                              },
                            })
                          }
                        >
                          + Add
                        </button>
                      </div>
                      {label.categories.map((cat, idx) => (
                        <div key={cat.id || idx} className="fpp-calling-cat-row">
                          <input
                            type="text"
                            aria-label="Match Center shift label"
                            value={cat.matchLabel}
                            placeholder="Male"
                            onChange={(e) => {
                              const categories = label.categories.map((c, i) =>
                                i === idx ? { ...c, matchLabel: e.target.value } : c,
                              );
                              patchCallingFeatures({ callingLabel: { ...label, categories } });
                            }}
                          />
                          <input
                            type="text"
                            aria-label="Head label"
                            value={cat.headLabel}
                            placeholder="H M Guard"
                            disabled={!cat.headCandidate}
                            onChange={(e) => {
                              const categories = label.categories.map((c, i) =>
                                i === idx ? { ...c, headLabel: e.target.value } : c,
                              );
                              patchCallingFeatures({ callingLabel: { ...label, categories } });
                            }}
                          />
                          <input
                            type="text"
                            aria-label="Item prefix"
                            value={cat.itemPrefix}
                            placeholder="M Guard"
                            onChange={(e) => {
                              const categories = label.categories.map((c, i) =>
                                i === idx ? { ...c, itemPrefix: e.target.value } : c,
                              );
                              patchCallingFeatures({ callingLabel: { ...label, categories } });
                            }}
                          />
                          <label className="fpp-calling-cat-head">
                            <input
                              type="checkbox"
                              checked={Boolean(cat.headCandidate)}
                              onChange={(e) => {
                                const categories = label.categories.map((c, i) =>
                                  i === idx ? { ...c, headCandidate: e.target.checked } : c,
                                );
                                patchCallingFeatures({ callingLabel: { ...label, categories } });
                              }}
                            />
                            Head
                          </label>
                          <button
                            type="button"
                            className="exams-btn secondary compact"
                            aria-label="Remove category"
                            onClick={() => {
                              const categories = label.categories.filter((_, i) => i !== idx);
                              patchCallingFeatures({ callingLabel: { ...label, categories } });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
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
