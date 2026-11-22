import { z } from 'zod';

export const listWarrantiesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  customer_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional(),
  serial_number_id: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID']).optional(),
  search: z.string().optional()
});

export const createWarrantySchema = z.object({
  customer_id: z.string().uuid({ message: 'Valid customer ID is required' }),
  sales_order_id: z.string().uuid({ message: 'Valid sales order ID is required' }),
  installation_job_id: z.string().uuid().optional(),
  serial_number_id: z.string().uuid().optional(),
  product_id: z.string().uuid({ message: 'Valid product ID is required' }),
  policy_code: z.string().optional(),
  duration_months: z.number().int().positive().optional(),
  start_date: z.string().optional(),
  terms_override: z.string().optional()
});

export const verifyClaimSchema = z.object({
  serial_number: z.string().min(1, { message: 'Serial number is required' }),
  customer_id: z.string().uuid().optional()
});

export const listPoliciesSchema = z.object({
  category_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional()
});
