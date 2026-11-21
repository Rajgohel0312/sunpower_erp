/**
 * Product Specification Service
 * Manages technical engineering attributes for products in the catalog.
 */

import { catalogRepository } from './catalog.repository.js';
import { AppError } from '../../utils/response.js';

export const productSpecificationService = {
  /**
   * Get specifications for a given product
   */
  async getSpecification(productId, tx = null) {
    const product = await catalogRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const spec = await catalogRepository.findSpecificationByProductId(productId, tx);
    return spec || null;
  },

  /**
   * Upsert technical specifications for a product
   */
  async upsertSpecification(productId, specData, tx = null) {
    const product = await catalogRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const categoryCode = specData.category_code || product.category?.code;
    if (!categoryCode) {
      throw new AppError('Category code is required for specifications', 400, 'CATEGORY_REQUIRED');
    }

    return catalogRepository.upsertSpecification(productId, {
      ...specData,
      category_code: categoryCode
    }, tx);
  }
};
