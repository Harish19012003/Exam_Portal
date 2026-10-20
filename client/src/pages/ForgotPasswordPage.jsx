import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import './ForgotPasswordPage.css';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process request. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-page">
      <div className="forgot-bg-glow glow-1"></div>
      <div className="forgot-bg-glow glow-2"></div>

      {!submitted && (
        <button
          type="button"
          className="forgot-top-back-btn"
          onClick={() => navigate('/login')}
          title="Back to login"
        >
          <ArrowLeft size={18} />
          <span>Back to Sign in</span>
        </button>
      )}

      <div className="forgot-card">
        <div className="forgot-header">
          <div className="forgot-brand">
            <div className="forgot-logo">E</div>
            <div className="forgot-brand-title">Exam View</div>
          </div>

          {!submitted ? (
            <>
              <h1 className="forgot-title">Forgot password?</h1>
              <p className="forgot-subtitle">
                Enter your account email address and we'll send you a secure link to reset your password.
              </p>
            </>
          ) : (
            <>
              <div className="forgot-icon-wrap success">
                <CheckCircle2 size={36} />
              </div>
              <h1 className="forgot-title">Check your email</h1>
              <p className="forgot-subtitle">
                We've sent a password reset link to <strong className="forgot-highlight-email">{email}</strong>. Please check your inbox (and spam folder) within the next 15 minutes.
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="forgot-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!submitted ? (
          <form className="forgot-form" onSubmit={handleSubmit}>
            <div className="forgot-form-group">
              <label className="forgot-label">Email address</label>
              <div className="forgot-input-wrap">
                <Mail size={18} className="forgot-input-icon" />
                <input
                  type="email"
                  className="forgot-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="forgot-btn" disabled={loading}>
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>

            <div className="forgot-footer">
              <span>Remember your password? </span>
              <Link to="/login" className="forgot-footer-link">Sign in</Link>
            </div>
          </form>
        ) : (
          <div className="forgot-success-content">
            <button
              type="button"
              className="forgot-btn"
              onClick={() => navigate('/login')}
            >
              Back to Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
