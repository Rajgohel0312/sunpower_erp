import { z } from 'zod';

export const createDispatchSchema = z.object({
  sales_order_id: z.string().uuid({ message: 'Valid Sales Order ID is required' }),
  warehouse_id: z.string().uuid({ message: 'Valid Destination/Origin Warehouse ID is required' }),
  driver_name: z.string().min(2, { message: 'Driver name must be at least 2 characters' }),
  driver_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, { message: 'Valid driver phone number is required' }),
  vehicle_number: z.string().min(4, { message: 'Vehicle registration number is required (e.g. GJ-01-AB-1234)' }),
  dispatch_date: z.string().optional(),
  delivery_target_date: z.string().optional(),
  delivery_notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid({ message: 'Valid Product ID is required' }),
      quantity: z.number().positive({ message: 'Dispatched quantity must be greater than 0' })
    })
  ).min(1, { message: 'At least one line item must be dispatched' }),
  serial_numbers: z.array(z.string().min(2)).optional().default([])
});

export const updateDispatchStatusSchema = z.object({
  status: z.enum(['IN_TRANSIT', 'DELIVERED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status must be IN_TRANSIT, DELIVERED, or CANCELLED' })
  }),
  delivery_notes: z.string().optional(),
  delivered_at: z.string().optional()
});

export const listDispatchesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.string().optional(),
  warehouse_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional()
});
