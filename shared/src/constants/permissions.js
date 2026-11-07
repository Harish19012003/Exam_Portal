/**
 * Application permissions — single source of truth.
 * Format: MODULE_ACTION
 * Used by: server permission middleware, client usePermission hook, <Can /> component.
 */
export const PERMISSIONS = Object.freeze({
  // --- Users ---
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_STATUS: 'users:manage_status',
  USERS_DISABLE_2FA: 'users:disable_2fa',

  // --- Roles & Permissions ---
  ROLES_VIEW: 'roles:view',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  PERMISSIONS_ASSIGN: 'permissions:assign',

  // --- App Groups ---
  GROUPS_VIEW: 'groups:view',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',

  // --- Announcements ---
  ANNOUNCEMENTS_VIEW: 'announcements:view',
  ANNOUNCEMENTS_CREATE: 'announcements:create',
  ANNOUNCEMENTS_UPDATE: 'announcements:update',
  ANNOUNCEMENTS_DELETE: 'announcements:delete',

  // --- Notifications ---
  NOTIFICATIONS_VIEW: 'notifications:view',
  NOTIFICATIONS_SEND: 'notifications:send',

  // --- Settings ---
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',

  // --- Audit Logs ---
  AUDIT_LOGS_VIEW: 'audit_logs:view',

  // --- Search ---
  SEARCH: 'search',

  // --- Maps ---
  MAPS_VIEW: 'maps:view',

  // --- Dashboard ---
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_CUSTOMIZE: 'dashboard:customize',
});

/** All permission values as an array */
export const PERMISSION_VALUES = Object.values(PERMISSIONS);

/**
 * Rights matrix: one row per feature, with an optional View and an optional Edit right.
 * `edit` keeps the original ids (e.g. exams:manage) so rights already saved on users stay valid.
 */
export const RIGHTS_MATRIX = [
  { category: 'Users', label: 'Users', view: 'users:view', edit: 'users:update' },
  { category: 'Users', label: 'Create Users', edit: 'users:create' },
  { category: 'Users', label: 'Delete Users', edit: 'users:delete' },
  { category: 'Administration', label: 'Roles & Rights', view: 'roles:view', edit: 'roles:manage' },
  { category: 'Examinations', label: 'Exams', view: 'exams:view', edit: 'exams:manage' },
  { category: 'Examinations', label: 'Exam Day', view: 'examday:view', edit: 'examday:manage' },
  { category: 'Vendors', label: 'Vendor Database', view: 'vendors:view', edit: 'vendors:manage' },
  { category: 'SeqView', label: 'SeqView Data', view: 'seqviews:view', edit: 'seqviews:manage' },
  { category: 'System', label: 'System Settings', view: 'settings:view', edit: 'settings:manage' },
  { category: 'Security', label: 'Audit Logs', view: 'audit_logs:view' },
];

/** Standard selectable rights/permissions (flat list derived from the matrix). */
export const AVAILABLE_RIGHTS = RIGHTS_MATRIX.flatMap((row) => [
  ...(row.view ? [{ id: row.view, label: `View ${row.label}`, category: row.category }] : []),
  ...(row.edit ? [{ id: row.edit, label: `Edit ${row.label}`, category: row.category }] : []),
]);

/** Default rights assigned to roles */
export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: AVAILABLE_RIGHTS.map((r) => r.id),
  global_admin: [
    'users:view',
    'users:create',
    'users:update',
    'roles:view',
    'exams:view',
    'exams:manage',
    'examday:view',
    'examday:manage',
    'vendors:view',
    'vendors:manage',
    'seqviews:view',
    'seqviews:manage',
    'settings:view',
    'settings:manage',
    'audit_logs:view',
  ],
  admin: [
    'users:view',
    'exams:view',
    'exams:manage',
    'examday:view',
    'examday:manage',
    'vendors:view',
    'vendors:manage',
    'seqviews:view',
    'seqviews:manage',
  ],
  user: [
    'exams:view',
  ],
};
