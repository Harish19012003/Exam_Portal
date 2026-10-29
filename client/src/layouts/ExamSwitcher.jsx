import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { listExams } from '../pages/exams/examApi';
import { buildExamLabel } from '../pages/exams/examLabel';

const STALE_MS = 60 * 1000;

/**
 * Breadcrumb tail on an exam page: shows the current exam and opens a searchable list of every exam,
 * so you can jump to another one without going back to the Exams list.
 */
export const ExamSwitcher = ({ examId, label }) => {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const loadedAt = useRef(0);

  const [open, setOpen] = useState(false);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listExams();
      setExams(rows.map((exam) => ({ id: String(exam.id), label: buildExamLabel(exam) })).sort((a, b) => a.label.localeCompare(b.label)));
      loadedAt.current = Date.now();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh the list each time it opens (new exams show up), unless it was loaded a moment ago.
  useEffect(() => {
    if (!open) return;
    if (Date.now() - loadedAt.current > STALE_MS) load();
    setQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? exams.filter((e) => e.label.toLowerCase().includes(q)) : exams;
  }, [exams, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const choose = (id) => {
    setOpen(false);
    if (id !== String(examId)) navigate(`/exams/${encodeURIComponent(id)}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && visible[active]) {
      e.preventDefault();
      choose(visible[active].id);
    }
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  return (
    <div className="exam-switcher" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`exam-switcher-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch exam"
      >
        <span className="exam-switcher-label">{label}</span>
        <ChevronDown size={15} className="exam-switcher-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="exam-switcher-menu">
          <div className="exam-switcher-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exams…"
              aria-label="Search exams"
              aria-controls={listId}
            />
          </div>
          <div className="exam-switcher-list" role="listbox" id={listId} aria-label="Exams">
            {loading && !exams.length ? (
              <div className="exam-switcher-empty">Loading exams…</div>
            ) : error ? (
              <div className="exam-switcher-empty exam-switcher-error">{error}</div>
            ) : visible.length === 0 ? (
              <div className="exam-switcher-empty">{query ? 'No exams match your search.' : 'No exams yet.'}</div>
            ) : (
              visible.map((exam, i) => {
                const current = exam.id === String(examId);
                return (
                  <button
                    key={exam.id}
                    id={`${listId}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={current}
                    className={`exam-switcher-item${current ? ' current' : ''}${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(exam.id)}
                  >
                    <span className="exam-switcher-check">{current && <Check size={14} aria-hidden="true" />}</span>
                    <span className="exam-switcher-item-label">{exam.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
