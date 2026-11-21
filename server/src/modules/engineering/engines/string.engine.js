/**
 * Photovoltaic String Design Engineering Engine
 * Evaluates temperature-corrected open-circuit voltage, MPPT operating bounds,
 * and series/parallel module electrical layouts.
 */

export const stringEngine = {
  /**
   * Designs and validates electrical string configuration for the array
   */
  designStrings({
    panelCount,
    moduleVoc = 49.50,
    moduleVmp = 41.80,
    moduleIsc = 13.85,
    moduleImp = 12.92,
    tempCoeffVocPct = -0.270,
    tempMinC = 5,
    tempMaxCellC = 65,
    inverterVdcMax = 550,
    inverterVmpptMin = 80,
    inverterVmpptMax = 500,
    inverterMaxInputCurrentA = 16.0,
    inverterMpptTrackers = 1
  }) {
    const blockers = [];
    const warnings = [];

    const voc = Number(moduleVoc);
    const vmp = Number(moduleVmp);
    const isc = Number(moduleIsc);
    const imp = Number(moduleImp);
    const alphaVoc = Number(tempCoeffVocPct);
    const tMin = Number(tempMinC);
    const tMaxCell = Number(tempMaxCellC);
    const vdcMax = Number(inverterVdcMax);
    const vmpptMin = Number(inverterVmpptMin);
    const vmpptMax = Number(inverterVmpptMax);
    const maxIscInverter = Number(inverterMaxInputCurrentA);
    const mppts = Number(inverterMpptTrackers);

    // 1. Temperature-corrected maximum open-circuit voltage per module at record minimum site temp
    // Voc(Tmin) = Voc_STC * [1 + (alphaVoc / 100) * (Tmin - 25)]
    const vocMaxModule = voc * (1 + (alphaVoc / 100) * (tMin - 25));

    // 2. Temperature-corrected minimum operating voltage per module at high summer cell temp
    // Vmp(Tmax) = Vmp_STC * [1 + (-0.35 / 100) * (TmaxCell - 25)]
    const vmpMinModule = vmp * (1 + (-0.350 / 100) * (tMaxCell - 25));

    // 3. Absolute series limits per string
    const maxSeriesModules = vocMaxModule > 0 ? Math.floor(vdcMax / vocMaxModule) : 0;
    const minSeriesModules = vmpMinModule > 0 ? Math.ceil(vmpptMin / vmpMinModule) : 0;

    // 4. Determine optimal string count (capped by available MPPT inputs)
    const maxSupportedStrings = Math.max(1, mppts);
    let stringCount = 1;

    if (maxSeriesModules > 0 && panelCount > maxSeriesModules) {
      // Split into multiple strings up to inverter's physical MPPT limit
      stringCount = Math.min(maxSupportedStrings, Math.ceil(panelCount / maxSeriesModules));
    }

    // If multiple MPPTs available and panel count permits splitting evenly
    if (mppts >= 2 && panelCount >= 10 && stringCount === 1) {
      stringCount = 2;
    }

    const modulesPerString = Math.floor(panelCount / stringCount);
    const remainderModules = panelCount % stringCount;

    if (remainderModules !== 0) {
      warnings.push({
        code: 'UNBALANCED_STRINGS',
        message: `Total ${panelCount} modules cannot be divided evenly across ${stringCount} strings (${modulesPerString} and ${modulesPerString + remainderModules}). Parallel connection on a single MPPT will cause voltage mismatch.`
      });
    }

    // 5. Operating electrical values for the longest string
    const longestStringModules = modulesPerString + remainderModules;
    const stringVocMax = Number((longestStringModules * vocMaxModule).toFixed(2));
    const stringVmpMin = Number((modulesPerString * vmpMinModule).toFixed(2));
    const stringVmpStc = Number((modulesPerString * vmp).toFixed(2));
    const stringIsc = Number(isc.toFixed(2));
    const stringImp = Number(imp.toFixed(2));

    // 6. Hard Engineering Validations
    if (stringVocMax > vdcMax) {
      blockers.push({
        code: 'INVERTER_VOLTAGE_EXCEEDED',
        message: `String maximum open-circuit voltage at ${tMin}°C (${stringVocMax}V) exceeds inverter maximum allowable DC voltage (${vdcMax}V). High risk of inverter bridge breakdown.`,
        expected: `<= ${vdcMax} V`,
        actual: `${stringVocMax} V`
      });
    }

    if (stringVmpMin < vmpptMin) {
      blockers.push({
        code: 'MPPT_RANGE_INVALID',
        message: `String minimum operating voltage at ${tMaxCell}°C (${stringVmpMin}V) drops below inverter MPPT minimum tracking window (${vmpptMin}V). Inverter will shut down or suffer severe clipping.`,
        expected: `>= ${vmpptMin} V`,
        actual: `${stringVmpMin} V`
      });
    }

    if (stringVmpStc > vmpptMax) {
      warnings.push({
        code: 'MPPT_HIGH_VOLTAGE',
        message: `String nominal operating voltage (${stringVmpStc}V) approaches or exceeds MPPT upper threshold (${vmpptMax}V).`,
        expected: `<= ${vmpptMax} V`,
        actual: `${stringVmpStc} V`
      });
    }

    if (stringIsc > maxIscInverter) {
      blockers.push({
        code: 'STRING_CURRENT_EXCEEDED',
        message: `Module short-circuit current (${stringIsc}A) exceeds inverter maximum MPPT DC current rating (${maxIscInverter}A).`,
        expected: `<= ${maxIscInverter} A`,
        actual: `${stringIsc} A`
      });
    }

    return {
      isValid: blockers.length === 0,
      stringCount,
      modulesPerString,
      hasUnbalancedStrings: remainderModules !== 0,
      stringVocMax,
      stringVmpMin,
      stringVmpStc,
      stringIsc,
      stringImp,
      maxSeriesModulesAllowed: maxSeriesModules,
      minSeriesModulesAllowed: minSeriesModules,
      blockers,
      warnings
    };
  }
};
