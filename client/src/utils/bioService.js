/** True when the exam/service value is Bio-Metric (any common spelling). */
export const isBioMetricService = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (!key) return false;
  return key === 'bio-metric' || key === 'biometric' || key.includes('bio-metric') || key.includes('biometric');
};
