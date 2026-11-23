/**
 * Stable DynamicTable ids used for prefs namespaces (localStorage + SQL).
 * Add a new id whenever a portal page mounts another table.
 */
export const TABLE_IDS = Object.freeze({
  EXAMS: 'exam_management_v1',
  VENDORS: 'vendor_master_data_v4',
  DEVICES: 'device_master_v1',
  USERS: 'user_management_v1',
  SEQ_VIEW: 'seq_view_data_v1',
});
