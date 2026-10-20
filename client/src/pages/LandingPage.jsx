import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Sparkles,
  ArrowRight,
  Monitor,
  UserCheck,
  CalendarDays,
  Bell,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import './LandingPage.css';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const hasAuth = Boolean(
      localStorage.getItem('accessToken') ||
      localStorage.getItem('sessionActive') === 'true' ||
      localStorage.getItem('user')
    );
    setIsLoggedIn(hasAuth);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <div className="landing-page">
      {/* Dynamic Background Glows */}
      <div className="landing-bg-glow landing-glow-1"></div>
      <div className="landing-bg-glow landing-glow-2"></div>
      <div className="landing-bg-glow landing-glow-3"></div>

      {/* Header / Navbar */}
      <header className="landing-header">
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon">E</div>
            <span className="landing-logo-text">Exam View</span>
          </Link>

          <nav className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#metrics" className="landing-nav-link">Metrics</a>
            <a href="#solutions" className="landing-nav-link">Architecture</a>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="landing-theme-btn"
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isLoggedIn ? (
              <Link to="/dashboard" className="btn-primary">
                <span>Open Dashboard</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary">
                  Sign In
                </Link>
                <Link to="/login" className="btn-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-pill">
          <Sparkles size={14} className="hero-pill-icon" />
          <span>Next-Gen Online Examination Infrastructure</span>
        </div>

        <h1 className="hero-title">
          Secure, Scalable & Intelligent <br />
          <span className="hero-gradient-text">Exam Management Portal</span>
        </h1>

        <p className="hero-subtitle">
          Real-time candidate telemetry, facial biometrics verification, live center roster synchronization, and end-to-end audit security for large-scale examinations.
        </p>

        <div className="hero-cta-group">
          {isLoggedIn ? (
            <Link to="/dashboard" className="btn-primary btn-hero-primary">
              <span>Enter Dashboard Console</span>
              <ArrowRight size={18} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary btn-hero-primary">
              <span>Sign In to Console</span>
              <ArrowRight size={18} />
            </Link>
          )}

          <a href="#features" className="btn-secondary btn-hero-secondary">
            Explore System Architecture
          </a>
        </div>

        {/* Interactive Preview Mockup Card */}
        <div className="hero-preview-wrapper">
          <div className="hero-preview-card">
            <div className="preview-top-bar">
              <div className="preview-dots">
                <div className="preview-dot dot-red"></div>
                <div className="preview-dot dot-yellow"></div>
                <div className="preview-dot dot-green"></div>
              </div>
              <div className="preview-status-pill">
                <div className="status-indicator-dot"></div>
                Live Exam Feeds Active
              </div>
            </div>

            <div className="preview-stats-row">
              <div className="preview-stat-card">
                <div className="preview-stat-label">Active Examinations</div>
                <div className="preview-stat-val">16 Active</div>
              </div>
              <div className="preview-stat-card">
                <div className="preview-stat-label">Connected Centers</div>
                <div className="preview-stat-val">185 Centers</div>
              </div>
              <div className="preview-stat-card">
                <div className="preview-stat-label">Biometric Verification</div>
                <div className="preview-stat-val">99.4% Match</div>
              </div>
              <div className="preview-stat-card">
                <div className="preview-stat-label">Socket Telemetry</div>
                <div className="preview-stat-val">12 ms Latency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="landing-metrics" id="metrics">
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-number">500+</div>
            <div className="metric-label">Proctored Examination Centers</div>
          </div>
          <div className="metric-item">
            <div className="metric-number">99.98%</div>
            <div className="metric-label">High-Availability Uptime</div>
          </div>
          <div className="metric-item">
            <div className="metric-number">1.2M+</div>
            <div className="metric-label">Candidates Verified Securely</div>
          </div>
          <div className="metric-item">
            <div className="metric-number">&lt; 150ms</div>
            <div className="metric-label">Real-Time Sync via WebSockets</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features" id="features">
        <div className="section-header">
          <div className="section-tag">Enterprise Capabilities</div>
          <h2 className="section-title">Built for Mission-Critical Exam Operations</h2>
          <p className="section-desc">
            Engineered to handle high-concurrency examination workloads with uncompromising data integrity and zero single points of failure.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-box">
              <Monitor size={24} />
            </div>
            <h3 className="feature-title">Real-Time Center Monitoring</h3>
            <p className="feature-text">
              Live dashboard telemetry showing shift progression, center check-ins, active candidate loads, and status across all regions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <UserCheck size={24} />
            </div>
            <h3 className="feature-title">Biometrics & Facial Match</h3>
            <p className="feature-text">
              Integrated facial recognition and biometric identity verification stopping impersonation before candidate center entry.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <CalendarDays size={24} />
            </div>
            <h3 className="feature-title">Shift & Center Rostering</h3>
            <p className="feature-text">
              Automated allocation of exam schedules, supervisory passwords, delPwd protections, and dynamic multi-shift rollouts.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Bell size={24} />
            </div>
            <h3 className="feature-title">Instant Broadcasts & Alerts</h3>
            <p className="feature-text">
              High-priority push notifications and emergency announcements sent in milliseconds to centers and invigilators via WebSockets.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <MapPin size={24} />
            </div>
            <h3 className="feature-title">Geofenced Center Verification</h3>
            <p className="feature-text">
              Precision Google Maps location validation ensuring center personnel and hardware operate strictly within certified perimeters.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <ShieldCheck size={24} />
            </div>
            <h3 className="feature-title">Tamper-Proof Audit Logging</h3>
            <p className="feature-text">
              Every system mutation, state transition, and admin action is logged with IP timestamps and immutable cryptographic traces.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta" id="cta">
        <div className="cta-box">
          <h2 className="cta-title">Ready to oversee your examination lifecycle?</h2>
          <p className="cta-desc">
            Access real-time proctoring metrics, schedule shifts, and manage centers securely with Exam View Portal.
          </p>
          <Link to="/login" className="btn-primary btn-hero-primary">
            <span>Access Portal Console</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="landing-logo-icon" style={{ width: '28px', height: '28px', fontSize: '14px' }}>E</div>
            <span>Exam View Portal</span>
          </div>
          <div className="footer-copy">
            &copy; {new Date().getFullYear()} Exam View Infrastructure. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
