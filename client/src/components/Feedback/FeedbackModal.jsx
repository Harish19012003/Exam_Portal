import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, Inbox, Lightbulb, MapPin, Maximize2, MessageSquareReply, Monitor, Plus, Send, X } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import {
  FEEDBACK_PRIORITY,
  createFeedback,
  listMyFeedback,
  priorityLabel,
  statusMeta,
} from '../../api/feedbackApi';
import { useToast } from '../ui/Toast';
import './Feedback.css';

const emptyForm = (kind) => ({ kind, title: '', description: '', steps: '', priority: 'medium' });

const TITLE_MAX = 120;
const DESC_MAX = 4000;

/** "Chrome 131 · macOS" from the user agent — just for the attached-info chip. */
const browserLabel = (ua = navigator.userAgent) => {
  const pick = (re, name) => {
    const m = ua.match(re);
    return m ? `${name} ${m[1].split('.')[0]}` : '';
  };
  const browser =
    pick(/Edg\/([\d.]+)/, 'Edge') ||
    pick(/OPR\/([\d.]+)/, 'Opera') ||
    pick(/Firefox\/([\d.]+)/, 'Firefox') ||
    pick(/Chrome\/([\d.]+)/, 'Chrome') ||
    pick(/Version\/([\d.]+).*Safari/, 'Safari') ||
    'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} · ${os}` : browser;
};

const timeAgo = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return d.toLocaleDateString();
};

export const StatusPill = ({ status }) => {
  const meta = statusMeta(status);
  return <span className={`fb-pill fb-pill--${meta.tone}`}>{meta.label}</span>;
};

export const KindTag = ({ kind }) =>
  kind === 'bug' ? (
    <span className="fb-kind fb-kind--bug"><Bug size={12} aria-hidden="true" /> Bug</span>
  ) : (
    <span className="fb-kind fb-kind--feature"><Lightbulb size={12} aria-hidden="true" /> Feature</span>
  );

/**
 * Report a bug / request a feature (sidebar icon + Help window). "My reports" shows status and replies.
 * The current page, browser and screen size are attached automatically.
 */
