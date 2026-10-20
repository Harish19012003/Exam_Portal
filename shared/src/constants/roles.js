/**
 * User roles — single source of truth.
 * Used by: server middleware, client <Can />, shared Zod schemas.
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  GLOBAL_ADMIN: 'global_admin',
  ADMIN: 'admin',
  USER: 'user',
});

/** All role values as an array (useful for Zod .enum()) */
export const ROLE_VALUES = Object.values(ROLES);
