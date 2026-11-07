import React, { useMemo, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { Button, IconButton } from '../../components/Button';
import { buildExamDateLabel, buildExamLabel } from './examLabel';
import { setExamLinks } from './examApi';
import { apiErrorMessage } from './examTableApi';
import '../users/UserGroups.css';
import './LinkExamsDialog.css';

/**
 * Pick which other exams are linked to `exam`.
 * Links are undirected and stored server-side for later use (e.g. Exam Day).
 */
export const LinkExamsDialog = ({ exam, exams = [], fields = [], onClose, onSaved }) => {
  const [selected, setSelected] = useState(
    () => new Set((exam?.linkedExamIds || []).map(String)),
  );
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const label = buildExamLabel(exam);
  const dateLabel = buildExamDateLabel(exam, fields);
  const others = useMemo(
    () => (exams || []).filter((e) => String(e.id) !== String(exam?.id)),
    [exams, exam?.id],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;
    return others.filter((e) => {
      const hay = `${buildExamLabel(e)} ${buildExamDateLabel(e, fields)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [others, query, fields]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (e) => {
    e.preventDefault();
    if (saving || !exam?.id) return;
    setSaving(true);
    setError('');
    try {
      await setExamLinks(exam.id, [...selected]);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save exam links.'));
      setSaving(false);
    }
  };

  return (
    <div className="user-group-overlay" onClick={onClose}>
      <form
        className="user-group-modal exam-link-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={`Linked exams for ${label}`}
      >
        <div className="user-group-modal-head">
          <div className="user-group-title">
            <h2>
              <Link2 size={16} aria-hidden="true" /> Linked exams
            </h2>
            <p className="exam-link-sub">
              {label}
              {dateLabel ? <span className="exam-link-date"> · {dateLabel}</span> : null}
            </p>
          </div>
          <IconButton variant="ghost" label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="user-group-modal-body">
          <div className="user-group-field">
            <label htmlFor="exam-link-search">
              Exams ({selected.size} linked)
            </label>
            <input
              id="exam-link-search"
              className="user-group-input"
              type="search"
              value={query}
              autoFocus
              placeholder="Search exams…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error && <div className="exam-link-error">{error}</div>}

          {others.length === 0 ? (
            <p className="exam-link-empty">No other exams to link yet.</p>
          ) : shown.length === 0 ? (
            <p className="exam-link-empty">No exams match your search.</p>
          ) : (
            <ul className="exam-link-list" role="listbox" aria-label="Exams to link">
              {shown.map((e) => {
                const id = String(e.id);
                const checked = selected.has(id);
                const rowDate = buildExamDateLabel(e, fields);
                return (
                  <li key={id}>
                    <label className={`exam-link-option${checked ? ' is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                      />
                      <span className="exam-link-option-text">
                        <span className="exam-link-option-label">{buildExamLabel(e)}</span>
                        {rowDate ? (
                          <span className="exam-link-option-date">{rowDate}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="user-group-modal-foot">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || others.length === 0}>
            {saving ? 'Saving…' : 'Save links'}
          </Button>
        </div>
      </form>
    </div>
  );
};
