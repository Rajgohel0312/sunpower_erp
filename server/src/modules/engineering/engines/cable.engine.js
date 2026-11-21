/**
 * DC and AC Solar Cable Engineering Engine
 * Evaluates conductor sizing, resistance, thermal derating, and Ohm's law voltage drop.
 */

export const cableEngine = {
  /**
   * Calculates DC solar string cable requirements and voltage drop
   */
  calculateDcCable({
    distanceMeters = 20,
    stringCount = 1,
    stringImp = 12.92,
    stringVmp = 400.0,
    conductorCrossSectionSqmm = 4.0,
    ambientTempC = 45,
    maxAllowedDropPct = 1.5
  }) {
    const blockers = [];
    const warnings = [];

    const oneWayDistance = Math.max(5, Number(distanceMeters));
    const strings = Math.max(1, Number(stringCount));
    const imp = Number(stringImp);
    const vmp = Math.max(100, Number(stringVmp));
    const crossSection = Number(conductorCrossSectionSqmm);

    // Round-trip circuit length per string: (OneWay * 2) + 10% routing margin + 3m connection slack
    const circuitLengthPerString = Math.ceil((oneWayDistance * 2 * 1.1) + 3);
    const totalDcLength = circuitLengthPerString * strings;

    // Conductor resistance for Tinned Copper Class 5 at 20°C:
    // 4 sq mm = 4.95 ohm/km; 6 sq mm = 3.30 ohm/km; 10 sq mm = 1.91 ohm/km
    let r20 = 4.95;
    if (crossSection >= 10.0) r20 = 1.91;
    else if (crossSection >= 6.0) r20 = 3.30;

    // Temperature correction of resistance: R_T = R_20 * [1 + 0.00393 * (T_op - 20)]
    // Operating temp for UV cable on hot rooftop: ~70°C
    const rOp = r20 * (1 + 0.00393 * (70 - 20)); // ohm per km
    const loopDistanceKm = (circuitLengthPerString) / 1000;
    const totalLoopResistance = rOp * loopDistanceKm; // ohm

    // Voltage Drop (V) = I_mp * R_loop
    const voltageDropV = Number((imp * totalLoopResistance).toFixed(2));
    const voltageDropPct = Number(((voltageDropV / vmp) * 100).toFixed(2));

    if (voltageDropPct > maxAllowedDropPct) {
      if (voltageDropPct > 2.5) {
        blockers.push({
          code: 'CABLE_VOLTAGE_DROP_EXCEEDED',
          message: `DC solar cable voltage drop is ${voltageDropPct}% (${voltageDropV}V drop across ${oneWayDistance}m run), exceeding maximum allowable limit of ${maxAllowedDropPct}%. Upsize conductor to 6 sq mm or reduce cable path length.`,
          expected: `<= ${maxAllowedDropPct}%`,
          actual: `${voltageDropPct}%`
        });
      } else {
        warnings.push({
          code: 'CABLE_VOLTAGE_DROP_HIGH',
          message: `DC cable voltage drop is ${voltageDropPct}%, which exceeds optimal ${maxAllowedDropPct}% recommendation. Consider 6 sq mm cable for higher lifetime yield.`
        });
      }
    }

    return {
      totalDcLengthMeters: totalDcLength,
      circuitLengthPerStringMeters: circuitLengthPerString,
      strings,
      conductorCrossSectionSqmm: crossSection,
      voltageDropV,
      voltageDropPct,
      isDropCompliant: blockers.length === 0,
      notes: `${totalDcLength}m UV-resistant ${crossSection} sq mm tinned copper DC cable (${strings} string${strings > 1 ? 's' : ''}, ${oneWayDistance}m one-way run, ${voltageDropPct}% V-drop)`,
      blockers,
      warnings
    };
  },

  /**
   * Calculates AC power armored cable requirements and voltage drop
   */
  calculateAcCable({
    distanceMeters = 20,
    ratedAcPowerW = 5000,
    phase = 'SINGLE',
    conductorCrossSectionSqmm = 4.0,
    maxAllowedDropPct = 2.0
  }) {
    const blockers = [];
    const warnings = [];

    const distance = Math.max(5, Number(distanceMeters));
    const acPower = Number(ratedAcPowerW);
    const isSinglePhase = phase === 'SINGLE';
    const nominalVoltage = isSinglePhase ? 230.0 : 415.0;

    // AC Length: distance + 15% conduit bends/routing margin + 4m termination tails
    const totalAcLength = Math.ceil((distance * 1.15) + 4);

    // Current:
    // Single Phase: I_ac = P / (V_phase * PF) where PF = 0.98
    // Three Phase: I_ac = P / (sqrt(3) * V_line * PF)
    const pf = 0.98;
    const maxAcCurrent = isSinglePhase
      ? Number((acPower / (nominalVoltage * pf)).toFixed(2))
      : Number((acPower / (Math.sqrt(3) * nominalVoltage * pf)).toFixed(2));

    // Copper Resistance at 50°C for 4 sq mm = ~4.95 ohm/km; 6 sq mm = ~3.30 ohm/km; 10 sq mm = ~1.91 ohm/km
    let r20 = 4.95;
    if (conductorCrossSectionSqmm >= 10.0) r20 = 1.91;
    else if (conductorCrossSectionSqmm >= 6.0) r20 = 3.30;
    const rOp = r20 * (1 + 0.00393 * (50 - 20)); // ohm per km

    // Voltage Drop:
    // Single phase: 2 * L * I * R
    // Three phase: sqrt(3) * L * I * R
    const distKm = totalAcLength / 1000;
    const voltageDropV = isSinglePhase
      ? Number((2 * distKm * maxAcCurrent * rOp).toFixed(2))
      : Number((Math.sqrt(3) * distKm * maxAcCurrent * rOp).toFixed(2));

    const voltageDropPct = Number(((voltageDropV / nominalVoltage) * 100).toFixed(2));

    if (voltageDropPct > maxAllowedDropPct) {
      if (voltageDropPct > 3.0) {
        blockers.push({
          code: 'AC_VOLTAGE_DROP_EXCEEDED',
          message: `AC cable voltage drop is ${voltageDropPct}% (${voltageDropV}V across ${totalAcLength}m run), exceeding maximum allowable limit of ${maxAllowedDropPct}%. Upsize conductor to reduce thermal losses and prevent grid-coupling trips.`,
          expected: `<= ${maxAllowedDropPct}%`,
          actual: `${voltageDropPct}%`
        });
      } else {
        warnings.push({
          code: 'AC_VOLTAGE_DROP_HIGH',
          message: `AC cable voltage drop is ${voltageDropPct}%. Consider upsizing to 6 sq mm if distance increases.`
        });
      }
    }

    // Required core count:
    // Single Phase: 3-Core (Phase + Neutral + Earth) or 4-Core armored with dedicated armor earth
    // Three Phase: 4-Core (R + Y + B + N)
    const requiredCores = isSinglePhase ? 4 : 4; // Using standard 4-Core armored copper cable in inventory

    return {
      totalAcLengthMeters: totalAcLength,
      phase,
      nominalVoltage,
      maxAcCurrent,
      requiredCores,
      voltageDropV,
      voltageDropPct,
      isDropCompliant: blockers.length === 0,
      notes: `${totalAcLength}m Heavy-Duty 4-Core ${conductorCrossSectionSqmm} sq mm Armored Copper Cable (${phase} Phase connection to net meter, ${maxAcCurrent}A, ${voltageDropPct}% V-drop)`,
      blockers,
      warnings
    };
  }
};
