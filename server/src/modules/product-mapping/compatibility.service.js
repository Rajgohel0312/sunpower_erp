/**
 * Product Compatibility Engine (Stage 1: Hard Technical Filtering)
 * Validates catalog products against pure engineering requirements.
 * Rejects products that violate electrical, mechanical, or safety standards.
 */

export const compatibilityService = {
  /**
   * Evaluates Inverter Compatibility
   */
  checkInverter(product, requirements) {
    const specs = product.product_specifications || {};
    const req = requirements.inverter;
    const stringing = requirements.stringing;
    const actualDcKw = requirements.capacity.actualDcCapacityKw;

    // Hard Filter 1: Phase Mismatch
    const prodPhase = specs.phase || (product.sku.includes('3P') ? 'THREE' : 'SINGLE');
    if (prodPhase !== req.requiredPhase) {
      return {
        isCompatible: false,
        code: 'INVERTER_PHASE_MISMATCH',
        reason: `Inverter is ${prodPhase} Phase, but grid connection requires ${req.requiredPhase} Phase.`
      };
    }

    // Hard Filter 2: DC Voltage Rating vs Temperature-Corrected String Voc
    const maxDcV = Number(specs.max_dc_voltage_v || (prodPhase === 'THREE' ? 1100 : 550));
    if (stringing && stringing.stringVocMax > maxDcV) {
      return {
        isCompatible: false,
        code: 'INVERTER_VOLTAGE_EXCEEDED',
        reason: `String maximum Voc (${stringing.stringVocMax}V) exceeds inverter DC maximum rating (${maxDcV}V).`
      };
    }

    // Hard Filter 3: MPPT Lower Window
    const minMpptV = Number(specs.mppt_voltage_min_v || (prodPhase === 'THREE' ? 140 : 80));
    if (stringing && stringing.stringVmpMin < minMpptV) {
      return {
        isCompatible: false,
        code: 'MPPT_RANGE_INVALID',
        reason: `String minimum Vmp (${stringing.stringVmpMin}V) drops below inverter MPPT window (${minMpptV}V).`
      };
    }

    // Hard Filter 4: Max Array Capacity / DC-AC Oversizing Ratio
    const ratedAcWatts = Number(specs.rated_ac_power_w || (product.rated_capacity_w || 5000));
    const ratio = (actualDcKw * 1000) / ratedAcWatts;
    if (ratio > 1.40) {
      return {
        isCompatible: false,
        code: 'DC_AC_RATIO_EXCESSIVE',
        reason: `DC/AC ratio is ${ratio.toFixed(2)}, which exceeds safe maximum limit of 1.35.`
      };
    }
    if (ratio < 0.65) {
      return {
        isCompatible: false,
        code: 'INVERTER_OVERSIZED',
        reason: `Inverter is drastically oversized for array (DC/AC ratio ${ratio.toFixed(2)}).`
      };
    }

    return { isCompatible: true };
  },

  /**
   * Evaluates Mounting Structure Compatibility
   */
  checkMounting(product, requirements) {
    const specs = product.product_specifications || {};
    const req = requirements.mounting;

    // Check supported roof types
    let supported = [];
    if (specs.supported_roof_types) {
      supported = Array.isArray(specs.supported_roof_types)
        ? specs.supported_roof_types
        : JSON.parse(specs.supported_roof_types || '[]');
    } else {
      if (product.sku.includes('TIN')) supported = ['METAL_SHEET'];
      else if (product.sku.includes('TILED')) supported = ['TILED_ROOF'];
      else if (product.sku.includes('SUPER')) supported = ['RCC_FLAT'];
      else supported = ['RCC_FLAT', 'GROUND_MOUNT'];
    }

    if (!supported.includes(req.targetSubstrate)) {
      return {
        isCompatible: false,
        code: 'MOUNTING_PROFILE_MISMATCH',
        reason: `Mounting kit (${product.sku}) supports [${supported.join(', ')}], incompatible with target roof substrate (${req.targetSubstrate}).`
      };
    }

    // Check elevated super structure requirement
    const isSuperElevatedProduct = product.sku.includes('SUPER') || specs.ground_clearance_mm > 2000;
    if (req.requiredStructureType === 'ELEVATED_SUPER_STRUCTURE' && !isSuperElevatedProduct) {
      return {
        isCompatible: false,
        code: 'STRUCTURE_HEIGHT_INSUFFICIENT',
        reason: 'Installation explicitly requires High-Clearance Elevated Super-Structure (>8.5ft).'
      };
    }

    if (req.requiredStructureType !== 'ELEVATED_SUPER_STRUCTURE' && isSuperElevatedProduct && req.targetSubstrate !== 'RCC_FLAT') {
      return {
        isCompatible: false,
        code: 'STRUCTURE_TYPE_UNSUITABLE',
        reason: 'Elevated super structure cannot be mounted on metal sheet or tiled roof substrates.'
      };
    }

    return { isCompatible: true };
  },

  /**
   * Evaluates AC Distribution Box Compatibility
   */
  checkAcdb(product, requirements) {
    const specs = product.product_specifications || {};
    const reqPhase = requirements.inverter.requiredPhase;

    const poles = specs.poles || (product.sku.includes('3P') ? 4 : 2);
    const expectedPoles = reqPhase === 'THREE' ? 4 : 2;

    if (poles !== expectedPoles) {
      return {
        isCompatible: false,
        code: 'PROTECTION_DEVICE_MISMATCH',
        reason: `ACDB has ${poles} poles, but ${reqPhase} Phase requires ${expectedPoles} poles.`
      };
    }

    return { isCompatible: true };
  },

  /**
   * Evaluates Cable Compatibility
   */
  checkCable(product, requirements, cableType = 'DC') {
    const specs = product.product_specifications || {};

    if (cableType === 'DC') {
      const isUv = specs.is_uv_resistant || product.sku.includes('DC');
      if (!isUv) {
        return {
          isCompatible: false,
          code: 'CABLE_INSULATION_INADEQUATE',
          reason: 'DC Solar cable exposed to weather must be certified UV-resistant.'
        };
      }
    } else {
      // AC cable
      const isArmored = specs.is_armored || product.sku.includes('ARMORED');
      if (!isArmored) {
        return {
          isCompatible: false,
          code: 'CABLE_ARMOR_REQUIRED',
          reason: 'External AC grid interconnection cable requires mechanical armor protection.'
        };
      }
    }

    return { isCompatible: true };
  }
};
