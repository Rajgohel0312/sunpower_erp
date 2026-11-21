/**
 * Solar Inverter Sizing & Compatibility Engineering Engine
 * Evaluates grid supply phase matching, DC/AC oversizing ratio, and electrical rating safety.
 */

export const inverterEngine = {
  /**
   * Assesses technical compatibility of an inverter with site requirements and array design
   */
  evaluateCompatibility({
    actualDcCapacityKw,
    supplyPhase = 'SINGLE',
    inverterSpecs = {},
    stringResults = null
  }) {
    const blockers = [];
    const warnings = [];

    const dcWatts = Number(actualDcCapacityKw) * 1000;
    const acRatedWatts = Number(inverterSpecs.rated_ac_power_w || 5000);
    const inverterPhase = inverterSpecs.phase || 'SINGLE';

    // 1. Mandatory Grid Supply Phase Check
    if (supplyPhase !== inverterPhase) {
      blockers.push({
        code: 'INVERTER_PHASE_MISMATCH',
        message: `Grid supply is ${supplyPhase} Phase, but inverter is engineered for ${inverterPhase} Phase systems. Connecting an incompatible phase inverter will be rejected by the DISCOM inspector and trips grid protection.`,
        expected: supplyPhase,
        actual: inverterPhase
      });
    }

    // 2. DC/AC Ratio Evaluation (Array Overloading / Undersizing)
    const dcAcRatio = Number((dcWatts / acRatedWatts).toFixed(2));

    if (dcAcRatio > 1.40) {
      blockers.push({
        code: 'DC_AC_RATIO_EXCESSIVE',
        message: `DC/AC ratio is ${dcAcRatio} (Array: ${(dcWatts / 1000).toFixed(2)} kWp, Inverter AC: ${(acRatedWatts / 1000).toFixed(2)} kW). Exceeds recommended maximum of 1.35. Inverter will suffer continuous thermal clipping and warranty void.`,
        expected: '<= 1.35',
        actual: `${dcAcRatio}`
      });
    } else if (dcAcRatio > 1.30) {
      warnings.push({
        code: 'DC_AC_RATIO_HIGH',
        message: `DC/AC ratio is ${dcAcRatio}. Peak summer generation may experience minor mid-day clipping.`
      });
    } else if (dcAcRatio < 0.80) {
      warnings.push({
        code: 'INVERTER_OVERSIZED',
        message: `Inverter AC capacity (${(acRatedWatts / 1000).toFixed(2)} kW) is significantly larger than DC array (${(dcWatts / 1000).toFixed(2)} kWp, ratio ${dcAcRatio}). Lower efficiency at partial loads.`
      });
    }

    // 3. String design electrical results check (if provided)
    if (stringResults && !stringResults.isValid) {
      stringResults.blockers.forEach(b => blockers.push(b));
    }
    if (stringResults && stringResults.warnings?.length > 0) {
      stringResults.warnings.forEach(w => warnings.push(w));
    }

    return {
      isCompatible: blockers.length === 0,
      dcAcRatio,
      ratedAcPowerKw: Number((acRatedWatts / 1000).toFixed(2)),
      inverterPhase,
      blockers,
      warnings
    };
  }
};