export const FeedbackModal = ({ open, onClose, initialKind = 'bug' }) => {
  const titleId = useId();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const firstFieldRef = useRef(null);
  const [view, setView] = useState('new'); // 'new' | 'mine'
  const [form, setForm] = useState(() => emptyForm(initialKind));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const mineQuery = useQuery({
    queryKey: queryKeys.feedback.mine(),
    queryFn: listMyFeedback,
    enabled: open,
  });
  const mine = mineQuery.data || [];

  useEffect(() => {
    if (!open) return undefined;
    setView('new');
    setForm(emptyForm(initialKind));
    setError('');
    setShowSteps(false);
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, initialKind]);

  if (!open) return null;

  const isBug = form.kind === 'bug';
  const page = `${location.pathname}${location.search}`;
  const set = (patch) => {
    setError('');
    setForm((p) => ({ ...p, ...patch }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Add a short title.');
    if (!form.description.trim()) return setError(isBug ? 'Describe what went wrong.' : 'Describe the feature you need.');
    setSending(true);
    try {
      const saved = await createFeedback({
        ...form,
        page,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
      });
      queryClient.setQueryData(queryKeys.feedback.mine(), (prev) => [saved, ...(prev || [])]);
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.list() });
      addToast(isBug ? 'Bug report sent — thank you!' : 'Feature request sent — thank you!', 'success');
      setForm(emptyForm(form.kind));
      setView('mine');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fb-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="fb-head">
          <span className={`fb-head-icon ${isBug && view === 'new' ? 'is-bug' : ''}`} aria-hidden="true">
            {view === 'mine' ? <Inbox size={20} /> : isBug ? <Bug size={20} /> : <Lightbulb size={20} />}
          </span>
          <div className="fb-head-text">
            <h2 id={titleId} className="fb-title">
              {view === 'mine' ? 'My reports' : isBug ? 'Report a bug' : 'Request a feature'}
            </h2>
            <p className="fb-sub">
              {view === 'mine' ? 'Status and replies from the team' : 'Goes straight to the admin team'}
            </p>
          </div>
          <button type="button" className="fb-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="fb-tabs" role="tablist" aria-label="Report views">
          <button type="button" role="tab" aria-selected={view === 'new'} className={`fb-tab${view === 'new' ? ' is-active' : ''}`} onClick={() => setView('new')}>
            New report
          </button>
          <button type="button" role="tab" aria-selected={view === 'mine'} className={`fb-tab${view === 'mine' ? ' is-active' : ''}`} onClick={() => setView('mine')}>
            My reports{mine.length ? <span className="fb-tab-count">{mine.length}</span> : null}
          </button>
        </div>

        {view === 'new' ? (
          <form
            className="fb-form"
            onSubmit={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
            }}
          >
            <div className="fb-body">
              <div className="fb-seg" role="radiogroup" aria-label="Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isBug}
                  className={`fb-seg-opt${isBug ? ' is-on is-bug' : ''}`}
                  onClick={() => set({ kind: 'bug' })}
                >
                  <Bug size={16} aria-hidden="true" />
                  Bug
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isBug}
                  className={`fb-seg-opt${!isBug ? ' is-on is-feature' : ''}`}
                  onClick={() => set({ kind: 'feature', priority: form.priority === 'critical' ? 'high' : form.priority })}
                >
                  <Lightbulb size={16} aria-hidden="true" />
                  Feature
                </button>
              </div>

              {error && <div className="fb-error" role="alert">{error}</div>}

              <div className="fb-field">
                <div className="fb-label-row">
                  <label className="fb-label" htmlFor={`${titleId}-t`}>Title</label>
                  <span className="fb-count">{form.title.length}/{TITLE_MAX}</span>
                </div>
                <input
                  ref={firstFieldRef}
                  id={`${titleId}-t`}
                  className="fb-input"
                  maxLength={TITLE_MAX}
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder={isBug ? 'e.g. Save does nothing on Field presets' : 'e.g. Export Device Master to Excel'}
                />
              </div>

              <div className="fb-field">
                <div className="fb-label-row">
                  <label className="fb-label" htmlFor={`${titleId}-d`}>
                    {isBug ? 'What happened?' : 'What do you need, and why?'}
                  </label>
                  {form.description.length > DESC_MAX * 0.8 && (
                    <span className="fb-count">{form.description.length}/{DESC_MAX}</span>
                  )}
                </div>
                <textarea
                  id={`${titleId}-d`}
                  className="fb-input fb-textarea"
                  rows={4}
                  maxLength={DESC_MAX}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder={isBug ? 'What did you expect, and what happened instead?' : 'Describe the idea and the problem it solves.'}
                />
              </div>

              {isBug &&
                (showSteps || form.steps ? (
                  <div className="fb-field">
                    <div className="fb-label-row">
                      <label className="fb-label" htmlFor={`${titleId}-s`}>Steps to reproduce</label>
                      <span className="fb-count">optional</span>
                    </div>
                    <textarea
                      id={`${titleId}-s`}
                      className="fb-input fb-textarea"
                      rows={3}
                      maxLength={2000}
                      value={form.steps}
                      onChange={(e) => set({ steps: e.target.value })}
                      placeholder={'1. Open …\n2. Click …\n3. See …'}
                      autoFocus={showSteps && !form.steps}
                    />
                  </div>
                ) : (
                  <button type="button" className="fb-add-steps" onClick={() => setShowSteps(true)}>
                    <Plus size={14} aria-hidden="true" /> Add steps to reproduce
                  </button>
                ))}

              <div className="fb-field">
                <span className="fb-label">{isBug ? 'How bad is it?' : 'How important is it?'}</span>
                <div className={`fb-prio${isBug ? '' : ' fb-prio--3'}`} role="radiogroup" aria-label="Priority">
                  {FEEDBACK_PRIORITY.filter((p) => isBug || !p.bugOnly).map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={form.priority === p.value}
                      className={`fb-prio-opt fb-prio-opt--${p.value}${form.priority === p.value ? ' is-on' : ''}`}
                      onClick={() => set({ priority: p.value })}
                    >
                      <span className="fb-prio-dot" aria-hidden="true" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fb-attached" aria-label="Attached automatically">
                <span className="fb-attached-label">Attached</span>
                <span className="fb-chip" title={page}><MapPin size={12} aria-hidden="true" /><code>{page}</code></span>
                <span className="fb-chip"><Monitor size={12} aria-hidden="true" />{browserLabel()}</span>
                <span className="fb-chip"><Maximize2 size={12} aria-hidden="true" />{window.innerWidth}×{window.innerHeight}</span>
              </div>
            </div>
            <footer className="fb-foot">
              <span className="fb-kbd-hint" aria-hidden="true"><kbd>⌘</kbd><kbd>↵</kbd> to send</span>
              <button type="button" className="fb-btn fb-btn--ghost" onClick={onClose} disabled={sending}>
                Cancel
              </button>
              <button type="submit" className={`fb-btn fb-btn--primary${isBug ? ' is-bug' : ''}`} disabled={sending}>
                <Send size={15} aria-hidden="true" />
                {sending ? 'Sending…' : isBug ? 'Send bug report' : 'Send request'}
              </button>
            </footer>
          </form>
        ) : (
          <div className="fb-body">
            {mineQuery.isLoading ? (
              <p className="fb-muted">Loading…</p>
            ) : mine.length === 0 ? (
              <div className="fb-empty">
                <Inbox size={26} aria-hidden="true" />
                <p>You haven’t sent any reports yet.</p>
                <button type="button" className="fb-btn fb-btn--primary" onClick={() => setView('new')}>
                  Send one
                </button>
              </div>
            ) : (
              <ul className="fb-mine">
                {mine.map((r) => (
                  <li key={r.id} className="fb-mine-item">
                    <div className="fb-mine-top">
                      <KindTag kind={r.kind} />
                      <span className="fb-mine-title">{r.title}</span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="fb-mine-meta">
                      {priorityLabel(r.priority)} priority · {timeAgo(r.created_at)}
                      {r.page ? <> · <code>{r.page}</code></> : null}
                    </div>
                    {r.admin_note && (
                      <div className="fb-reply">
                        <MessageSquareReply size={14} aria-hidden="true" />
                        <span>{r.admin_note}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
