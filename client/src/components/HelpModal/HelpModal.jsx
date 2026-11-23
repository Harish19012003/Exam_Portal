import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Clock,
  Bug,
  Lightbulb,
  Copy,
  ExternalLink,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { useSupportSettings, hasSupportContent } from '../../hooks/useSupportSettings';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import './HelpModal.css';

const FAQ_SEARCH_AT = 5;

const CopyButton = ({ text, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="hm-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked — value is still visible */
        }
      }}
      aria-label={done ? 'Copied' : `Copy ${label}`}
      title={done ? 'Copied' : `Copy ${label}`}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

/**
 * Help & Support modal (sidebar "?" icon). Content comes from Settings → Support;
 * the email is the Platform support email. Admins get a shortcut to edit it.
 */
export const HelpModal = ({ open, onClose, user, canConfigure = false, onReport = null }) => {
  const titleId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const closeRef = useRef(null);
  const { settings: platform } = usePlatformSettings();
  const { settings, isLoading, isError } = useSupportSettings({ enabled: open });
  const [faqQuery, setFaqQuery] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    setFaqQuery('');
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => closeRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const page = `${location.pathname}${location.search}`;
  const who = user?.email || [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  const context = useMemo(
    () => [`Page: ${window.location.origin}${page}`, who ? `Account: ${who}` : null, `Time: ${new Date().toLocaleString()}`]
      .filter(Boolean)
      .join('\n'),
    // Recompute when reopened on another page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, who, open],
  );

  const faqs = settings.faqs || [];
  const visibleFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    return q ? faqs.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q)) : faqs;
  }, [faqs, faqQuery]);

  if (!open) return null;

  const portal = platform.portal_name || 'the portal';
  const subject = encodeURIComponent(`Help: ${page}`);
  const body = encodeURIComponent(`Hi,\n\n<describe the problem>\n\n---\n${context}`);
  const waDigits = String(settings.whatsapp || '').replace(/[^\d]/g, '');
  const waText = encodeURIComponent(`Hi, I need help with ${portal}.\n${context}`);
  const contacts = [
    settings.email && {
      id: 'email',
      icon: Mail,
      label: 'Email',
      value: settings.email,
      href: `mailto:${settings.email}?subject=${subject}&body=${body}`,
      action: 'Write an email',
    },
    settings.phone && {
      id: 'phone',
      icon: Phone,
      label: 'Phone',
      value: settings.phone,
      href: `tel:${settings.phone.replace(/[^\d+]/g, '')}`,
      action: 'Call',
    },
    waDigits && {
      id: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      value: settings.whatsapp,
      href: `https://wa.me/${waDigits}?text=${waText}`,
      action: 'Chat',
      external: true,
    },
  ].filter(Boolean);

  const empty = !isLoading && !hasSupportContent(settings);
  const goConfigure = () => {
    onClose();
    navigate('/settings?tab=support');
  };

  const reportSection = onReport ? (
    <section className="hm-section">
        <h3 className="hm-section-title">Something wrong, or an idea?</h3>
        <div className="hm-report">
          <button type="button" className="hm-report-btn hm-report-btn--bug" onClick={() => onReport('bug')}>
            <Bug size={18} aria-hidden="true" />
            <span><strong>Report a bug</strong><small>Something is broken</small></span>
          </button>
          <button type="button" className="hm-report-btn" onClick={() => onReport('feature')}>
            <Lightbulb size={18} aria-hidden="true" />
            <span><strong>Request a feature</strong><small>Idea or improvement</small></span>
          </button>
        </div>
      </section>
  ) : null;

  return createPortal(
    <div className="hm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="hm-head">
          <span className="hm-head-icon" aria-hidden="true"><LifeBuoy size={20} /></span>
          <div className="hm-head-text">
            <h2 id={titleId} className="hm-title">Help &amp; Support</h2>
            <p className="hm-sub">{portal}</p>
          </div>
          <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="hm-body">
          {isLoading ? (
            <div className="hm-loading" role="status">
              <span className="hm-skel" />
              <span className="hm-skel hm-skel--short" />
              <div className="hm-contacts">
                <span className="hm-skel hm-skel--card" />
                <span className="hm-skel hm-skel--card" />
              </div>
            </div>
          ) : empty ? (
            <>
            <div className="hm-empty">
              <LifeBuoy size={28} aria-hidden="true" />
              <p className="hm-empty-title">Support details aren’t set up yet</p>
              <p className="hm-empty-text">
                {canConfigure
                  ? 'Add a support email, phone, WhatsApp, help links and FAQs in Settings → Support.'
                  : 'Please contact your administrator.'}
              </p>
              {canConfigure && (
                <button type="button" className="hm-btn hm-btn--primary" onClick={goConfigure}>
                  <Settings2 size={15} aria-hidden="true" />
                  Set up Support
                </button>
              )}
            </div>
            {reportSection}
            </>
          ) : (
            <>
              {isError && <p className="hm-note hm-note--error">Could not load the latest support details.</p>}
              <p className="hm-intro">
                {settings.intro || `Stuck on something in ${portal}? Reach the support team using any option below.`}
              </p>

              {contacts.length > 0 && (
                <div className="hm-contacts">
                  {contacts.map((c) => {
                    const Icon = c.icon;
                    return (
                      <div key={c.id} className={`hm-contact hm-contact--${c.id}`}>
                        <span className="hm-contact-icon" aria-hidden="true"><Icon size={18} /></span>
                        <span className="hm-contact-text">
                          <span className="hm-contact-label">{c.label}</span>
                          <span className="hm-contact-value" title={c.value}>{c.value}</span>
                        </span>
                        <CopyButton text={c.value} label={c.label.toLowerCase()} />
                        <a
                          className="hm-contact-action"
                          href={c.href}
                          {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          {c.action}
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}

              {settings.hours && (
                <p className="hm-hours">
                  <Clock size={15} aria-hidden="true" />
                  <span><strong>Support hours:</strong> {settings.hours}</span>
                </p>
              )}

              {settings.links?.length > 0 && (
                <section className="hm-section">
                  <h3 className="hm-section-title">Quick links</h3>
                  <ul className="hm-links">
                    {settings.links.map((l) => (
                      <li key={`${l.label}-${l.url}`}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="hm-link">
                          <span>{l.label}</span>
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {faqs.length > 0 && (
                <section className="hm-section">
                  <h3 className="hm-section-title">Frequently asked questions</h3>
                  {faqs.length >= FAQ_SEARCH_AT && (
                    <label className="hm-faq-search">
                      <Search size={14} aria-hidden="true" />
                      <input
                        type="search"
                        value={faqQuery}
                        onChange={(e) => setFaqQuery(e.target.value)}
                        placeholder="Search questions…"
                        aria-label="Search questions"
                      />
                    </label>
                  )}
                  {visibleFaqs.length === 0 ? (
                    <p className="hm-note">No questions match “{faqQuery.trim()}”.</p>
                  ) : (
                    <div className="hm-faqs">
                      {visibleFaqs.map((f) => (
                        <details key={f.q} className="hm-faq">
                          <summary>
                            <span>{f.q}</span>
                            <ChevronDown size={16} aria-hidden="true" className="hm-faq-chevron" />
                          </summary>
                          <p>{f.a}</p>
                        </details>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {reportSection}

              <section className="hm-context">
                <div className="hm-context-head">
                  <span>Include this when you contact support</span>
                  <CopyButton text={context} label="details" />
                </div>
                <pre>{context}</pre>
              </section>
            </>
          )}
        </div>

        {canConfigure && !empty && !isLoading && (
          <footer className="hm-foot">
            <button type="button" className="hm-btn hm-btn--ghost" onClick={goConfigure}>
              <Settings2 size={15} aria-hidden="true" />
              Edit support info
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
