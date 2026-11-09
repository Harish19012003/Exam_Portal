import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '../../components/PageHeading';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { CENTER_CODE_KEY, DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel } from '@exam-view/shared';
import { buildCombinedField, COMBINE_SEPARATORS, DEFAULT_COMBINE_SEPARATOR, separatorForLabel } from './examCombinedFields';
import { normalizeUniqueRowKeys, uniqueRowKeysLabel } from './examUniqueRows';
import { getExamTable } from './examTableApi';
import { SearchableSelect } from './SearchableSelect';
import './ImportFieldsFromTabModal.css';

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
  /** Ordered selection (tick order = join / unique-key order by default). */
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [combineMode, setCombineMode] = useState(false);
  /** Selected fields also define a composite unique row key (e.g. State + City + Vendor). */
  const [uniqueMode, setUniqueMode] = useState(false);
  const [combineLabel, setCombineLabel] = useState('');
  const [combineSeparator, setCombineSeparator] = useState(DEFAULT_COMBINE_SEPARATOR);
  const [separatorChoice, setSeparatorChoice] = useState('comma'); // a COMBINE_SEPARATORS id, or 'custom'
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setSourceView(firstTabKey);
    setSourcePresetId(presetSourcesRef.current?.[0]?.id || '');
    setSelectedOrder([]);
    setCombineMode(false);
    setUniqueMode(false);
    setCombineLabel('');
    setCombineSeparator(DEFAULT_COMBINE_SEPARATOR);
    setSeparatorChoice('comma');
    setQuery('');
    setError('');
    return undefined;
  }, [open, firstTabKey]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;

    if (presetMode) {
      const preset = (presetSourcesRef.current || []).find((p) => String(p.id) === String(sourcePresetId));
      const list = Array.isArray(preset?.fields) ? preset.fields : [];
      setSourceFields(list);
      setSelectedOrder([]);
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
        setSourceFields(list);
        setSelectedOrder([]);
      })
      .catch(() => {
        if (!alive) return;
        setSourceFields([]);
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
    if (selectedOrder.length < 1 && uniqueMode) setUniqueMode(false);
  }, [selectedOrder, uniqueMode]);

  useEffect(() => {
    if (!combineMode || combineLabel.trim()) return;
    const labels = selectedOrder
      .map((key) => sourceFields.find((f) => f.key === key)?.label || key)
      .filter(Boolean);
    if (labels.length >= 2) setCombineLabel(labels.join(separatorForLabel(combineSeparator)));
  }, [combineMode, selectedOrder, sourceFields, combineSeparator, combineLabel]);

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
  const listFields = q
    ? baseFields.filter((f) => `${f.label || ''} ${f.key}`.toLowerCase().includes(q))
    : baseFields;
  const alreadyHere = sourceFields.filter((f) => currentKeys.has(f.key));
  const sourceHomeView = presetMode
    ? (presetSources || []).find((p) => String(p.id) === String(sourcePresetId))?.view || DEFAULT_EXAM_VIEW
    : sourceView;
  const uniqueKeysPreview = uniqueRowKeysLabel(sourceFields, selectedOrder);

  const handleImport = () => {
    if (!selectedOrder.length) {
      setError('Select at least one field to import.');
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
    const picked = selectedOrder
      .map((key) => sourceFields.find((f) => f.key === key))
      .filter((f) => f && !currentKeys.has(f.key));
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
                {uniqueMode && selected.has(f.key) && (
                  <span className="import-fields-badge unique">unique key</span>
                )}
                {(combineMode || uniqueMode) && selected.has(f.key) && (
                  <span className="import-fields-ord">#{selectedOrder.indexOf(f.key) + 1}</span>
                )}
              </label>
            ))
          )}
          {!combineMode && !uniqueMode && alreadyHere.length > 0 && listFields.length > 0 && (
            <details className="import-fields-skipped">
              <summary>{alreadyHere.length} already on this page</summary>
              <p className="import-fields-skip">{alreadyHere.map((f) => f.label || f.key).join(', ')}</p>
            </details>
          )}
        </div>

        {selectedOrder.length >= 1 && (
          <div className="import-fields-combine">
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
                  . The first matching center is kept; duplicates stay on{' '}
                  {examViewLabel(sourceHomeView)}.
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
