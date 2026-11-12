import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Server, KeyRound, Send, Save, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { DynamicDropdown } from '../../components/DynamicData';
import { queryKeys } from '../../api/queryKeys';
import {
  EMAIL_PROVIDER_OPTIONS,
  fetchEmailSettings,
  saveEmailSettings,
  sendTestEmail,
} from '../../api/emailSettingsApi';
import './PlatformSettingsTab.css';

const PROVIDER_LABELS = EMAIL_PROVIDER_OPTIONS.map((o) => o.label);

const toForm = (saved) => ({
  provider: saved?.provider || 'smtp',
  host: saved?.host || '',
  port: String(saved?.port || 587),
  secure: Boolean(saved?.secure),
  user: saved?.user || '',
  from: saved?.from || '',
  password: '',
});

export const EmailSettingsPanel = ({ isDarkMode }) => {
  const queryClient = useQueryClient();
  const { data: saved, isLoading, isError, error: loadError } = useQuery({
    queryKey: queryKeys.integrations.email,
    queryFn: fetchEmailSettings,
  });

  const [form, setForm] = useState(() => toForm(null));
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState(null); // { type, text }

  useEffect(() => {
    if (saved) setForm(toForm(saved));
  }, [saved]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    const base = toForm(saved);
    return JSON.stringify({ ...form, password: '' }) !== JSON.stringify(base) || form.password !== '';
  }, [form, saved]);

  const set = (patch) => {
    setNotice(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const payload = () => ({
    provider: form.provider,
    host: form.host,
    port: Number(form.port),
    secure: form.secure,
    user: form.user,
    from: form.from,
    ...(form.password ? { password: form.password } : {}),
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const next = await saveEmailSettings(payload());
      queryClient.setQueryData(queryKeys.integrations.email, next);
      setNotice({ type: 'success', text: 'Email settings saved' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save email settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const result = await sendTestEmail({ ...payload(), ...(testTo.trim() ? { to: testTo.trim() } : {}) });
      setNotice({ type: 'success', text: `Test email sent to ${result?.to || 'you'}. Check the inbox (and spam).` });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'The test email could not be sent' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <div className="platform-settings platform-settings--loading">Loading email settings…</div>;
  if (isError) {
    return (
      <div className="ps-alert error" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{loadError?.response?.data?.message || 'Could not load email settings.'}</span>
      </div>
    );
  }

  const providerLabel = EMAIL_PROVIDER_OPTIONS.find((o) => o.value === form.provider)?.label || form.provider;
  const isGmail = form.provider === 'google';

  return (
    <form className="platform-settings" onSubmit={handleSave}>
      {notice && (
        <div className={`ps-alert ${notice.type}`} role="status">
          {notice.type === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="ps-source" role="note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>
          {saved?.source === 'database'
            ? 'Using the settings saved here. The password is stored encrypted and is never shown again.'
            : 'Using the values from the server environment. Save here to manage them from the portal instead.'}
        </span>
      </div>

      <div className="ps-grid">
        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Server size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Mail server</h3>
              <p className="ps-card-desc">Used for login codes and password-reset emails.</p>
            </div>
          </header>

          <label className="ps-label">Provider</label>
          <DynamicDropdown
            variant="form"
            required
            className="ps-dd"
            isDarkMode={isDarkMode}
            options={PROVIDER_LABELS}
            value={providerLabel}
            onChange={(label) => {
              const next = EMAIL_PROVIDER_OPTIONS.find((o) => o.label === label);
              if (next) set({ provider: next.value });
            }}
            minMenuWidth={240}
          />

          {!isGmail && (
            <>
              <label className="ps-label" htmlFor="em-host">Host</label>
              <input
                id="em-host"
                className="ps-input"
                type="text"
                value={form.host}
                onChange={(e) => set({ host: e.target.value })}
                placeholder={form.provider === 'outlook' ? 'smtp.office365.com' : 'smtp.example.com'}
                autoComplete="off"
              />
              <div className="ps-row">
                <div className="ps-col">
                  <label className="ps-label" htmlFor="em-port">Port</label>
                  <input
                    id="em-port"
                    className="ps-input"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => set({ port: e.target.value })}
                  />
                </div>
                <label className="ps-check">
                  <input type="checkbox" checked={form.secure} onChange={(e) => set({ secure: e.target.checked })} />
                  <span>Use SSL/TLS (port 465)</span>
                </label>
              </div>
            </>
          )}
          {isGmail && (
            <p className="ps-note">
              Gmail needs an <strong>App Password</strong> (Google Account → Security → 2-Step Verification → App
              passwords), not your normal password.
            </p>
          )}
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><KeyRound size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Sign-in</h3>
              <p className="ps-card-desc">The account the portal sends email from.</p>
            </div>
          </header>

          <label className="ps-label" htmlFor="em-user">Username</label>
          <input
            id="em-user"
            className="ps-input"
            type="text"
            value={form.user}
            onChange={(e) => set({ user: e.target.value })}
            placeholder="you@example.com"
            autoComplete="off"
          />

          <label className="ps-label" htmlFor="em-pass">Password</label>
          <input
            id="em-pass"
            className="ps-input"
            type="password"
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
            placeholder={saved?.has_password ? '•••••••• saved — type to replace' : 'Enter password'}
            autoComplete="new-password"
          />
          {saved?.has_password && !form.password && <span className="ps-chip">Password saved</span>}

          <label className="ps-label" htmlFor="em-from">From address</label>
          <input
            id="em-from"
            className="ps-input"
            type="text"
            value={form.from}
            onChange={(e) => set({ from: e.target.value })}
            placeholder={'"Exam View" <noreply@example.com>'}
          />
        </section>

        <section className="ps-card ps-card--wide">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Mail size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Send a test email</h3>
              <p className="ps-card-desc">
                Uses the values above, even before you save, so you can confirm they work. Leave the address empty to
                send it to yourself.
              </p>
            </div>
          </header>
          <div className="ps-row ps-row--end">
            <div className="ps-col">
              <label className="ps-label" htmlFor="em-test-to">Send to</label>
              <input
                id="em-test-to"
                className="ps-input"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="Your own email"
              />
            </div>
            <button type="button" className="ps-btn ps-btn--ghost" onClick={handleTest} disabled={testing || saving}>
              <Send size={16} aria-hidden="true" />
              <span>{testing ? 'Sending…' : 'Send test email'}</span>
            </button>
          </div>
        </section>
      </div>

      <div className="ps-actions">
        <span className={`ps-hint ${dirty ? 'dirty' : ''}`} role="status">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </span>
        <div className="ps-buttons">
          {dirty && (
            <button type="button" className="ps-btn ps-btn--ghost" onClick={() => saved && setForm(toForm(saved))} disabled={saving}>
              Discard
            </button>
          )}
          <button type="submit" className="ps-btn ps-btn--primary" disabled={saving || !dirty}>
            <Save size={16} aria-hidden="true" />
            <span>{saving ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default EmailSettingsPanel;
