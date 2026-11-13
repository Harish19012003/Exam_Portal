import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Compass } from 'lucide-react';
import { AppFooter } from '../AppFooter/AppFooter';
import { NotFoundMascot } from './NotFoundMascot';
import { NotFoundClouds } from './NotFoundClouds';
import './NotFoundScreen.css';

/** Long ids make addresses unreadable: `/exams/1794216839152_d82eb052/center-list` → `/exams/179421…2eb052/center-list`. */
export const shortenPath = (path, maxSegment = 14, maxTotal = 56) => {
  const short = String(path || '')
    .split('/')
    .map((segment) => (segment.length > maxSegment ? `${segment.slice(0, 6)}…${segment.slice(-6)}` : segment))
    .join('/');
  return short.length > maxTotal ? `${short.slice(0, maxTotal - 1)}…` : short;
};

/** Full-screen "page not found": giant 404, a lost mascot whose eyes follow you, one clear way back. */
export const NotFoundScreen = () => {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const heroRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);

    // The mascot's eyes follow the pointer (skipped for people who prefer reduced motion).
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const onMove = (event) => {
      const hero = heroRef.current;
      if (!hero) {
        return;
      }
      const rect = hero.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height * 0.38);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 360);
      hero.classList.add('is-tracking');
      hero.style.setProperty('--lx', `${((dx / dist) * 6 * reach).toFixed(2)}px`);
      hero.style.setProperty('--ly', `${((dy / dist) * 5 * reach).toFixed(2)}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <main className="nf">
      <header className="nf-top">
        <a className="nf-brand" href="/">
          <span className="nf-brand-mark" aria-hidden="true">E</span>
          <span>Exam View</span>
        </a>
      </header>

      <NotFoundClouds />

      <section className="nf-stage">
        {/* The mascot and the giant 404 share one box, so the "0" is always centred behind it. */}
        <div className="nf-hero" ref={heroRef}>
          <div className="nf-digits" aria-hidden="true">
            <span>4</span>
            <i className="nf-zero" />
            <span>4</span>
          </div>
          <NotFoundMascot />
        </div>

        <h1 className="nf-title">
          Oops, I think we’re{' '}
          <span className="nf-lost">
            lost
            <svg className="nf-squiggle" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M2 7 Q9 1 16 7 T30 7 T44 7 T58 7 T72 7 T86 7 T98 7" fill="none" strokeWidth="3.6" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="nf-sub">Let’s get you back somewhere familiar…</p>
        {path && path !== '/' && (
          <p className="nf-path" title={path}>
            <Compass size={14} aria-hidden="true" />
            <span>Couldn’t find</span>
            <code>{shortenPath(path)}</code>
          </p>
        )}

        <div className="nf-actions">
          <a className="nf-btn" href="/dashboard">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to dashboard</span>
          </a>
          {canGoBack && (
            <button type="button" className="nf-back" onClick={() => window.history.back()}>
              Go back
            </button>
          )}
        </div>
      </section>

      <span className="nf-sr">Error 404: page not found</span>
      <AppFooter variant="floating" />
    </main>
  );
};
