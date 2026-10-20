import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, AlertCircle, Eye, EyeOff, RotateCcw, Shield, Smartphone, Key } from 'lucide-react';
import './LoginPage.css';

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

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleLoginSuccess = (token, user) => {
    if (token) {
      localStorage.setItem('accessToken', token);
    }
    localStorage.setItem('sessionActive', 'true');
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
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

      handleLoginSuccess(data.accessToken, data.user);
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

      handleLoginSuccess(data.accessToken, data.user);
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
      const { accessToken, user } = response.data?.data || {};
      handleLoginSuccess(accessToken, user);
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

  return (
    <div className="login-page">
      <div className="login-bg-glow glow-1"></div>
      <div className="login-bg-glow glow-2"></div>

      <button
        type="button"
        className="login-top-back-btn"
        onClick={() => navigate('/')}
        title="Back"
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

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
            <div className="login-header">
              <div className="login-brand">
                <div className="login-logo">E</div>
                <div className="login-brand-title">Exam View</div>
              </div>
              <h1 className="login-title">Welcome back</h1>
              <p className="login-subtitle">Sign in to your Exam View portal account</p>
            </div>

            {/* Mode Selector Tabs */}
            <div className="login-mode-tabs">
              <button
                type="button"
                className={`login-mode-tab ${mode === 'password' ? 'active' : ''}`}
                onClick={() => switchMode('password')}
              >
                <KeyRound size={16} />
                <span>Password</span>
              </button>
              <button
                type="button"
                className={`login-mode-tab ${mode === 'otp' ? 'active' : ''}`}
                onClick={() => switchMode('otp')}
              >
                <Mail size={16} />
                <span>Email OTP</span>
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
                  <label className="login-label">Email address</label>
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
                  <div className="login-label-row">
                    <label className="login-label">Password</label>
                    <Link to="/forgot-password" className="login-forgot-link">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="login-password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="login-input password-input"
                      placeholder="••••••••"
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
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
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
  );
};
