/**
 * Product Mapping Orchestrator (Tier B)
 * Retrieves candidate products from catalog with specifications,
 * matches them against pure engineering requirements, and returns full mapping results.
 */

import { prisma } from '../../database/index.js';
import { productSelectorService } from './product-selector.service.js';

export const productMappingService = {
  /**
   * Maps engineering requirements to catalog products
   * @param {Object} requirements - Output from engineeringService.generateRequirements()
   * @param {Object} [overrides] - Optional user overrides { panel_product_id, inverter_product_id, structure_product_id }
   * @param {Object} [tx] - Prisma transaction client
   */
  async mapRequirements(requirements, overrides = {}, tx = null) {
    const client = tx || prisma;

    // Fetch all active products with specifications and categories in one efficient query
    const allProducts = await client.products.findMany({
      where: {
        is_active: true,
        deleted_at: null
      },
      include: {
        product_categories: true,
        product_specifications: true
      }
    });

    // Group candidates by category
    const byCategory = {
      PANEL: allProducts.filter(p => p.product_categories?.code === 'PANEL'),
      INVERTER: allProducts.filter(p => p.product_categories?.code === 'INVERTER'),
      STRUCTURE: allProducts.filter(p => p.product_categories?.code === 'STRUCTURE'),
      CABLE: allProducts.filter(p => p.product_categories?.code === 'CABLE'),
      ACDB_DCDB: allProducts.filter(p => p.product_categories?.code === 'ACDB_DCDB'),
      PROTECTION_EARTHING: allProducts.filter(p => p.product_categories?.code === 'PROTECTION_EARTHING'),
      ACCESSORY: allProducts.filter(p => p.product_categories?.code === 'ACCESSORY')
    };

    const mapping = {};
    const mappingBlockers = [];

    // 1. Solar Module
    const panelOverride = overrides.panel_product_id || overrides.forcedPanelId || overrides.panelSku;
    const panelResult = productSelectorService.selectProduct(
      byCategory.PANEL,
      requirements,
      'PANEL',
      panelOverride
    );
    mapping.panel = panelResult;
    if (panelResult.status === 'OVERRIDE_INCOMPATIBLE') {
      mappingBlockers.push({
        code: panelResult.rejectedMatch.code || 'INCOMPATIBLE_MODULE',
        component: 'PANEL',
        description: panelResult.rejectedMatch.reason || 'Selected module is incompatible with array requirements.'
      });
    } else if (panelResult.status === 'NO_COMPATIBLE_PRODUCT') {
      mappingBlockers.push({
        code: 'NO_COMPATIBLE_PRODUCT',
        component: 'PANEL',
        description: 'No active, compatible solar PV module found in product catalog.'
      });
    }

    // 2. Inverter
    const inverterOverride = overrides.inverter_product_id || overrides.forcedInverterId || overrides.inverterSku;
    const inverterResult = productSelectorService.selectProduct(
      byCategory.INVERTER,
      requirements,
      'INVERTER',
      inverterOverride
    );
    mapping.inverter = inverterResult;
    if (inverterResult.status === 'OVERRIDE_INCOMPATIBLE') {
      mappingBlockers.push({
        code: inverterResult.rejectedMatch.code || 'INCOMPATIBLE_INVERTER',
        component: 'INVERTER',
        description: inverterResult.rejectedMatch.reason || 'Selected inverter violates electrical compatibility rules.'
      });
    } else if (inverterResult.status === 'NO_COMPATIBLE_PRODUCT') {
      mappingBlockers.push({
        code: 'NO_COMPATIBLE_PRODUCT',
        component: 'INVERTER',
        description: `No compatible ${requirements.inverter.requiredPhase} Phase inverter found in catalog matching array capacity.`
      });
    }

    // 3. Mounting Structure
    const structureOverride = overrides.structure_product_id || overrides.forcedStructureId || overrides.structureSku;
    const structureResult = productSelectorService.selectProduct(
      byCategory.STRUCTURE,
      requirements,
      'STRUCTURE',
      structureOverride
    );
    mapping.structure = structureResult;
    if (structureResult.status === 'OVERRIDE_INCOMPATIBLE') {
      mappingBlockers.push({
        code: structureResult.rejectedMatch.code || 'MOUNTING_PROFILE_MISMATCH',
        component: 'STRUCTURE',
        description: structureResult.rejectedMatch.reason || 'Selected mounting structure violates substrate requirements.'
      });
    } else if (structureResult.status === 'NO_COMPATIBLE_PRODUCT') {
      mappingBlockers.push({
        code: 'NO_COMPATIBLE_PRODUCT',
        component: 'STRUCTURE',
        description: `No mounting structure kit found supporting substrate ${requirements.mounting.targetSubstrate}.`
      });
    }

    // 4. DC Cable
    const dcCableCandidates = byCategory.CABLE.filter(p => p.sku.includes('DC') || p.product_specifications?.is_uv_resistant);
    const dcCableResult = productSelectorService.selectProduct(
      dcCableCandidates.length > 0 ? dcCableCandidates : byCategory.CABLE,
      requirements,
      'CABLE_DC'
    );
    mapping.dcCable = dcCableResult;

    // 5. AC Armored Cable
    const acCableCandidates = byCategory.CABLE.filter(p => p.sku.includes('AC') || p.product_specifications?.is_armored);
    const acCableResult = productSelectorService.selectProduct(
      acCableCandidates.length > 0 ? acCableCandidates : byCategory.CABLE,
      requirements,
      'CABLE_AC'
    );
    mapping.acCable = acCableResult;

    // 6. AC Distribution Box (ACDB)
    const acdbCandidates = byCategory.ACDB_DCDB.filter(p => p.sku.includes('ACDB'));
    const acdbResult = productSelectorService.selectProduct(
      acdbCandidates,
      requirements,
      'ACDB'
    );
    mapping.acdb = acdbResult;

    // 7. DC Distribution Box (DCDB)
    const dcdbCandidates = byCategory.ACDB_DCDB.filter(p => p.sku.includes('DCDB'));
    const dcdbResult = productSelectorService.selectProduct(
      dcdbCandidates,
      requirements,
      'DCDB'
    );
    mapping.dcdb = dcdbResult;

    // 8. Earthing Electrodes
    const earthCandidates = byCategory.PROTECTION_EARTHING.filter(p => p.sku.includes('EARTH'));
    const earthingResult = productSelectorService.selectProduct(
      earthCandidates,
      requirements,
      'EARTHING'
    );
    mapping.earthing = earthingResult;

    // 9. Lightning Arrester (if required)
    if (requirements.earthing.requiresLightningArrester) {
      const laCandidates = byCategory.PROTECTION_EARTHING.filter(p => p.sku.includes('LA'));
      const laResult = productSelectorService.selectProduct(
        laCandidates,
        requirements,
        'LA'
      );
      mapping.lightningArrester = laResult;
    }

    // 10. Balance of System Kit
    const bosCandidates = byCategory.ACCESSORY.filter(p => p.sku.includes('ACC') || p.sku.includes('BOS'));
    const bosResult = productSelectorService.selectProduct(
      bosCandidates.length > 0 ? bosCandidates : byCategory.ACCESSORY,
      requirements,
      'BOS'
    );
    mapping.bos = bosResult;

    return {
      mapping,
      hasBlockers: mappingBlockers.length > 0,
      mappingBlockers
    };
  }
};
