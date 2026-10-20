import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import './ResetPasswordPage.css';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successfully! Please sign in with your new password.' },
        });
      }, 2500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. The link may have expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // If no token in URL, prompt user to request a valid link
  if (!token) {
    return (
      <div className="reset-page">
        <div className="reset-bg-glow glow-1"></div>
        <div className="reset-bg-glow glow-2"></div>

        <div className="reset-card">
          <div className="reset-header">
            <div className="reset-icon-wrap error">
              <ShieldAlert size={36} />
            </div>
            <h1 className="reset-title">Invalid Reset Link</h1>
            <p className="reset-subtitle">
              This password reset link is missing a verification token or is invalid. Please request a new reset link.
            </p>
          </div>

          <button
            type="button"
            className="reset-btn"
            onClick={() => navigate('/forgot-password')}
          >
            Request New Reset Link
          </button>

          <div className="reset-footer">
            <Link to="/login" className="reset-footer-link">Back to Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-page">
      <div className="reset-bg-glow glow-1"></div>
      <div className="reset-bg-glow glow-2"></div>

      <button
        type="button"
        className="reset-top-back-btn"
        onClick={() => navigate('/login')}
        title="Back to login"
      >
        <ArrowLeft size={18} />
        <span>Back to Sign in</span>
      </button>

      <div className="reset-card">
        <div className="reset-header">
          <div className="reset-brand">
            <div className="reset-logo">E</div>
            <div className="reset-brand-title">Exam View</div>
          </div>

          {!success ? (
            <>
              <h1 className="reset-title">Reset your password</h1>
              <p className="reset-subtitle">
                Create a strong new password for your account. Must be at least 8 characters.
              </p>
            </>
          ) : (
            <>
              <div className="reset-icon-wrap success">
                <CheckCircle2 size={36} />
              </div>
              <h1 className="reset-title">Password updated!</h1>
              <p className="reset-subtitle">
                Your password has been reset successfully. Redirecting you to the sign-in page...
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="reset-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!success ? (
          <form className="reset-form" onSubmit={handleSubmit}>
            <div className="reset-form-group">
              <label className="reset-label">New Password</label>
              <div className="reset-input-wrap">
                <Lock size={18} className="reset-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="reset-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="reset-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="reset-form-group">
              <label className="reset-label">Confirm New Password</label>
              <div className="reset-input-wrap">
                <Lock size={18} className="reset-input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="reset-input"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="reset-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Validation indicators */}
            <div className="reset-requirements">
              <div className={`reset-req-item ${password.length >= 8 ? 'valid' : ''}`}>
                <span className="reset-req-dot"></span>
                <span>At least 8 characters</span>
              </div>
              <div className={`reset-req-item ${password && confirmPassword && password === confirmPassword ? 'valid' : ''}`}>
                <span className="reset-req-dot"></span>
                <span>Passwords match</span>
              </div>
            </div>

            <button type="submit" className="reset-btn" disabled={loading}>
              {loading ? 'Updating password...' : 'Update Password'}
            </button>

            <div className="reset-footer">
              <Link to="/login" className="reset-footer-link">Cancel and return to Sign in</Link>
            </div>
          </form>
        ) : (
          <div className="reset-success-actions">
            <button
              type="button"
              className="reset-btn"
              onClick={() => navigate('/login', {
                state: { message: 'Password reset successfully! Please sign in with your new password.' },
              })}
            >
              Sign in now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
