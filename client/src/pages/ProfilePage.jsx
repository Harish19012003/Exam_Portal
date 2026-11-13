import React, { useState, useEffect, useRef } from 'react';
import { useUrlState } from '../hooks/useUrlState';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { PageHeading, PageShell } from '../components/PageHeading';
import { DynamicDropdown } from '../components/DynamicData';
import {
  requestAvatarSignature,
  uploadAvatarToCloudinary,
  saveAvatar,
  removeAvatar,
} from '../api/avatarApi';
import { optimizedAvatarUrl, validateAvatarFile } from '../utils/avatarImage';
import { ImageCropDialog } from '../components/ImageCropDialog';
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
  CalendarDays,
  Camera,
  Trash2,
  Loader2,
  Users,
  FileText,
  Building2,
  Settings,
  ScrollText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import './ProfilePage.css';

/** Timezone choices: `value` is stored on the profile, `label` is what the dropdown shows. */
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - UTC+05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST - UTC-05:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST - UTC+00:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST - UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT - UTC+08:00)' },
];
const TIMEZONE_LABELS = TIMEZONE_OPTIONS.map((o) => o.label);

/** Panel title row: icon tile, title + subtitle, optional status on the right. */
const PanelHeader = ({ icon: Icon, title, subtitle, aside }) => (
  <div className="profile-panel-header">
    <span className="profile-panel-icon"><Icon size={20} aria-hidden="true" /></span>
    <div className="profile-panel-heading">
      <h2 className="profile-panel-title">{title}</h2>
      <p className="profile-panel-subtitle">{subtitle}</p>
    </div>
    {aside}
  </div>
);

/** 0-4 score + label for the new-password meter (length, variety). Purely advisory. */
const passwordStrength = (pw) => {
  if (!pw) {
    return { score: 0, label: '' };
  }
  let score = 0;
  if (pw.length >= 8) { score += 1; }
  if (pw.length >= 12) { score += 1; }
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) { score += 1; }
  if (/[^A-Za-z0-9]/.test(pw)) { score += 1; }
  if (pw.length < 8) { score = Math.min(score, 1); }
  return { score, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score] };
};

