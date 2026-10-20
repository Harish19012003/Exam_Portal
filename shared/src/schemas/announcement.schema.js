import { z } from 'zod';
import {
  ANNOUNCEMENT_PRIORITY_VALUES,
  ANNOUNCEMENT_STATUS_VALUES,
} from '../constants/status.js';

/**
 * Schema for creating or updating an announcement.
 */
export const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  content: z.string().min(1, 'Content is required'),
  actionUrl: z.string().url('Must be a valid URL').optional().nullable(),
  priority: z.enum(
    /** @type {[string, ...string[]]} */ (ANNOUNCEMENT_PRIORITY_VALUES)
  ),
  displayLine: z
    .boolean()
    .default(false)
    .describe('Show in the announcement strip under the header'),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(
    /** @type {[string, ...string[]]} */ (ANNOUNCEMENT_STATUS_VALUES)
  ).default('draft'),
});

/**
 * Schema for updating an announcement (all fields optional + version for optimistic lock).
 */
export const updateAnnouncementSchema = announcementSchema
  .partial()
  .extend({
    version: z.number().int().positive('Version is required for update'),
  });
