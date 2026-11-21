/**
 * Earthing & Lightning Protection Engineering Engine
 * Separates equipment bonding from structural lightning protection (IS/IEC 62305).
 */

export const earthingEngine = {
  /**
   * Sizing earthing and lightning protection system
   */
  evaluateEarthing({
    proposedCapacityKw,
    surveyPitsNeeded = 2,
    structureType = 'STANDARD_GI',
    isElevatedStructure = false,
    buildingHeightMeters = 12
  }) {
    const warnings = [];

    // Equipment earthing requires 2 dedicated earth pits:
    // Pit 1: Solar PV Array Structure & DC combiner bonding
    // Pit 2: Inverter AC body & main ACDB chassis bonding
    let recommendedPits = Math.max(2, Number(surveyPitsNeeded) || 2);

    // Lightning Protection System (LPS) Risk Criteria per IS/IEC 62305:
    // Requires physical lightning arrester when building is elevated (>15m) or array is high-clearance canopy
    const isHighClearance = structureType === 'ELEVATED_SUPER_STRUCTURE' || isElevatedStructure;
    const isCommercialScale = Number(proposedCapacityKw) >= 10.0;

    let requiresLightningArrester = false;
    let lpsReason = '';

    if (isHighClearance) {
      requiresLightningArrester = true;
      recommendedPits = Math.max(recommendedPits, 3);
      lpsReason = 'High-clearance elevated super-structure (>8.5ft) increases effective building capture area. Dedicated Lightning Arrester and isolated 3rd earth pit required per IS/IEC 62305.';
    } else if (isCommercialScale) {
      requiresLightningArrester = true;
      recommendedPits = Math.max(recommendedPits, 3);
      lpsReason = 'Commercial scale array (>=10 kWp) requires dedicated external lightning terminal and isolated dissipation pit.';
    } else if (Number(proposedCapacityKw) >= 5.0) {
      // For 5 to 10 kW residential rooftop, LA is recommended if building is freestanding
      requiresLightningArrester = true;
      recommendedPits = Math.max(recommendedPits, 3);
      lpsReason = 'Recommended for enhanced surge protection on freestanding residential structures.';
    } else {
      requiresLightningArrester = false;
      lpsReason = 'Residential array under 5 kWp with existing building parapet shielding does not require standalone external mast. Standard Type II SPDs provide required surge protection.';
    }

    return {
      equipmentEarthPits: 2,
      totalRecommendedPits: recommendedPits,
      requiresLightningArrester,
      lpsReason,
      notes: `${recommendedPits}x Chemical Earthing Electrodes (2m Copper-Bonded Rods with 25kg carbonaceous backfill compound per pit)${requiresLightningArrester ? ' [Dedicated LA Earth Pit Included]' : ''}`,
      warnings
    };
  }
};
