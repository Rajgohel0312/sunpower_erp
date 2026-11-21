/**
 * Product Catalog Domain Service
 */

import { catalogRepository } from './catalog.repository.js';
import { AppError } from '../../utils/response.js';

export const catalogService = {
  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------
  async listCategories() {
    return catalogRepository.listCategories();
  },

  async createCategory(input, actor) {
    const existing = await catalogRepository.findCategoryByCode(input.code);
    if (existing) {
      throw new AppError(`Category with code '${input.code}' already exists.`, 409, 'DUPLICATE_CATEGORY_CODE');
    }

    return catalogRepository.createCategory({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null
    });
  },

  async updateCategory(id, input, actor) {
    const category = await catalogRepository.findCategoryById(id);
    if (!category) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    return catalogRepository.updateCategory(id, input);
  },

  // ---------------------------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------------------------
  async listProducts(queryParams) {
    return catalogRepository.listProducts(queryParams);
  },

  async getProduct(id) {
    const product = await catalogRepository.findProductById(id);
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }
    return product;
  },

  async createProduct(input, actor) {
    // 1. Verify category exists and is active
    const category = await catalogRepository.findCategoryById(input.category_id);
    if (!category || !category.is_active) {
      throw new AppError('Assigned category does not exist or is inactive.', 400, 'INVALID_CATEGORY');
    }

    // 2. Check SKU uniqueness
    const existingSku = await catalogRepository.findProductBySku(input.sku);
    if (existingSku) {
      throw new AppError(`Product with SKU '${input.sku}' already exists.`, 409, 'DUPLICATE_SKU');
    }

    return catalogRepository.createProduct({
      category_id: input.category_id,
      sku: input.sku.toUpperCase(),
      brand: input.brand,
      model_name: input.model_name,
      rated_capacity_w: input.rated_capacity_w || null,
      unit_code: input.unit_code || 'NOS',
      standard_cost: input.standard_cost,
      tax_rate_pct: input.tax_rate_pct !== undefined ? input.tax_rate_pct : 12.00,
      hsn_code: input.hsn_code || '85414011',
      is_serial_tracked: input.is_serial_tracked || false,
      metadata: input.metadata || {}
    });
  },

  async updateProduct(id, input, actor) {
    const existing = await catalogRepository.findProductById(id);
    if (!existing) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    if (input.category_id) {
      const category = await catalogRepository.findCategoryById(input.category_id);
      if (!category || !category.is_active) {
        throw new AppError('Assigned category does not exist or is inactive.', 400, 'INVALID_CATEGORY');
      }
    }

    return catalogRepository.updateProduct(id, input);
  },

  async deleteProduct(id, actor) {
    const existing = await catalogRepository.findProductById(id);
    if (!existing) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    return catalogRepository.deleteProduct(id);
  }
};
