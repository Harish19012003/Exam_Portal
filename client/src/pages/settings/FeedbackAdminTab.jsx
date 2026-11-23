import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bug, ExternalLink, Inbox, Lightbulb, Monitor, Save, Search, Trash2, User } from 'lucide-react';
import { useConfirm } from '../../feedback';
import { useToast } from '../../components/ui/Toast';
import { queryKeys } from '../../api/queryKeys';
import {
  FEEDBACK_PRIORITY,
  FEEDBACK_STATUS,
  deleteFeedback,
  listAllFeedback,
  priorityLabel,
  updateFeedback,
} from '../../api/feedbackApi';
import { KindTag, StatusPill } from '../../components/Feedback/FeedbackModal';
import { useUrlState } from '../../hooks/useUrlState';
import { SearchableSelect } from '../exams/SearchableSelect';
import '../../components/Feedback/Feedback.css';
import './FeedbackAdminTab.css';

const OPEN = new Set(['new', 'in_review', 'planned', 'in_progress']);
const NO_ROWS = [];

const fmt = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

/** Settings → Bugs & Features: triage everything users reported from the app. */
export const FeedbackAdminTab = () => {
  const confirm = useConfirm();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: queryKeys.feedback.list(), queryFn: listAllFeedback });
  const rows = listQuery.data || NO_ROWS;

  const [kind, setKind] = useUrlState('fbk', 'all', ['all', 'bug', 'feature']);
  const [status, setStatus] = useUrlState('fbs', 'open', ['open', 'all', ...FEEDBACK_STATUS.map((s) => s.value)]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useUrlState('fbid', '');

  const counts = useMemo(() => {
    const c = { all: rows.length, bug: 0, feature: 0, open: 0 };
    rows.forEach((r) => {
      c[r.kind] += 1;
      if (OPEN.has(r.status)) c.open += 1;
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (status === 'open' && !OPEN.has(r.status)) return false;
      if (status !== 'open' && status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return [r.title, r.description, r.reporter_name, r.reporter_email, r.page].some((t) =>
        String(t || '').toLowerCase().includes(q),
      );
    });
  }, [rows, kind, status, query]);

  const selected = rows.find((r) => r.id === selectedId) || null;

  // Draft for the selected report.
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(selected ? { status: selected.status, priority: selected.priority, admin_note: selected.admin_note || '' } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.updated_at]);
  const dirty =
    selected && draft &&
    (draft.status !== selected.status || draft.priority !== selected.priority || draft.admin_note !== (selected.admin_note || ''));

  const putRow = (saved) =>
    queryClient.setQueryData(queryKeys.feedback.list(), (prev) => (prev || []).map((r) => (r.id === saved.id ? saved : r)));

  const save = async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      putRow(await updateFeedback(selected.id, draft));
      addToast('Report updated — the reporter is notified', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not update the report', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: 'Delete report?',
      message: `Delete “${selected.title}”?`,
      tertiary: 'The reporter will no longer see it in My reports.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFeedback(selected.id);
      queryClient.setQueryData(queryKeys.feedback.list(), (prev) => (prev || []).filter((r) => r.id !== selected.id));
      setSelectedId('');
      addToast('Report deleted', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete the report', 'error');
    }
  };

  return (
    <div className={`fba${selected ? ' has-selection' : ''}`}>
      <div className="fba-toolbar">
        <div className="fba-chips" role="group" aria-label="Type">
          {[
            { id: 'all', label: 'All', n: counts.all },
            { id: 'bug', label: 'Bugs', n: counts.bug, icon: Bug },
            { id: 'feature', label: 'Features', n: counts.feature, icon: Lightbulb },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                className={`fba-chip${kind === c.id ? ' is-on' : ''}`}
                aria-pressed={kind === c.id}
                onClick={() => setKind(c.id)}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                {c.label}
                <span className="fba-chip-n">{c.n}</span>
              </button>
            );
          })}
        </div>
        <SearchableSelect
          className="fba-dd fba-dd--filter"
          ariaLabel="Status filter"
          portal
          searchThreshold={99}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: `Open (${counts.open})` },
            { value: 'all', label: `All statuses (${counts.all})` },
            ...FEEDBACK_STATUS.map((s) => ({ value: s.value, label: `${s.label} (${counts[s.value] || 0})` })),
          ]}
        />
        <label className="fba-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, text, person or page…"
            aria-label="Search reports"
          />
        </label>
      </div>

      <div className="fba-split">
        <div className="fba-list" aria-label="Reports">
          {listQuery.isLoading ? (
            <p className="fb-muted fba-pad">Loading reports…</p>
          ) : listQuery.isError ? (
            <p className="fb-muted fba-pad">Could not load reports.</p>
          ) : visible.length === 0 ? (
            <div className="fb-empty">
              <Inbox size={26} aria-hidden="true" />
              <p>{rows.length ? 'No reports match these filters.' : 'No bug reports or feature requests yet.'}</p>
            </div>
          ) : (
            <ul>
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`fba-row${r.id === selectedId ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <span className="fba-row-top">
                      <KindTag kind={r.kind} />
                      <span className="fba-row-title">{r.title}</span>
                    </span>
                    <span className="fba-row-meta">
                      <StatusPill status={r.status} />
                      <span className={`fba-prio fba-prio--${r.priority}`}>{priorityLabel(r.priority)}</span>
                      <span className="fba-row-who">{r.reporter_name || r.reporter_email || 'Unknown'}</span>
                      <span className="fba-row-when">{fmt(r.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fba-detail">
          {!selected || !draft ? (
            <div className="fb-empty">
              <Inbox size={26} aria-hidden="true" />
              <p>Select a report to see the details.</p>
            </div>
          ) : (
            <>
              <button type="button" className="fba-back" onClick={() => setSelectedId('')}>
                <ArrowLeft size={15} aria-hidden="true" /> All reports
              </button>
              <div className="fba-detail-head">
                <KindTag kind={selected.kind} />
                <h3 className="fba-detail-title">{selected.title}</h3>
              </div>
              <div className="fba-facts">
                <span><User size={13} aria-hidden="true" /> {selected.reporter_name || '—'}{selected.reporter_email ? ` · ${selected.reporter_email}` : ''}</span>
                <span>{fmt(selected.created_at)}</span>
                {selected.page && (
                  <a href={selected.page} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={13} aria-hidden="true" /> <code>{selected.page}</code>
                  </a>
                )}
                {(selected.viewport || selected.user_agent) && (
                  <span title={selected.user_agent}>
                    <Monitor size={13} aria-hidden="true" /> {selected.viewport}
                    {selected.user_agent ? ` · ${selected.user_agent.slice(0, 60)}${selected.user_agent.length > 60 ? '…' : ''}` : ''}
                  </span>
                )}
              </div>

              <section className="fba-block">
                <h4>{selected.kind === 'bug' ? 'What happened' : 'Request'}</h4>
                <p>{selected.description}</p>
              </section>
              {selected.steps && (
                <section className="fba-block">
                  <h4>Steps to reproduce</h4>
                  <p>{selected.steps}</p>
                </section>
              )}

              <section className="fba-manage">
                <div className="fba-manage-row">
                  <label>
                    <span>Status</span>
                    <SearchableSelect
                      className="fba-dd"
                      ariaLabel="Status"
                      portal
                      searchThreshold={99}
                      value={draft.status}
                      onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                      options={FEEDBACK_STATUS.map((s) => ({ value: s.value, label: s.label }))}
                    />
                  </label>
                  <label>
                    <span>Priority</span>
                    <SearchableSelect
                      className="fba-dd"
                      ariaLabel="Priority"
                      portal
                      searchThreshold={99}
                      value={draft.priority}
                      onChange={(v) => setDraft((d) => ({ ...d, priority: v }))}
                      options={FEEDBACK_PRIORITY.map((p) => ({ value: p.value, label: p.label }))}
                    />
                  </label>
                </div>
                <label className="fba-reply">
                  <span>Reply to reporter <small>shown in their “My reports”</small></span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.admin_note}
                    onChange={(e) => setDraft((d) => ({ ...d, admin_note: e.target.value }))}
                    placeholder="e.g. Fixed in today’s update — please refresh."
                  />
                </label>
                <div className="fba-actions">
                  <button type="button" className="fb-btn fb-btn--danger" onClick={remove}>
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </button>
                  <button type="button" className="fb-btn fb-btn--primary" onClick={save} disabled={!dirty || saving}>
                    <Save size={15} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
