import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2, X } from 'lucide-react';
import {
  DEFAULT_EXAM_VIEW,
  EXAM_VIEWS,
  examViewLabel,
} from '@exam-view/shared';
import { SearchableSelect } from './SearchableSelect';
import { getExamTable } from './examTableApi';
import { COMBINE_SEPARATORS, separatorForLabel } from './examCombinedFields';
import {
  DEFAULT_SUMMARY_FIELD_SEPARATOR,
  DEFAULT_SUMMARY_ROW_SEPARATOR,
  buildSummaryField,
  normalizeSummaryConfig,
} from './examSummaryFields';
import './ImportFieldsFromTabModal.css';
import './SummaryColumnModal.css';

const PAGE_SOURCE = '__page__';

const presetLabel = (p) => {
  const name = p.name || p.serviceValue || 'Untitled';
  const page = examViewLabel(p.view || DEFAULT_EXAM_VIEW);
  return p.serviceValue ? `${name} · ${p.serviceValue} · ${page}` : `${name} · ${page}`;
};

const choiceFor = (separator, fallback) => {
  const hit = COMBINE_SEPARATORS.find((o) => o.value === separator);
  return hit ? hit.id : (separator == null ? fallback : 'custom');
};

const fieldOptions = (fields) =>
  (fields || [])
    .filter((f) => f?.key && f.dataType !== 'summary')
    .map((f) => ({
      value: f.key,
      label: `${f.label || f.key} (${f.key})`,
    }));

