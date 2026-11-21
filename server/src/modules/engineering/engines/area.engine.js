/**
 * Rooftop Area & Layout Feasibility Engineering Engine
 * Evaluates usable shadow-free rooftop space against physical module footprint,
 * row pitch spacing, and maintenance setbacks.
 */

export const areaEngine = {
  /**
   * Assesses rooftop area feasibility
   * @param {Object} params
   * @param {number} params.shadowFreeAreaSqft - Surveyed shadow-free rooftop space in sq ft
   * @param {number} params.proposedCapacityKw - Target DC capacity in kW
   * @param {number} params.panelCount - Calculated number of PV modules
   * @param {number} [params.moduleLengthMm=2278] - Physical module length
   * @param {number} [params.moduleWidthMm=1134] - Physical module width
   * @param {number} [params.pitchFactor=1.65] - Allowance for inter-row tilt shadow clearance and walkways
   */
  evaluateAreaFeasibility({
    shadowFreeAreaSqft,
    proposedCapacityKw,
    panelCount,
    moduleLengthMm = 2278,
    moduleWidthMm = 1134,
    pitchFactor = 1.65
  }) {
    const availableSqft = shadowFreeAreaSqft ? Number(shadowFreeAreaSqft) : null;
    const capacityKw = Number(proposedCapacityKw);

    // 1. Physical gross module footprint
    // Area per module (sq meters) = (Length * Width) / 10^6
    const moduleAreaSqM = (Number(moduleLengthMm) * Number(moduleWidthMm)) / 1000000;
    // 1 sq meter = 10.7639 sq ft
    const singleModuleSqFt = moduleAreaSqM * 10.7639;
    const netModuleAreaSqft = Number((panelCount * singleModuleSqFt).toFixed(2));

    // 2. Gross installation area required (including tilt pitch, inter-row clearance, maintenance walkways)
    const requiredGrossAreaSqft = Math.ceil(netModuleAreaSqft * Number(pitchFactor));

    // Standard rule-of-thumb benchmark: ~75 sq ft / kWp
    const benchmarkAreaSqft = Math.ceil(capacityKw * 75);
    const effectiveRequiredSqft = Math.max(requiredGrossAreaSqft, benchmarkAreaSqft);

    // If available area is unrecorded or zero, flag for site inspection
    if (availableSqft === null || availableSqft <= 0) {
      return {
        isFeasible: false,
        status: 'SITE_INSPECTION_REQUIRED',
        availableSqft: 0,
        requiredSqft: effectiveRequiredSqft,
        deficitSqft: effectiveRequiredSqft,
        maxFeasibleCapacityKw: 0,
        approvalEligible: false,
        message: 'Shadow-free rooftop area has not been surveyed or verified. Field inspection required.'
      };
    }

    // 3. Area Deficit Check
    const isDeficit = availableSqft < effectiveRequiredSqft;
    const deficitSqft = isDeficit ? Math.ceil(effectiveRequiredSqft - availableSqft) : 0;
    
    // Max capacity physically feasible on this rooftop
    const maxFeasibleCapacityKw = Number(((availableSqft / (effectiveRequiredSqft / capacityKw))).toFixed(1));

    if (isDeficit) {
      return {
        isFeasible: false,
        status: 'AREA_INSUFFICIENT',
        availableSqft,
        requiredSqft: effectiveRequiredSqft,
        requiredFootprintSqft: effectiveRequiredSqft,
        grossModuleAreaSqft: netModuleAreaSqft,
        deficitSqft,
        maxFeasibleCapacityKw,
        approvalEligible: false, // Hard gate: area deficit cannot be approved for installation
        message: `Rooftop shadow-free area (${availableSqft} sq ft) is insufficient for ${capacityKw} kWp (requires ~${effectiveRequiredSqft} sq ft). Area deficit of ${deficitSqft} sq ft. Maximum feasible capacity on this footprint is ~${maxFeasibleCapacityKw} kWp.`,
        recommendation: `Reduce proposed capacity to ${maxFeasibleCapacityKw} kWp or identify additional unobstructed rooftop space. Note: Elevating structure cannot bypass insufficient usable footprint.`
      };
    }

    return {
      isFeasible: true,
      status: 'VERIFIED_FEASIBLE',
      availableSqft,
      requiredSqft: effectiveRequiredSqft,
      requiredFootprintSqft: effectiveRequiredSqft,
      grossModuleAreaSqft: netModuleAreaSqft,
      deficitSqft: 0,
      maxFeasibleCapacityKw,
      approvalEligible: true,
      message: `Rooftop area verified. Available shadow-free space (${availableSqft} sq ft) comfortably accommodates ${capacityKw} kWp array (~${effectiveRequiredSqft} sq ft required).`
    };
  }
};
