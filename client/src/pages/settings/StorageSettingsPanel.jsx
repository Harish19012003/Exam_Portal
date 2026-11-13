import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, KeyRound, PlugZap, ShieldCheck, AlertCircle } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { fetchStorageSettings, saveStorageSettings, testStorageSettings } from '../../api/integrationSettingsApi';
import { SettingsNotice, SettingsSaveBar } from './SettingsSaveBar';
import './PlatformSettingsTab.css';

const toForm = (saved) => ({
  cloud_name: saved?.cloud_name || '',
  api_key: saved?.api_key || '',
  api_secret: '',
});

/** Storage (Cloudinary) credentials. Used for profile photos today. */
export const StorageSettingsPanel = () => {
  const queryClient = useQueryClient();
  const { data: saved, isLoading, isError, error: loadError } = useQuery({
    queryKey: queryKeys.integrations.storage,
    queryFn: fetchStorageSettings,
  });

  const [form, setForm] = useState(() => toForm(null));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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
    return form.cloud_name !== base.cloud_name || form.api_key !== base.api_key || form.api_secret !== '';
  }, [form, saved]);

  const set = (patch) => {
    setNotice(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const payload = () => ({
    cloud_name: form.cloud_name,
    api_key: form.api_key,
    ...(form.api_secret ? { api_secret: form.api_secret } : {}),
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const next = await saveStorageSettings(payload());
      queryClient.setQueryData(queryKeys.integrations.storage, next);
      setNotice({ type: 'success', text: 'Storage settings saved' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save storage settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      await testStorageSettings(payload());
      setNotice({ type: 'success', text: 'Connected to Cloudinary. These credentials work.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not verify the credentials' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return <div className="platform-settings platform-settings--loading">Loading storage settings…</div>;
  }
  if (isError) {
    return (
      <div className="ps-alert error" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{loadError?.response?.data?.message || 'Could not load storage settings.'}</span>
      </div>
    );
  }

  return (
    <form className="platform-settings" onSubmit={handleSave}>
      <SettingsNotice notice={notice} />

      <div className="ps-source" role="note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>
          {saved?.source === 'database'
            ? 'Using the settings saved here. The API secret is stored encrypted and is never shown again.'
            : 'Using the values from the server environment. Save here to manage them from the portal instead.'}{' '}
          Cloudinary stores profile photos. The portal shows one small optimized copy and only loads the original when
          it is opened, which keeps bandwidth low.
        </span>
      </div>

      <div className="ps-grid">
        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Cloud size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Cloudinary account</h3>
              <p className="ps-card-desc">Find these on your Cloudinary dashboard → Settings → API Keys.</p>
            </div>
          </header>

          <label className="ps-label" htmlFor="st-cloud">Cloud name</label>
          <input
            id="st-cloud"
            className="ps-input"
            type="text"
            value={form.cloud_name}
            onChange={(e) => set({ cloud_name: e.target.value })}
            placeholder="my-cloud"
            autoComplete="off"
          />

          <label className="ps-label" htmlFor="st-key">API key</label>
          <input
            id="st-key"
            className="ps-input"
            type="text"
            inputMode="numeric"
            value={form.api_key}
            onChange={(e) => set({ api_key: e.target.value })}
            placeholder="123456789012345"
            autoComplete="off"
          />
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><KeyRound size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">API secret</h3>
              <p className="ps-card-desc">Kept secret on the server. Leave blank to keep the saved one.</p>
            </div>
          </header>

          <label className="ps-label" htmlFor="st-secret">API secret</label>
          <input
            id="st-secret"
            className="ps-input"
            type="password"
            value={form.api_secret}
            onChange={(e) => set({ api_secret: e.target.value })}
            placeholder={saved?.has_secret ? '•••••••• saved — type to replace' : 'Enter API secret'}
            autoComplete="new-password"
          />
          {saved?.has_secret && !form.api_secret && <span className="ps-chip">Secret saved</span>}

          <button
            type="button"
            className="ps-btn ps-btn--ghost ps-btn--inline"
            onClick={handleTest}
            disabled={testing || saving}
          >
            <PlugZap size={16} aria-hidden="true" />
            <span>{testing ? 'Checking…' : 'Test connection'}</span>
          </button>
          <p className="ps-note">Checks the credentials above with Cloudinary, even before you save.</p>
        </section>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onDiscard={() => saved && setForm(toForm(saved))} />
    </form>
  );
};

export default StorageSettingsPanel;
