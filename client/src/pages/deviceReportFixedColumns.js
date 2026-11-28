/**
 * Hardcoded columns on Device Master report-tab presets (Stats Center, Training, …).
 * Values are stamped from the Param row used for each TrustView fetch — not from the API CSV.
 * Param (`devices`) and Center-CSR-Matching keep their own column rules.
 */

/** @typedef {{ id: string, key: string, label: string, dataType: string, order: number, required?: boolean }} DeviceReportFixedColumn */

/** @type {DeviceReportFixedColumn[]} */
export const DEVICE_REPORT_FIXED_COLUMNS = [
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

export const DEVICE_REPORT_FIXED_KEYS = DEVICE_REPORT_FIXED_COLUMNS.map((c) => c.key);
export const DEVICE_REPORT_FIXED_KEY_SET = new Set(DEVICE_REPORT_FIXED_KEYS);

/** Tabs that get Param date + shift indicate as fixed columns. */
export const isDeviceReportFixedView = (view) => {
  const key = String(view || '').trim();
  return Boolean(key) && key !== 'devices' && key !== 'center-csr-matching';
};

export const DEVICE_REPORT_RESERVED_KEYS = [
  'id',
  'version',
  'created_at',
  'updated_at',
  ...DEVICE_REPORT_FIXED_KEYS,
];

export const hardcodedDeviceReportFields = () => DEVICE_REPORT_FIXED_COLUMNS.map((f) => ({ ...f }));

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
