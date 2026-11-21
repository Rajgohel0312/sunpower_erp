import { z } from 'zod';

export const createQuotationSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  survey_id: z.string().uuid().optional().nullable(),
  bom_id: z.string().uuid({ message: 'A valid Engineering BOM ID is required to generate a quotation' }).optional().nullable(),
  system_capacity_kw: z.coerce.number().positive().optional(),
  installation_charges: z.coerce.number().min(0).optional(),
  transport_charges: z.coerce.number().min(0).optional(),
  discount_amount: z.coerce.number().min(0).optional().default(0),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}/, { message: 'valid_until must be YYYY-MM-DD format' }).optional(),
  commercial_terms: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid().optional().nullable(),
      item_type: z.enum(['HARDWARE', 'INSTALLATION', 'ELECTRICAL', 'TRANSPORT', 'CUSTOM']).default('HARDWARE'),
      item_name: z.string().min(1, 'Item name is required'),
      description: z.string().optional().nullable(),
      quantity: z.coerce.number().positive('Quantity must be greater than 0'),
      unit_code: z.string().default('NOS'),
      unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
      tax_rate_pct: z.coerce.number().min(0).max(100).default(12.00),
      is_optional: z.boolean().default(false),
      sort_order: z.coerce.number().int().optional().default(0)
    })
  ).optional()
}).refine(data => data.bom_id || data.lead_id || data.customer_id, {
  message: 'Either an Engineering BOM (bom_id), lead_id, or customer_id must be provided for a quotation',
  path: ['bom_id']
});

export const updateQuotationSchema = z.object({
  installation_charges: z.number().min(0).optional(),
  transport_charges: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  commercial_terms: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid().optional().nullable(),
      item_type: z.enum(['HARDWARE', 'INSTALLATION', 'ELECTRICAL', 'TRANSPORT', 'CUSTOM']).default('HARDWARE'),
      item_name: z.string().min(1),
      description: z.string().optional().nullable(),
      quantity: z.number().positive(),
      unit_code: z.string().default('NOS'),
      unit_price: z.number().min(0),
      tax_rate_pct: z.number().min(0).max(100).default(12.00),
      is_optional: z.boolean().default(false),
      sort_order: z.number().int().optional().default(0)
    })
  ).optional()
});

export const reviewQuotationSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional()
}).refine(data => data.decision !== 'REJECT' || (data.comments && data.comments.trim().length > 0), {
  message: 'Comments are mandatory when rejecting a commercial quotation',
  path: ['comments']
});

export const sendQuotationSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'DIRECT_LINK', 'MANUAL']).default('MANUAL')
});

export const acceptQuotationSchema = z.object({
  accepted_by_name: z.string().optional(),
  notes: z.string().optional()
});

export const rejectQuotationSchema = z.object({
  rejection_reason: z.string().min(3, 'Rejection reason must be at least 3 characters long')
});

export const listQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']).default('ALL'),
  customer_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional()
});
