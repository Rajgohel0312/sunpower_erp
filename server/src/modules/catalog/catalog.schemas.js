/**
 * Zod Validation Schemas for Product Catalog & Categories
 */

import { z } from 'zod';

export const createCategorySchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric and underscores only'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable()
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional()
});

export const createProductSchema = z.object({
  category_id: z.string().uuid('Invalid category UUID'),
  sku: z.string().trim().min(3).max(100).toUpperCase(),
  brand: z.string().trim().min(2).max(100),
  model_name: z.string().trim().min(2).max(150),
  rated_capacity_w: z.coerce.number().positive().max(1000000).optional().nullable(),
  unit_code: z.enum(['NOS', 'MTR', 'SET', 'KG', 'LOT']).default('NOS'),
  standard_cost: z.coerce.number().min(0, 'Standard cost cannot be negative'),
  tax_rate_pct: z.coerce.number().min(0).max(100).default(12.00),
  hsn_code: z.string().trim().max(20).default('85414011'),
  is_serial_tracked: z.boolean().default(false),
  metadata: z.record(z.any()).default({})
});

export const updateProductSchema = z.object({
  category_id: z.string().uuid().optional(),
  brand: z.string().trim().min(2).max(100).optional(),
  model_name: z.string().trim().min(2).max(150).optional(),
  rated_capacity_w: z.coerce.number().positive().optional().nullable(),
  unit_code: z.enum(['NOS', 'MTR', 'SET', 'KG', 'LOT']).optional(),
  standard_cost: z.coerce.number().min(0).optional(),
  tax_rate_pct: z.coerce.number().min(0).max(100).optional(),
  hsn_code: z.string().trim().max(20).optional(),
  is_serial_tracked: z.boolean().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category_code: z.string().trim().optional(),
  category_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  sort_by: z.enum(['created_at', 'sku', 'brand', 'model_name', 'standard_cost']).default('created_at'),
  sort_order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC')
});
