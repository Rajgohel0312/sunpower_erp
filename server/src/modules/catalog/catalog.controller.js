/**
 * Product Catalog HTTP Controller
 */

import { catalogService } from './catalog.service.js';
import { productSpecificationService } from './product-specification.service.js';
import { productPricingService } from './product-pricing.service.js';
import { sendSuccess } from '../../utils/response.js';

export const catalogController = {
  // Categories
  async listCategories(req, res, next) {
    try {
      const categories = await catalogService.listCategories();
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  },

  async createCategory(req, res, next) {
    try {
      const category = await catalogService.createCategory(req.body, req.user);
      return sendSuccess(res, category, { message: 'Category created successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async updateCategory(req, res, next) {
    try {
      const category = await catalogService.updateCategory(req.params.id, req.body, req.user);
      return sendSuccess(res, category, { message: 'Category updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  // Products
  async listProducts(req, res, next) {
    try {
      const result = await catalogService.listProducts(req.query);
      return sendSuccess(res, result.products, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async getProduct(req, res, next) {
    try {
      const product = await catalogService.getProduct(req.params.id);
      return sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  },

  async createProduct(req, res, next) {
    try {
      const product = await catalogService.createProduct(req.body, req.user);
      return sendSuccess(res, product, { message: 'Product created successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async updateProduct(req, res, next) {
    try {
      const product = await catalogService.updateProduct(req.params.id, req.body, req.user);
      return sendSuccess(res, product, { message: 'Product updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async deleteProduct(req, res, next) {
    try {
      await catalogService.deleteProduct(req.params.id, req.user);
      return sendSuccess(res, null, { message: 'Product deactivated successfully' });
    } catch (err) {
      next(err);
    }
  },

  // Technical Specifications
  async getProductSpecifications(req, res, next) {
    try {
      const spec = await productSpecificationService.getSpecification(req.params.id);
      return sendSuccess(res, spec);
    } catch (err) {
      next(err);
    }
  },

  async upsertProductSpecifications(req, res, next) {
    try {
      const spec = await productSpecificationService.upsertSpecification(req.params.id, req.body);
      return sendSuccess(res, spec, { message: 'Specifications saved successfully' });
    } catch (err) {
      next(err);
    }
  },

  // Pricing History
  async getProductPrices(req, res, next) {
    try {
      const prices = await productPricingService.getPriceHistory(req.params.id);
      return sendSuccess(res, prices);
    } catch (err) {
      next(err);
    }
  },

  async recordProductPrice(req, res, next) {
    try {
      const price = await productPricingService.recordPrice(req.params.id, req.body, req.user);
      return sendSuccess(res, price, { message: 'Price recorded successfully' }, 201);
    } catch (err) {
      next(err);
    }
  }
};
