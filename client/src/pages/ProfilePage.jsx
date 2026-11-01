import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { PageHeading } from '../components/PageHeading';
import {
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Crown,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Lock,
  Eye,
  EyeOff,
  Check,
  QrCode,
  Smartphone,
  Copy,
  X,
  Key,
} from 'lucide-react';
import './ProfilePage.css';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [saving, setSaving] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 2FA TOTP state
  const [showTwoFactorSetupModal, setShowTwoFactorSetupModal] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState(null);
  const [twoFactorSetupLoading, setTwoFactorSetupLoading] = useState(false);
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [twoFactorVerifyLoading, setTwoFactorVerifyLoading] = useState(false);
  const [twoFactorVerifyError, setTwoFactorVerifyError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Disable 2FA state
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Active section tab: 'details' | 'security' | 'permissions'
  const [activeTab, setActiveTab] = useState('details');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/users/profile');
      const data = response.data?.data || {};
      setProfile(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone_number || '');
      setTimezone(data.timezone || 'Asia/Kolkata');

      // Update localStorage cached user object
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...data }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setError('');
    setSaving(true);

    try {
      const response = await apiClient.patch('/users/profile', {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        timezone,
      });

      const updated = response.data?.data || {};
      setProfile((prev) => ({ ...prev, ...updated }));

      // Update localStorage so sidebar immediately reflects new name
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const newStored = { ...stored, ...updated };
      localStorage.setItem('user', JSON.stringify(newStored));

      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);

    try {
      await apiClient.patch('/users/profile', {
        password: newPassword,
      });

      setPasswordSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Start 2FA Setup
  const handleStart2FASetup = async () => {
    try {
      setTwoFactorSetupLoading(true);
      setError('');
      setTwoFactorVerifyError('');
      setTwoFactorVerifyCode('');
      const response = await apiClient.post('/auth/2fa/setup');
      setTwoFactorSetupData(response.data?.data || null);
      setShowTwoFactorSetupModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initialize 2FA setup');
    } finally {
      setTwoFactorSetupLoading(false);
    }
  };

  // Verify and Enable 2FA
  const handleVerifyAndEnable2FA = async (e) => {
    e.preventDefault();
    const cleanCode = twoFactorVerifyCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setTwoFactorVerifyError('Please enter the 6-digit code from your authenticator app');
      return;
    }

    setTwoFactorVerifyLoading(true);
    setTwoFactorVerifyError('');

    try {
      await apiClient.post('/auth/2fa/enable', {
        setupToken: twoFactorSetupData?.setupToken,
        code: cleanCode,
      });

      setShowTwoFactorSetupModal(false);
      setSuccessMsg('Two-Factor Authentication (TOTP) activated successfully!');
      setProfile((prev) => ({ ...prev, two_factor_enabled: true }));

      // Update cached user in localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, two_factor_enabled: true }));
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setTwoFactorVerifyError(err.response?.data?.message || 'Invalid 6-digit verification code. Please try again.');
    } finally {
      setTwoFactorVerifyLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (!disablePassword && !disableCode) {
      setDisableError('Please enter your current password or 6-digit code');
      return;
    }

    setDisableLoading(true);
    setDisableError('');

    try {
      await apiClient.post('/auth/2fa/disable', {
        password: disablePassword,
        code: disableCode,
      });

      setShowDisable2FAModal(false);
      setDisablePassword('');
      setDisableCode('');
      setSuccessMsg('Two-Factor Authentication has been disabled.');
      setProfile((prev) => ({ ...prev, two_factor_enabled: false }));

      // Update cached user in localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, two_factor_enabled: false }));
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setDisableError(err.response?.data?.message || 'Failed to disable 2FA. Please verify your credentials.');
    } finally {
      setDisableLoading(false);
    }
  };

  const copyText = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } else if (type === 'backup') {
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner"></div>
        <span>Loading profile details...</span>
      </div>
    );
  }

  const isPrimary = Boolean(profile?.is_primary);
  const avatarLetter = (firstName?.[0] || profile?.email?.[0] || 'U').toUpperCase();
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || profile?.email || 'User';
  const roleName = profile?.role ? profile.role.replace(/_/g, ' ').toUpperCase() : 'USER';
  const permissionsList = Array.isArray(profile?.permissions) ? profile.permissions : [];

  return (
    <div className="profile-page">
      <PageHeading title="Profile & Security" />

      <div className="profile-header-card">
        <div className="profile-avatar-container">
          <div className="profile-avatar-circle" aria-hidden="true">
            {avatarLetter}
          </div>
          <span className="profile-status-indicator" title="Active" />
        </div>

        <div className="profile-header-info">
          <div className="profile-title-row">
            <h2 className="profile-name">{displayName}</h2>
            <div className="profile-badge-group">
              {isPrimary ? (
                <span className="profile-badge primary">
                  <Crown size={13} aria-hidden="true" />
                  <span>Primary Super Admin</span>
                </span>
              ) : (
                <span className="profile-badge role">
                  <Shield size={13} aria-hidden="true" />
                  <span>{roleName}</span>
                </span>
              )}
              <span className={`profile-badge status ${profile?.status === 'active' ? 'active' : ''}`}>
                {profile?.status || 'active'}
              </span>
            </div>
          </div>
          <div className="profile-meta-row">
            <span className="profile-meta-item">
              <Mail size={14} aria-hidden="true" />
              <span className="profile-meta-text">{profile?.email}</span>
            </span>
            {profile?.phone_number && (
              <span className="profile-meta-item">
                <Phone size={14} aria-hidden="true" />
                <span className="profile-meta-text">{profile.phone_number}</span>
              </span>
            )}
            <span className="profile-meta-item">
              <Globe size={14} aria-hidden="true" />
              <span className="profile-meta-text">{profile?.timezone || 'Asia/Kolkata'}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          className={`profile-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <User size={16} aria-hidden="true" />
          <span>Personal Details</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <KeyRound size={16} aria-hidden="true" />
          <span>Security & Password</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'permissions'}
          className={`profile-tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          <Shield size={16} aria-hidden="true" />
          <span className="profile-tab-label-full">Rights & Permissions ({permissionsList.length})</span>
          <span className="profile-tab-label-short">Rights ({permissionsList.length})</span>
        </button>
      </div>

        {/* ALERTS */}
      {successMsg && (
        <div className="profile-alert success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="profile-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB CONTENT 1: PERSONAL DETAILS */}
      {activeTab === 'details' && (
        <div className="profile-panel">
          <div className="profile-panel-header">
            <div>
              <h2 className="profile-panel-title">Personal Information</h2>
              <p className="profile-panel-subtitle">Manage your personal details and account preferences</p>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleUpdateProfile}>
            <div className="profile-form-grid">
              <div className="profile-form-group">
                <label className="profile-label">First Name</label>
                <input
                  type="text"
                  className="profile-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Last Name</label>
                <input
                  type="text"
                  className="profile-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Email Address</label>
                <div className="profile-input-readonly">
                  <input
                    type="email"
                    className="profile-input disabled"
                    value={profile?.email || ''}
                    disabled
                  />
                  <span className="profile-input-badge">Verified</span>
                </div>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Phone Number</label>
                <input
                  type="text"
                  className="profile-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="profile-form-group full-width">
                <label className="profile-label">Timezone</label>
                <select
                  className="profile-select"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST - UTC-05:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST - UTC+00:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                </select>
              </div>
            </div>

            <div className="profile-form-actions">
              <button type="submit" className="profile-save-btn" disabled={saving}>
                <Save size={16} />
                <span>{saving ? 'Saving changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT 2: SECURITY */}
      {activeTab === 'security' && (
        <div className="profile-panel">
          <div className="profile-panel-header">
            <div>
              <h2 className="profile-panel-title">Security & Password</h2>
              <p className="profile-panel-subtitle">Update your password and review your account security status</p>
            </div>
          </div>

          {passwordSuccess && (
            <div className="profile-alert success">
              <CheckCircle2 size={18} />
              <span>{passwordSuccess}</span>
            </div>
          )}
          {passwordError && (
            <div className="profile-alert error">
              <AlertCircle size={18} />
              <span>{passwordError}</span>
            </div>
          )}

          <form className="profile-form" onSubmit={handleUpdatePassword}>
            <div className="profile-form-grid">
              <div className="profile-form-group">
                <label className="profile-label">New Password</label>
                <div className="profile-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="profile-input password-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    className="profile-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="profile-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="profile-save-btn"
                disabled={passwordSaving || !newPassword || !confirmPassword}
              >
                <Lock size={16} />
                <span>{passwordSaving ? 'Updating password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>

          <div className="profile-security-card">
            <div className="profile-2fa-banner">
              <div className="profile-2fa-icon-badge">
                <Shield size={26} />
              </div>
              <div className="profile-2fa-info">
                <div className="profile-2fa-header-line">
                  <h4 className="profile-security-item-title">Two-Factor Authentication (TOTP)</h4>
                  <span className={`profile-status-pill ${profile?.two_factor_enabled ? 'enabled' : 'disabled'}`}>
                    {profile?.two_factor_enabled ? 'Active & Protected' : 'Not Enabled'}
                  </span>
                </div>
                <p className="profile-security-item-desc">
                  {profile?.two_factor_enabled
                    ? 'Your account is protected by an Authenticator App (Google Authenticator, Microsoft Authenticator, etc.). A 6-digit code is required each time you log in.'
                    : 'Add an extra layer of security. When signing in, you will be prompted for a 6-digit code from Google Authenticator, Microsoft Authenticator, Authy, or Apple Passwords.'}
                </p>

                <div className="profile-2fa-action-bar">
                  {profile?.two_factor_enabled ? (
                    <button
                      type="button"
                      className="profile-2fa-disable-trigger-btn"
                      onClick={() => {
                        setShowDisable2FAModal(true);
                        setDisableError('');
                        setDisablePassword('');
                        setDisableCode('');
                      }}
                    >
                      <Lock size={15} />
                      <span>Disable 2FA</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="profile-2fa-enable-trigger-btn"
                      onClick={handleStart2FASetup}
                      disabled={twoFactorSetupLoading}
                    >
                      <Smartphone size={16} />
                      <span>{twoFactorSetupLoading ? 'Generating QR Code...' : 'Set up Authenticator App'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-security-item">
              <div>
                <h4 className="profile-security-item-title">Last Activity</h4>
                <p className="profile-security-item-desc">
                  {profile?.last_active_at ? new Date(profile.last_active_at).toLocaleString() : 'Currently Active'}
                </p>
              </div>
              <span className="profile-time-badge">
                <Clock size={13} />
                <span>Session Active</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: RIGHTS & PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="profile-panel">
          <div className="profile-panel-header">
            <div>
              <h2 className="profile-panel-title">Assigned Permissions & Rights</h2>
              <p className="profile-panel-subtitle">Access privileges granted to your account role</p>
            </div>
          </div>

          <div className="profile-permissions-grid">
            {permissionsList.length > 0 ? (
              permissionsList.map((perm, idx) => (
                <div key={idx} className="profile-permission-card">
                  <div className="profile-perm-check">
                    <Check size={14} />
                  </div>
                  <span className="profile-perm-name">{perm}</span>
                </div>
              ))
            ) : (
              <p className="profile-empty-text">No explicit rights assigned</p>
            )}
          </div>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {showTwoFactorSetupModal && twoFactorSetupData && (
        <div className="profile-modal-backdrop" onClick={() => setShowTwoFactorSetupModal(false)}>
          <div className="profile-modal-dialog profile-2fa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div className="profile-modal-title-wrap">
                <div className="profile-modal-icon-badge">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="profile-modal-title">Set up Authenticator App</h3>
                  <p className="profile-modal-subtitle">Google Authenticator, Microsoft Authenticator, Authy, Apple Passwords</p>
                </div>
              </div>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowTwoFactorSetupModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="profile-modal-body">
              {/* Step 1: Scan QR */}
              <div className="profile-2fa-step">
                <div className="profile-2fa-step-badge">1</div>
                <div className="profile-2fa-step-content">
                  <h4 className="profile-2fa-step-title">Scan this QR Code</h4>
                  <p className="profile-2fa-step-desc">
                    Open your authenticator app, tap <strong>"+"</strong> or <strong>"Add account"</strong>, and scan the QR code.
                  </p>
                  
                  <div className="profile-2fa-qr-wrapper">
                    <img
                      src={twoFactorSetupData.qrCode}
                      alt="Two-Factor QR Code"
                      className="profile-2fa-qr-image"
                    />
                  </div>

                  <div className="profile-2fa-manual-key-box">
                    <span className="profile-2fa-manual-label">Can't scan? Use this setup key:</span>
                    <div className="profile-2fa-key-row">
                      <code className="profile-2fa-key-code">{twoFactorSetupData.secret}</code>
                      <button
                        type="button"
                        className="profile-2fa-copy-btn"
                        onClick={() => copyText(twoFactorSetupData.secret, 'secret')}
                      >
                        {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedSecret ? 'Copied' : 'Copy Key'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Backup Codes */}
              <div className="profile-2fa-step">
                <div className="profile-2fa-step-badge">2</div>
                <div className="profile-2fa-step-content">
                  <div className="profile-2fa-backup-header">
                    <div>
                      <h4 className="profile-2fa-step-title">Save Recovery Backup Codes</h4>
                      <p className="profile-2fa-step-desc">
                        If you ever lose access to your phone, each of these one-time codes can be used once to log in.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="profile-2fa-copy-backup-btn"
                      onClick={() => copyText(twoFactorSetupData.backupCodes.join('\n'), 'backup')}
                    >
                      {copiedBackupCodes ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedBackupCodes ? 'Copied All' : 'Copy All Codes'}</span>
                    </button>
                  </div>

                  <div className="profile-2fa-backup-grid">
                    {twoFactorSetupData.backupCodes.map((code, idx) => (
                      <div key={idx} className="profile-2fa-backup-pill">
                        <code>{code}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Enter Code */}
              <div className="profile-2fa-step">
                <div className="profile-2fa-step-badge">3</div>
                <div className="profile-2fa-step-content">
                  <h4 className="profile-2fa-step-title">Verify 6-Digit Code</h4>
                  <p className="profile-2fa-step-desc">
                    Enter the rolling 6-digit code currently displayed in your authenticator app to complete activation.
                  </p>

                  {twoFactorVerifyError && (
                    <div className="profile-modal-error">
                      <AlertCircle size={16} />
                      <span>{twoFactorVerifyError}</span>
                    </div>
                  )}

                  <form className="profile-2fa-verify-form" onSubmit={handleVerifyAndEnable2FA}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      placeholder="••••••"
                      className="profile-2fa-code-input"
                      value={twoFactorVerifyCode}
                      onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                    />

                    <button
                      type="submit"
                      className="profile-2fa-submit-btn"
                      disabled={twoFactorVerifyLoading || twoFactorVerifyCode.length !== 6}
                    >
                      <CheckCircle2 size={16} />
                      <span>{twoFactorVerifyLoading ? 'Verifying code...' : 'Verify & Enable 2FA'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISABLE 2FA MODAL */}
      {showDisable2FAModal && (
        <div className="profile-modal-backdrop" onClick={() => setShowDisable2FAModal(false)}>
          <div className="profile-modal-dialog profile-disable-2fa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div className="profile-modal-title-wrap">
                <div className="profile-modal-icon-badge danger">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="profile-modal-title">Disable Two-Factor Authentication</h3>
                  <p className="profile-modal-subtitle">Turn off authenticator app verification</p>
                </div>
              </div>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowDisable2FAModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisable2FA} className="profile-disable-form">
              <div className="profile-disable-warning">
                <AlertCircle size={18} />
                <span>Disabling 2FA reduces account security. Anyone who knows your password can log in without a secondary check.</span>
              </div>

              {disableError && (
                <div className="profile-modal-error">
                  <AlertCircle size={16} />
                  <span>{disableError}</span>
                </div>
              )}

              <div className="profile-form-group">
                <label className="profile-label">Current Account Password</label>
                <input
                  type="password"
                  className="profile-input"
                  placeholder="Enter your current password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>

              <div className="profile-disable-or-divider">
                <span>OR</span>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Current 6-Digit Authenticator Code</label>
                <input
                  type="text"
                  maxLength={6}
                  className="profile-input"
                  placeholder="••••••"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="profile-modal-actions">
                <button
                  type="button"
                  className="profile-modal-cancel-btn"
                  onClick={() => setShowDisable2FAModal(false)}
                  disabled={disableLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="profile-modal-danger-btn"
                  disabled={disableLoading || (!disablePassword && !disableCode)}
                >
                  {disableLoading ? 'Disabling...' : 'Confirm & Turn Off 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
