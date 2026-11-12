import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  ArrowRight,
  Monitor,
  UserCheck,
  CalendarDays,
  Bell,
  MapPin,
  ShieldCheck,
  Menu,
  X,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { AppFooter } from '../components/AppFooter/AppFooter';
import './LandingPage.css';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#metrics', label: 'Why Exam View' },
];

const FEATURES = [
  {
    icon: Monitor,
    title: 'Real-time center monitoring',
    text: 'Live shift progress, check-ins and candidate load across every region, on one screen.',
    wide: true,
  },
  {
    icon: UserCheck,
    title: 'Biometric identity checks',
    text: 'Facial verification stops impersonation before a candidate reaches the seat.',
  },
  {
    icon: CalendarDays,
    title: 'Shift & center rostering',
    text: 'Schedule exams, shifts and supervisor passwords without spreadsheets.',
  },
  {
    icon: Bell,
    title: 'Instant broadcasts',
    text: 'Push urgent announcements to centers and invigilators the moment they matter.',
  },
  {
    icon: MapPin,
    title: 'Geofenced centers',
    text: 'Confirm that staff and hardware are inside certified center perimeters.',
  },
  {
    icon: ShieldCheck,
    title: 'Tamper-proof audit trail',
    text: 'Every change and admin action is logged with a timestamp and IP address.',
    wide: true,
  },
];

const STEPS = [
  { n: '01', title: 'Set up the exam', text: 'Create the exam, add shifts and assign centers in a few guided steps.' },
  { n: '02', title: 'Go live', text: 'Centers check in, candidates are verified and shifts start on schedule.' },
  { n: '03', title: 'Monitor & review', text: 'Watch progress in real time, then review the full audit log afterward.' },
];

const PREVIEW_ROWS = [
  { name: 'Morning Shift · Batch A', meta: '42 centers', pct: 92 },
  { name: 'Morning Shift · Batch B', meta: '38 centers', pct: 76 },
  { name: 'Afternoon Shift · Batch A', meta: '51 centers', pct: 48 },
];

export const LandingPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    setIsLoggedIn(
      Boolean(
        localStorage.getItem('accessToken') ||
          localStorage.getItem('sessionActive') === 'true' ||
          localStorage.getItem('user')
      )
    );
  }, []);

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isDarkMode]);

  // Scroll-reveal + card spotlight
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const spotlight = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const primaryTo = isLoggedIn ? '/dashboard' : '/login';
  const primaryLabel = isLoggedIn ? 'Open dashboard' : 'Sign in';

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-container lp-nav">
          <Link to="/" className="lp-logo" aria-label="Exam View home">
            <span className="lp-logo-mark">E</span>
            <span className="lp-logo-text">Exam View</span>
          </Link>

          <nav className="lp-nav-links" aria-label="Primary">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="lp-nav-link">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-icon-btn"
              onClick={() => setIsDarkMode((p) => !p)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to={primaryTo} className="lp-btn lp-btn-primary lp-nav-cta">
              {primaryLabel}
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              className="lp-icon-btn lp-menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lp-mobile-menu" aria-label="Mobile">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="lp-mobile-link" onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">
                <span className="lp-live-dot" /> Online examination operations
              </span>
              <h1 className="lp-h1">
                Run every exam with <span className="lp-accent">complete confidence.</span>
              </h1>
              <p className="lp-lead">
                Exam View brings scheduling, center monitoring, identity verification and audit
                logging into one portal, so large-scale exams stay on time and on the record.
              </p>
              <div className="lp-cta-row">
                <Link to={primaryTo} className="lp-btn lp-btn-primary lp-btn-lg">
                  {isLoggedIn ? 'Enter dashboard' : 'Sign in to console'}
                  <ArrowRight size={18} />
                </Link>
                <a href="#features" className="lp-btn lp-btn-ghost lp-btn-lg">
                  See what it does
                </a>
              </div>
              <ul className="lp-checks">
                <li><CheckCircle2 size={16} /> Live center status</li>
                <li><CheckCircle2 size={16} /> Biometric checks</li>
                <li><CheckCircle2 size={16} /> Full audit log</li>
              </ul>
            </div>

            {/* Illustrative product preview */}
            <div className="lp-preview" aria-hidden="true">
              <div className="lp-preview-bar">
                <span className="lp-dots"><i /><i /><i /></span>
                <span className="lp-preview-pill"><Activity size={12} /> Live</span>
              </div>
              <div className="lp-preview-body">
                <div className="lp-preview-stats">
                  <div><span>Active exams</span><strong>16</strong></div>
                  <div><span>Centers online</span><strong>185</strong></div>
                  <div><span>Verified</span><strong>99.4%</strong></div>
                </div>
                <div className="lp-preview-list">
                  {PREVIEW_ROWS.map((r) => (
                    <div key={r.name} className="lp-preview-row">
                      <div className="lp-preview-row-head">
                        <span>{r.name}</span>
                        <em>{r.meta}</em>
                      </div>
                      <div className="lp-bar"><i style={{ width: `${r.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="lp-preview-note">Sample data for illustration</p>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="lp-section lp-metrics" id="metrics">
          <div className="lp-container lp-metrics-grid">
            {[
              ['Real-time', 'Center and shift status as it happens'],
              ['1 portal', 'Scheduling, monitoring and audit together'],
              ['Every action', 'Logged with timestamp and IP'],
              ['Any device', 'Works on phone, tablet and desktop'],
            ].map(([big, small]) => (
              <div key={big} className="lp-metric lp-reveal">
                <strong>{big}</strong>
                <span>{small}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="lp-section" id="features">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-kicker">Capabilities</span>
              <h2 className="lp-h2">Everything exam day needs</h2>
              <p className="lp-sub">
                Built for high-concurrency exam workloads where accuracy and accountability matter.
              </p>
            </div>
            <div className="lp-bento">
              {FEATURES.map(({ icon: Icon, title, text, wide }, i) => (
                <article
                  key={title}
                  className={`lp-card lp-reveal${wide ? ' lp-card-wide' : ''}`}
                  style={{ '--d': `${(i % 3) * 0.08}s` }}
                  onMouseMove={spotlight}
                >
                  <span className="lp-card-icon"><Icon size={22} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="lp-section lp-alt" id="how">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-kicker">How it works</span>
              <h2 className="lp-h2">From setup to sign-off in three steps</h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.n} className="lp-step lp-reveal" style={{ '--d': `${i * 0.1}s` }}>
                  <span className="lp-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-cta-box lp-reveal">
              <h2>Ready to oversee your next exam?</h2>
              <p>Sign in to schedule shifts, manage centers and monitor exams in real time.</p>
              <Link to={primaryTo} className="lp-btn lp-btn-light lp-btn-lg">
                {isLoggedIn ? 'Open dashboard' : 'Access the portal'}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span className="lp-logo">
            <span className="lp-logo-mark lp-logo-sm">E</span>
            <span className="lp-logo-text">Exam View</span>
          </span>
          <span className="lp-copy">&copy; {new Date().getFullYear()} Exam View · <AppFooter variant="inline" /></span>
        </div>
      </footer>
    </div>
  );
};