/** `users:view` -> { area: 'users', action: 'view' }; grouped for display. */
const ACTION_LABELS = { view: 'View', create: 'Create', update: 'Edit', delete: 'Delete', manage: 'Manage' };
/** Visual weight of an action: read-only is calm, destructive is red. */
const ACTION_TONES = { view: 'info', create: 'ok', update: 'warn', delete: 'danger', manage: 'primary' };
const ACTION_ORDER = ['view', 'create', 'update', 'delete', 'manage'];
const AREA_ICONS = {
  users: Users,
  roles: ShieldCheck,
  exams: FileText,
  vendors: Building2,
  settings: Settings,
  audit_logs: ScrollText,
};
const titleCase = (text) => String(text).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const groupPermissions = (list) => {
  const groups = new Map();
  list.forEach((code) => {
    const [areaRaw, actionRaw] = String(code).split(':');
    const area = actionRaw ? areaRaw : 'other';
    const action = actionRaw || areaRaw;
    if (!groups.has(area)) {
      groups.set(area, []);
    }
    groups.get(area).push({ code: String(code), action, label: ACTION_LABELS[action] || titleCase(action) });
  });
  return [...groups.entries()].map(([area, items]) => ({ area, title: titleCase(area), items }));
};

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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [permQuery, setPermQuery] = useState('');
  const [permAction, setPermAction] = useState('all');
  const avatarInputRef = useRef(null);
  const [avatarPicked, setAvatarPicked] = useState(null);
  const avatarMenuRef = useRef(null);
  const avatarTriggerRef = useRef(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  // Close the photo menu on outside click or Escape (focus returns to the camera button).
  useEffect(() => {
    if (!avatarMenuOpen) {
      return undefined;
    }
    const onPointerDown = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAvatarMenuOpen(false);
        avatarTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen]);
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  useEffect(() => {
    const syncTheme = () => {
      const root = document.documentElement;
      setIsDarkMode(root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark'));
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);
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
  const [activeTab, setActiveTab] = useUrlState('tab', 'details', ['details', 'security', 'permissions']);

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
      window.dispatchEvent(new Event('user-profile-updated'));

      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  /** Keep the cached user (used by the sidebar) and local profile in sync with the new picture. */
  const applyAvatar = (url) => {
    setProfile((prev) => ({ ...prev, avatar_url: url || null }));
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, avatar_url: url || null }));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event('user-profile-updated'));
  };

  const handleAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSuccessMsg('');
    setError('');
    try {
      validateAvatarFile(file);
      setAvatarPicked(file);
    } catch (err) {
      setError(err.message || 'Could not open that image');
    }
  };

  // Called by the crop dialog: only the adjusted square is uploaded.
  const uploadCroppedAvatar = async (cropped) => {
    setAvatarBusy(true);
    try {
      const signature = await requestAvatarSignature();
      const uploaded = await uploadAvatarToCloudinary(cropped, signature);
      const saved = await saveAvatar({ secure_url: uploaded.secure_url, public_id: uploaded.public_id });
      applyAvatar(saved?.avatar_url || uploaded.secure_url);
      setSuccessMsg('Profile photo updated');
      setTimeout(() => setSuccessMsg(''), 4000);
      setAvatarPicked(null);
    } catch (err) {
      setAvatarPicked(null);
      setError(err.response?.data?.message || err.message || 'Could not upload your photo');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setSuccessMsg('');
    setError('');
    setAvatarBusy(true);
    try {
      await removeAvatar();
      applyAvatar(null);
      setSuccessMsg('Profile photo removed');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not remove your photo');
    } finally {
      setAvatarBusy(false);
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
  // Save stays disabled until something actually differs from what is stored.
  const dirty =
    !!profile &&
    (firstName !== (profile.first_name || '') ||
      lastName !== (profile.last_name || '') ||
      phone !== (profile.phone_number || '') ||
      timezone !== (profile.timezone || 'Asia/Kolkata'));
  const completenessChecks = [
    { label: 'name', done: Boolean(profile?.first_name && profile?.last_name) },
    { label: 'phone number', done: Boolean(profile?.phone_number) },
    { label: 'timezone', done: Boolean(profile?.timezone) },
    { label: 'profile photo', done: Boolean(profile?.avatar_url) },
  ];
  const completenessPct = Math.round((completenessChecks.filter((c) => c.done).length / completenessChecks.length) * 100);
  const missingBits = completenessChecks.filter((c) => !c.done).map((c) => c.label);
  const strength = passwordStrength(newPassword);
  const passwordsMatch = confirmPassword !== '' && newPassword === confirmPassword;
  const passwordReady = newPassword.length >= 8 && passwordsMatch;
  const permQueryNorm = permQuery.trim().toLowerCase();
  const allPermissionGroups = groupPermissions(permissionsList);
  const permActionCounts = permissionsList.reduce((acc, code) => {
    const action = String(code).includes(':') ? String(code).split(':')[1] : String(code);
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});
  const availableActions = ACTION_ORDER.filter((a) => permActionCounts[a]);
  const permissionGroups = allPermissionGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (permAction === 'all' || item.action === permAction) &&
          (!permQueryNorm ||
            item.code.toLowerCase().includes(permQueryNorm) ||
            item.label.toLowerCase().includes(permQueryNorm) ||
            group.title.toLowerCase().includes(permQueryNorm)),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const handleDiscard = () => {
    setFirstName(profile?.first_name || '');
    setLastName(profile?.last_name || '');
    setPhone(profile?.phone_number || '');
    setTimezone(profile?.timezone || 'Asia/Kolkata');
  };

  return (
    <PageShell className="profile-page">
      <PageHeading
        title="Profile & Security"
        subtitle="Manage your personal details, password and access rights"
      />

      <div className="profile-layout">
      <aside className="profile-aside">
      <div className="profile-header-card">
        <div className="profile-avatar-container">
          <div className={`profile-avatar-circle ${avatarBusy ? 'busy' : ''}`}>
            {profile?.avatar_url ? (
              <a
                href={profile.avatar_url}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-avatar-link"
                title="View full photo"
              >
                <img
                  className="profile-avatar-img"
                  src={optimizedAvatarUrl(profile.avatar_url)}
                  alt={`${displayName} profile photo`}
                  width={96}
                  height={96}
                  decoding="async"
                />
              </a>
            ) : (
              <span aria-hidden="true">{avatarLetter}</span>
            )}
            {avatarBusy && (
              <span className="profile-avatar-spinner" role="status" aria-label="Uploading photo">
                <Loader2 size={22} className="profile-spin" />
              </span>
            )}
          </div>
          <span className="profile-status-indicator" title="Active" />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="profile-avatar-file"
            onChange={handleAvatarSelected}
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="profile-avatar-menu-wrap" ref={avatarMenuRef}>
            <button
              ref={avatarTriggerRef}
              type="button"
              className="profile-avatar-btn"
              onClick={() => setAvatarMenuOpen((open) => !open)}
              disabled={avatarBusy}
              aria-haspopup="menu"
              aria-expanded={avatarMenuOpen}
              aria-label="Profile photo options"
              title="Profile photo"
            >
              <Camera size={14} aria-hidden="true" />
            </button>
            {avatarMenuOpen && (
              <div className="profile-avatar-menu" role="menu" aria-label="Profile photo">
                <button
                  type="button"
                  role="menuitem"
                  className="profile-avatar-menu-item"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    avatarInputRef.current?.click();
                  }}
                >
                  <Camera size={15} aria-hidden="true" />
                  <span>{profile?.avatar_url ? 'Upload new photo' : 'Upload photo'}</span>
                </button>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    role="menuitem"
                    className="profile-avatar-menu-item danger"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      handleAvatarRemove();
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>Remove photo</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
              <span className="profile-meta-icon"><Mail size={15} aria-hidden="true" /></span>
              <span className="profile-meta-body">
                <span className="profile-meta-label">Email</span>
                <span className="profile-meta-text">{profile?.email}</span>
              </span>
            </span>
            {profile?.phone_number && (
              <span className="profile-meta-item">
                <span className="profile-meta-icon"><Phone size={15} aria-hidden="true" /></span>
                <span className="profile-meta-body">
                  <span className="profile-meta-label">Phone</span>
                  <span className="profile-meta-text">{profile.phone_number}</span>
                </span>
              </span>
            )}
            <span className="profile-meta-item">
              <span className="profile-meta-icon"><Globe size={15} aria-hidden="true" /></span>
              <span className="profile-meta-body">
                <span className="profile-meta-label">Timezone</span>
                <span className="profile-meta-text">{profile?.timezone || 'Asia/Kolkata'}</span>
              </span>
            </span>
            <span className="profile-meta-item">
              <span className="profile-meta-icon"><Clock size={15} aria-hidden="true" /></span>
              <span className="profile-meta-body">
                <span className="profile-meta-label">Last active</span>
                <span className="profile-meta-text">
                  {profile?.last_active_at && !Number.isNaN(new Date(profile.last_active_at).getTime())
                    ? new Date(profile.last_active_at).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Active now'}
                </span>
              </span>
            </span>
          </div>
        </div>

        <div className="profile-stats" aria-label="Account summary">
          <button
            type="button"
            className="profile-stat profile-stat--link tone-primary"
            title="View your rights and permissions"
            onClick={() => setActiveTab('permissions')}
          >
            <span className="profile-stat-icon"><Shield size={15} aria-hidden="true" /></span>
            <span className="profile-stat-value">{permissionsList.length}</span>
            <span className="profile-stat-label">Permissions</span>
          </button>
          <button
            type="button"
            className={`profile-stat profile-stat--link ${profile?.two_factor_enabled ? 'tone-ok' : 'tone-warn'}`}
            title="Manage two-factor sign-in"
            onClick={() => setActiveTab('security')}
          >
            <span className="profile-stat-icon"><Lock size={15} aria-hidden="true" /></span>
            <span className="profile-stat-value">{profile?.two_factor_enabled ? 'On' : 'Off'}</span>
            <span className="profile-stat-label">Two-factor</span>
          </button>
          {profile?.created_at && !Number.isNaN(new Date(profile.created_at).getTime()) && (
            <div className="profile-stat tone-info">
              <span className="profile-stat-icon"><CalendarDays size={15} aria-hidden="true" /></span>
              <span className="profile-stat-value">
                {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
              <span className="profile-stat-label">Joined</span>
            </div>
          )}
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
          <span className="profile-tab-text">
            <span className="profile-tab-title">Personal Details</span>
            <span className="profile-tab-desc">Name, phone and timezone</span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <KeyRound size={16} aria-hidden="true" />
          <span className="profile-tab-text">
            <span className="profile-tab-title">Security & Password</span>
            <span className="profile-tab-desc">Password and two-factor sign-in</span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'permissions'}
          className={`profile-tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          <Shield size={16} aria-hidden="true" />
          <span className="profile-tab-text">
            <span className="profile-tab-title">
              <span className="profile-tab-label-full">Rights & Permissions ({permissionsList.length})</span>
              <span className="profile-tab-label-short">Rights ({permissionsList.length})</span>
            </span>
            <span className="profile-tab-desc">What you can access</span>
          </span>
        </button>
      </div>
      </aside>

      <div className="profile-main">
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
          <PanelHeader
            icon={User}
            title="Personal Information"
            subtitle="Manage your personal details and account preferences"
            aside={(
              <div className="profile-completeness" title={missingBits.length ? `Still missing: ${missingBits.join(', ')}` : 'Everything is filled in'}>
                <div className="profile-completeness-top">
                  <span>Profile {completenessPct}% complete</span>
                </div>
                <div className="profile-completeness-bar" role="progressbar" aria-valuenow={completenessPct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
                  <span style={{ width: `${completenessPct}%` }} />
                </div>
                {missingBits.length > 0 && <span className="profile-completeness-hint">Add your {missingBits[0]} to finish</span>}
              </div>
            )}
          />

          <form className="profile-form" onSubmit={handleUpdateProfile}>
            <div className="profile-form-grid">
              <div className="profile-section-head full-width">
                <h3 className="profile-section-title">Basic information</h3>
                <p className="profile-section-desc">Your name as it appears across the portal.</p>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">First Name</label>
                <div className="profile-field">
                  <User size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="profile-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Last Name</label>
                <div className="profile-field">
                  <User size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="profile-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="profile-section-head full-width">
                <h3 className="profile-section-title">Contact</h3>
                <p className="profile-section-desc">Your email is verified and can't be changed here.</p>
              </div>

              <div className="profile-form-group">
                <label className="profile-label">Email Address</label>
                <div className="profile-input-readonly profile-field">
                  <Mail size={16} className="profile-field-icon" aria-hidden="true" />
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
                <div className="profile-field">
                  <Phone size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="profile-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="profile-section-head full-width">
                <h3 className="profile-section-title">Preferences</h3>
                <p className="profile-section-desc">Choose the timezone that suits you.</p>
              </div>

              <div className="profile-form-group full-width">
                <label className="profile-label">Timezone</label>
                <div className="profile-field">
                <Globe size={16} className="profile-field-icon" aria-hidden="true" />
                <DynamicDropdown
                  variant="form"
                  required
                  className="profile-dd"
                  isDarkMode={isDarkMode}
                  options={TIMEZONE_LABELS}
                  value={TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label || timezone}
                  onChange={(label) => {
                    const next = TIMEZONE_OPTIONS.find((o) => o.label === label);
                    if (next) setTimezone(next.value);
                  }}
                  minMenuWidth={260}
                />
                </div>
              </div>
            </div>

            <div className={`profile-form-actions ${dirty ? 'is-dirty' : ''}`}>
              <span className={`profile-dirty-hint ${dirty ? 'show' : ''}`} role="status">
                {dirty ? 'You have unsaved changes' : 'All changes saved'}
              </span>
              <div className="profile-form-buttons">
                {dirty && (
                  <button type="button" className="profile-discard-btn" onClick={handleDiscard} disabled={saving}>
                    Discard
                  </button>
                )}
              <button type="submit" className="profile-save-btn" disabled={saving || !dirty}>
                <Save size={16} />
                <span>{saving ? 'Saving changes...' : 'Save Changes'}</span>
              </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT 2: SECURITY */}
      {activeTab === 'security' && (
        <div className="profile-panel">
          <PanelHeader
            icon={KeyRound}
            title="Security & Password"
            subtitle="Update your password and review your account security status"
            aside={(
              <span className={`profile-chip ${profile?.two_factor_enabled ? 'ok' : 'warn'}`}>
                <ShieldCheck size={14} aria-hidden="true" />
                {profile?.two_factor_enabled ? 'Two-factor on' : 'Two-factor off'}
              </span>
            )}
          />

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
              <div className="profile-section-head full-width">
                <h3 className="profile-section-title">Change password</h3>
                <p className="profile-section-desc">Use at least 8 characters. A longer, unique password is safer.</p>
              </div>

              <div className="profile-form-group">
                <label className="profile-label" htmlFor="pf-new-password">New Password</label>
                <div className="profile-password-wrap profile-field">
                  <KeyRound size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    id="pf-new-password"
                    type={showPassword ? 'text' : 'password'}
                    className="profile-input password-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="profile-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="profile-strength" role="status" aria-live="polite">
                    <div className="profile-strength-bars" aria-hidden="true">
                      {[1, 2, 3, 4].map((n) => (
                        <span key={n} className={`profile-strength-bar ${strength.score >= n ? `on s${strength.score}` : ''}`} />
                      ))}
                    </div>
                    <span className={`profile-strength-label s${strength.score}`}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div className="profile-form-group">
                <label className="profile-label" htmlFor="pf-confirm-password">Confirm New Password</label>
                <div className="profile-field">
                  <Lock size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    id="pf-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="profile-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                  />
                </div>
                {confirmPassword && (
                  <span className={`profile-match ${passwordsMatch ? 'ok' : 'bad'}`} role="status">
                    {passwordsMatch ? <Check size={13} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
                  </span>
                )}
              </div>
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="profile-save-btn"
                disabled={passwordSaving || !passwordReady}
              >
                <Lock size={16} />
                <span>{passwordSaving ? 'Updating password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>

          <div className="profile-section-head profile-section-head--standalone">
            <h3 className="profile-section-title">Two-factor authentication</h3>
            <p className="profile-section-desc">Protect sign-in with a code from an authenticator app.</p>
          </div>

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
          <PanelHeader
            icon={Shield}
            title="Assigned Permissions & Rights"
            subtitle="Access privileges granted to your account role"
            aside={(
              <span className="profile-chip">
                <Shield size={14} aria-hidden="true" />
                {permissionsList.length} {permissionsList.length === 1 ? 'permission' : 'permissions'} · {allPermissionGroups.length} {allPermissionGroups.length === 1 ? 'area' : 'areas'}
              </span>
            )}
          />

          {permissionsList.length > 0 && (
            <div className="profile-perm-toolbar">
              {availableActions.length > 1 ? (
                <div className="profile-perm-filters" role="group" aria-label="Filter by action">
                  <button
                    type="button"
                    className={`profile-perm-filter ${permAction === 'all' ? 'active' : ''}`}
                    aria-pressed={permAction === 'all'}
                    title={`${permissionsList.length} permissions across ${allPermissionGroups.length} areas`}
                    onClick={() => setPermAction('all')}
                  >
                    All <span>{permissionsList.length}</span>
                  </button>
                  {availableActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`profile-perm-filter tone-${ACTION_TONES[action]} ${permAction === action ? 'active' : ''}`}
                      aria-pressed={permAction === action}
                      onClick={() => setPermAction(permAction === action ? 'all' : action)}
                    >
                      {ACTION_LABELS[action]} <span>{permActionCounts[action]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="profile-perm-summary">
                  <strong>{permissionsList.length}</strong> {permissionsList.length === 1 ? 'permission' : 'permissions'}
                </span>
              )}
              {permissionsList.length > 8 && (
                <div className="profile-field profile-perm-search">
                  <Search size={16} className="profile-field-icon" aria-hidden="true" />
                  <input
                    type="search"
                    className="profile-input"
                    value={permQuery}
                    onChange={(e) => setPermQuery(e.target.value)}
                    placeholder="Search permissions"
                    aria-label="Search permissions"
                  />
                </div>
              )}
            </div>
          )}

          {permissionsList.length === 0 ? (
            <p className="profile-empty-text">No explicit rights assigned</p>
          ) : permissionGroups.length === 0 ? (
            <p className="profile-empty-text">
              No permissions match{permQuery ? ` "${permQuery}"` : ' this filter'}.
            </p>
          ) : (
            <div className="profile-perm-groups">
              {permissionGroups.map((group) => {
                const AreaIcon = AREA_ICONS[group.area] || Shield;
                return (
                  <section key={group.area} className={`profile-perm-group ${group.items.length === 1 ? 'is-single' : ''}`}>
                    <header className="profile-perm-group-head">
                      <span className="profile-perm-group-icon"><AreaIcon size={16} aria-hidden="true" /></span>
                      <h3 className="profile-perm-group-title">{group.title}</h3>
                      <span className="profile-perm-count">{group.items.length}</span>
                    </header>
                    <ul className="profile-perm-list">
                      {group.items.map((item) => (
                        <li key={item.code} className={`profile-perm-row tone-${ACTION_TONES[item.action] || 'primary'}`} title={item.code}>
                          <span className="profile-perm-check"><Check size={13} aria-hidden="true" /></span>
                          <span className="profile-perm-label">{item.label}</span>
                          <code className="profile-perm-code">{item.code}</code>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      </div>
      </div>

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
      {avatarPicked && (
        <ImageCropDialog
          file={avatarPicked}
          title="Adjust your photo"
          outputSize={512}
          shapes={['square']}
          defaultShape="square"
          previewSizes={[96, 40]}
          onCancel={() => setAvatarPicked(null)}
          onConfirm={uploadCroppedAvatar}
        />
      )}
    </PageShell>
  );
};
