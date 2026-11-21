/**
 * Zod Validation Schemas for User Management
 */

import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
  phone_e164: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be valid E.164 format (e.g. +919876543210)'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters long'),
  role_codes: z.array(z.string()).min(1, 'User must be assigned at least one role')
});

export const updateUserSchema = z.object({
  full_name: z.string().trim().min(2).optional(),
  phone_e164: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  is_active: z.boolean().optional(),
  role_codes: z.array(z.string()).optional()
});

export const queryUserSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  role: z.string().trim().optional()
});
