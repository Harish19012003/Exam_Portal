import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const PLATFORM_DEFAULTS = {
  portal_name: 'Exam View',
  support_email: '',
  logo_url: '',
  favicon_url: '',
  default_timezone: 'Asia/Kolkata',
  maintenance: { enabled: false, message: '' },
};

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - UTC+05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST - UTC-05:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST - UTC+00:00)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST - UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT - UTC+08:00)' },
];

export const fetchPlatformSettings = async () => {
  const data = unwrap(await apiClient.get('/settings/platform'));
  return { ...PLATFORM_DEFAULTS, ...data, maintenance: { ...PLATFORM_DEFAULTS.maintenance, ...(data?.maintenance || {}) } };
};

/** Public branding for login / tab icon — no auth required. */
export const fetchPublicBranding = async () => {
  const data = unwrap(await apiClient.get('/settings/platform/branding'));
  return {
    portal_name: data?.portal_name || PLATFORM_DEFAULTS.portal_name,
    logo_url: data?.logo_url || '',
    favicon_url: data?.favicon_url || '',
  };
};

export const savePlatformSettings = async (settings) =>
  unwrap(await apiClient.put('/settings/platform', settings));

/** Short-lived signature so a super admin can upload the logo / favicon straight to Cloudinary. */
export const requestBrandingSignature = async (kind) =>
  unwrap(await apiClient.post('/settings/platform/branding/signature', { kind }));
