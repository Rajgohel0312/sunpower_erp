/**
 * Zod Validation Schemas for Authentication
 */

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid or malformed reset token'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long')
});
