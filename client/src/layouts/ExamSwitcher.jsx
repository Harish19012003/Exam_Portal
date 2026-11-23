import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { examPath } from '../pages/exams/examUrl';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useExamsList } from '../hooks/useExamsQuery';
import { buildExamLabel, pick } from '../pages/exams/examLabel';
import { serviceHue } from '../utils/serviceTone';

const STALE_MS = 60 * 1000;
const NO_EXAMS = [];

/** Trigger label arrives pre-built: "UPPSC (Bio-Metric - CODE)" → { name, service }. */
const parseExamLabel = (label) => {
  const raw = String(label || '').trim();
  const m = raw.match(/^(.*?)\s*\((.+)\)$/);
  if (!m) return { name: raw, service: '' };
  return { name: m[1].trim(), service: m[2].split(' - ')[0].trim() };
};

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlight query matches inside a plain string (safe: text nodes only). */
export const Highlight = ({ text, query }) => {
  const value = String(text || '');
  const q = String(query || '').trim();
  if (!q || !value) return value;
  const parts = value.split(new RegExp(`(${escapeRegExp(q)})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="exam-switcher-mark">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

/**
 * Breadcrumb tail on an exam page: shows the current exam and opens a searchable list of every exam,
 * so you can jump to another one without going back to the Exams list.
 */
export const ExamSwitcher = ({ examId, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  // Shared exams cache (same key as the Exams page). Loads on first open; refreshes on open when older than a minute.
  const examsQuery = useExamsList({ enabled: open, staleTime: STALE_MS });
  const rows = examsQuery.data ?? NO_EXAMS;
  const loading = examsQuery.isLoading;
  const error = examsQuery.error
    ? examsQuery.error.response?.data?.message || 'Could not load the exams.'
    : '';
  // Name on top, service + code underneath; `label` stays the search haystack.
  const exams = useMemo(
    () =>
      rows
        .map((exam) => {
          const values = exam?.values || {};
          return {
            id: String(exam.id),
            name: pick(values, ['exam_name', 'name', 'title']) || 'Untitled exam',
            service: pick(values, ['service']),
            code: pick(values, ['project_code']),
            label: buildExamLabel(exam),
          };
        })
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
            a.label.localeCompare(b.label),
        ),
    [rows],
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const currentExam = useMemo(() => parseExamLabel(label), [label]);
  const currentId = String(examId || '');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? exams.filter((e) => {
          const hay = `${e.name} ${e.service} ${e.code} ${e.label}`.toLowerCase();
          return hay.includes(q);
        })
      : exams;
    // Keep the open exam at the top so it’s easy to spot.
    if (!matched.length || !currentId) return matched;
    const current = matched.find((e) => e.id === currentId);
    if (!current) return matched;
    return [current, ...matched.filter((e) => e.id !== currentId)];
  }, [exams, query, currentId]);

  useEffect(() => {
    const idx = visible.findIndex((e) => e.id === currentId);
    setActive(idx >= 0 ? idx : 0);
  }, [query, open, visible, currentId]);

  const choose = (id) => {
    setOpen(false);
    if (id !== currentId) {
      // Stay on the sub page being viewed (Op/Guard List, Mock Day...) when switching exams.
      const currentTab = location.pathname.replace(/\/$/, '').split('/')[3] || 'center-list';
      navigate(examPath(id, currentTab));
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (query) {
        setQuery('');
        return;
      }
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
        <span className="exam-switcher-label" title={label}>
          {currentExam.name || label}
        </span>
        {currentExam.service && (
          <span
            className="exam-switcher-svc exam-switcher-svc--trigger"
            style={{ '--svc-h': serviceHue(currentExam.service) }}
          >
            {currentExam.service}
          </span>
        )}
        <ChevronDown size={15} className="exam-switcher-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="exam-switcher-menu" role="presentation">
          <div className="exam-switcher-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, service, or code…"
              aria-label="Search exams"
              aria-controls={listId}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                className="exam-switcher-clear"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <div className="exam-switcher-list" role="listbox" id={listId} aria-label="Exams">
            {loading && !exams.length ? (
              <div className="exam-switcher-empty">Loading exams…</div>
            ) : error ? (
              <div className="exam-switcher-empty exam-switcher-error">{error}</div>
            ) : visible.length === 0 ? (
              <div className="exam-switcher-empty">
                {query ? 'No exams match your search.' : 'No exams yet.'}
              </div>
            ) : (
              visible.map((exam, i) => {
                const current = exam.id === currentId;
                const focused = i === active;
                return (
                  <button
                    key={exam.id}
                    id={`${listId}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={current}
                    className={`exam-switcher-item${current ? ' current' : ''}${focused ? ' active' : ''}`}
                    style={{ '--svc-h': serviceHue(exam.service) }}
                    title={exam.label}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(exam.id)}
                  >
                    <span className="exam-switcher-item-text">
                      <span className="exam-switcher-item-top">
                        <span className="exam-switcher-item-name">
                          <Highlight text={exam.name} query={query} />
                        </span>
                        {exam.service ? (
                          <span className="exam-switcher-svc">
                            <Highlight text={exam.service} query={query} />
                          </span>
                        ) : null}
                      </span>
                      {exam.code ? (
                        <span className="exam-switcher-item-code">
                          <Highlight text={exam.code} query={query} />
                        </span>
                      ) : null}
                    </span>
                    <span className="exam-switcher-check" aria-hidden="true">
                      {current ? <Check size={16} strokeWidth={2.5} /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {!loading && !error && exams.length > 0 && (
            <div className="exam-switcher-foot">
              <span>
                {query ? `${visible.length} of ${exams.length}` : exams.length} exam
                {exams.length === 1 ? '' : 's'}
              </span>
              <span className="exam-switcher-keys" aria-hidden="true">
                <kbd>↑</kbd>
                <kbd>↓</kbd> move · <kbd>↵</kbd> open · <kbd>esc</kbd> close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
