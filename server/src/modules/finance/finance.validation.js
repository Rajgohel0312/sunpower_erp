import { z } from 'zod';

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID']).optional(),
  customer_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional(),
  milestone_type: z.enum(['ADVANCE', 'DELIVERY', 'INSTALLATION_COMPLETE', 'NET_METERING', 'FINAL_SETTLEMENT', 'AD_HOC']).optional()
});

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  item_type: z.enum(['HARDWARE', 'SERVICE', 'TRANSPORT', 'CIVIL_WORKS', 'MISCELLANEOUS']).default('HARDWARE'),
  description: z.string().min(1).max(255),
  hsn_sac_code: z.string().max(20).default('995465'),
  quantity: z.coerce.number().positive(),
  unit_code: z.string().max(20).default('NOS'),
  unit_price: z.coerce.number().min(0),
  tax_rate_pct: z.coerce.number().min(0).max(100).default(12.0)
});

export const createInvoiceSchema = z.object({
  sales_order_id: z.string().uuid({ message: 'Valid Sales Order ID is required' }),
  milestone_type: z.enum(['ADVANCE', 'DELIVERY', 'INSTALLATION_COMPLETE', 'NET_METERING', 'FINAL_SETTLEMENT', 'AD_HOC']).default('ADVANCE'),
  milestone_percentage: z.coerce.number().min(0).max(100).default(20.0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Due date must be YYYY-MM-DD' }),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(invoiceItemSchema).optional()
});

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['RECORDED', 'VERIFIED', 'REJECTED', 'BOUNCED']).optional(),
  customer_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional(),
  payment_mode: z.enum(['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH', 'BANK_TRANSFER', 'DEMAND_DRAFT']).optional()
});

export const recordPaymentSchema = z.object({
  customer_id: z.string().uuid({ message: 'Customer ID is required' }),
  sales_order_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive({ message: 'Payment amount must be greater than zero' }),
  payment_mode: z.enum(['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH', 'BANK_TRANSFER', 'DEMAND_DRAFT'], {
    message: 'Valid payment mode is required'
  }),
  transaction_reference: z.string().min(3).max(100, { message: 'Transaction reference or UTR is required' }),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  idempotency_key: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  auto_allocate_invoice_id: z.string().uuid().optional().nullable()
});

export const allocatePaymentSchema = z.object({
  payment_id: z.string().uuid({ message: 'Payment ID is required' }),
  invoice_id: z.string().uuid({ message: 'Invoice ID is required' }),
  amount: z.coerce.number().positive({ message: 'Allocation amount must be greater than zero' })
});

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sales_order_id: z.string().uuid().optional(),
  category: z.enum(['LABOR', 'TRANSPORT', 'CRANE_RENTAL', 'LIASONING', 'ELECTRICAL_CONSUMABLES', 'CIVIL_MATERIALS', 'MISCELLANEOUS']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).optional()
});

export const createExpenseSchema = z.object({
  sales_order_id: z.string().uuid({ message: 'Sales Order ID is required' }),
  category: z.enum(['LABOR', 'TRANSPORT', 'CRANE_RENTAL', 'LIASONING', 'ELECTRICAL_CONSUMABLES', 'CIVIL_MATERIALS', 'MISCELLANEOUS'], {
    message: 'Valid expense category is required'
  }),
  vendor_name: z.string().min(2).max(255, { message: 'Vendor/recipient name is required' }),
  amount: z.coerce.number().positive({ message: 'Expense amount must be greater than zero' }),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receipt_url: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});
