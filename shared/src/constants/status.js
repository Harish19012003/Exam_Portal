/**
 * User account status values.
 * Used by: DB column, server validation, client status pills.
 */
export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
});

/**
 * Announcement priority levels.
 * Maps to color tokens: info / primary / warning / danger.
 */
export const ANNOUNCEMENT_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/**
 * Announcement lifecycle status.
 * Maps to color tokens: secondary / info / success / muted.
 */
export const ANNOUNCEMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  EXPIRED: 'expired',
});

/** User status values array */
export const USER_STATUS_VALUES = Object.values(USER_STATUS);

/** Announcement priority values array */
export const ANNOUNCEMENT_PRIORITY_VALUES = Object.values(ANNOUNCEMENT_PRIORITY);

/** Announcement status values array */
export const ANNOUNCEMENT_STATUS_VALUES = Object.values(ANNOUNCEMENT_STATUS);
