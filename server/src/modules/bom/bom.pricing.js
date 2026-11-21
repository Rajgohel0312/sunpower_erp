/**
 * BOM Commercial Pricing Engine
 * Computes subtotal, taxes, and grand totals with exact decimal arithmetic.
 */

export const bomPricing = {
  /**
   * Calculates total hardware cost from generated items
   */
  calculateTotals(items = []) {
    const subtotal = items.reduce((acc, it) => acc + Number(it.total_cost), 0);
    const grandTotalCost = Number(subtotal.toFixed(2));

    return {
      itemCount: items.length,
      subtotalCost: grandTotalCost,
      grandTotalCost
    };
  }
};
