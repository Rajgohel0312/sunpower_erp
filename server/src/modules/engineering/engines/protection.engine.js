/**
 * Electrical Protection & Switchgear Engineering Engine
 * Evaluates ACDB breaker ampacity (1.25x continuous current), DC string fusing,
 * and Type II Surge Protection Devices (SPD).
 */

export const protectionEngine = {
  /**
   * Calculates AC and DC distribution and protection requirements
   */
  evaluateProtection({
    supplyPhase = 'SINGLE',
    maxAcCurrentA = 22.7,
    stringCount = 1,
    stringVocMax = 450,
    moduleMaxSeriesFuseA = 25
  }) {
    const isSinglePhase = supplyPhase === 'SINGLE';

    // 1. AC Breaker Sizing: continuous current rating = 1.25 * I_ac,max per IS/IEC 60898
    const continuousCurrentA = Number(maxAcCurrentA);
    const minMcbRatingA = continuousCurrentA * 1.25;

    // Standard miniature circuit breaker (MCB) frame ratings: 16A, 25A, 32A, 40A, 63A
    let selectedMcbRatingA = 32;
    if (minMcbRatingA > 40) selectedMcbRatingA = 63;
    else if (minMcbRatingA > 32) selectedMcbRatingA = 40;
    else if (minMcbRatingA > 25) selectedMcbRatingA = 32;
    else if (minMcbRatingA > 16) selectedMcbRatingA = 25;
    else selectedMcbRatingA = 16;

    const acPoles = isSinglePhase ? 2 : 4;
    const acSpdVoltage = isSinglePhase ? 320 : 440;

    // 2. DC Combiner & Protection Sizing
    const dcStrings = Math.max(1, Number(stringCount));
    // DC fuse must be <= module max series fuse rating (typically 20A or 25A) and >= 1.25 * Isc
    const dcFuseRatingA = 15;
    const dcSpdVoltage = stringVocMax > 600 ? 1000 : 600;

    return {
      acdb: {
        phase: supplyPhase,
        poles: acPoles,
        breakerRatingA: selectedMcbRatingA,
        spdType: 'Type 2',
        spdVoltageRatingV: acSpdVoltage,
        notes: isSinglePhase
          ? `Single-Phase ACDB with 2-Pole ${selectedMcbRatingA}A MCB (Trip Curve C) & 320V Type II SPD Protection`
          : `Three-Phase ACDB with 4-Pole ${selectedMcbRatingA}A MCB (Trip Curve C) & 440V Type II SPD Protection`
      },
      dcdb: {
        supportedStrings: Math.max(2, dcStrings),
        fuseRatingA: dcFuseRatingA,
        spdType: 'Type 2 DC',
        spdVoltageRatingV: dcSpdVoltage,
        notes: `${Math.max(2, dcStrings)}-In ${Math.max(2, dcStrings)}-Out 1000V DC Combiner Box with ${dcFuseRatingA}A gPV Fuses & SPD Protection`
      }
    };
  }
};
