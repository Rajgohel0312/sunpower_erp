import { z } from 'zod';

export const listStockSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  low_stock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const listMovementsSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  movement_type: z.enum([
    'PURCHASE_RECEIPT',
    'ORDER_RESERVATION',
    'RESERVATION_RELEASE',
    'DISPATCH',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'RETURN',
    'ADJUSTMENT'
  ]).optional(),
  reference_type: z.enum([
    'GOODS_RECEIPT',
    'SALES_ORDER',
    'STOCK_TRANSFER',
    'STOCK_ADJUSTMENT'
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const reserveStockSchema = z.object({
  sales_order_id: z.string().uuid('Valid sales order ID required'),
  items: z.array(
    z.object({
      product_id: z.string().uuid('Valid product ID required'),
      warehouse_id: z.string().uuid('Valid warehouse ID required'),
      quantity: z.coerce.number().positive('Quantity must be greater than zero')
    })
  ).min(1, 'At least one item required for reservation')
});

export const releaseReservationSchema = z.object({
  sales_order_id: z.string().uuid('Valid sales order ID required'),
  reason: z.string().trim().max(255).optional()
});

export const adjustStockSchema = z.object({
  product_id: z.string().uuid('Valid product ID required'),
  warehouse_id: z.string().uuid('Valid warehouse ID required'),
  quantity_delta: z.coerce.number().refine(n => n !== 0, 'Adjustment delta cannot be zero'),
  reason: z.string().trim().min(3, 'Adjustment reason required (min 3 characters)'),
  notes: z.string().trim().max(500).optional()
});