const OrderList = ({ keys, fields, onReorder, onRemove, empty }) => {
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  const dropOn = (targetKey) => {
    if (!dragKey || !targetKey || dragKey === targetKey) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    onReorder?.(dragKey, targetKey);
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <ul className="summary-column-list">
      {keys.length === 0 ? (
        <li className="summary-column-hint">{empty}</li>
      ) : (
        keys.map((key, index) => {
          const field = (fields || []).find((f) => f.key === key);
          const label = field?.label || key;
          return (
            <li
              key={key}
              className={`summary-column-item${dragKey === key ? ' is-dragging' : ''}${overKey === key && dragKey !== key ? ' is-drop-target' : ''}`}
              onDragOver={(e) => {
                if (!dragKey) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overKey !== key) setOverKey(key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(key);
              }}
            >
              <button
                type="button"
                className="summary-column-grip"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', key);
                  setDragKey(key);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                onKeyDown={(e) => {
                  if (!e.altKey) return;
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (index > 0) onReorder?.(key, keys[index - 1], 'before');
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (index < keys.length - 1) onReorder?.(key, keys[index + 1], 'after');
                  }
                }}
                aria-label={`Reorder ${label}. Drag, or press Alt and an arrow key`}
                title="Drag to reorder (Alt + ↑ / ↓)"
              >
                <GripVertical size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="summary-column-item-label">{label}</span>
              <button
                type="button"
                className="summary-column-icon-btn"
                onClick={() => onRemove(key)}
                aria-label={`Remove ${label}`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
};

const SeparatorField = ({ label, choice, separator, onChoice, onSeparator }) => (
  <div className="import-fields-source">
    <span>{label}</span>
    <SearchableSelect
      ariaLabel={label}
      value={choice}
      searchThreshold={99}
      portal
      onChange={onChoice}
      options={[
        ...COMBINE_SEPARATORS.map((o) => ({ value: o.id, label: o.label })),
        { value: 'custom', label: 'Custom…' },
      ]}
    />
    {choice === 'custom' && (
      <input
        type="text"
        value={separator}
        onChange={(e) => onSeparator(e.target.value)}
        placeholder="Type the symbol"
        maxLength={12}
        aria-label={`Custom ${label}`}
      />
    )}
  </div>
);

/**
 * Create or edit one read-only summary column.
 * The user picks the source page, match columns, value columns, and both join symbols.
 */
export const SummaryColumnModal = ({
  open,
  examId = null,
  currentView = '',
  pageFields = [],
  presetSources = null,
  takenKeys = [],
  initial = null,
  onClose,
  onSave,
}) => {
  const presetMode = Array.isArray(presetSources);
  const [sourceId, setSourceId] = useState(PAGE_SOURCE);
  const [loadedFields, setLoadedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [matchKeys, setMatchKeys] = useState([]);
  const [valueKeys, setValueKeys] = useState([]);
  const [fieldSeparator, setFieldSeparator] = useState(DEFAULT_SUMMARY_FIELD_SEPARATOR);
  const [rowSeparator, setRowSeparator] = useState(DEFAULT_SUMMARY_ROW_SEPARATOR);
  const [fieldChoice, setFieldChoice] = useState('dash');
  const [rowChoice, setRowChoice] = useState('newline');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const cfg = normalizeSummaryConfig(initial?.summary);
    setLabel(initial?.label || '');
    setMatchKeys(cfg?.matchKeys || []);
    setValueKeys(cfg?.valueKeys || []);
    setFieldSeparator(cfg?.fieldSeparator ?? DEFAULT_SUMMARY_FIELD_SEPARATOR);
    setRowSeparator(cfg?.rowSeparator ?? DEFAULT_SUMMARY_ROW_SEPARATOR);
    setFieldChoice(choiceFor(cfg?.fieldSeparator, 'dash'));
    setRowChoice(choiceFor(cfg?.rowSeparator, 'newline'));
    setError('');
    const pageLabel = examViewLabel(currentView || DEFAULT_EXAM_VIEW);
    const presetHit = presetMode && cfg?.sourceView
      ? (presetSources || []).find((p) =>
        String(p.view || '') === cfg.sourceView &&
        (!cfg.sourceLabel || cfg.sourceLabel === p.name || cfg.sourceLabel === presetLabel(p)))
      : null;
    if (presetHit) setSourceId(String(presetHit.id));
    else if (cfg?.sourceView && cfg.sourceView !== currentView && !presetMode) setSourceId(cfg.sourceView);
    else if (cfg?.sourceView === currentView || !cfg || cfg.sourceLabel === pageLabel) setSourceId(PAGE_SOURCE);
    else setSourceId(PAGE_SOURCE);
    return undefined;
  }, [open, initial, presetMode, presetSources, currentView]);

  const sourcePreset = presetMode
    ? (presetSources || []).find((p) => String(p.id) === String(sourceId))
    : null;
  const sourceView = sourceId === PAGE_SOURCE
    ? String(currentView || DEFAULT_EXAM_VIEW)
    : presetMode
      ? String(sourcePreset?.view || DEFAULT_EXAM_VIEW)
      : String(sourceId || DEFAULT_EXAM_VIEW);
  const sourceLabel = sourceId === PAGE_SOURCE
    ? examViewLabel(sourceView)
    : presetMode
      ? (sourcePreset?.name || examViewLabel(sourceView))
      : examViewLabel(sourceView);

  useEffect(() => {
    if (!open) return undefined;
    if (sourceId === PAGE_SOURCE) {
      setLoadedFields(pageFields);
      setLoading(false);
      return undefined;
    }
    if (presetMode) {
      setLoadedFields(Array.isArray(sourcePreset?.fields) ? sourcePreset.fields : []);
      setLoading(false);
      return undefined;
    }
    if (!examId) {
      setLoadedFields([]);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    getExamTable(examId, sourceView)
      .then((snap) => {
        if (!alive) return;
        setLoadedFields(Array.isArray(snap?.fields) ? snap.fields : []);
      })
      .catch(() => {
        if (alive) setLoadedFields([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, sourceId, sourceView, examId, presetMode, sourcePreset, pageFields]);

  const pageByKey = useMemo(() => {
    const map = new Map();
    (pageFields || []).forEach((f) => {
      if (f?.key) map.set(f.key, f);
    });
    return map;
  }, [pageFields]);
  const sourceByKey = useMemo(() => {
    const map = new Map();
    (loadedFields || []).forEach((f) => {
      if (f?.key && f.dataType !== 'summary') map.set(f.key, f);
    });
    return map;
  }, [loadedFields]);

  const matchChoices = useMemo(() => {
    const keys = sourceId === PAGE_SOURCE
      ? [...pageByKey.keys()]
      : [...pageByKey.keys()].filter((key) => sourceByKey.has(key));
    return keys
      .filter((key) => !matchKeys.includes(key))
      .map((key) => ({
        value: key,
        label: `${pageByKey.get(key)?.label || key} (${key})`,
      }));
  }, [sourceId, pageByKey, sourceByKey, matchKeys]);

  const valueChoices = useMemo(
    () => fieldOptions(loadedFields).filter((o) => !valueKeys.includes(o.value)),
    [loadedFields, valueKeys],
  );

  const reorder = (setList, fromKey, toKey, place = 'before') => {
    setList((prev) => {
      const from = prev.indexOf(fromKey);
      let to = prev.indexOf(toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (from < to) to -= 1;
      const insertAt = place === 'after' ? to + 1 : to;
      next.splice(insertAt, 0, item);
      return next;
    });
  };

  const preview = useMemo(() => {
    if (valueKeys.length < 1) return '';
    const sample = valueKeys.map((key, i) => {
      const field = sourceByKey.get(key) || pageByKey.get(key);
      return field?.label || key || `Value ${i + 1}`;
    });
    const line = sample.join(separatorForLabel(fieldSeparator));
    const rowSep = rowSeparator.includes('\n') ? '\n' : (rowSeparator || '\n');
    return `${line}${rowSep}${line}`;
  }, [valueKeys, sourceByKey, pageByKey, fieldSeparator, rowSeparator]);

  if (!open) return null;

  const sourceOptions = [
    { value: PAGE_SOURCE, label: `This page · ${examViewLabel(currentView || DEFAULT_EXAM_VIEW)}` },
    ...(presetMode
      ? (presetSources || []).map((p) => ({
        value: String(p.id),
        label: presetLabel(p),
      }))
      : EXAM_VIEWS.filter((v) => v.key !== currentView).map((v) => ({
        value: v.key,
        label: v.label,
      }))),
  ];

  const applySeparator = (id, setChoice, setValue) => {
    setChoice(id);
    const preset = COMBINE_SEPARATORS.find((o) => o.id === id);
    if (preset) setValue(preset.value);
  };

  const handleSave = () => {
    const summary = normalizeSummaryConfig({
      sourceView,
      sourceLabel,
      matchKeys,
      valueKeys,
      fieldSeparator,
      rowSeparator,
    });
    if (!summary) {
      setError('Pick a source page, at least one match column, and at least one value column.');
      return;
    }
    try {
      const built = buildSummaryField({
        label,
        summary,
        takenKeys: (takenKeys || []).filter((k) => k !== initial?.key),
        sourceFields: loadedFields,
      });
      onSave?.({
        ...built,
        key: initial?.key || built.key,
        label: built.label,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not add the summary column.');
    }
  };

  return createPortal(
    <div className="import-fields-overlay" onClick={onClose} role="presentation">
      <div
        className="import-fields-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-column-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="import-fields-header">
          <h2 id="summary-column-title" className="import-fields-title">
            {initial?.key ? 'Edit summary column' : 'Summary column'}
          </h2>
          <button type="button" className="import-fields-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="summary-column-body">
          <p className="summary-column-hint">
            The cell is read-only. It redraws when the source values change. You choose every column and both join symbols.
          </p>

          <label className="import-fields-source">
            <span>Column name</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Bio name and number"
              maxLength={120}
            />
          </label>

          <div className="import-fields-source">
            <span>Source page</span>
            <SearchableSelect
              ariaLabel="Source page"
              value={sourceId}
              portal
              onChange={(next) => {
                setSourceId(next);
                setMatchKeys([]);
                setValueKeys([]);
              }}
              options={sourceOptions}
              searchPlaceholder="Search pages…"
            />
          </div>

          {loading ? <p className="summary-column-hint">Loading columns…</p> : null}
          {error ? <p className="summary-column-hint" role="alert">{error}</p> : null}

          <div className="summary-column-grid">
            <section className="summary-column-card" aria-labelledby="summary-match-heading">
              <h3 id="summary-match-heading">Match columns</h3>
              <p className="summary-column-hint">
                Rows match when every selected column is the same. Only columns on both pages are listed.
              </p>
              <SearchableSelect
                ariaLabel="Add match column"
                value=""
                portal
                onChange={(key) => {
                  if (!key || matchKeys.includes(key)) return;
                  setMatchKeys((prev) => [...prev, key]);
                }}
                options={matchChoices}
                placeholder="Add match column…"
                searchPlaceholder="Search columns…"
              />
              <OrderList
                keys={matchKeys}
                fields={pageFields}
                onReorder={(fromKey, toKey, place) => reorder(setMatchKeys, fromKey, toKey, place)}
                onRemove={(key) => setMatchKeys((prev) => prev.filter((k) => k !== key))}
                empty="No match columns yet."
              />
            </section>

            <section className="summary-column-card" aria-labelledby="summary-value-heading">
              <h3 id="summary-value-heading">Value columns</h3>
              <p className="summary-column-hint">
                These are joined for each matching row, in the order you set.
              </p>
              <SearchableSelect
                ariaLabel="Add value column"
                value=""
                portal
                onChange={(key) => {
                  if (!key || valueKeys.includes(key)) return;
                  setValueKeys((prev) => [...prev, key]);
                }}
                options={valueChoices}
                placeholder={loadedFields.length ? 'Add value column…' : 'No columns on that page'}
                searchPlaceholder="Search columns…"
              />
              <OrderList
                keys={valueKeys}
                fields={loadedFields}
                onReorder={(fromKey, toKey, place) => reorder(setValueKeys, fromKey, toKey, place)}
                onRemove={(key) => setValueKeys((prev) => prev.filter((k) => k !== key))}
                empty="No value columns yet."
              />
            </section>
          </div>

          <div className="summary-column-grid">
            <SeparatorField
              label="Field join"
              choice={fieldChoice}
              separator={fieldSeparator}
              onChoice={(id) => applySeparator(id, setFieldChoice, setFieldSeparator)}
              onSeparator={setFieldSeparator}
            />
            <SeparatorField
              label="Row join"
              choice={rowChoice}
              separator={rowSeparator}
              onChoice={(id) => applySeparator(id, setRowChoice, setRowSeparator)}
              onSeparator={setRowSeparator}
            />
          </div>

          {preview ? (
            <p className="summary-column-preview" aria-label="Preview">
              {preview}
            </p>
          ) : null}
        </div>

        <footer className="import-fields-footer">
          <span className="import-fields-count">
            {matchKeys.length} match · {valueKeys.length} value
          </span>
          <button type="button" className="import-fields-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="import-fields-btn primary" onClick={handleSave}>
            {initial?.key ? 'Save summary column' : 'Add summary column'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
