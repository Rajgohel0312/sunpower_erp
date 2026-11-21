/**
 * Product Catalog & Categories Automated Test Suite (Phase 4)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { catalogService } from '../../src/modules/catalog/catalog.service.js';
import { createCategorySchema, createProductSchema } from '../../src/modules/catalog/catalog.schemas.js';

describe('Phase 4 — Product Catalog & Categories Zod Boundaries', () => {
  it('createCategorySchema validates valid uppercase alphanumeric code', () => {
    const valid = createCategorySchema.safeParse({
      code: 'BATTERY_STORAGE',
      name: 'Lithium Battery Storage'
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.code, 'BATTERY_STORAGE');
  });

  it('createCategorySchema rejects lowercase or invalid code characters', () => {
    const invalid = createCategorySchema.safeParse({
      code: 'battery-storage',
      name: 'Lithium Battery Storage'
    });
    assert.equal(invalid.success, false);
  });

  it('createProductSchema validates complete solar product details', () => {
    const valid = createProductSchema.safeParse({
      category_id: 'a0000000-0000-0000-0000-000000000001',
      sku: 'pnl-test-500w',
      brand: 'TestBrand',
      model_name: 'Super Solar 500W',
      rated_capacity_w: 500,
      standard_cost: 10500,
      tax_rate_pct: 12
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.sku, 'PNL-TEST-500W'); // auto-uppercased
  });

  it('createProductSchema rejects negative standard_cost or invalid category UUID', () => {
    const invalidCost = createProductSchema.safeParse({
      category_id: 'a0000000-0000-0000-0000-000000000001',
      sku: 'PNL-TEST',
      brand: 'TestBrand',
      model_name: 'Super Solar 500W',
      standard_cost: -500
    });
    assert.equal(invalidCost.success, false);

    const invalidUuid = createProductSchema.safeParse({
      category_id: 'not-a-uuid',
      sku: 'PNL-TEST',
      brand: 'TestBrand',
      model_name: 'Super Solar 500W',
      standard_cost: 5000
    });
    assert.equal(invalidUuid.success, false);
  });
});

describe('Phase 4 — Product Catalog Service & Business Logic', () => {
  it('lists seeded standard solar product categories', async () => {
    const categories = await catalogService.listCategories();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.length >= 8);

    const codes = categories.map(c => c.code);
    assert.ok(codes.includes('PANEL'));
    assert.ok(codes.includes('INVERTER'));
    assert.ok(codes.includes('STRUCTURE'));
    assert.ok(codes.includes('CABLE'));
  });

  it('lists seeded solar products with category relations', async () => {
    const result = await catalogService.listProducts({ limit: 50 });
    assert.ok(Array.isArray(result.products));
    assert.ok(result.products.length >= 8);

    const waaree = result.products.find(p => p.sku === 'PNL-WAAREE-540W');
    assert.ok(waaree);
    assert.equal(waaree.brand, 'Waaree');
    assert.equal(Number(waaree.rated_capacity_w), 540);
    assert.equal(waaree.category?.code, 'PANEL');
  });

  it('rejects creating a product with duplicate SKU', async () => {
    const categories = await catalogService.listCategories();
    const panelCat = categories.find(c => c.code === 'PANEL');

    await assert.rejects(
      async () => {
        await catalogService.createProduct({
          category_id: panelCat.id,
          sku: 'PNL-WAAREE-540W', // Already seeded
          brand: 'Duplicate Brand',
          model_name: 'Duplicate Model',
          standard_cost: 10000
        }, { id: 'admin' });
      },
      /already exists/
    );
  });
});
