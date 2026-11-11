import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '../../components/PageHeading';
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from 'lucide-react';
import { CENTER_CODE_KEY, DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel } from '@exam-view/shared';
import { buildCombinedField, COMBINE_SEPARATORS, DEFAULT_COMBINE_SEPARATOR, separatorForLabel } from './examCombinedFields';
import {
  normalizeUniqueRowAggregates,
  normalizeUniqueRowKeys,
  UNIQUE_ROW_AGGREGATE_OPS,
  uniqueRowKeysLabel,
} from './examUniqueRows';
import {
  buildAllDaySumSourceField,
  dateShiftSumSourceOptions,
  DATE_SHIFT_ALL_DAY_KEY,
} from './dateShiftsConfig';
import { getExamTable } from './examTableApi';
import { SearchableSelect } from './SearchableSelect';
import './ImportFieldsFromTabModal.css';

const newAggregateRule = (op = 'count') => ({
  id: `agg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  op,
  targetKey: '',
  sourceKey: '',
});

const presetLabel = (p) =>
  `${p.name || p.serviceValue} · ${examViewLabel(p.view || DEFAULT_EXAM_VIEW)}`;

/**
 * Pick fields from another exam tab (live exam) or from another field preset (Settings).
 * Optional: combine 2+ source fields into one read-only joined column.
 */
export const ImportFieldsFromTabModal = ({
  open,
  examId = null,
  currentView,
  currentFields = [],
  /** Other presets to import from (Settings → Field presets). */
  presetSources = null,
  /** Existing unique-import config so the user can re-edit it. */
  existingUniqueRowKeys = null,
  existingUniqueRowAggregates = null,
  /** Open scrolled to the Unique import panel (Edit unique import). */
  focusUnique = false,
  onClose,
  onImport,
}) => {
  const presetMode = Array.isArray(presetSources) && !examId;
  // The parent rebuilds `presetSources` / `tabOptions` on every render. Read them through refs so a
  // re-render never resets the user's ticks; only opening the dialog or changing the source does.
  const presetSourcesRef = useRef(presetSources);
  presetSourcesRef.current = presetSources;
  const currentKeys = useMemo(() => new Set(currentFields.map((f) => f.key)), [currentFields]);

  const tabOptions = useMemo(
    () => EXAM_VIEWS.filter((v) => v.key !== currentView),
    [currentView],
  );
  const firstTabKey = tabOptions[0]?.key || DEFAULT_EXAM_VIEW;

  const [sourceView, setSourceView] = useState(tabOptions[0]?.key || DEFAULT_EXAM_VIEW);
  const [sourcePresetId, setSourcePresetId] = useState(presetSources?.[0]?.id || '');
  const [sourceFields, setSourceFields] = useState([]);
  /** Date×shift template from the source tab/preset (e.g. Max all day on Center list format). */
  const [sourceDateShifts, setSourceDateShifts] = useState(null);
  /** Ordered selection (tick order = join / unique-key order by default). */
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [combineMode, setCombineMode] = useState(false);
  /** Selected fields also define a composite unique row key (e.g. State + City + Vendor). */
  const [uniqueMode, setUniqueMode] = useState(false);
  /** Count / sum results written onto this page’s fields for each unique group. */
  const [aggregateRules, setAggregateRules] = useState([]);
  const [combineLabel, setCombineLabel] = useState('');
  const [combineSeparator, setCombineSeparator] = useState(DEFAULT_COMBINE_SEPARATOR);
  const [separatorChoice, setSeparatorChoice] = useState('comma'); // a COMBINE_SEPARATORS id, or 'custom'
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const uniquePanelRef = useRef(null);

  const seedUniqueKeys = useMemo(
    () => normalizeUniqueRowKeys(existingUniqueRowKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(normalizeUniqueRowKeys(existingUniqueRowKeys))],
  );
  const seedAggregates = useMemo(
    () => normalizeUniqueRowAggregates(existingUniqueRowAggregates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(normalizeUniqueRowAggregates(existingUniqueRowAggregates))],
  );
  const seedUniqueKeysSig = seedUniqueKeys.join('|');

  useEffect(() => {
    if (!open) return undefined;
    setSourceView(firstTabKey);
    setSourcePresetId(presetSourcesRef.current?.[0]?.id || '');
    setCombineMode(false);
    setCombineLabel('');
    setCombineSeparator(DEFAULT_COMBINE_SEPARATOR);
    setSeparatorChoice('comma');
    setQuery('');
    setError('');
    // Re-open existing unique import for editing, or when opened via “Unique import”.
    if (seedUniqueKeys.length || focusUnique) {
      setUniqueMode(true);
      setSelectedOrder(seedUniqueKeys);
      setAggregateRules(
        seedAggregates.map((r) => ({
          ...newAggregateRule(r.op),
          op: r.op,
          targetKey: r.targetKey,
          sourceKey: r.sourceKey || '',
        })),
      );
    } else {
      setUniqueMode(false);
      setSelectedOrder([]);
      setAggregateRules([]);
    }
    return undefined;
  }, [open, firstTabKey, seedUniqueKeysSig, seedAggregates, focusUnique]);

  useEffect(() => {
    if (!open || !uniqueMode) return undefined;
    if (!focusUnique && !seedUniqueKeys.length) return undefined;
    const t = window.setTimeout(() => {
      uniquePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, uniqueMode, focusUnique, seedUniqueKeysSig]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;

    const applySourceList = (list, dateShifts = null) => {
      setSourceFields(list);
      setSourceDateShifts(dateShifts);
      // Keep / restore unique-key selection against the loaded source.
      setSelectedOrder((prev) => {
        const preferred = (prev.length ? prev : seedUniqueKeys).filter((k) =>
          list.some((f) => f.key === k),
        );
        if (seedUniqueKeys.length) return preferred;
        // Switching source preset/tab while editing clears ticks that aren't on the new source.
        return preferred;
      });
    };

    if (presetMode) {
      const preset = (presetSourcesRef.current || []).find((p) => String(p.id) === String(sourcePresetId));
      const list = Array.isArray(preset?.fields) ? preset.fields : [];
      applySourceList(list, preset?.features?.dateShifts || null);
      setLoading(false);
      setError('');
      return () => {
        alive = false;
      };
    }

    if (!examId || !sourceView) return undefined;
    setLoading(true);
    setError('');
    getExamTable(examId, sourceView)
      .then((snap) => {
        if (!alive) return;
        const list = Array.isArray(snap?.fields) ? snap.fields : [];
        applySourceList(list, snap?.features?.dateShifts || null);
      })
      .catch(() => {
        if (!alive) return;
        setSourceFields([]);
        setSourceDateShifts(null);
        setError('Could not load fields from that tab.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, examId, sourceView, sourcePresetId, presetMode]);

  useEffect(() => {
    if (selectedOrder.length < 2 && combineMode) setCombineMode(false);
  }, [selectedOrder, combineMode]);

  useEffect(() => {
    if (!combineMode || combineLabel.trim()) return;
    const labels = selectedOrder
      .map((key) => sourceFields.find((f) => f.key === key)?.label || key)
      .filter(Boolean);
    if (labels.length >= 2) setCombineLabel(labels.join(separatorForLabel(combineSeparator)));
  }, [combineMode, selectedOrder, sourceFields, combineSeparator, combineLabel]);

  const targetFieldOptions = useMemo(() => {
    const list = Array.isArray(currentFields) ? currentFields : [];
    return list
      .filter((f) => f?.key)
      .map((f) => ({
        value: f.key,
        label: `${f.label || f.key} (${f.key})`,
      }));
  }, [currentFields]);
  const sourceFieldOptions = useMemo(() => {
    const fromDateShifts = dateShiftSumSourceOptions(sourceDateShifts, sourceFields);
    const fromFields = (sourceFields || [])
      .filter((f) => f?.key)
      .map((f) => ({
        value: f.key,
        label: `${f.label || f.key} (${f.key})`,
      }));
    const seen = new Set();
    const out = [];
    // Date-shift columns (Max all day, shifts, day summaries) first so Sum of… finds them.
    for (const opt of [...fromDateShifts, ...fromFields]) {
      if (!opt?.value || seen.has(opt.value)) continue;
      seen.add(opt.value);
      out.push(opt);
    }
    return out;
  }, [sourceFields, sourceDateShifts]);
  const uniqueKeysPreview = uniqueRowKeysLabel(sourceFields, selectedOrder);

  if (!open) return null;

  const selected = new Set(selectedOrder);
  const toggle = (key) => {
    setSelectedOrder((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const movePart = (key, dir) => {
    setSelectedOrder((prev) => {
      const i = prev.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Normal import skips keys already on this page; combine / unique can use any source field.
  const baseFields = combineMode || uniqueMode
    ? sourceFields
    : sourceFields.filter((f) => !currentKeys.has(f.key));
  const q = query.trim().toLowerCase();
  const filteredFields = q
    ? baseFields.filter((f) => `${f.label || ''} ${f.key}`.toLowerCase().includes(q))
    : baseFields;
  // Unique edit: already-imported fields first so State / City / Vendor are easy to find.
  const listFields = uniqueMode
    ? [...filteredFields].sort((a, b) => {
        const aHere = currentKeys.has(a.key) ? 0 : 1;
        const bHere = currentKeys.has(b.key) ? 0 : 1;
        if (aHere !== bHere) return aHere - bHere;
        const aSel = selected.has(a.key) ? 0 : 1;
        const bSel = selected.has(b.key) ? 0 : 1;
        return aSel - bSel;
      })
    : filteredFields;
  const alreadyHere = sourceFields.filter((f) => currentKeys.has(f.key));
  const sourceHomeView = presetMode
    ? (presetSources || []).find((p) => String(p.id) === String(sourcePresetId))?.view || DEFAULT_EXAM_VIEW
    : sourceView;

  const patchAggregateRule = (id, patch) => {
    setAggregateRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleImport = () => {
    if (!selectedOrder.length) {
      setError(
        uniqueMode
          ? 'Select the unique key fields (including ones already on this page).'
          : 'Select at least one field to import.',
      );
      return;
    }

    if (combineMode) {
      if (selectedOrder.length < 2) {
        setError('Pick at least two fields to combine.');
        return;
      }
      try {
        const combinedField = buildCombinedField({
          label: combineLabel,
          keys: selectedOrder,
          separator: combineSeparator,
          sourceView: sourceHomeView,
          takenKeys: [...currentKeys],
          sourceFields,
        });
        onImport?.({ combinedField, sourceView: sourceHomeView });
        onClose?.();
      } catch (err) {
        setError(err?.message || 'Could not build the combined column.');
      }
      return;
    }

    const uniqueRowKeys = uniqueMode ? normalizeUniqueRowKeys(selectedOrder) : [];
    const uniqueRowAggregates = uniqueMode
      ? normalizeUniqueRowAggregates(
          aggregateRules.map((r) => ({
            op: r.op,
            targetKey: r.targetKey,
            sourceKey: r.sourceKey,
          })),
        )
      : [];
    if (uniqueMode && aggregateRules.length && uniqueRowAggregates.length !== aggregateRules.length) {
      setError('Each result needs a target field; Sum also needs a source field.');
      return;
    }
    const pickedByKey = new Map();
    for (const key of selectedOrder) {
      const f = sourceFields.find((x) => x.key === key);
      if (f && !currentKeys.has(f.key)) pickedByKey.set(f.key, f);
    }
    // Sum sources from Center date-shifts (e.g. Max all day) should travel with the import.
    if (uniqueMode) {
      for (const rule of uniqueRowAggregates) {
        if (rule.op !== 'sum' || !rule.sourceKey || currentKeys.has(rule.sourceKey)) continue;
        if (pickedByKey.has(rule.sourceKey)) continue;
        const fromSource = sourceFields.find((f) => f.key === rule.sourceKey);
        if (fromSource) {
          pickedByKey.set(fromSource.key, fromSource);
          continue;
        }
        if (rule.sourceKey === DATE_SHIFT_ALL_DAY_KEY) {
          const synthetic = buildAllDaySumSourceField(sourceDateShifts);
          if (synthetic) pickedByKey.set(synthetic.key, synthetic);
        }
      }
    }
    const picked = Array.from(pickedByKey.values());
    if (!picked.length && !uniqueRowKeys.length) {
      setError('Select at least one field that is not already on this page.');
      return;
    }
    if (uniqueMode && uniqueRowKeys.length < 1) {
      setError('Pick at least one field for the unique key.');
      return;
    }
    onImport?.({
      fields: picked,
      sourceView: sourceHomeView,
      ...(uniqueRowKeys.length ? { uniqueRowKeys } : {}),
      ...(uniqueRowAggregates.length ? { uniqueRowAggregates } : {}),
    });
    onClose?.();
  };

  return createPortal(
    <div className="import-fields-overlay" onClick={onClose} role="presentation">
      <div
        className="import-fields-modal"
        role="dialog"
        aria-modal="true"
        aria-label={presetMode ? 'Import fields from another preset' : 'Import fields from another tab'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="import-fields-header">
          <div>
            <h2 className="import-fields-title">
              {presetMode ? 'Import fields from another preset' : 'Import fields from another tab'}
              <InfoTip title="About importing" label="About importing fields">
                Imported columns are shared: one value, edited on the home page. Tick fields and turn on Unique
                import to keep only one row per combination (e.g. State · City · Vendor). Or tick 2+ fields to
                combine them into one read-only column.
              </InfoTip>
            </h2>
          </div>
          <button type="button" className="import-fields-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="import-fields-controls">
        {presetMode ? (
          (presetSources || []).length === 0 ? (
            <p className="import-fields-empty">
              Create at least one other preset first (e.g. Center list for this service), then import its columns here.
            </p>
          ) : (
            <div className="import-fields-source">
              <span>From</span>
              <SearchableSelect
                ariaLabel="Source preset"
                value={String(sourcePresetId)}
                onChange={(v) => setSourcePresetId(v)}
                options={(presetSources || []).map((p) => ({
                  value: String(p.id),
                  label: `${presetLabel(p)} (${p.fieldCount ?? p.fields?.length ?? 0} fields)`,
                }))}
                searchPlaceholder="Search presets…"
              />
            </div>
          )
        ) : (
          <div className="import-fields-source">
            <span>From</span>
            <SearchableSelect
              ariaLabel="Source tab"
              value={sourceView}
              onChange={(v) => setSourceView(v)}
              options={tabOptions.map((v) => ({ value: v.key, label: v.label }))}
            />
          </div>
        )}

        {sourceFields.length > 6 && (
          <label className="import-fields-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              aria-label="Search fields"
            />
          </label>
        )}

        </div>

        {error && (
          <p className="import-fields-error" role="alert">
            {error}
          </p>
        )}

        <div className="import-fields-list" role="group" aria-label="Fields to import">
          {loading ? (
            <p className="import-fields-empty">Loading…</p>
          ) : !sourceFields.length ? (
            <p className="import-fields-empty">
              {presetMode ? 'That preset has no fields yet.' : `“${examViewLabel(sourceView)}” has no fields yet.`}
            </p>
          ) : !listFields.length ? (
            <p className="import-fields-empty">
              {q ? 'No fields match your search.' : 'Every field from the source is already in this list.'}
            </p>
          ) : (
            listFields.map((f) => (
              <label key={f.key} className={`import-fields-row${uniqueMode && selected.has(f.key) ? ' is-unique' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(f.key)}
                  onChange={() => toggle(f.key)}
                />
                <span className="import-fields-label">{f.label || f.key}</span>
                <code className="import-fields-key">{f.key}</code>
                {f.key === CENTER_CODE_KEY && <span className="import-fields-badge">shared key</span>}
                {uniqueMode && currentKeys.has(f.key) && !selected.has(f.key) && (
                  <span className="import-fields-badge on-page">on page</span>
                )}
                {uniqueMode && selected.has(f.key) && (
                  <span className="import-fields-badge unique">
                    unique · {selectedOrder.indexOf(f.key) + 1}
                  </span>
                )}
                {combineMode && !uniqueMode && selected.has(f.key) && (
                  <span className="import-fields-ord">#{selectedOrder.indexOf(f.key) + 1}</span>
                )}
              </label>
            ))
          )}
          {!combineMode && !uniqueMode && alreadyHere.length > 0 && (
            <details className="import-fields-skipped" open={listFields.length === 0}>
              <summary>{alreadyHere.length} already on this page</summary>
              <p className="import-fields-skip">{alreadyHere.map((f) => f.label || f.key).join(', ')}</p>
              <p className="import-fields-skip">
                Turn on <strong>Unique import</strong> below to pick these again for unique key / count / sum.
              </p>
            </details>
          )}
        </div>

        {(selectedOrder.length >= 1 || alreadyHere.length > 0 || uniqueMode || focusUnique) && (
          <div className="import-fields-combine" ref={uniquePanelRef}>
            <label className="import-fields-combine-toggle">
              <input
                type="checkbox"
                checked={uniqueMode}
                onChange={(e) => {
                  const on = e.target.checked;
                  setUniqueMode(on);
                  if (on) setCombineMode(false);
                }}
              />
              <span>Unique import</span>
            </label>
            {uniqueMode && (
              <>
                <p className="import-fields-skip">
                  Only one row per combination of the selected fields will show on this page
                  {uniqueKeysPreview ? (
                    <>
                      {' '}
                      (<strong>{uniqueKeysPreview}</strong>)
                    </>
                  ) : null}
                  . Matching centers stay on {examViewLabel(sourceHomeView)}; result fields can count or
                  sum them.
                </p>
                {selectedOrder.length >= 2 && (
                  <div className="import-fields-parts" role="list" aria-label="Unique key order">
                    <span className="import-fields-parts-label">Unique key order</span>
                    {selectedOrder.map((key, index) => {
                      const field = sourceFields.find((f) => f.key === key);
                      return (
                        <div key={key} className="import-fields-part" role="listitem">
                          <span className="import-fields-part-label">
                            {field?.label || key}
                            <code>{key}</code>
                          </span>
                          <span className="import-fields-part-actions">
                            <button
                              type="button"
                              className="import-fields-part-btn"
                              disabled={index === 0}
                              onClick={() => movePart(key, -1)}
                              aria-label={`Move ${field?.label || key} up`}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="import-fields-part-btn"
                              disabled={index === selectedOrder.length - 1}
                              onClick={() => movePart(key, 1)}
                              aria-label={`Move ${field?.label || key} down`}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="import-fields-parts" role="list" aria-label="Unique result fields">
                  <div className="import-fields-parts-head">
                    <span className="import-fields-parts-label">Result fields</span>
                    <div className="import-fields-agg-actions">
                      <button
                        type="button"
                        className="import-fields-agg-add"
                        onClick={() => setAggregateRules((prev) => [...prev, newAggregateRule('count')])}
                      >
                        <Plus size={14} />
                        Count
                      </button>
                      <button
                        type="button"
                        className="import-fields-agg-add"
                        onClick={() => setAggregateRules((prev) => [...prev, newAggregateRule('sum')])}
                      >
                        <Plus size={14} />
                        Sum
                      </button>
                    </div>
                  </div>
                  {!aggregateRules.length ? (
                    <p className="import-fields-skip">
                      Optional. e.g. Count → Days Total Center, Sum of Max all day → Max All Days.
                    </p>
                  ) : (
                    aggregateRules.map((rule) => (
                      <div key={rule.id} className="import-fields-agg-row" role="listitem">
                        <SearchableSelect
                          ariaLabel="Result type"
                          value={rule.op}
                          searchThreshold={99}
                          portal
                          onChange={(op) => patchAggregateRule(rule.id, { op, sourceKey: op === 'sum' ? rule.sourceKey : '' })}
                          options={UNIQUE_ROW_AGGREGATE_OPS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        {rule.op === 'sum' ? (
                          <SearchableSelect
                            ariaLabel="Source field to sum"
                            value={rule.sourceKey}
                            portal
                            onChange={(sourceKey) => patchAggregateRule(rule.id, { sourceKey })}
                            options={sourceFieldOptions}
                            searchPlaceholder="Sum of…"
                          />
                        ) : null}
                        <SearchableSelect
                          ariaLabel="Target field on this page"
                          value={rule.targetKey}
                          portal
                          onChange={(targetKey) => patchAggregateRule(rule.id, { targetKey })}
                          options={targetFieldOptions}
                          searchPlaceholder="Write to…"
                        />
                        <button
                          type="button"
                          className="import-fields-part-btn"
                          onClick={() => setAggregateRules((prev) => prev.filter((r) => r.id !== rule.id))}
                          aria-label="Remove result"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                  {!targetFieldOptions.length ? (
                    <p className="import-fields-skip">
                      Add number fields on this page first (e.g. Days Total Center, Max All Days), then map
                      results here.
                    </p>
                  ) : null}
                </div>
              </>
            )}
            {selectedOrder.length >= 2 && (
              <label className="import-fields-combine-toggle">
                <input
                  type="checkbox"
                  checked={combineMode}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setCombineMode(on);
                    if (on) setUniqueMode(false);
                  }}
                />
                <span>Combine into one column</span>
              </label>
            )}
            {combineMode && (
              <>
                <label className="import-fields-source">
                  <span>Combined column name</span>
                  <input
                    type="text"
                    value={combineLabel}
                    onChange={(e) => setCombineLabel(e.target.value)}
                    placeholder="e.g. Center address"
                    maxLength={120}
                  />
                </label>
                <div className="import-fields-source">
                  <span>Separator</span>
                  <SearchableSelect
                    ariaLabel="Separator"
                    value={separatorChoice}
                    searchThreshold={99}
                    onChange={(id) => {
                      setSeparatorChoice(id);
                      const preset = COMBINE_SEPARATORS.find((o) => o.id === id);
                      setCombineSeparator(preset ? preset.value : '');
                    }}
                    options={[
                      ...COMBINE_SEPARATORS.map((o) => ({ value: o.id, label: o.label })),
                      { value: 'custom', label: 'Custom…' },
                    ]}
                  />
                </div>
                {separatorChoice === 'custom' && (
                  <label className="import-fields-source">
                    <span>Custom separator</span>
                    <input
                      type="text"
                      value={combineSeparator}
                      onChange={(e) => setCombineSeparator(e.target.value)}
                      placeholder="e.g.  ::  or  →"
                      maxLength={12}
                      autoFocus
                    />
                  </label>
                )}
                <div className="import-fields-parts" role="list" aria-label="Join order">
                  <span className="import-fields-parts-label">Join order</span>
                  {selectedOrder.map((key, index) => {
                    const field = sourceFields.find((f) => f.key === key);
                    return (
                      <div key={key} className="import-fields-part" role="listitem">
                        <span className="import-fields-part-label">
                          {field?.label || key}
                          <code>{key}</code>
                        </span>
                        <span className="import-fields-part-actions">
                          <button
                            type="button"
                            className="import-fields-part-btn"
                            disabled={index === 0}
                            onClick={() => movePart(key, -1)}
                            aria-label={`Move ${field?.label || key} up`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="import-fields-part-btn"
                            disabled={index === selectedOrder.length - 1}
                            onClick={() => movePart(key, 1)}
                            aria-label={`Move ${field?.label || key} down`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="import-fields-skip">
                  Only the combined column is added — source columns stay on {examViewLabel(sourceHomeView)}.
                  Empty parts are skipped at display time.
                </p>
              </>
            )}
          </div>
        )}

        <footer className="import-fields-footer">
          <span className="import-fields-count" aria-live="polite">
            {selectedOrder.length
              ? uniqueMode
                ? `${selectedOrder.length} unique key field${selectedOrder.length === 1 ? '' : 's'}`
                : `${selectedOrder.length} selected`
              : 'None selected'}
          </span>
          <button type="button" className="import-fields-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="import-fields-btn primary"
            onClick={handleImport}
            disabled={loading || selectedOrder.length === 0 || (combineMode && selectedOrder.length < 2)}
          >
            {combineMode
              ? 'Add combined column'
              : uniqueMode
                ? 'Import unique fields'
                : `Import ${selectedOrder.length || ''} field${selectedOrder.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
