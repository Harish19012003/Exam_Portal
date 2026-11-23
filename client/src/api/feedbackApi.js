import { apiClient } from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const FEEDBACK_STATUS = [
  { value: 'new', label: 'New', tone: 'blue' },
  { value: 'in_review', label: 'In review', tone: 'violet' },
  { value: 'planned', label: 'Planned', tone: 'slate' },
  { value: 'in_progress', label: 'In progress', tone: 'amber' },
  { value: 'resolved', label: 'Resolved', tone: 'green' },
  { value: 'wont_do', label: "Won't do", tone: 'gray' },
];

export const FEEDBACK_PRIORITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical', bugOnly: true },
];

export const statusMeta = (value) => FEEDBACK_STATUS.find((s) => s.value === value) || FEEDBACK_STATUS[0];
export const priorityLabel = (value) => FEEDBACK_PRIORITY.find((p) => p.value === value)?.label || 'Medium';

export const createFeedback = async (payload) => unwrap(await apiClient.post('/feedback', payload));
export const listMyFeedback = async () => unwrap(await apiClient.get('/feedback/mine')) || [];
export const listAllFeedback = async () => unwrap(await apiClient.get('/feedback')) || [];
export const updateFeedback = async (id, patch) =>
  unwrap(await apiClient.patch(`/feedback/${encodeURIComponent(id)}`, patch));
export const deleteFeedback = async (id) => unwrap(await apiClient.delete(`/feedback/${encodeURIComponent(id)}`));
