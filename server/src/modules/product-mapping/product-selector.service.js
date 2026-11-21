/**
 * Product Selector & Ranking Service (Stage 2: Ranking & Alternatives)
 * Ranks technically eligible products using commercial and preference rules.
 * Never overrides hard engineering constraints.
 */

import { compatibilityService } from './compatibility.service.js';

export const productSelectorService = {
  /**
   * Filters and ranks catalog products for a specific engineering requirement
   * @param {Array} candidates - Catalog products in category with specs
   * @param {Object} requirements - Engineering requirements
   * @param {string} categoryKey - 'INVERTER', 'STRUCTURE', 'PANEL', 'CABLE_DC', 'CABLE_AC', 'ACDB', 'DCDB', 'EARTHING', 'LA', 'BOS'
   * @param {string} [preferredSku] - Optional manual override or preference
   */
  selectProduct(candidates = [], requirements, categoryKey, preferredSku = null) {
    const compatible = [];
    const rejected = [];

    // Stage 1: Hard Technical Filtering
    for (const prod of candidates) {
      if (!prod.is_active || prod.deleted_at) {
        rejected.push({
          productId: prod.id,
          sku: prod.sku,
          brand: prod.brand,
          reason: 'Product is inactive or discontinued'
        });
        continue;
      }

      let check = { isCompatible: true };

      if (categoryKey === 'INVERTER') {
        check = compatibilityService.checkInverter(prod, requirements);
      } else if (categoryKey === 'STRUCTURE') {
        check = compatibilityService.checkMounting(prod, requirements);
      } else if (categoryKey === 'ACDB') {
        check = compatibilityService.checkAcdb(prod, requirements);
      } else if (categoryKey === 'CABLE_DC') {
        check = compatibilityService.checkCable(prod, requirements, 'DC');
      } else if (categoryKey === 'CABLE_AC') {
        check = compatibilityService.checkCable(prod, requirements, 'AC');
      }

      if (check.isCompatible) {
        compatible.push(prod);
      } else {
        rejected.push({
          productId: prod.id,
          sku: prod.sku,
          brand: prod.brand,
          code: check.code,
          reason: check.reason
        });
      }
    }

    // Check if a preferred product was explicitly requested
    if (preferredSku) {
      const rejectedMatch = rejected.find(r => r.productId === preferredSku || r.sku === preferredSku);
      if (rejectedMatch) {
        // Explicitly selected product failed hard engineering checks
        return {
          selected: null,
          status: 'OVERRIDE_INCOMPATIBLE',
          rejectedMatch,
          selectionReason: null,
          alternatives: [],
          rejected
        };
      }
    }

    // If no compatible product found
    if (compatible.length === 0) {
      return {
        selected: null,
        status: 'NO_COMPATIBLE_PRODUCT',
        selectionReason: null,
        alternatives: [],
        rejected
      };
    }

    // Stage 2: Commercial Ranking (Priority: preferredSku -> lowest standard_cost)
    let selected = null;
    let selectionReason = 'Lowest standard cost among technically certified products';

    if (preferredSku) {
      const preferredMatch = compatible.find(p => p.sku === preferredSku || p.id === preferredSku);
      if (preferredMatch) {
        selected = preferredMatch;
        selectionReason = 'Preferred product matching engineering requirements';
      }
    }

    if (!selected) {
      if (categoryKey === 'CABLE_DC') {
        const targetCross = Number(requirements.cables?.dc?.conductorCrossSectionSqmm || 4);
        compatible.sort((a, b) => {
          const aCross = Number(a.product_specifications?.cross_section_sqmm || (a.sku.includes('6SQMM') ? 6 : 4));
          const bCross = Number(b.product_specifications?.cross_section_sqmm || (b.sku.includes('6SQMM') ? 6 : 4));
          const aMatch = aCross === targetCross ? -1 : 1;
          const bMatch = bCross === targetCross ? -1 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return Number(a.standard_cost) - Number(b.standard_cost);
        });
        selected = compatible[0];
      } else if (categoryKey === 'CABLE_AC') {
        const targetCross = Number(requirements.cables?.ac?.conductorCrossSectionSqmm || 4);
        compatible.sort((a, b) => {
          const aCross = Number(a.product_specifications?.cross_section_sqmm || (a.sku.includes('6SQMM') ? 6 : 4));
          const bCross = Number(b.product_specifications?.cross_section_sqmm || (b.sku.includes('6SQMM') ? 6 : 4));
          const aMatch = aCross === targetCross ? -1 : 1;
          const bMatch = bCross === targetCross ? -1 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return Number(a.standard_cost) - Number(b.standard_cost);
        });
        selected = compatible[0];
      } else {
        // Sort by standard_cost ascending
        compatible.sort((a, b) => Number(a.standard_cost) - Number(b.standard_cost));
        selected = compatible[0];
      }
    }

    // Alternatives are other compatible products
    const alternatives = compatible
      .filter(p => p.id !== selected.id)
      .map(p => ({
        productId: p.id,
        sku: p.sku,
        brand: p.brand,
        modelName: p.model_name,
        standardCost: Number(p.standard_cost)
      }));

    return {
      selected,
      status: 'MATCHED',
      selectionReason,
      alternatives,
      rejected
    };
  }
};
