import { z } from 'zod';

export const listSuppliersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name required (min 2 chars)').max(150),
  contact_person: z.string().trim().max(100).optional(),
  phone_e164: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid E.164 phone number'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian 15-digit GSTIN').optional().or(z.literal('')),
  payment_terms_days: z.coerce.number().int().min(0).default(30),
  address_line1: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).default('Gujarat'),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Invalid 6-digit Indian PIN code').optional().or(z.literal(''))
});

export const listPurchaseOrdersSchema = z.object({
  supplier_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  status: z.enum(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).default('ALL'),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid('Valid supplier ID required'),
  warehouse_id: z.string().uuid('Valid warehouse ID required'),
  expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid('Valid product ID required'),
      quantity_ordered: z.coerce.number().positive('Quantity must be positive'),
      unit_price: z.coerce.number().positive('Unit price must be positive'),
      tax_rate_pct: z.coerce.number().min(0).max(28).default(12.00)
    })
  ).min(1, 'Purchase order must have at least one line item')
});

export const recordGoodsReceiptSchema = z.object({
  po_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid('Valid supplier ID required'),
  warehouse_id: z.string().uuid('Valid warehouse ID required'),
  invoice_challan_number: z.string().trim().max(100).optional(),
  invoice_challan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      po_item_id: z.string().uuid().optional(),
      product_id: z.string().uuid('Valid product ID required'),
      quantity_received: z.coerce.number().positive('Received quantity must be positive'),
      quantity_accepted: z.coerce.number().min(0, 'Accepted quantity cannot be negative'),
      quantity_rejected: z.coerce.number().min(0).default(0),
      rejection_reason: z.string().trim().max(255).optional(),
      unit_cost: z.coerce.number().min(0, 'Unit cost cannot be negative')
    })
  ).min(1, 'Goods receipt must have at least one item'),
  serials: z.array(
    z.object({
      product_id: z.string().uuid('Valid product ID required'),
      serial_number: z.string().trim().min(3, 'Serial must be at least 3 characters').max(100),
      manufacturing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })
  ).optional().default([])
});

export const listGoodsReceiptsSchema = z.object({
  po_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const listSerialsSchema = z.object({
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  current_order_id: z.string().uuid().optional(),
  status: z.enum(['ALL', 'AVAILABLE', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'RETURNED', 'UNDER_REPAIR', 'REPLACED']).default('ALL'),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const verifySerialSchema = z.object({
  serial_number: z.string().trim().min(1, 'Serial number required'),
  expected_product_id: z.string().uuid().optional(),
  expected_warehouse_id: z.string().uuid().optional()
});
