import { z } from 'zod';

export const createOrderFromQuotationSchema = z.object({
  quotation_id: z.string().uuid({ message: 'Valid quotation_id is required' }),
  advance_payment_received: z.number().min(0).optional().default(0),
  installation_target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  notes: z.string().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'CONFIRMED',
    'IN_ENGINEERING',
    'MATERIAL_RESERVED',
    'DISPATCHED',
    'INSTALLATION_IN_PROGRESS',
    'COMMISSIONED',
    'CANCELLED'
  ]),
  notes: z.string().optional()
});

export const recordOrderPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  payment_method: z.enum(['UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CASH', 'ONLINE']).default('NEFT'),
  reference_id: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional()
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum([
    'ALL',
    'CONFIRMED',
    'IN_ENGINEERING',
    'MATERIAL_RESERVED',
    'DISPATCHED',
    'INSTALLATION_IN_PROGRESS',
    'COMMISSIONED',
    'CANCELLED',
    'CLOSED'
  ]).default('ALL'),
  customer_id: z.string().uuid().optional()
});
