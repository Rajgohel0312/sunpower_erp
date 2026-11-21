/**
 * Product Pricing Service
 * Manages effective-dated price history and cost ledger for catalog items.
 */

import { catalogRepository } from './catalog.repository.js';
import { AppError } from '../../utils/response.js';

export const productPricingService = {
  /**
   * Get all price records for a product
   */
  async getPriceHistory(productId, tx = null) {
    const product = await catalogRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    return catalogRepository.listPricesByProductId(productId, tx);
  },

  /**
   * Get the active effective price for a product as of a specific date
   */
  async getEffectivePrice(productId, date = new Date(), tx = null) {
    const priceRecord = await catalogRepository.findEffectivePrice(productId, date, tx);
    if (priceRecord) {
      return parseFloat(priceRecord.unit_cost);
    }

    // Fall back to product standard_cost if no historical price record exists
    const product = await catalogRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    return parseFloat(product.standard_cost || 0);
  },

  /**
   * Record a new effective price for a product
   */
  async recordPrice(productId, priceData, actor = null, tx = null) {
    const product = await catalogRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    if (priceData.unit_cost === undefined || isNaN(parseFloat(priceData.unit_cost)) || parseFloat(priceData.unit_cost) < 0) {
      throw new AppError('Valid non-negative unit_cost is required', 400, 'INVALID_UNIT_COST');
    }

    const effectiveFrom = priceData.effective_from ? new Date(priceData.effective_from) : new Date();

    const newPrice = await catalogRepository.createPrice({
      product_id: productId,
      unit_cost: parseFloat(priceData.unit_cost),
      currency: priceData.currency || 'INR',
      effective_from: effectiveFrom,
      effective_to: priceData.effective_to ? new Date(priceData.effective_to) : null,
      supplier_name: priceData.supplier_name || null,
      notes: priceData.notes || null,
      created_by: actor?.id || null
    }, tx);

    // Also update standard_cost on product for quick listing
    await catalogRepository.updateProduct(productId, {
      standard_cost: parseFloat(priceData.unit_cost)
    }, tx);

    return newPrice;
  }
};
