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
 * Standard selectable rights/permissions for user administration
 */
export const AVAILABLE_RIGHTS = [
  { id: 'users:view', label: 'View Users', category: 'Users' },
  { id: 'users:create', label: 'Create Users', category: 'Users' },
  { id: 'users:update', label: 'Update Users', category: 'Users' },
  { id: 'users:delete', label: 'Delete Users', category: 'Users' },
  { id: 'roles:manage', label: 'Manage Roles & Rights', category: 'Administration' },
  { id: 'exams:manage', label: 'Manage Exams', category: 'Examinations' },
  { id: 'vendors:manage', label: 'Manage Vendor Database', category: 'Vendors' },
  { id: 'seqviews:manage', label: 'Manage SeqView Data', category: 'SeqView' },
  { id: 'settings:manage', label: 'System Settings', category: 'System' },
  { id: 'audit_logs:view', label: 'View Audit Logs', category: 'Security' },
];

/** Default rights assigned to roles */
export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: AVAILABLE_RIGHTS.map((r) => r.id),
  global_admin: [
    'users:view',
    'users:create',
    'users:update',
    'exams:manage',
    'vendors:manage',
    'seqviews:manage',
    'settings:manage',
    'audit_logs:view',
  ],
  admin: [
    'users:view',
    'exams:manage',
    'vendors:manage',
    'seqviews:manage',
  ],
  user: [
    'exams:view',
  ],
};
