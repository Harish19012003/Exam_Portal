import { z } from 'zod';
import { USER_STATUS_VALUES } from '../constants/status.js';
import { ROLE_VALUES } from '../constants/roles.js';

/**
 * Schema for creating a new user (admin action).
 */
export const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email required').max(255),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Valid phone number required')
    .optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(/** @type {[string, ...string[]]} */ (ROLE_VALUES)),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  status: z.enum(/** @type {[string, ...string[]]} */ (USER_STATUS_VALUES)).default('active'),
});

/**
 * Schema for updating an existing user.
 */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .optional()
    .nullable(),
  role: z.enum(/** @type {[string, ...string[]]} */ (ROLE_VALUES)).optional(),
  timezone: z.string().optional(),
  status: z
    .enum(/** @type {[string, ...string[]]} */ (USER_STATUS_VALUES))
    .optional(),
  version: z.number().int().positive('Version is required for update'),
});

/**
 * Schema for updating user status (active/inactive/suspended).
 */
export const updateUserStatusSchema = z.object({
  status: z.enum(/** @type {[string, ...string[]]} */ (USER_STATUS_VALUES)),
  version: z.number().int().positive(),
});
