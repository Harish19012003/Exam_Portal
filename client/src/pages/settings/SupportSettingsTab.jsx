import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Eye,
  HelpCircle,
  Link2,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useSupportSettings, useApplySupportSettings } from '../../hooks/useSupportSettings';
import { saveSupportSettings, SUPPORT_DEFAULTS } from '../../api/supportSettingsApi';
import { HelpModal } from '../../components/HelpModal/HelpModal';
import { BoneSkeleton } from '../../components/ui/BoneSkeleton';
import { FormCardsSkeleton } from '../../components/ui/SettingsSkeletons';
import './PlatformSettingsTab.css';
import './SupportSettingsTab.css';

const INTRO_MAX = 300;
const LINKS_MAX = 8;
const FAQS_MAX = 20;

const toForm = (s) => ({
  ...SUPPORT_DEFAULTS,
  ...s,
  links: (s?.links || []).map((l) => ({ ...l })),
  faqs: (s?.faqs || []).map((f) => ({ ...f })),
});

const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Settings → Support: what the Help modal (sidebar "?") shows to everyone.
 * Email is the Platform support email (also used by the footer and email templates).
 */
export const SupportSettingsTab = () => {
  const { settings, isLoading, isError } = useSupportSettings();
  const applySaved = useApplySupportSettings();
  const [form, setForm] = useState(() => toForm(settings));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setForm(toForm(settings));
  }, [settings]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(toForm(settings)), [form, settings]);

  const set = (patch) => {
    setNotice(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };
  const setLink = (i, patch) => set({ links: form.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const setFaq = (i, patch) => set({ faqs: form.faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveSupportSettings(form);
      applySaved(saved);
      setNotice({ type: 'success', text: 'Support settings saved — the Help window shows them now' });
      window.setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save support settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BoneSkeleton name="settings-support" loading={isLoading} fallback={<FormCardsSkeleton cards={[4, 3]} />}>
      <form className="platform-settings sst" onSubmit={handleSave}>
        {isError && (
          <div className="ps-alert error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>Could not load the saved support settings.</span>
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
              <span className="ps-card-icon"><LifeBuoy size={18} aria-hidden="true" /></span>
              <div>
                <h3 className="ps-card-title">Contact</h3>
                <p className="ps-card-desc">How people reach your support team. Leave a field empty to hide it.</p>
              </div>
            </header>

            <label className="ps-label" htmlFor="sst-email"><Mail size={13} aria-hidden="true" /> Support email</label>
            <input
              id="sst-email"
              className="ps-input"
              type="email"
              maxLength={120}
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="support@example.com"
            />
            <p className="sst-hint">Also used in the footer and in system emails.</p>

            <div className="sst-two">
              <div>
                <label className="ps-label" htmlFor="sst-phone"><Phone size={13} aria-hidden="true" /> Phone</label>
                <input
                  id="sst-phone"
                  className="ps-input"
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="ps-label" htmlFor="sst-wa"><MessageCircle size={13} aria-hidden="true" /> WhatsApp</label>
                <input
                  id="sst-wa"
                  className="ps-input"
                  type="tel"
                  maxLength={20}
                  value={form.whatsapp}
                  onChange={(e) => set({ whatsapp: e.target.value })}
                  placeholder="+919876543210"
                />
              </div>
            </div>

            <label className="ps-label" htmlFor="sst-hours"><Clock size={13} aria-hidden="true" /> Support hours</label>
            <input
              id="sst-hours"
              className="ps-input"
              type="text"
              maxLength={120}
              value={form.hours}
              onChange={(e) => set({ hours: e.target.value })}
              placeholder="Mon–Sat, 9 AM – 7 PM IST"
            />
          </section>

          <section className="ps-card">
            <header className="ps-card-head">
              <span className="ps-card-icon"><HelpCircle size={18} aria-hidden="true" /></span>
              <div>
                <h3 className="ps-card-title">Welcome message</h3>
                <p className="ps-card-desc">Shown at the top of the Help window.</p>
              </div>
            </header>
            <textarea
              id="sst-intro"
              className="ps-input ps-textarea"
              rows={4}
              maxLength={INTRO_MAX}
              value={form.intro}
              onChange={(e) => set({ intro: e.target.value })}
              placeholder="Stuck on something? Our team replies within one working day."
              aria-label="Welcome message"
            />
            <div className="ps-counter">{form.intro.length}/{INTRO_MAX}</div>
          </section>

          <section className="ps-card ps-card--wide">
            <header className="ps-card-head">
              <span className="ps-card-icon"><Link2 size={18} aria-hidden="true" /></span>
              <div>
                <h3 className="ps-card-title">Quick links</h3>
                <p className="ps-card-desc">Guides, videos or forms. Open in a new tab. Up to {LINKS_MAX}.</p>
              </div>
            </header>
            {form.links.length === 0 && <p className="sst-empty">No links yet.</p>}
            {form.links.map((l, i) => (
              <div key={i} className="sst-link-row">
                <input
                  className="ps-input"
                  type="text"
                  maxLength={60}
                  value={l.label}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder="User guide"
                  aria-label={`Link ${i + 1} label`}
                />
                <input
                  className="ps-input"
                  type="url"
                  maxLength={500}
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  placeholder="https://…"
                  aria-label={`Link ${i + 1} URL`}
                />
                <button
                  type="button"
                  className="sst-icon-btn danger"
                  onClick={() => set({ links: form.links.filter((_, idx) => idx !== i) })}
                  aria-label={`Remove link ${i + 1}`}
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {form.links.length < LINKS_MAX && (
              <button
                type="button"
                className="sst-add"
                onClick={() => set({ links: [...form.links, { label: '', url: '' }] })}
              >
                <Plus size={15} aria-hidden="true" /> Add link
              </button>
            )}
          </section>

          <section className="ps-card ps-card--wide">
            <header className="ps-card-head">
              <span className="ps-card-icon"><HelpCircle size={18} aria-hidden="true" /></span>
              <div>
                <h3 className="ps-card-title">FAQs</h3>
                <p className="ps-card-desc">Common questions and answers. Searchable in the Help window from 5 questions. Up to {FAQS_MAX}.</p>
              </div>
            </header>
            {form.faqs.length === 0 && <p className="sst-empty">No questions yet.</p>}
            {form.faqs.map((f, i) => (
              <div key={i} className="sst-faq">
                <div className="sst-faq-head">
                  <span className="sst-faq-num">{i + 1}</span>
                  <input
                    className="ps-input"
                    type="text"
                    maxLength={200}
                    value={f.q}
                    onChange={(e) => setFaq(i, { q: e.target.value })}
                    placeholder="How do I reset my password?"
                    aria-label={`Question ${i + 1}`}
                  />
                  <div className="sst-faq-actions">
                    <button
                      type="button"
                      className="sst-icon-btn"
                      onClick={() => set({ faqs: move(form.faqs, i, i - 1) })}
                      disabled={i === 0}
                      aria-label={`Move question ${i + 1} up`}
                      title="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="sst-icon-btn"
                      onClick={() => set({ faqs: move(form.faqs, i, i + 1) })}
                      disabled={i === form.faqs.length - 1}
                      aria-label={`Move question ${i + 1} down`}
                      title="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="sst-icon-btn danger"
                      onClick={() => set({ faqs: form.faqs.filter((_, idx) => idx !== i) })}
                      aria-label={`Remove question ${i + 1}`}
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <textarea
                  className="ps-input ps-textarea"
                  rows={3}
                  maxLength={1000}
                  value={f.a}
                  onChange={(e) => setFaq(i, { a: e.target.value })}
                  placeholder="Answer…"
                  aria-label={`Answer ${i + 1}`}
                />
              </div>
            ))}
            {form.faqs.length < FAQS_MAX && (
              <button
                type="button"
                className="sst-add"
                onClick={() => set({ faqs: [...form.faqs, { q: '', a: '' }] })}
              >
                <Plus size={15} aria-hidden="true" /> Add question
              </button>
            )}
          </section>
        </div>

        <div className="ps-actions">
          <span className={`ps-hint ${dirty ? 'dirty' : ''}`} role="status">
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </span>
          <div className="ps-buttons">
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => setPreviewOpen(true)}
              title={dirty ? 'Preview shows the saved version — save first to see your changes' : 'Open the Help window'}
            >
              <Eye size={16} aria-hidden="true" />
              <span>Preview</span>
            </button>
            {dirty && (
              <button type="button" className="ps-btn ps-btn--ghost" onClick={() => setForm(toForm(settings))} disabled={saving}>
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
      <HelpModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </BoneSkeleton>
  );
};
