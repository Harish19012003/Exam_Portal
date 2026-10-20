import { z } from 'zod';
import { ROLE_VALUES } from '../constants/roles.js';

/**
 * Schema for email/phone + password login.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or phone is required')
    .max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

/**
 * Schema for forgot-password request.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

/**
 * Schema for resetting password with a token.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Schema for 2FA / OTP verification.
 */
export const otpVerifySchema = z.object({
  code: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d+$/, 'OTP must contain only digits'),
});

/** Role enum using ROLES constant values */
export const roleSchema = z.enum(/** @type {[string, ...string[]]} */ (ROLE_VALUES));
