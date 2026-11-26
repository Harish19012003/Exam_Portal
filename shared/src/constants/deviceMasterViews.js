/** Default Device Master tab. */
export const DEFAULT_DEVICE_MASTER_VIEW = 'devices';

/**
 * Device Master operational views (sidebar + /device-master/:subTab).
 * Row data for bio-scoped tabs lives in Mongo collections named `device_*`
 * (plus `device_*_meta` for field layout), keyed by exam_id.
 */
export const DEVICE_MASTER_VIEWS = [
  { key: 'devices', label: 'Param', collection: 'device_param', examScoped: true },
  {
    key: 'stats-center',
    label: 'Stats Center',
    collection: 'device_stats_center',
    examScoped: true,
  },
  {
    key: 'oprsummary',
    label: 'Oprsummary',
    collection: 'device_oprsummary',
    examScoped: true,
  },
  {
    key: 'sync-pending',
    label: 'Sync Pending',
    collection: 'device_sync_pending',
    examScoped: true,
  },
  {
    key: 'data-download',
    label: 'Data Download',
    collection: 'device_data_download',
    examScoped: true,
  },
  {
    key: 'training',
    label: 'Training',
    collection: 'device_training',
    examScoped: true,
  },
  {
    key: 'non-aadhaar-enrollments',
    label: 'Non Aadhaar Enrollments',
    collection: 'device_non_aadhaar_enrollments',
    examScoped: true,
  },
  {
    key: 'aadhaar-enrollments',
    label: 'Aadhaar Enrollments',
    collection: 'device_aadhaar_enrollments',
    examScoped: true,
  },
  { key: 'csr', label: 'CSR', collection: 'device_csr', examScoped: true },
  {
    key: 'center-csr-matching',
    label: 'Center-CSR-Matching',
    collection: 'device_center_csr_matching',
    examScoped: true,
  },
  { key: 'modality-report', label: 'Modality Report', collection: 'device_modality_report' },
  { key: 'modality-summary', label: 'Modality Summary', collection: 'device_modality_summary' },
  {
    key: 'aadhaar-failed-reason',
    label: 'Aadhaar Failed Reason',
    collection: 'device_aadhaar_failed_reason',
  },
];

export const DEVICE_MASTER_VIEW_KEYS = DEVICE_MASTER_VIEWS.map((v) => v.key);

/** Tabs that get a dedicated `device_*` (+ meta) collection scaffold. */
export const DEVICE_TAB_COLLECTIONS = DEVICE_MASTER_VIEWS.filter(
  (v) =>
    v.collection &&
    String(v.collection).startsWith('device_') &&
    // Already have hand-written entities (Device / CenterCsrMatching).
    v.key !== 'devices' &&
    v.key !== 'center-csr-matching',
);

export const isDeviceMasterViewKey = (view) =>
  DEVICE_MASTER_VIEW_KEYS.includes(String(view || '').trim());

export const deviceMasterViewLabel = (view) => {
  const key = String(view || '').trim();
  return DEVICE_MASTER_VIEWS.find((v) => v.key === key)?.label || key || 'Device page';
};

export const deviceMasterCollection = (view) => {
  const key = String(view || '').trim();
  return DEVICE_MASTER_VIEWS.find((v) => v.key === key)?.collection || '';
};

/** Access / table id: stats-center → device_stats_center */
export const deviceMasterTableId = (view) => {
  const collection = deviceMasterCollection(view);
  if (collection && String(collection).startsWith('device_')) return collection;
  const key = String(view || '').trim().replace(/-/g, '_');
  return key ? `device_${key}` : '';
};
