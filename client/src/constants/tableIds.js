/**
 * Stable DynamicTable ids used for prefs namespaces (localStorage + SQL).
 * Add a new id whenever a portal page mounts another table.
 */
export const TABLE_IDS = Object.freeze({
  EXAMS: 'exam_management_v1',
  VENDORS: 'vendor_master_data_v4',
  DEVICES: 'device_master_v1',
  CENTER_CSR_MATCHING: 'center_csr_matching_v1',
  DEVICE_STATS_CENTER: 'device_stats_center_v1',
  DEVICE_OPRSUMMARY: 'device_oprsummary_v1',
  DEVICE_SYNC_PENDING: 'device_sync_pending_v1',
  DEVICE_DATA_DOWNLOAD: 'device_data_download_v1',
  DEVICE_TRAINING: 'device_training_v1',
  DEVICE_NON_AADHAAR_ENROLLMENTS: 'device_non_aadhaar_enrollments_v1',
  DEVICE_AADHAAR_ENROLLMENTS: 'device_aadhaar_enrollments_v1',
  DEVICE_CSR: 'device_csr_v1',
  DEVICE_MODALITY_REPORT: 'device_modality_report_v1',
  DEVICE_MODALITY_SUMMARY: 'device_modality_summary_v1',
  DEVICE_AADHAAR_FAILED_REASON: 'device_aadhaar_failed_reason_v1',
  USERS: 'user_management_v1',
  SEQ_VIEW: 'seq_view_data_v1',
});
