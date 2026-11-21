/**
 * Product Catalog Express Router
 * Mounts at /api/v1/catalog
 */

import { Router } from 'express';
import { catalogController } from './catalog.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema
} from './catalog.schemas.js';

export const catalogRouter = Router();

catalogRouter.use(authenticate);

// -----------------------------------------------------------------------------
// CATEGORIES
// -----------------------------------------------------------------------------
catalogRouter.get(
  '/categories',
  requirePermission('catalog:read'),
  catalogController.listCategories
);

catalogRouter.post(
  '/categories',
  requirePermission('catalog:manage'),
  validate({ body: createCategorySchema }),
  catalogController.createCategory
);

catalogRouter.patch(
  '/categories/:id',
  requirePermission('catalog:manage'),
  validate({ body: updateCategorySchema }),
  catalogController.updateCategory
);

// -----------------------------------------------------------------------------
// PRODUCTS
// -----------------------------------------------------------------------------
catalogRouter.get(
  '/products',
  requirePermission('catalog:read'),
  validate({ query: listProductsQuerySchema }),
  catalogController.listProducts
);

catalogRouter.get(
  '/products/:id',
  requirePermission('catalog:read'),
  catalogController.getProduct
);

catalogRouter.post(
  '/products',
  requirePermission('catalog:manage'),
  validate({ body: createProductSchema }),
  catalogController.createProduct
);

catalogRouter.patch(
  '/products/:id',
  requirePermission('catalog:manage'),
  validate({ body: updateProductSchema }),
  catalogController.updateProduct
);

catalogRouter.delete(
  '/products/:id',
  requirePermission('catalog:manage'),
  catalogController.deleteProduct
);

// -----------------------------------------------------------------------------
// TECHNICAL SPECIFICATIONS & PRICING
// -----------------------------------------------------------------------------
catalogRouter.get(
  '/products/:id/specifications',
  requirePermission('catalog:read'),
  catalogController.getProductSpecifications
);

catalogRouter.post(
  '/products/:id/specifications',
  requirePermission('catalog:manage'),
  catalogController.upsertProductSpecifications
);

catalogRouter.get(
  '/products/:id/prices',
  requirePermission('catalog:read'),
  catalogController.getProductPrices
);

catalogRouter.post(
  '/products/:id/prices',
  requirePermission('catalog:manage'),
  catalogController.recordProductPrice
);

export default catalogRouter;
