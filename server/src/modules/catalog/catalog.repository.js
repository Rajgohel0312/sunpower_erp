/**
 * Product Catalog Database Repository
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const catalogRepository = {
  // ---------------------------------------------------------------------------
  // PRODUCT CATEGORIES
  // ---------------------------------------------------------------------------
  async listCategories(tx = null) {
    const client = tx || prisma;
    return client.product_categories.findMany({
      orderBy: { name: 'asc' }
    });
  },

  async findCategoryById(id, tx = null) {
    const client = tx || prisma;
    return client.product_categories.findUnique({
      where: { id }
    });
  },

  async findCategoryByCode(code, tx = null) {
    const client = tx || prisma;
    return client.product_categories.findUnique({
      where: { code }
    });
  },

  async createCategory(data, tx = null) {
    const client = tx || prisma;
    return client.product_categories.create({
      data
    });
  },

  async updateCategory(id, data, tx = null) {
    const client = tx || prisma;
    return client.product_categories.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  },

  // ---------------------------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------------------------
  async listProducts({ page = 1, limit = 50, category_code, category_id, search, is_active, sort_by = 'created_at', sort_order = 'DESC' }, tx = null) {
    const client = tx || prisma;
    const where = {
      deleted_at: null
    };

    if (category_id) {
      where.category_id = category_id;
    } else if (category_code) {
      where.product_categories = {
        code: category_code
      };
    }

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model_name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    const validSortCol = ['created_at', 'sku', 'brand', 'model_name', 'standard_cost'].includes(sort_by)
      ? sort_by
      : 'created_at';
    orderBy[validSortCol] = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      client.products.findMany({
        where,
        include: {
          product_categories: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      client.products.count({ where })
    ]);

    const products = rows.map((p) => {
      const { product_categories, ...rest } = p;
      return {
        ...rest,
        category: product_categories
      };
    });

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async findProductById(id, tx = null) {
    const client = tx || prisma;
    const row = await client.products.findFirst({
      where: { id, deleted_at: null },
      include: {
        product_categories: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!row) return null;
    const { product_categories, ...rest } = row;
    return {
      ...rest,
      category: product_categories
    };
  },

  async findProductBySku(sku, tx = null) {
    const client = tx || prisma;
    return client.products.findFirst({
      where: { sku, deleted_at: null }
    });
  },

  async createProduct(data, tx = null) {
    const client = tx || prisma;
    return client.products.create({
      data,
      include: {
        product_categories: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });
  },

  async updateProduct(id, data, tx = null) {
    const client = tx || prisma;
    return client.products.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      },
      include: {
        product_categories: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });
  },

  async deleteProduct(id, tx = null) {
    const client = tx || prisma;
    return client.products.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        is_active: false
      }
    });
  },

  // ---------------------------------------------------------------------------
  // SPECIFICATIONS & PRICING
  // ---------------------------------------------------------------------------
  async findSpecificationByProductId(productId, tx = null) {
    const client = tx || prisma;
    return client.product_specifications.findUnique({
      where: { product_id: productId }
    });
  },

  async upsertSpecification(productId, data, tx = null) {
    const client = tx || prisma;
    return client.product_specifications.upsert({
      where: { product_id: productId },
      create: {
        ...data,
        product_id: productId
      },
      update: {
        ...data,
        updated_at: new Date()
      }
    });
  },

  async listPricesByProductId(productId, tx = null) {
    const client = tx || prisma;
    return client.product_prices.findMany({
      where: { product_id: productId },
      orderBy: { effective_from: 'desc' }
    });
  },

  async findEffectivePrice(productId, date = new Date(), tx = null) {
    const client = tx || prisma;
    return client.product_prices.findFirst({
      where: {
        product_id: productId,
        effective_from: { lte: date },
        OR: [
          { effective_to: null },
          { effective_to: { gte: date } }
        ]
      },
      orderBy: { effective_from: 'desc' }
    });
  },

  async createPrice(data, tx = null) {
    const client = tx || prisma;
    return client.product_prices.create({
      data
    });
  }
};
