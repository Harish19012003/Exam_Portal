import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Mail,
  Globe,
  Megaphone,
  Save,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Plug,
  Cloud,
  Bell,
  MessageCircle,
} from 'lucide-react';
import { DynamicDropdown } from '../../components/DynamicData';
import { usePlatformSettings, useSetPlatformSettingsCache } from '../../hooks/usePlatformSettings';
import { useAccess } from '../../hooks/useAccess';
import { EmailSettingsPanel } from './EmailSettingsPanel';
import { StorageSettingsPanel } from './StorageSettingsPanel';
import { PushSettingsPanel } from './PushSettingsPanel';
import { savePlatformSettings, TIMEZONE_OPTIONS } from '../../api/platformSettingsApi';
import './PlatformSettingsTab.css';

const TIMEZONE_LABELS = TIMEZONE_OPTIONS.map((o) => o.label);
const MESSAGE_MAX = 240;

const useIsDark = () => {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const sync = () => {
      const root = document.documentElement;
      setDark(root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark'));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
};

const GeneralSettings = ({ isDarkMode }) => {
  const { settings, isLoading, isError } = usePlatformSettings();
  const setCache = useSetPlatformSettingsCache();

  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }

  // Load the saved values into the form once they arrive (and again after a save).
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(settings), [form, settings]);

  const set = (patch) => {
    setNotice(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };
  const setMaintenance = (patch) => set({ maintenance: { ...form.maintenance, ...patch } });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const saved = await savePlatformSettings(form);
      setCache(saved);
      setNotice({ type: 'success', text: 'Platform settings saved' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save platform settings' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="platform-settings platform-settings--loading">Loading platform settings…</div>;
  }

  return (
    <form className="platform-settings" onSubmit={handleSave}>
      {isError && (
        <div className="ps-alert error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>Could not load the saved settings. Showing defaults.</span>
        </div>
      )}
      {notice && (
        <div className={`ps-alert ${notice.type}`} role="status">
          {notice.type === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="ps-grid">
        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Building2 size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Branding</h3>
              <p className="ps-card-desc">Shown in the sidebar and the browser tab.</p>
            </div>
          </header>
          <label className="ps-label" htmlFor="ps-portal-name">Portal name</label>
          <input
            id="ps-portal-name"
            className="ps-input"
            type="text"
            maxLength={60}
            value={form.portal_name}
            onChange={(e) => set({ portal_name: e.target.value })}
            placeholder="Exam View"
          />
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Mail size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Support contact</h3>
              <p className="ps-card-desc">Where people should write when they need help. Leave empty to hide it.</p>
            </div>
          </header>
          <label className="ps-label" htmlFor="ps-support-email">Support email</label>
          <input
            id="ps-support-email"
            className="ps-input"
            type="email"
            maxLength={120}
            value={form.support_email}
            onChange={(e) => set({ support_email: e.target.value })}
            placeholder="support@example.com"
          />
        </section>

        <section className="ps-card">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Globe size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Defaults</h3>
              <p className="ps-card-desc">Applied to new accounts. Existing users keep their own timezone.</p>
            </div>
          </header>
          <label className="ps-label">Default timezone for new users</label>
          <DynamicDropdown
            variant="form"
            required
            className="ps-dd"
            isDarkMode={isDarkMode}
            options={TIMEZONE_LABELS}
            value={TIMEZONE_OPTIONS.find((o) => o.value === form.default_timezone)?.label || form.default_timezone}
            onChange={(label) => {
              const next = TIMEZONE_OPTIONS.find((o) => o.label === label);
              if (next) set({ default_timezone: next.value });
            }}
            minMenuWidth={260}
          />
        </section>

        <section className="ps-card ps-card--wide">
          <header className="ps-card-head">
            <span className="ps-card-icon"><Megaphone size={18} aria-hidden="true" /></span>
            <div>
              <h3 className="ps-card-title">Maintenance banner</h3>
              <p className="ps-card-desc">A notice shown at the top of every page for all signed-in users.</p>
            </div>
            <label className="ps-switch" aria-label="Show maintenance banner">
              <input
                type="checkbox"
                checked={form.maintenance.enabled}
                onChange={(e) => setMaintenance({ enabled: e.target.checked })}
              />
              <span className="ps-switch-track" />
            </label>
          </header>
          <label className="ps-label" htmlFor="ps-banner-message">Message</label>
          <textarea
            id="ps-banner-message"
            className="ps-input ps-textarea"
            rows={3}
            maxLength={MESSAGE_MAX}
            value={form.maintenance.message}
            onChange={(e) => setMaintenance({ message: e.target.value })}
            placeholder="e.g. Scheduled maintenance tonight 11 PM – 12 AM IST. The portal may be unavailable."
          />
          <div className="ps-counter">{form.maintenance.message.length}/{MESSAGE_MAX}</div>
          {form.maintenance.enabled && form.maintenance.message.trim() && (
            <div className="ps-banner-preview" role="note">
              <Megaphone size={16} aria-hidden="true" />
              <span>{form.maintenance.message}</span>
            </div>
          )}
        </section>
      </div>

      <div className="ps-actions">
        <span className={`ps-hint ${dirty ? 'dirty' : ''}`} role="status">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </span>
        <div className="ps-buttons">
          {dirty && (
            <button type="button" className="ps-btn ps-btn--ghost" onClick={() => setForm(settings)} disabled={saving}>
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

const SECTIONS = [
  { id: 'general', title: 'General', desc: 'Name, support and defaults', icon: SlidersHorizontal },
  { id: 'email', title: 'Email', desc: 'Mail server and sign-in', icon: Plug, superAdminOnly: true },
  { id: 'storage', title: 'Storage', desc: 'Cloudinary for photos', icon: Cloud, superAdminOnly: true },
  { id: 'push', title: 'Push notifications', desc: 'Firebase connection', icon: Bell, superAdminOnly: true },
  { id: 'whatsapp', title: 'WhatsApp', desc: 'Messages and alerts', icon: MessageCircle, superAdminOnly: true, disabled: true },
];

/**
 * Platform Settings: section menu on the left, the selected section on the right (same split as the
 * profile page). Email is Super Admin only — it holds credentials.
 */
export const PlatformSettingsTab = () => {
  const isDarkMode = useIsDark();
  const { isSuperAdmin } = useAccess();
  const { settings } = usePlatformSettings();
  const [section, setSection] = useState('general');

  const sections = SECTIONS.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const active = sections.some((item) => item.id === section && !item.disabled) ? section : 'general';
  const bannerOn = settings.maintenance.enabled && Boolean(settings.maintenance.message);
  const tzLabel = TIMEZONE_OPTIONS.find((o) => o.value === settings.default_timezone)?.value || settings.default_timezone;

  return (
    <div className="ps-layout">
      <aside className="ps-aside">
        <div className="ps-identity">
          <div className="ps-identity-mark" aria-hidden="true">
            <Building2 size={28} />
          </div>
          <h2 className="ps-identity-name" title={settings.portal_name}>{settings.portal_name}</h2>
          <span className="ps-identity-sub">Platform settings</span>

          <ul className="ps-facts">
            <li className="ps-fact">
              <span className="ps-fact-icon"><Megaphone size={15} aria-hidden="true" /></span>
              <span className="ps-fact-body">
                <span className="ps-fact-label">Maintenance banner</span>
                <span className={`ps-fact-value ${bannerOn ? 'on' : ''}`}>{bannerOn ? 'Showing to everyone' : 'Off'}</span>
              </span>
            </li>
            <li className="ps-fact">
              <span className="ps-fact-icon"><Globe size={15} aria-hidden="true" /></span>
              <span className="ps-fact-body">
                <span className="ps-fact-label">Default timezone</span>
                <span className="ps-fact-value">{tzLabel}</span>
              </span>
            </li>
            <li className="ps-fact">
              <span className="ps-fact-icon"><Mail size={15} aria-hidden="true" /></span>
              <span className="ps-fact-body">
                <span className="ps-fact-label">Support email</span>
                <span className="ps-fact-value">{settings.support_email || 'Not set'}</span>
              </span>
            </li>
          </ul>
        </div>

        <nav className="ps-nav" role="tablist" aria-label="Platform settings sections">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active === item.id}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                title={item.disabled ? `${item.title} is coming soon` : undefined}
                className={`ps-nav-item ${active === item.id ? 'active' : ''}`}
                onClick={() => !item.disabled && setSection(item.id)}
              >
                <span className="ps-nav-icon"><Icon size={16} aria-hidden="true" /></span>
                <span className="ps-nav-text">
                  <span className="ps-nav-title">{item.title}</span>
                  <span className="ps-nav-desc">{item.desc}</span>
                </span>
                {item.disabled && <span className="ps-soon">Soon</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="ps-content">
        {active === 'email' && <EmailSettingsPanel isDarkMode={isDarkMode} />}
        {active === 'storage' && <StorageSettingsPanel />}
        {active === 'push' && <PushSettingsPanel />}
        {active === 'general' && <GeneralSettings isDarkMode={isDarkMode} />}
      </div>
    </div>
  );
};

export default PlatformSettingsTab;
