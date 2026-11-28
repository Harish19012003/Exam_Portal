import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  Monitor,
  Moon,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { fetchPublicBranding, PLATFORM_DEFAULTS } from '../api/platformSettingsApi';
import { OtpInput } from '../components/ui/OtpInput';
import './LoginPage.css';

const RECENT_KEY = 'recentLogins';
const OTP_LOCK_KEY = 'otpResendLocks';
const OTP_RESEND_LOCK_SEC = 30;

const readOtpLockUntil = (addr) => {
  const key = String(addr || '').trim().toLowerCase();
  if (!key) return 0;
  try {
    const map = JSON.parse(sessionStorage.getItem(OTP_LOCK_KEY) || '{}');
    const until = Number(map?.[key] || 0);
    return until > Date.now() ? until : 0;
  } catch {
    return 0;
  }
};

const writeOtpLockUntil = (addr, seconds = OTP_RESEND_LOCK_SEC) => {
  const key = String(addr || '').trim().toLowerCase();
  if (!key) return 0;
  const until = Date.now() + seconds * 1000;
  try {
    const map = JSON.parse(sessionStorage.getItem(OTP_LOCK_KEY) || '{}');
    const now = Date.now();
    const cleaned = Object.fromEntries(
      Object.entries(map || {}).filter(([, ts]) => Number(ts) > now)
    );
    cleaned[key] = until;
    sessionStorage.setItem(OTP_LOCK_KEY, JSON.stringify(cleaned));
  } catch {
    /* cache only */
  }
  return until;
};

const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.slice(0, 4) : [];
  } catch {
    return [];
  }
};

const writeRecent = (list) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* cache only */
  }
};

const activeLabel = (at) => {
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return 'Active today';
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
};

