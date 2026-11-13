import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Save,
  Eye,
  Code,
  Check,
  CheckCircle2,
  AlertCircle,
  Shield,
  Tag,
  UserPlus,
  KeyRound,
  Mail,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import {
  fetchMessageTemplates,
  saveMessageTemplate,
  resetMessageTemplate,
  sendTestMessageTemplate,
} from '../../api/messageTemplatesApi';

const CATEGORY_ICONS = {
  auth: KeyRound,
  security: Shield,
  welcome: UserPlus,
};
const categoryIcon = (badge) => CATEGORY_ICONS[String(badge || '').toLowerCase()] || Mail;

const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/** Fill {variable} placeholders with the template's sample values (preview only). */
const fillSample = (text, sample) =>
  String(text || '').replace(/\{([a-z_]+)\}/g, (match, key) => (sample && key in sample ? sample[key] : match));

export const MessageTemplatesTab = ({ actionsSlot = null }) => {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.messageTemplates,
    queryFn: fetchMessageTemplates,
  });

  const [selectedId, setSelectedId] = useState('otp');
  const [drafts, setDrafts] = useState({}); // { [id]: { subject?, body?, enabled? } } — unsaved edits only
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState(null);
  const bodyRef = useRef(null);

  const server = templates.find((t) => t.id === selectedId) || templates[0];
  const draft = (server && drafts[server.id]) || {};
  const current = server ? { ...server, ...draft } : null;
  const isDirty = (tpl) => {
    const d = drafts[tpl.id];
    return Boolean(d) && ['subject', 'body', 'enabled'].some((k) => k in d && d[k] !== tpl[k]);
  };
  const dirty = server ? isDirty(server) : false;

  const patchCache = (updated) =>
    queryClient.setQueryData(queryKeys.messageTemplates, (list = []) => list.map((t) => (t.id === updated.id ? updated : t)));

  const setDraft = (field, value) => {
    setNotice(null);
    setDrafts((prev) => ({ ...prev, [server.id]: { ...(prev[server.id] || {}), [field]: value } }));
  };
  const clearDraft = (id) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleInsertVariable = (name) => {
    const token = `{${name}}`;
    if (viewMode === 'code' && bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? current.body.length;
      const end = el.selectionEnd ?? start;
      setDraft('body', `${current.body.slice(0, start)}${token}${current.body.slice(end)}`);
      return;
    }
    // Subject is the only text field in preview mode, so variables go there.
    setDraft('subject', `${current.subject} ${token}`.trim());
  };

  const handleSave = async () => {
    if (!server || !dirty || saving) {return;}
    const patch = {};
    ['subject', 'body', 'enabled'].forEach((k) => {
      if (k in draft && draft[k] !== server[k]) {patch[k] = draft[k];}
    });
    setSaving(true);
    setNotice(null);
    try {
      const updated = await saveMessageTemplate(server.id, patch);
      patchCache(updated);
      clearDraft(server.id);
      setNotice({ type: 'success', text: `${server.name} saved` });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: errorText(err, 'Could not save the template') });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!server) {return;}
    if (!window.confirm(`Reset "${server.name}" to the built-in default? Your edits to it will be lost.`)) {return;}
    setSaving(true);
    setNotice(null);
    try {
      const updated = await resetMessageTemplate(server.id);
      patchCache(updated);
      clearDraft(server.id);
      setNotice({ type: 'success', text: 'Reset to the default template' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: errorText(err, 'Could not reset the template') });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailAddress || !server) {return;}
    setTestEmailSending(true);
    setTestEmailMsg(null);
    try {
      await sendTestMessageTemplate(server.id, testEmailAddress);
      setTestEmailMsg({ type: 'success', text: `Test email sent to ${testEmailAddress}` });
      setTimeout(() => {
        setTestEmailOpen(false);
        setTestEmailMsg(null);
      }, 2500);
    } catch (err) {
      setTestEmailMsg({ type: 'error', text: errorText(err, 'Could not send the test email') });
    } finally {
      setTestEmailSending(false);
    }
  };

  const previewDoc = useMemo(
    () => (current ? fillSample(current.body, current.sample) : ''),
    [current?.body, current?.sample], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const headerActions = (
    <div className="config-toolbar-actions">
      <button
        type="button"
        className="config-add-btn secondary"
        onClick={() => {
          setTestEmailMsg(null);
          setTestEmailOpen(true);
        }}
        disabled={!server}
        title="Send the saved version of this email to an address you choose"
      >
        <Send size={14} aria-hidden="true" />
        <span>Send test</span>
      </button>
      <button
        type="button"
        className="config-add-btn"
        onClick={handleSave}
        disabled={!dirty || saving}
        title={dirty ? 'Save changes to this template' : 'No changes to save'}
      >
        {saving ? <Loader2 size={14} className="ps-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
        <span>{saving ? 'Saving…' : 'Save template'}</span>
      </button>
    </div>
  );

  if (isLoading) {
    return <div className="msg-templates-container msg-state">Loading templates…</div>;
  }
  if (isError || !current) {
    return (
      <div className="msg-templates-container msg-state" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>Could not load the email templates.</span>
        <button type="button" className="config-add-btn secondary" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="msg-templates-container">
      {actionsSlot ? createPortal(headerActions, actionsSlot) : <div className="msg-templates-header">{headerActions}</div>}

      {notice && (
        <div className={`ps-alert ${notice.type}`} role="status">
          {notice.type === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="msg-studio-grid">
        <div className="msg-sidebar-card">
          <div className="msg-sidebar-header">
            <span className="msg-sidebar-title">Templates ({templates.length})</span>
          </div>

          <div className="msg-template-list">
            {templates.map((tpl) => {
              const enabled = tpl.id in drafts && 'enabled' in drafts[tpl.id] ? drafts[tpl.id].enabled : tpl.enabled;
              const Icon = categoryIcon(tpl.badge);
              return (
                <button
                  type="button"
                  key={tpl.id}
                  className={`msg-template-card ${tpl.id === selectedId ? 'active' : ''} ${enabled ? '' : 'is-off'}`}
                  onClick={() => setSelectedId(tpl.id)}
                  aria-current={tpl.id === selectedId ? 'true' : undefined}
                >
                  <span className="msg-template-icon" aria-hidden="true"><Icon size={16} /></span>
                  <span className="msg-template-text">
                    <span className="msg-template-name" title={tpl.name}>{tpl.name}</span>
                    <span className="msg-template-kind">{enabled ? tpl.badge : 'Off'}</span>
                  </span>
                  {isDirty(tpl) && <span className="msg-template-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="msg-editor-card">
          {/* ON / OFF for this email */}
          <div className="msg-enable-row">
            <div className="msg-enable-text">
              <span className="msg-enable-title">Send this email</span>
              <span className="msg-enable-hint">
                {current.enabled
                  ? 'Users receive this email automatically.'
                  : current.required
                    ? 'Switched off — people will not get this email, so sign-in or password recovery may not work.'
                    : 'Switched off — nothing is sent.'}
              </span>
            </div>
            <label className="msg-switch" aria-label={`Send ${current.name} email`}>
              <input
                type="checkbox"
                checked={current.enabled}
                onChange={(e) => {
                  if (
                    !e.target.checked &&
                    current.required &&
                    !window.confirm(`"${current.name}" is used for sign-in and password recovery. If you switch it off, people will not receive it and may be unable to sign in or recover access. Switch it off anyway?`)
                  ) {
                    return;
                  }
                  setDraft('enabled', e.target.checked);
                }}
              />
              <span className="msg-switch-track" />
            </label>
          </div>

          <div className={`msg-editor-body ${current.enabled ? '' : 'is-off'}`}>
            <div className="msg-field-row">
              <label className="msg-field-label" htmlFor="msg-subject">Subject</label>
              <input
                id="msg-subject"
                type="text"
                className="msg-subject-input"
                value={current.subject}
                maxLength={200}
                onChange={(e) => setDraft('subject', e.target.value)}
                placeholder="Email subject…"
              />
            </div>

            <div className="msg-variables-bar">
              <span className="msg-variables-label">Insert variable</span>
              <div className="msg-chips-wrap">
                {current.variables.map((name) => (
                  <button
                    type="button"
                    key={name}
                    className="msg-var-chip"
                    onClick={() => handleInsertVariable(name)}
                    title={viewMode === 'code' ? `Insert {${name}} at the cursor` : `Add {${name}} to the subject`}
                  >
                    <Tag size={12} aria-hidden="true" />
                    <span>{`{${name}}`}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="msg-view-tabs-row">
              <div className="msg-view-tabs">
                <button type="button" className={`msg-view-tab ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}>
                  <Eye size={14} aria-hidden="true" />
                  <span>Preview</span>
                </button>
                <button type="button" className={`msg-view-tab ${viewMode === 'code' ? 'active' : ''}`} onClick={() => setViewMode('code')}>
                  <Code size={14} aria-hidden="true" />
                  <span>HTML</span>
                </button>
              </div>
              <div className="msg-view-actions">
                <span className="msg-sample-note">Preview uses sample values; real emails use the user's own</span>
                {(current.customized || dirty) && (
                  <button type="button" className="msg-reset-btn" onClick={handleReset} disabled={saving} title="Go back to the built-in template">
                    <RotateCcw size={13} aria-hidden="true" /> Reset to default
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'preview' ? (
              <div className="msg-preview-frame-wrap">
                <div className="msg-mail-meta">
                  <span className="msg-mail-meta-label">Subject</span>
                  <span className="msg-mail-meta-value">{fillSample(current.subject, current.sample)}</span>
                </div>
                {/* Sandboxed: the template HTML can never run scripts in the portal. */}
                <iframe
                  className="msg-preview-iframe"
                  title={`${current.name} preview`}
                  sandbox="allow-same-origin"
                  srcDoc={previewDoc}
                  onLoad={(e) => {
                    const doc = e.currentTarget.contentDocument;
                    if (doc?.body) {e.currentTarget.style.height = `${doc.documentElement.scrollHeight}px`;}
                  }}
                />
              </div>
            ) : (
              <textarea
                ref={bodyRef}
                className="msg-code-editor"
                value={current.body}
                onChange={(e) => setDraft('body', e.target.value)}
                rows={16}
                spellCheck={false}
                aria-label="Email HTML"
              />
            )}
          </div>
        </div>
      </div>

      {testEmailOpen && (
        <div className="msg-modal-overlay" onClick={() => !testEmailSending && setTestEmailOpen(false)}>
          <div className="msg-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Send test email">
            <div className="msg-modal-header">
              <div className="msg-modal-icon-wrap"><Send size={18} /></div>
              <h3 className="msg-modal-title">Send test email</h3>
            </div>
            <p className="msg-modal-desc">
              Sends the <strong>saved</strong> version of <strong>{server.name}</strong> with sample values, through your configured mail server.
              {dirty && ' You have unsaved edits — save first to include them.'}
            </p>

            {testEmailMsg && (
              <div className={`msg-modal-alert ${testEmailMsg.type === 'error' ? 'is-error' : ''}`} role="status">
                {testEmailMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                <span>{testEmailMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSendTestEmail}>
              <div className="msg-modal-group">
                <label className="msg-field-label" htmlFor="msg-test-to">Recipient email address</label>
                <input
                  id="msg-test-to"
                  type="email"
                  className="msg-subject-input"
                  placeholder="you@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="msg-modal-footer">
                <button type="button" className="msg-modal-cancel-btn" onClick={() => setTestEmailOpen(false)} disabled={testEmailSending}>
                  Cancel
                </button>
                <button type="submit" className="msg-save-btn" disabled={testEmailSending || !testEmailAddress}>
                  {testEmailSending ? 'Sending…' : <><Check size={14} aria-hidden="true" /> Send test</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageTemplatesTab;
