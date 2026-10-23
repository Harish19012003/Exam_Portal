import { z } from 'zod';

export const vendorCreateSchema = z.object({
  vendor_code: z.string().min(1, 'Vendor code is required').max(50),
  vendor_name: z.string().min(1, 'Vendor name is required').max(255),
  phone_number: z.string().max(50).optional().nullable().or(z.literal('')),
  email: z.string().max(255).optional().nullable().or(z.literal('')),
  status: z.enum(['Active', 'Pending', 'Suspended', 'Under Review']).default('Active'),
});

export const vendorUpdateSchema = vendorCreateSchema.partial().extend({
  version: z.coerce.number().int().optional(),
});
