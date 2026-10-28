import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ArrowLeft, CalendarCheck, Building2, ClipboardList, CheckCircle2, Mail, AlertCircle, Eye, EyeOff, RotateCcw, Shield, Smartphone, Key, XCircle } from 'lucide-react';
import { RocketIllustration } from '../components/RocketIllustration';
import './LoginPage.css';

const RECENT_KEY = 'recentLogins';

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

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [countdown, setCountdown] = useState(0);

  // 2FA Authenticator Challenge State
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [recent, setRecent] = useState(readRecent);

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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
        const entry = { email: addr, name: user.name || user.fullName || addr.split('@')[0], at: Date.now() };
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
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/otp/send', { email });
      setChallengeToken(response.data?.data?.challengeToken || '');
      setOtpStep('input_code');
      setCountdown(60);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send login code. Please try again.';
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
    if (!cleanCode) {
      setError(useBackupCode ? 'Please enter your recovery backup code' : 'Please enter the 6-digit authenticator code');
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
      const msg = err.response?.data?.message || 'Invalid verification code. Please check your authenticator app and try again.';
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
    switchMode('password');
  };

  const removeRecent = (addr) => {
    const next = recent.filter((r) => r.email !== addr);
    setRecent(next);
    writeRecent(next);
  };

  const handleSocial = (provider) => {
    setError(`${provider} sign-in is not configured yet. Please use your email and password.`);
  };

  return (
    <div className="login-page">
      <button type="button" className="login-top-back-btn" onClick={() => navigate('/')} title="Back">
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div className="login-frame">
        <div className="login-blue">
          <div className="login-topbar">
            <span className="login-brand-name">Exam View</span>
          </div>
          <div className="login-hero">
            <div className="login-hero-text">
              <h2 className="login-hero-title">Sign in to</h2>
              <p className="login-hero-sub">Exam View is simply smarter</p>
              <p className="login-hero-copy">
                Manage exams, vendors and schedules in one place. Sign in to pick up right where you left off.
              </p>
            </div>
            <RocketIllustration />
          </div>
        </div>

        <div className="login-white">
          {recent.length === 0 ? (
            <div className="login-features">
              <div className="login-feature">
                <span className="login-feature-icon"><ClipboardList size={20} /></span>
                <h3>Exams</h3>
                <p>Create, organise and track every exam with custom fields and tables.</p>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon"><Building2 size={20} /></span>
                <h3>Vendors</h3>
                <p>Keep all your exam vendors and their details in one searchable place.</p>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon"><CalendarCheck size={20} /></span>
                <h3>Schedules</h3>
                <p>Stay on top of upcoming dates, announcements and notifications.</p>
              </div>
            </div>
          ) : (
          <div className="login-recent">
            <p className="login-recent-title">Login as</p>
            {(
              <div className="login-recent-list">
                {recent.map((r) => (
                  <div
                    key={r.email}
                    className="login-recent-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => pickRecent(r)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickRecent(r)}
                  >
                    <button
                      type="button"
                      className="login-recent-remove"
                      aria-label={`Remove ${r.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(r.email);
                      }}
                    >
                      <XCircle size={14} />
                    </button>
                    <span className="login-recent-avatar">{(r.name || r.email).charAt(0).toUpperCase()}</span>
                    <span className="login-recent-name">{r.name}</span>
                    <span className="login-recent-active">{activeLabel(r.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

      <div className="login-card">
        {isTwoFactorStep ? (
          <div className="login-2fa-container">
            <div className="login-header">
              <div className="login-2fa-shield-badge">
                <Shield size={32} className="login-2fa-shield-icon" />
              </div>
              <h1 className="login-title">Two-Factor Authentication</h1>
              <p className="login-subtitle">
                {useBackupCode
                  ? 'Enter one of your 8-character recovery backup codes to access your account'
                  : `Enter the 6-digit verification code from your authenticator app for ${twoFactorEmail}`}
              </p>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleVerify2FA}>
              <div className="login-form-group">
                <label className="login-label">
                  {useBackupCode ? 'Recovery Backup Code' : '6-Digit Code'}
                </label>
                <input
                  type="text"
                  autoFocus
                  className="login-input login-otp-code-input"
                  placeholder={useBackupCode ? 'a8f1-3b9c' : '••••••'}
                  maxLength={useBackupCode ? 12 : 6}
                  value={twoFactorCode}
                  onChange={(e) => {
                    if (useBackupCode) {
                      setTwoFactorCode(e.target.value);
                    } else {
                      setTwoFactorCode(e.target.value.replace(/\D/g, ''));
                    }
                  }}
                  required
                />
                <span className="login-helper-text">
                  {useBackupCode
                    ? 'Each backup code is single-use only.'
                    : 'Works with Google Authenticator, Microsoft Authenticator, Authy, Apple Passwords.'}
                </span>
              </div>

              <div className="login-2fa-toggle-row">
                <button
                  type="button"
                  className="login-2fa-toggle-btn"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setTwoFactorCode('');
                    setError('');
                  }}
                >
                  {useBackupCode ? (
                    <>
                      <Smartphone size={14} />
                      <span>Use Authenticator App instead</span>
                    </>
                  ) : (
                    <>
                      <Key size={14} />
                      <span>Lost your phone? Use a backup code</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={loading || !twoFactorCode.trim()}
              >
                {loading ? 'Verifying code...' : 'Verify & Sign in'}
              </button>

              <button
                type="button"
                className="login-2fa-cancel-btn"
                onClick={handleCancel2FA}
              >
                <ArrowLeft size={14} />
                <span>Back to sign in</span>
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="login-card-head">
              <div>
                <p className="login-welcome">
                  Welcome to <span>Exam View</span>
                </p>
                <h1 className="login-title login-title-xl">Sign in</h1>
              </div>
              <p className="login-noaccount">
                No account?<br />
                <span>Contact admin</span>
              </p>
            </div>

            <div className="login-social-row">
              <button type="button" className="login-google-btn" onClick={() => handleSocial('Google')}>
                <GoogleIcon />
                <span>Google</span>
              </button>
              <button type="button" className="login-social-btn" aria-label="Sign in with Facebook" onClick={() => handleSocial('Facebook')}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877f2" /><path fill="#fff" d="M13.3 19v-6.2h2.1l.3-2.5h-2.4V8.7c0-.7.2-1.2 1.2-1.2h1.3V5.3c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.6v2.5h2.1V19h2.6z" /></svg>
              </button>
              <button type="button" className="login-social-btn" aria-label="Sign in with Apple" onClick={() => handleSocial('Apple')}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.7c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.800.9s-2-.9-3.300-.9c-1.700 0-3.300 1-4.200 2.500-1.800 3.100-.5 7.700 1.300 10.200.9 1.200 1.900 2.600 3.200 2.500 1.300-.1 1.800-.8 3.300-.8s2 .8 3.400.8 2.300-1.200 3.100-2.500c1-1.400 1.400-2.800 1.400-2.900-.1 0-2.900-1.100-2.900-4.300zM13.900 5.500c.7-.9 1.200-2.100 1-3.300-1 0-2.300.7-3 1.600-.7.800-1.200 2-1.100 3.200 1.200.1 2.400-.6 3.100-1.500z" /></svg>
              </button>
            </div>

            {successMessage && (
              <div className="login-success-banner">
                <CheckCircle2 size={18} />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Tab 1: Password Login */}
            {mode === 'password' && (
              <form className="login-form" onSubmit={handlePasswordSubmit}>
                <div className="login-form-group">
                  <label className="login-label">Email or username</label>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="login-form-group">
                  <label className="login-label">Password</label>
                  <div className="login-password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="login-input password-input"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="login-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <Link to="/forgot-password" className="login-forgot-link">
                    Forgot?
                  </Link>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <button type="button" className="login-alt-link" onClick={() => switchMode('otp')}>
                  <Mail size={14} />
                  <span>Use email code</span>
                </button>
              </form>
            )}

            {/* Tab 2: Email OTP Login */}
            {mode === 'otp' && otpStep === 'input_email' && (
              <form className="login-form" onSubmit={handleSendOtp}>
                <div className="login-form-group">
                  <label className="login-label">Email address</label>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <span className="login-helper-text">
                    We will email a 6-digit one-time code to this address.
                  </span>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Sending code...' : 'Send Login Code'}
                </button>
                <button type="button" className="login-alt-link" onClick={() => switchMode('password')}>
                  <ArrowLeft size={14} />
                  <span>Use password instead</span>
                </button>
              </form>
            )}

            {/* Tab 2: Email OTP Verification */}
            {mode === 'otp' && otpStep === 'input_code' && (
              <form className="login-form" onSubmit={handleVerifyOtp}>
                <div className="login-otp-info-box">
                  <span className="login-otp-sent-text">
                    Code sent to <strong>{email}</strong>
                  </span>
                  <button
                    type="button"
                    className="login-otp-change-email-btn"
                    onClick={() => {
                      setOtpStep('input_email');
                      setOtpCode('');
                      setError('');
                    }}
                  >
                    Change
                  </button>
                </div>

                <div className="login-form-group">
                  <label className="login-label">6-Digit Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    className="login-input login-otp-code-input"
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    required
                  />
                </div>

                <div className="login-otp-resend-row">
                  {countdown > 0 ? (
                    <span className="login-otp-countdown">
                      Resend code in {countdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="login-otp-resend-btn"
                      onClick={handleSendOtp}
                      disabled={loading}
                    >
                      <RotateCcw size={14} />
                      <span>Resend code</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify & Sign in'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
};
