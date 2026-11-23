import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const SUPPORT_DEFAULTS = {
  intro: '',
  email: '',
  phone: '',
  whatsapp: '',
  hours: '',
  links: [],
  faqs: [],
};

const normalize = (data) => ({
  ...SUPPORT_DEFAULTS,
  ...(data && typeof data === 'object' ? data : {}),
  links: Array.isArray(data?.links) ? data.links : [],
  faqs: Array.isArray(data?.faqs) ? data.faqs : [],
});

export const fetchSupportSettings = async () => normalize(unwrap(await apiClient.get('/settings/support')));

export const saveSupportSettings = async (settings) =>
  normalize(unwrap(await apiClient.put('/settings/support', settings)));
