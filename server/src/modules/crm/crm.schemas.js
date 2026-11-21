/**
 * Zod Validation Schemas for CRM & Lead Management Module
 */

import { z } from 'zod';

/**
 * Normalizes and validates phone numbers to E.164 format (+91XXXXXXXXXX)
 */
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');

  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.substring(1)}`;
  }
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return null;
}

export const phoneSchema = z.string()
  .min(8, 'Phone number too short')
  .max(20, 'Phone number too long')
  .transform((val, ctx) => {
    const normalized = normalizePhone(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number format. Provide 10-digit Indian mobile or valid E.164 (e.g. +919876543210).'
      });
      return z.NEVER;
    }
    return normalized;
  });

export const leadStageEnum = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SURVEY_SCHEDULED',
  'SURVEY_APPROVED',
  'QUOTATION_SENT',
  'NEGOTIATION',
  'WON',
  'LOST'
]);

export const leadSourceEnum = z.enum([
  'WEBSITE',
  'WHATSAPP',
  'PHONE',
  'WALK_IN',
  'REFERRAL',
  'MANUAL'
]);

export const systemTypeEnum = z.enum([
  'ON_GRID',
  'OFF_GRID',
  'HYBRID'
]);

export const customerTypeEnum = z.enum([
  'RESIDENTIAL',
  'COMMERCIAL',
  'INDUSTRIAL'
]);

// 1. Create Lead Schema
export const createLeadSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must have at least 2 characters').max(150),
  phone_e164: phoneSchema,
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  source: leadSourceEnum.default('MANUAL'),
  site_address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).default('Gujarat'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits').optional().nullable().or(z.literal('')),
  monthly_electricity_bill: z.coerce.number().min(0, 'Monthly bill cannot be negative').optional().nullable(),
  requested_capacity_kw: z.coerce.number().positive('Capacity must be greater than 0').max(500, 'Capacity exceeds 500 kW').optional().nullable(),
  system_type: systemTypeEnum.default('ON_GRID'),
  notes: z.string().trim().max(2000).optional().nullable(),
  assigned_to: z.string().uuid('Invalid user UUID for assigned_to').optional().nullable()
});

// 2. Update Lead Schema
export const updateLeadSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  phone_e164: phoneSchema.optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  source: leadSourceEnum.optional(),
  stage: leadStageEnum.optional(),
  site_address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional().nullable().or(z.literal('')),
  monthly_electricity_bill: z.coerce.number().min(0).optional().nullable(),
  requested_capacity_kw: z.coerce.number().positive().max(500).optional().nullable(),
  system_type: systemTypeEnum.optional(),
  lost_reason: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable()
}).refine(data => {
  if (data.stage === 'LOST' && (!data.lost_reason || data.lost_reason.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'A valid lost_reason is mandatory when marking a lead as LOST.',
  path: ['lost_reason']
});

// 3. Assign Lead Schema
export const assignLeadSchema = z.object({
  assigned_to: z.string().uuid('assigned_to must be a valid user UUID'),
  notes: z.string().trim().max(1000).optional()
});

// 4. Convert Lead to Customer Schema
export const convertLeadSchema = z.object({
  customer_type: customerTypeEnum.default('RESIDENTIAL'),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid 15-character GSTIN format').optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(1000).optional()
});

// 5. Lead Activity Schema
export const createActivitySchema = z.object({
  activity_type: z.enum(['CALL', 'WHATSAPP', 'MEETING', 'NOTE']),
  details: z.record(z.any()).or(z.string().transform(str => ({ note: str })))
});

// 6. Follow-up Schema
export const createFollowUpSchema = z.object({
  scheduled_at: z.string().datetime({ message: 'scheduled_at must be an ISO 8601 timestamp' }),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional()
});

export const updateFollowUpSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED', 'CANCELLED']).optional(),
  notes: z.string().trim().max(1000).optional()
});

// 7. Customer Schemas
export const createCustomerAddressSchema = z.object({
  address_type: z.enum(['SITE', 'BILLING', 'RESIDENTIAL', 'OTHER']).default('SITE'),
  address_line1: z.string().trim().min(3, 'Address line 1 must have at least 3 characters').max(255),
  address_line2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100).default('Gujarat'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  is_primary: z.boolean().default(true)
});

export const createCustomerSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  phone_e164: phoneSchema,
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  customer_type: customerTypeEnum.default('RESIDENTIAL'),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid 15-character GSTIN format').optional().nullable().or(z.literal('')),
  address: createCustomerAddressSchema.optional()
});

export const updateCustomerSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  phone_e164: phoneSchema.optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  customer_type: customerTypeEnum.optional(),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().nullable().or(z.literal(''))
});

// 8. Query Filtering Schemas
export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stage: leadStageEnum.optional(),
  source: leadSourceEnum.optional(),
  assigned_to: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  sort_by: z.enum(['created_at', 'full_name', 'stage', 'monthly_electricity_bill', 'lead_number']).default('created_at'),
  sort_order: z.enum(['ASC', 'DESC']).default('DESC')
});

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customer_type: customerTypeEnum.optional(),
  search: z.string().trim().optional(),
  sort_by: z.enum(['created_at', 'full_name', 'customer_code']).default('created_at'),
  sort_order: z.enum(['ASC', 'DESC']).default('DESC')
});

export const duplicateCheckQuerySchema = z.object({
  phone: z.string().min(8)
});
