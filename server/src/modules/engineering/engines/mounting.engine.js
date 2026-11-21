/**
 * Mounting Structure Selection & Substrate Compatibility Engine
 * Evaluates roof substrate, profile, structural loads, and elevation requirements.
 */

export const mountingEngine = {
  /**
   * Evaluates substrate compatibility and determines mounting kit specifications
   */
  evaluateMounting({
    roofType = 'RCC_FLAT',
    structureType = 'STANDARD_GI',
    proposedCapacityKw,
    areaEvaluation = null,
    windSpeedZoneKmph = 150
  }) {
    const blockers = [];
    const warnings = [];

    const capacityKw = Number(proposedCapacityKw);
    const structQty = Math.ceil(capacityKw);

    // CRITICAL RULE CHECK: Area shortage must NEVER automatically select elevated structure
    if (areaEvaluation && areaEvaluation.status === 'AREA_INSUFFICIENT' && structureType !== 'ELEVATED_SUPER_STRUCTURE') {
      warnings.push({
        code: 'AREA_DEFICIT_NOT_RESOLVED_BY_STRUCTURE',
        message: 'Rooftop area is insufficient for the proposed array. Selecting or modifying mounting structures cannot overcome an insufficient physical roof footprint. Structural review and capacity curtailment required.'
      });
    }

    let requiredStructureType = 'STANDARD_GI';
    let targetSubstrate = 'RCC_FLAT';
    let notes = '';

    switch (roofType) {
      case 'METAL_SHEET':
        targetSubstrate = 'METAL_SHEET';
        requiredStructureType = 'FLUSH_MOUNT';
        notes = `Rail-less Anodized Aluminum Clamp Kit for ${structQty} kW industrial metal shed (non-penetrating EPDM clamped to purlins/ridges).`;
        break;

      case 'TILED_ROOF':
        targetSubstrate = 'TILED_ROOF';
        requiredStructureType = 'FLUSH_MOUNT';
        notes = `SS304 Roof Tile Bracket & Rail Mounting Kit for ${structQty} kW slanted tiled roof.`;
        break;

      case 'GROUND_MOUNT':
        targetSubstrate = 'GROUND_MOUNT';
        requiredStructureType = 'STANDARD_GI';
        notes = `Hot-Dip Galvanized Ground Mount Pile/Ramming Structure Kit for ${structQty} kW array.`;
        break;

      case 'OTHER':
        targetSubstrate = 'OTHER';
        requiredStructureType = 'CUSTOM';
        notes = `Specialized custom mounting structure required for non-standard roof substrate (${structQty} kW array).`;
        break;

      case 'RCC_FLAT':
      default:
        targetSubstrate = 'RCC_FLAT';
        if (structureType === 'ELEVATED_SUPER_STRUCTURE') {
          requiredStructureType = 'ELEVATED_SUPER_STRUCTURE';
          notes = `High-Clearance HDG Elevated Super-Structure (>8.5ft clearance) for ${structQty} kW array (allows usable terrace area and bridges parapets).`;
        } else {
          requiredStructureType = 'STANDARD_GI';
          notes = `Standard HDG Elevated GI Mounting Kit (150 km/h wind rated, 300-500mm front clearance) for ${structQty} kW flat slab.`;
        }
        break;
    }

    return {
      isValid: blockers.length === 0,
      targetSubstrate,
      requiredStructureType,
      structQty,
      windSpeedZoneKmph,
      notes,
      blockers,
      warnings
    };
  }
};