const HIGHLIGHTS = [
  {
    icon: Monitor,
    title: 'Real-time center monitoring',
    text: 'Live shifts, check-ins and device sync status in one view.',
  },
  {
    icon: UserCheck,
    title: 'Biometric & shift control',
    text: 'Coordinate exam rosters, presets and calling lists without spreadsheets.',
  },
  {
    icon: ShieldCheck,
    title: 'Role & audit protection',
    text: 'Group-based access rules with every change recorded.',
  },
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const passwordInputRef = useRef(null);

  const { data: branding } = useQuery({
    queryKey: queryKeys.platformBranding,
    queryFn: fetchPublicBranding,
  });
  const portalName = branding?.portal_name || PLATFORM_DEFAULTS.portal_name;
  const logoUrl = branding?.logo_url || '';

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Mode: 'password' | 'otp'
  const [mode, setMode] = useState('password');

  // Shared form state
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const successMessage = location.state?.message || '';

  // Password mode state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP mode state
  const [otpStep, setOtpStep] = useState('input_email'); // 'input_email' | 'input_code'
  const [otpCode, setOtpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 2FA Authenticator Challenge State
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [recent, setRecent] = useState(readRecent);

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isDarkMode]);

  // Keep 30s resend lock synced with the currently entered email
  useEffect(() => {
    const updateCountdown = () => {
      const until = readOtpLockUntil(email);
      const remaining = until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
      setCountdown(remaining);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 500);
    return () => clearInterval(timer);
  }, [email]);

  const handleLoginSuccess = (token, user, refreshToken) => {
    if (token) {
      localStorage.setItem('accessToken', token);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.setItem('sessionActive', 'true');
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      const addr = user.email || email;
      if (addr) {
        const entry = {
          email: addr,
          name: user.name || user.fullName || addr.split('@')[0],
          at: Date.now(),
        };
        writeRecent([entry, ...readRecent().filter((r) => r.email !== addr)].slice(0, 4));
      }
    }
    navigate('/dashboard');
  };

  // Password login submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const data = response.data?.data || {};

      if (data.requires2FA) {
        setTwoFactorToken(data.tempToken);
        setTwoFactorEmail(data.email || email);
        setIsTwoFactorStep(true);
        setTwoFactorCode('');
        setError('');
        return;
      }

      handleLoginSuccess(data.accessToken, data.user, data.refreshToken);
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }

    const lockedUntil = readOtpLockUntil(cleanEmail);
    if (lockedUntil > Date.now()) {
      const waitSec = Math.ceil((lockedUntil - Date.now()) / 1000);
      setCountdown(waitSec);
      setError(`Code already sent. Please wait ${waitSec}s before resending.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/otp/send', { email: cleanEmail });
      const data = response.data?.data || {};
      const lockSec = Number(data.retryAfter) || OTP_RESEND_LOCK_SEC;
      writeOtpLockUntil(cleanEmail, lockSec);
      setChallengeToken(data.challengeToken || '');
      setSentEmail(cleanEmail);
      setOtpStep('input_code');
      setCountdown(lockSec);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send login code. Please try again.';
      if (err.response?.status === 429) {
        const match = String(msg).match(/(\d+)\s*s/i);
        const lockSec = match ? Number(match[1]) : OTP_RESEND_LOCK_SEC;
        writeOtpLockUntil(cleanEmail, lockSec);
        setCountdown(lockSec);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/otp/verify', {
        email,
        code: otpCode,
        challengeToken,
      });
      const data = response.data?.data || {};

      if (data.requires2FA) {
        setTwoFactorToken(data.tempToken);
        setTwoFactorEmail(data.email || email);
        setIsTwoFactorStep(true);
        setTwoFactorCode('');
        setError('');
        return;
      }

      handleLoginSuccess(data.accessToken, data.user, data.refreshToken);
    } catch (err) {
      const msg = err.response?.data?.message || 'Incorrect verification code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Verify 2FA challenge
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    const cleanCode = twoFactorCode.trim();
    if (useBackupCode ? !cleanCode : cleanCode.length !== 6) {
      setError(
        useBackupCode
          ? 'Please enter your recovery backup code'
          : 'Please enter the 6-digit authenticator code'
      );
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/2fa/verify', {
        tempToken: twoFactorToken,
        code: cleanCode,
      });
      const { accessToken, refreshToken, user } = response.data?.data || {};
      handleLoginSuccess(accessToken, user, refreshToken);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Invalid verification code. Please check your authenticator app and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2FA = () => {
    setIsTwoFactorStep(false);
    setTwoFactorToken('');
    setTwoFactorCode('');
    setError('');
    setUseBackupCode(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    if (newMode === 'password') {
      setOtpStep('input_email');
      setOtpCode('');
    }
  };

  const pickRecent = (account) => {
    setEmail(account.email);
    setPassword('');
    setIsTwoFactorStep(false);
    switchMode('password');
    setTimeout(() => passwordInputRef.current?.focus(), 0);
  };

  const removeRecent = (addr) => {
    const next = recent.filter((r) => r.email !== addr);
    setRecent(next);
    writeRecent(next);
  };

  const portalInitial = portalName.charAt(0).toUpperCase() || 'E';

  return (
    <div className="lg-page">
      <div className="lg-bg" aria-hidden="true">
        <div className="lg-glow lg-glow--a" />
        <div className="lg-glow lg-glow--b" />
        <div className="lg-grid" />
      </div>

      {/* Floating pill header matching Landing Page */}
      <header className="lg-header">
        <Link to="/" className="lg-back-pill" aria-label="Back to home" title="Back to home">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>

        <div className="lg-nav">
          <div className="lg-nav-left">
            <Link to="/" className="lg-back-inline" aria-label="Back to home" title="Back to home">
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <Link to="/" className="lg-brand" aria-label={`${portalName} home`}>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="lg-brand-img" />
              ) : (
                <span className="lg-brand-mark">{portalInitial}</span>
              )}
              <span className="lg-brand-name">{portalName}</span>
            </Link>
          </div>

          <div className="lg-nav-actions">
            <button
              type="button"
              className="lg-icon-btn"
              onClick={() => setIsDarkMode((p) => !p)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="lg-main">
        <div className="lg-shell">
          {/* Left column: context + quick sign-in */}
          <section className="lg-context" aria-label="Portal overview">
            <span className="lg-badge">
              <span className="lg-badge-dot" aria-hidden="true" />
              Operations console
            </span>

            <h1 className="lg-hero-title">
              Sign in to <span className="lg-grad">{portalName}</span>
            </h1>
            <p className="lg-hero-lead">
              Manage exams, center operations, devices and live shifts in one place. Sign in to pick
              up right where you left off.
            </p>

            {recent.length > 0 ? (
              <div className="lg-recent">
                <div className="lg-recent-head">
                  <span className="lg-section-label">Quick sign-in</span>
                  <span className="lg-recent-hint">Select an account to prefill</span>
                </div>
                <div className="lg-recent-list">
                  {recent.map((r) => {
                    const selected = email.trim().toLowerCase() === r.email.toLowerCase();
                    return (
                      <div
                        key={r.email}
                        className={`lg-recent-card${selected ? ' is-selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => pickRecent(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            pickRecent(r);
                          }
                        }}
                      >
                        <span className="lg-recent-avatar" aria-hidden="true">
                          {(r.name || r.email).charAt(0).toUpperCase()}
                        </span>
                        <span className="lg-recent-meta">
                          <span className="lg-recent-name">{r.name}</span>
                          <span className="lg-recent-email">{r.email}</span>
                          <span className="lg-recent-active">{activeLabel(r.at)}</span>
                        </span>
                        <button
                          type="button"
                          className="lg-recent-remove"
                          aria-label={`Remove ${r.name} from recent accounts`}
                          title="Remove account"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecent(r.email);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="lg-highlights">
                {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="lg-highlight-card">
                    <span className="lg-highlight-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <div className="lg-highlight-body">
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ul className="lg-trust">
              <li>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Real-time sync</span>
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>2FA ready</span>
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Full audit trail</span>
              </li>
            </ul>
          </section>

          {/* Right column: Sign-in card */}
          <section className="lg-card-wrap" aria-label="Sign in form">
            <div className="lg-card">
              {isTwoFactorStep ? (
                <div className="lg-2fa">
                  <div className="lg-2fa-head">
                    <div className="lg-2fa-badge" aria-hidden="true">
                      <Shield size={26} />
                    </div>
                    <h2 className="lg-card-title">Two-factor verification</h2>
                    <p className="lg-card-sub">
                      {useBackupCode
                        ? 'Enter one of your recovery backup codes to continue.'
                        : `Enter the 6-digit code from your authenticator app for ${twoFactorEmail}.`}
                    </p>
                  </div>

                  {error && (
                    <div className="lg-alert lg-alert--error" role="alert">
                      <AlertCircle size={17} aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form key="2fa-form" className="lg-form" onSubmit={handleVerify2FA} noValidate>
                    <div className="lg-field">
                      <label className="lg-label" htmlFor="login-2fa-code">
                        {useBackupCode ? 'Recovery backup code' : '6-digit authenticator code'}
                      </label>
                      {useBackupCode ? (
                        <input
                          id="login-2fa-code"
                          type="text"
                          autoComplete="one-time-code"
                          autoFocus
                          className="lg-input lg-code-input"
                          placeholder="a8f1-3b9c"
                          maxLength={12}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                        />
                      ) : (
                        <OtpInput
                          id="login-2fa-code"
                          value={twoFactorCode}
                          onChange={setTwoFactorCode}
                          autoFocus
                          disabled={loading}
                          hasError={Boolean(error)}
                          ariaLabel="6-digit authenticator code"
                        />
                      )}
                      <span className="lg-helper">
                        {useBackupCode
                          ? 'Each backup code can only be used once.'
                          : 'Paste or type the 6-digit code from your authenticator app.'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="lg-link-btn lg-link-btn--center"
                      onClick={() => {
                        setUseBackupCode(!useBackupCode);
                        setTwoFactorCode('');
                        setError('');
                      }}
                    >
                      {useBackupCode ? (
                        <>
                          <Smartphone size={14} aria-hidden="true" />
                          <span>Use authenticator app instead</span>
                        </>
                      ) : (
                        <>
                          <Key size={14} aria-hidden="true" />
                          <span>Lost your device? Use a backup code</span>
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      className="lg-submit"
                      disabled={loading || (useBackupCode ? !twoFactorCode.trim() : twoFactorCode.length !== 6)}
                    >
                      <span>{loading ? 'Verifying...' : 'Verify & sign in'}</span>
                      {!loading && <ArrowRight size={16} aria-hidden="true" />}
                    </button>

                    <button
                      type="button"
                      className="lg-secondary-btn"
                      onClick={handleCancel2FA}
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      <span>Back to sign in</span>
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="lg-card-head">
                    <div>
                      <p className="lg-card-eyebrow">Welcome back</p>
                      <h2 className="lg-card-title">Sign in to your account</h2>
                    </div>
                  </div>

                  {/* Mode Switcher */}
                  <div className="lg-tabs" role="tablist" aria-label="Sign in method">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'password'}
                      className={`lg-tab${mode === 'password' ? ' is-active' : ''}`}
                      onClick={() => switchMode('password')}
                    >
                      <Lock size={14} aria-hidden="true" />
                      <span>Password</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'otp'}
                      className={`lg-tab${mode === 'otp' ? ' is-active' : ''}`}
                      onClick={() => switchMode('otp')}
                    >
                      <KeyRound size={14} aria-hidden="true" />
                      <span>Email code</span>
                    </button>
                  </div>

                  {successMessage && (
                    <div className="lg-alert lg-alert--success" role="status">
                      <CheckCircle2 size={17} aria-hidden="true" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {error && (
                    <div className="lg-alert lg-alert--error" role="alert">
                      <AlertCircle size={17} aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Password Login */}
                  {mode === 'password' && (
                    <form className="lg-form" onSubmit={handlePasswordSubmit}>
                      <div className="lg-field">
                        <label className="lg-label" htmlFor="login-email">
                          Email address
                        </label>
                        <div className="lg-input-wrap">
                          <Mail size={16} className="lg-input-icon" aria-hidden="true" />
                          <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            className="lg-input lg-input--with-icon"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="lg-field">
                        <div className="lg-label-row">
                          <label className="lg-label" htmlFor="login-password">
                            Password
                          </label>
                          <Link to="/forgot-password" className="lg-forgot">
                            Forgot password?
                          </Link>
                        </div>
                        <div className="lg-input-wrap">
                          <Lock size={16} className="lg-input-icon" aria-hidden="true" />
                          <input
                            ref={passwordInputRef}
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            className="lg-input lg-input--with-icon lg-input--with-action"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            className="lg-eye-btn"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      <button type="submit" className="lg-submit" disabled={loading}>
                        <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                        {!loading && <ArrowRight size={16} aria-hidden="true" />}
                      </button>
                    </form>
                  )}

                  {/* Email OTP: Step 1 */}
                  {mode === 'otp' && otpStep === 'input_email' && (
                    <form key="otp-email-form" className="lg-form" onSubmit={handleSendOtp}>
                      <div className="lg-field">
                        <label className="lg-label" htmlFor="login-otp-email">
                          Email address
                        </label>
                        <div className="lg-input-wrap">
                          <Mail size={16} className="lg-input-icon" aria-hidden="true" />
                          <input
                            id="login-otp-email"
                            type="email"
                            autoComplete="email"
                            className="lg-input lg-input--with-icon"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                        <span className="lg-helper">
                          We&apos;ll send a 6-digit one-time login code to your inbox.
                        </span>
                      </div>

                      <button type="submit" className="lg-submit" disabled={loading || countdown > 0}>
                        <span>
                          {loading
                            ? 'Sending code...'
                            : countdown > 0
                              ? `Resend locked (${countdown}s)`
                              : 'Send login code'}
                        </span>
                        {!loading && countdown === 0 && <ArrowRight size={16} aria-hidden="true" />}
                      </button>

                      {countdown > 0 &&
                        challengeToken &&
                        sentEmail === email.trim().toLowerCase() && (
                          <button
                            type="button"
                            className="lg-link-btn lg-link-btn--center"
                            onClick={() => {
                              setError('');
                              setOtpStep('input_code');
                            }}
                          >
                            <span>Already have a code? Enter code</span>
                          </button>
                        )}
                    </form>
                  )}

                  {/* Email OTP: Step 2 */}
                  {mode === 'otp' && otpStep === 'input_code' && (
                    <form key="otp-code-form" className="lg-form" onSubmit={handleVerifyOtp} noValidate>
                      <div className="lg-otp-banner">
                        <span className="lg-otp-sent-wrap">
                          <MailCheck size={16} className="lg-otp-sent-icon" aria-hidden="true" />
                          <span className="lg-otp-sent">
                            Code sent to <strong>{email}</strong>
                          </span>
                        </span>
                        <button
                          type="button"
                          className="lg-otp-change"
                          onClick={() => {
                            setOtpStep('input_email');
                            setOtpCode('');
                            setError('');
                          }}
                        >
                          Change
                        </button>
                      </div>

                      <div className="lg-field">
                        <div className="lg-label-row">
                          <label className="lg-label" htmlFor="login-otp-code">
                            Verification code
                          </label>
                          <span className="lg-label-hint">Paste supported</span>
                        </div>
                        <OtpInput
                          id="login-otp-code"
                          value={otpCode}
                          onChange={setOtpCode}
                          autoFocus
                          disabled={loading}
                          hasError={Boolean(error)}
                          ariaLabel="6-digit verification code"
                        />
                      </div>

                      <div className="lg-otp-resend-row">
                        {countdown > 0 ? (
                          <span className="lg-otp-countdown" role="status" aria-live="polite">
                            <Lock size={13} aria-hidden="true" />
                            <span>Resend available in {countdown}s</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="lg-link-btn"
                            onClick={handleSendOtp}
                            disabled={loading}
                          >
                            <RotateCcw size={14} aria-hidden="true" />
                            <span>Resend code</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="lg-submit"
                        disabled={loading || otpCode.length !== 6}
                      >
                        <span>{loading ? 'Verifying...' : 'Verify & sign in'}</span>
                        {!loading && <ArrowRight size={16} aria-hidden="true" />}
                      </button>
                    </form>
                  )}

                  <p className="lg-card-foot">
                    Need access? <span>Contact your portal administrator.</span>
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
