/**
 * Columns we want when Device Master pulls TrustView
 * `GET …/exceldownload` (e.g. type=operator_details / currentshift sheet).
 *
 * `key` is matched against response headers (case-insensitive), same as field key/label
 * in device-api `mapItems`. Confirm `shift_code` header via Test request — that sheet
 * column often has no header in Excel.
 *
 * Applied on empty Device Master (see DeviceMasterPage).
 */

/** @typedef {{ key: string, label: string, dataType: string, order: number, sample?: string }} DeviceApiImportColumn */

/** @type {DeviceApiImportColumn[]} */
export const DEVICE_API_IMPORT_COLUMNS = [
  {
    key: 'currentshift',
    label: 'Shift type',
    dataType: 'text',
    order: 1,
    sample: 'TS',
  },
  {
    key: 'shift_code',
    label: 'Shift code',
    dataType: 'text',
    order: 2,
    sample: '66939',
  },
  {
    key: 'date',
    label: 'Date',
    dataType: 'date',
    order: 3,
    sample: '11/19/2026',
  },
  {
    key: 'shift',
    label: 'Shift indicate',
    dataType: 'text',
    order: 4,
    sample: 'S1 Scan',
  },
];

const newFieldId = () => `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/** Turn the stub into Device Master field definitions (ready to save later). */
export const buildDeviceApiImportFields = (columns = DEVICE_API_IMPORT_COLUMNS) =>
  (Array.isArray(columns) ? columns : []).map((col, i) => ({
    id: newFieldId(),
    key: col.key,
    label: col.label,
    dataType: col.dataType || 'text',
    required: false,
    order: col.order ?? i + 1,
  }));
