import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CENTER_CODE_KEY, DEFAULT_EXAM_VIEW, EXAM_VIEWS, examViewLabel } from '@exam-view/shared';
import { getExamTable } from './examTableApi';
import './ImportFieldsFromTabModal.css';

const presetLabel = (p) =>
  `${p.name || p.serviceValue} · ${examViewLabel(p.view || DEFAULT_EXAM_VIEW)}`;

/**
 * Pick fields from another exam tab (live exam) or from another field preset (Settings).
 * Shared row values show automatically once the column key is added.
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
  const currentKeys = useMemo(() => new Set(currentFields.map((f) => f.key)), [currentFields]);

  const tabOptions = useMemo(
    () => EXAM_VIEWS.filter((v) => v.key !== currentView),
    [currentView],
  );

  const [sourceView, setSourceView] = useState(tabOptions[0]?.key || DEFAULT_EXAM_VIEW);
  const [sourcePresetId, setSourcePresetId] = useState(presetSources?.[0]?.id || '');
  const [sourceFields, setSourceFields] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setSourceView(tabOptions[0]?.key || DEFAULT_EXAM_VIEW);
    setSourcePresetId(presetSources?.[0]?.id || '');
    setSelected(new Set());
    setError('');
    return undefined;
  }, [open, tabOptions, presetSources]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;

    if (presetMode) {
      const preset = (presetSources || []).find((p) => String(p.id) === String(sourcePresetId));
      const list = Array.isArray(preset?.fields) ? preset.fields : [];
      setSourceFields(list);
      const next = new Set();
      const center = list.find((f) => f.key === CENTER_CODE_KEY);
      if (center && !currentKeys.has(CENTER_CODE_KEY)) next.add(CENTER_CODE_KEY);
      setSelected(next);
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
        const next = new Set();
        const center = list.find((f) => f.key === CENTER_CODE_KEY);
        if (center && !currentKeys.has(CENTER_CODE_KEY)) next.add(CENTER_CODE_KEY);
        setSelected(next);
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
  }, [open, examId, sourceView, sourcePresetId, presetMode, presetSources, currentKeys]);

  if (!open) return null;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectable = sourceFields.filter((f) => !currentKeys.has(f.key));
  const alreadyHere = sourceFields.filter((f) => currentKeys.has(f.key));
  const sourceHomeView = presetMode
    ? (presetSources || []).find((p) => String(p.id) === String(sourcePresetId))?.view || DEFAULT_EXAM_VIEW
    : sourceView;

  const handleImport = () => {
    const picked = sourceFields.filter((f) => selected.has(f.key));
    if (!picked.length) {
      setError('Select at least one field to import.');
      return;
    }
    onImport?.(picked, sourceHomeView);
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
            </h2>
            <p className="import-fields-sub">
              Same keys share one value on the exam. Imported columns are marked shared from the source page —
              edit there; they stay read-only on this page.
            </p>
          </div>
          <button type="button" className="import-fields-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {presetMode ? (
          (presetSources || []).length === 0 ? (
            <p className="import-fields-empty">
              Create at least one other preset first (e.g. Center list for this service), then import its columns here.
            </p>
          ) : (
          <label className="import-fields-source">
            <span>Source preset</span>
            <select value={sourcePresetId} onChange={(e) => setSourcePresetId(e.target.value)}>
              {(presetSources || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {presetLabel(p)} ({p.fieldCount ?? p.fields?.length ?? 0} fields)
                </option>
              ))}
            </select>
          </label>
          )
        ) : (
          <label className="import-fields-source">
            <span>Source tab</span>
            <select value={sourceView} onChange={(e) => setSourceView(e.target.value)}>
              {tabOptions.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}

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
          ) : !selectable.length ? (
            <p className="import-fields-empty">Every field from the source is already in this list.</p>
          ) : (
            selectable.map((f) => (
              <label key={f.key} className="import-fields-row">
                <input
                  type="checkbox"
                  checked={selected.has(f.key)}
                  onChange={() => toggle(f.key)}
                />
                <span className="import-fields-label">{f.label || f.key}</span>
                <code className="import-fields-key">{f.key}</code>
                <span className="import-fields-badge">
                  {f.key === CENTER_CODE_KEY ? 'shared key' : 'shared'}
                </span>
              </label>
            ))
          )}
          {alreadyHere.length > 0 && selectable.length > 0 && (
            <p className="import-fields-skip">
              Skipped (already here): {alreadyHere.map((f) => f.label || f.key).join(', ')}
            </p>
          )}
        </div>

        <footer className="import-fields-footer">
          <button type="button" className="import-fields-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="import-fields-btn primary"
            onClick={handleImport}
            disabled={loading || selected.size === 0}
          >
            Import {selected.size || ''} field{selected.size === 1 ? '' : 's'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
