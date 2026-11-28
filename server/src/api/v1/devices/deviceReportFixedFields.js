/**
 * Hardcoded Date + Shift indicate on Device Master report tabs.
 * Stamped from the Param row used for each TrustView download.
 */

/** @typedef {{ id: string, key: string, label: string, dataType: string, order: number, required: boolean }} FixedFieldDef */

/** @type {FixedFieldDef[]} */
export const DEVICE_REPORT_FIXED_FIELDS = [
  { id: 'fixed_param_date', key: 'date', label: 'Date', dataType: 'date', order: 1, required: false },
  {
    id: 'fixed_param_shift',
    key: 'shift',
    label: 'Shift indicate',
    dataType: 'text',
    order: 2,
    required: false,
  },
];

export const DEVICE_REPORT_FIXED_KEYS = DEVICE_REPORT_FIXED_FIELDS.map((f) => f.key);
export const DEVICE_REPORT_FIXED_KEY_SET = new Set(DEVICE_REPORT_FIXED_KEYS);

export const isDeviceReportFixedView = (view) => {
  const key = String(view || '').trim();
  return Boolean(key) && key !== 'devices' && key !== 'center-csr-matching';
};

export const hardcodedDeviceReportFields = () => DEVICE_REPORT_FIXED_FIELDS.map((f) => ({ ...f }));

export const stripDeviceReportFixedFields = (fields = []) =>
  (Array.isArray(fields) ? fields : []).filter((f) => f?.key && !DEVICE_REPORT_FIXED_KEY_SET.has(f.key));

export const withHardcodedDeviceReportFields = (extras = []) => {
  const fixed = hardcodedDeviceReportFields();
  const rest = stripDeviceReportFixedFields(extras).map((f, i) => ({
    ...f,
    order: fixed.length + i + 1,
  }));
  return [...fixed, ...rest];
};
