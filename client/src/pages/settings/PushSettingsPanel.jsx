import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, KeyRound, PlugZap, Trash2, Info, ShieldCheck, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { fetchPushSettings, savePushSettings, testPushSettings } from '../../api/integrationSettingsApi';
import { SettingsNotice, SettingsSaveBar } from './SettingsSaveBar';
import './PlatformSettingsTab.css';

const toForm = (saved) => ({
  project_id: saved?.project_id || '',
  api_key: saved?.api_key || '',
  messaging_sender_id: saved?.messaging_sender_id || '',
  app_id: saved?.app_id || '',
  vapid_key: saved?.vapid_key || '',
  service_account: '',
});

const PUBLIC_FIELDS = ['project_id', 'api_key', 'messaging_sender_id', 'app_id', 'vapid_key'];

/** Push notifications (Firebase Cloud Messaging) connection details. */
export const PushSettingsPanel = () => {
  const queryClient = useQueryClient();
  const { data: saved, isLoading, isError, error: loadError } = useQuery({
    queryKey: queryKeys.integrations.push,
    queryFn: fetchPushSettings,
  });

  const [form, setForm] = useState(() => toForm(null));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (saved) {
      setForm(toForm(saved));
    }
  }, [saved]);

  const dirty = useMemo(() => {
    if (!saved) {
      return false;
    }
    const base = toForm(saved);
    return PUBLIC_FIELDS.some((key) => form[key] !== base[key]) || form.service_account.trim() !== '';
  }, [form, saved]);

  const set = (patch) => {
    setNotice(null);
    if ('service_account' in patch) {
      setVerified(false);
    }
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const payload = () => ({
    ...Object.fromEntries(PUBLIC_FIELDS.map((key) => [key, form[key]])),
    ...(form.service_account.trim() ? { service_account: form.service_account } : {}),
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const next = await savePushSettings(payload());
      queryClient.setQueryData(queryKeys.integrations.push, next);
      setNotice({ type: 'success', text: 'Push notification settings saved' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save push notification settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const result = await testPushSettings(form.service_account.trim() ? { service_account: form.service_account } : {});
      setVerified(true);
      setNotice({ type: 'success', text: `Server key verified for project ${result?.project_id || ''}. No notification was sent.` });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not verify the server key' });
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!window.confirm('Remove the saved server key?')) {
      return;
    }
    setRemoving(true);
    setNotice(null);
    try {
      const next = await savePushSettings({ clear_service_account: true });
      setVerified(false);
      queryClient.setQueryData(queryKeys.integrations.push, next);
      setNotice({ type: 'success', text: 'Server key removed' });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not remove the server key' });
    } finally {
      setRemoving(false);
    }
  };

  if (isLoading) {
    return <div className="platform-settings platform-settings--loading">Loading push notification settings…</div>;
  }
  if (isError) {
    return (
      <div className="ps-alert error" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{loadError?.response?.data?.message || 'Could not load push notification settings.'}</span>
      </div>
    );
  }

  const webConfigDone = PUBLIC_FIELDS.every((key) => Boolean(saved?.[key]));
  const steps = [
    { label: 'Web app details', done: webConfigDone },
    { label: 'Server key saved', done: Boolean(saved?.has_service_account) },
    { label: 'Key verified', done: verified },
  ];

  const textField = (id, label, key, placeholder, wide = true) => (
    <div className={`ps-field ${wide ? 'ps-field--wide' : ''}`}>
      <label className="ps-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ps-input"
        type="text"
        value={form[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );

  return (
    <form className="platform-settings" onSubmit={handleSave}>
      <SettingsNotice notice={notice} />

      <div className="ps-source ps-source--info" role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          This saves and verifies your Firebase connection. <strong>Sending push notifications is not turned on yet</strong>
          {' '}— the portal will start using these details once that feature is released.
        </span>
      </div>

      <ol className="ps-steps" aria-label="Setup progress">
        {steps.map((step, index) => (
          <li key={step.label} className={`ps-step ${step.done ? 'done' : ''}`}>
            <span className="ps-step-mark" aria-hidden="true">{step.done ? <Check size={14} /> : index + 1}</span>
            <span className="ps-step-label">{step.label}</span>
            <span className="ps-sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
          </li>
        ))}
      </ol>

      <div className="ps-grid ps-grid--two">
        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Bell size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Web app</h3>
              <p className="ps-card-desc">
                Firebase console → Project settings → Your apps → Web app. These values are not secret.{' '}
                <a className="ps-ext-link" href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                  Open Firebase console <ExternalLink size={12} aria-hidden="true" />
                </a>
              </p>
            </div>
          </header>
          <div className="ps-fields">
            {textField('pu-project', 'Project ID', 'project_id', 'my-project-123', false)}
            {textField('pu-sender', 'Messaging sender ID', 'messaging_sender_id', '123456789012', false)}
            {textField('pu-apikey', 'Web API key', 'api_key', 'AIza…')}
            {textField('pu-app', 'App ID', 'app_id', '1:123456789012:web:abc123')}
            {textField('pu-vapid', 'Web push certificate (VAPID key)', 'vapid_key', 'Cloud Messaging → Web Push certificates')}
          </div>
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><KeyRound size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Server key</h3>
              <p className="ps-card-desc">
                Project settings → Service accounts → Generate new private key. Paste the whole JSON file. It is stored
                encrypted and never shown again.
              </p>
            </div>
          </header>

          {saved?.has_service_account && (
            <div className="ps-keyinfo">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>
                Key saved{saved.service_account_email ? <> for <strong>{saved.service_account_email}</strong></> : null}
              </span>
              <button
                type="button"
                className="ps-link-danger"
                onClick={handleRemoveKey}
                disabled={removing || saving}
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>{removing ? 'Removing…' : 'Remove'}</span>
              </button>
            </div>
          )}

          <label className="ps-label" htmlFor="pu-key">{saved?.has_service_account ? 'Replace server key' : 'Server key (JSON)'}</label>
          <textarea
            id="pu-key"
            className="ps-input ps-textarea ps-mono"
            rows={6}
            value={form.service_account}
            onChange={(e) => set({ service_account: e.target.value })}
            placeholder={'{\n  "type": "service_account",\n  "project_id": "…",\n  …\n}'}
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="button"
            className="ps-btn ps-btn--ghost ps-btn--inline"
            onClick={handleTest}
            disabled={testing || saving || (!saved?.has_service_account && !form.service_account.trim())}
          >
            <PlugZap size={16} aria-hidden="true" />
            <span>{testing ? 'Verifying…' : 'Verify server key'}</span>
          </button>
          <p className="ps-note">Confirms Google accepts the key. It does not send any notification.</p>
        </section>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onDiscard={() => saved && setForm(toForm(saved))} />
    </form>
  );
};

export default PushSettingsPanel;
