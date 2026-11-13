import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  Menu,
  X,
  ArrowRight,
  Monitor,
  UserCheck,
  CalendarDays,
  Bell,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  Smartphone,
  Zap,
  Users,
  Activity,
} from 'lucide-react';
import { AppFooter } from '../components/AppFooter/AppFooter';
import './LandingPage.css';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
];

const HERO_TILES = [
  { icon: Users, cls: 'people', x: 120, y: 170, size: 88 },
  { icon: Bell, cls: 'yellow', x: 220, y: 70, size: 74 },
  { icon: MapPin, cls: 'sky', x: 260, y: 240, size: 74 },
  { icon: CheckCircle2, cls: 'main', x: 500, y: 170, size: 118 },
  { icon: Zap, cls: 'orange', x: 745, y: 80, size: 74 },
  { icon: UserCheck, cls: 'verify', x: 775, y: 235, size: 62 },
  { icon: Monitor, cls: 'white', x: 880, y: 170, size: 88 },
];

const FEATURES = [
  {
    icon: Monitor,
    tag: 'Real-time',
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
    tag: 'Every action',
    title: 'Tamper-proof audit trail',
    text: 'Every change and admin action is logged with a timestamp and IP address.',
    wide: true,
  },
  {
    icon: LayoutGrid,
    tag: '1 portal',
    title: 'One portal for everything',
    text: 'Scheduling, monitoring and audit together, instead of juggling separate tools.',
  },
  {
    icon: Smartphone,
    tag: 'Any device',
    title: 'Works on any device',
    text: 'Phone, tablet or desktop: supervisors get the same live view wherever they are.',
    full: true,
  },
];

const STEPS = [
  { n: '01', title: 'Set up the exam', text: 'Create the exam, add shifts and assign centers in a few guided steps.' },
  { n: '02', title: 'Go live', text: 'Centers check in, candidates are verified and shifts start on schedule.' },
  { n: '03', title: 'Monitor & review', text: 'Watch progress in real time, then review the full audit log afterward.' },
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
        <section className="lp-hero hz">
          <div className="lp-container hz-inner">
            <div className="hz-stage" aria-hidden="true">
              <svg className="hz-lines" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMid meet">
                <path d="M170 170 H830" />
                <path d="M300 85 L355 170" />
                <path d="M260 240 H335 L385 170" />
                <path d="M745 80 H668 L618 170" />
                <path d="M775 235 H700 L645 170" />
                <circle cx="300" cy="85" r="4.5" />
                <circle cx="335" cy="240" r="4.5" />
                <circle cx="668" cy="80" r="4.5" />
                <circle cx="700" cy="235" r="4.5" />
              </svg>
              {HERO_TILES.map(({ icon: Icon, cls, x, y, size }) => (
                <span
                  key={cls}
                  className={`hz-tile hz-tile--${cls}`}
                  style={{ left: `${x / 10}%`, top: `${(y / 340) * 100}%`, width: `${size / 10}%` }}
                >
                  <Icon strokeWidth={1.75} />
                </span>
              ))}
            </div>

            <span className="hz-badge"><span className="hz-badge-dot" />Built for high-concurrency exams</span>
            <h1 className="hz-title">
              All-in-one exam <span className="hz-grad">operations</span> platform
            </h1>
            <p className="hz-lead">
              Scheduling, center monitoring, identity checks and audit logging in one portal, so large exams
              stay on time and on the record.
            </p>
            <div className="hz-actions">
              <Link to={primaryTo} className="hz-cta">
                {isLoggedIn ? 'Open dashboard' : 'Sign in to console'}
                <ArrowRight size={18} />
              </Link>
              <a href="#features" className="hz-ghost">See what it does</a>
            </div>
            <ul className="hz-trust">
              <li><CheckCircle2 size={15} /> Real-time monitoring</li>
              <li><CheckCircle2 size={15} /> Biometric checks</li>
              <li><CheckCircle2 size={15} /> Full audit trail</li>
            </ul>
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
              {FEATURES.map(({ icon: Icon, title, text, tag, wide, full }, i) => (
                <article
                  key={title}
                  className={`lp-card lp-reveal${wide ? ' lp-card-wide' : ''}${full ? ' lp-card-full' : ''}`}
                  style={{ '--d': `${(i % 3) * 0.08}s` }}
                  onMouseMove={spotlight}
                >
                  <div className="lp-card-top">
                    <span className="lp-card-icon"><Icon size={22} /></span>
                    {tag && <span className="lp-card-tag">{tag}</span>}
                  </div>
                  <div className="lp-card-body">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
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
