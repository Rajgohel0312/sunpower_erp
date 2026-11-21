/**
 * Engineering Service (Tier A Orchestrator)
 * Determines pure engineering installation requirements using physics, electrical, and structural calculations,
 * completely independent of specific catalog product selection.
 */

import { capacityEngine } from './engines/capacity.engine.js';
import { areaEngine } from './engines/area.engine.js';
import { stringEngine } from './engines/string.engine.js';
import { inverterEngine } from './engines/inverter.engine.js';
import { mountingEngine } from './engines/mounting.engine.js';
import { cableEngine } from './engines/cable.engine.js';
import { protectionEngine } from './engines/protection.engine.js';
import { earthingEngine } from './engines/earthing.engine.js';

export const engineeringService = {
  /**
   * Generates technical installation requirements from survey specs
   * @param {Object} survey - Survey specifications record
   * @param {Object} [referenceSpecs] - Optional reference module and inverter specs
   */
  generateRequirements(survey, referenceSpecs = {}) {
    if (!survey || !survey.proposed_capacity_kw || Number(survey.proposed_capacity_kw) <= 0) {
      throw new Error('Valid proposed_capacity_kw is required for engineering sizing');
    }

    const proposedKw = Number(survey.proposed_capacity_kw);
    const shadowAreaSqft = survey.shadow_free_area_sqft ? Number(survey.shadow_free_area_sqft) : null;
    const roofType = survey.roof_type || 'RCC_FLAT';
    const supplyPhase = survey.supply_phase || 'SINGLE';
    const distanceM = Number(survey.distance_roof_to_meter_m || 20);
    const structureType = survey.structure_type || 'STANDARD_GI';

    const allBlockers = [];
    const allWarnings = [];

    // 1. Capacity & Module Count
    const moduleWattageW = referenceSpecs.moduleWattageW || 540;
    const capacity = capacityEngine.calculateModuleCapacity(proposedKw, moduleWattageW);

    // 2. Rooftop Area Feasibility
    const area = areaEngine.evaluateAreaFeasibility({
      shadowFreeAreaSqft: shadowAreaSqft,
      proposedCapacityKw: proposedKw,
      panelCount: capacity.panelCount,
      moduleLengthMm: referenceSpecs.moduleLengthMm || 2278,
      moduleWidthMm: referenceSpecs.moduleWidthMm || 1134
    });

    if (!area.isFeasible) {
      allBlockers.push({
        code: area.status,
        severity: 'BLOCKER',
        component: 'AREA',
        description: area.message,
        expected_value: `>= ${area.requiredSqft} sq ft`,
        actual_value: `${area.availableSqft} sq ft`,
        technical_explanation: area.recommendation
      });
    }

    // 3. String Design
    // Reference inverter voltage limits (550V for 1P, 1100V for 3P)
    const refVdcMax = supplyPhase === 'THREE' ? 1100 : 550;
    const refVmpptMin = supplyPhase === 'THREE' ? 140 : 80;
    const refVmpptMax = supplyPhase === 'THREE' ? 1000 : 500;

    const stringing = stringEngine.designStrings({
      panelCount: capacity.panelCount,
      moduleVoc: referenceSpecs.moduleVoc || 49.50,
      moduleVmp: referenceSpecs.moduleVmp || 41.80,
      moduleIsc: referenceSpecs.moduleIsc || 13.85,
      moduleImp: referenceSpecs.moduleImp || 12.92,
      inverterVdcMax: referenceSpecs.inverterVdcMax || refVdcMax,
      inverterVmpptMin: referenceSpecs.inverterVmpptMin || refVmpptMin,
      inverterVmpptMax: referenceSpecs.inverterVmpptMax || refVmpptMax,
      inverterMpptTrackers: supplyPhase === 'THREE' ? 2 : (proposedKw > 3.6 ? 2 : 1)
    });

    if (stringing.blockers?.length > 0) {
      stringing.blockers.forEach(b => allBlockers.push({ ...b, severity: 'BLOCKER', component: 'STRING' }));
    }
    if (stringing.warnings?.length > 0) {
      stringing.warnings.forEach(w => allWarnings.push({ ...w, severity: 'WARNING', component: 'STRING' }));
    }

    // 4. Inverter Requirements
    const requiredInverterAcKw = proposedKw <= 3.6 ? 3.0 : (proposedKw <= 6.0 ? 5.0 : 10.0);
    const inverter = {
      requiredPhase: supplyPhase,
      nominalGridVoltageV: supplyPhase === 'THREE' ? 415.0 : 230.0,
      targetAcPowerKw: requiredInverterAcKw,
      minMpptWindowV: refVmpptMin,
      maxMpptWindowV: refVmpptMax,
      maxDcVoltageV: refVdcMax,
      minInputCurrentA: stringing.stringIsc
    };

    // 5. Mounting Structure Requirements
    const mounting = mountingEngine.evaluateMounting({
      roofType,
      structureType,
      proposedCapacityKw: proposedKw,
      areaEvaluation: area
    });

    if (mounting.blockers?.length > 0) {
      mounting.blockers.forEach(b => allBlockers.push({ ...b, severity: 'BLOCKER', component: 'MOUNTING' }));
    }
    if (mounting.warnings?.length > 0) {
      mounting.warnings.forEach(w => allWarnings.push({ ...w, severity: 'WARNING', component: 'MOUNTING' }));
    }

    // 6. Cable Sizing with Automatic Conductor Upsizing
    let targetDcCrossSection = Number(referenceSpecs.dcCableCrossSectionSqmm || referenceSpecs.cableCrossSectionSqmm || 4.0);
    let dcCable = cableEngine.calculateDcCable({
      distanceMeters: distanceM,
      stringCount: stringing.stringCount,
      stringImp: stringing.stringImp,
      stringVmp: stringing.stringVmpStc,
      conductorCrossSectionSqmm: targetDcCrossSection
    });

    // Auto-upsize DC cable to 6 sq mm if 4 sq mm has high voltage drop (>1.5%) and user didn't explicitly fix it
    if ((dcCable.warnings?.length > 0 || dcCable.blockers?.length > 0) && targetDcCrossSection < 6.0 && !referenceSpecs.dcCableCrossSectionSqmm) {
      const candidate6mm = cableEngine.calculateDcCable({
        distanceMeters: distanceM,
        stringCount: stringing.stringCount,
        stringImp: stringing.stringImp,
        stringVmp: stringing.stringVmpStc,
        conductorCrossSectionSqmm: 6.0
      });
      if (candidate6mm.isDropCompliant && candidate6mm.warnings.length === 0) {
        targetDcCrossSection = 6.0;
        dcCable = candidate6mm;
      } else if (candidate6mm.blockers.length === 0 && candidate6mm.warnings.length < dcCable.warnings.length) {
        targetDcCrossSection = 6.0;
        dcCable = candidate6mm;
      }
    }

    if (dcCable.blockers?.length > 0) {
      dcCable.blockers.forEach(b => allBlockers.push({ ...b, severity: 'BLOCKER', component: 'CABLE_DC' }));
    }
    if (dcCable.warnings?.length > 0) {
      dcCable.warnings.forEach(w => allWarnings.push({ ...w, severity: 'WARNING', component: 'CABLE_DC' }));
    }

    let targetAcCrossSection = Number(referenceSpecs.acCableCrossSectionSqmm || referenceSpecs.cableCrossSectionSqmm || 4.0);
    let acCable = cableEngine.calculateAcCable({
      distanceMeters: distanceM,
      ratedAcPowerW: requiredInverterAcKw * 1000,
      phase: supplyPhase,
      conductorCrossSectionSqmm: targetAcCrossSection
    });

    // Auto-upsize AC cable to 6 sq mm if 4 sq mm has high voltage drop (>2.0%)
    if ((acCable.warnings?.length > 0 || acCable.blockers?.length > 0) && targetAcCrossSection < 6.0 && !referenceSpecs.acCableCrossSectionSqmm) {
      const candidate6mm = cableEngine.calculateAcCable({
        distanceMeters: distanceM,
        ratedAcPowerW: requiredInverterAcKw * 1000,
        phase: supplyPhase,
        conductorCrossSectionSqmm: 6.0
      });
      if (candidate6mm.isDropCompliant && candidate6mm.warnings.length === 0) {
        targetAcCrossSection = 6.0;
        acCable = candidate6mm;
      } else if (candidate6mm.blockers.length === 0) {
        targetAcCrossSection = 6.0;
        acCable = candidate6mm;
      }
    }

    if (acCable.blockers?.length > 0) {
      acCable.blockers.forEach(b => allBlockers.push({ ...b, severity: 'BLOCKER', component: 'CABLE_AC' }));
    }
    if (acCable.warnings?.length > 0) {
      acCable.warnings.forEach(w => allWarnings.push({ ...w, severity: 'WARNING', component: 'CABLE_AC' }));
    }

    // 7. Protection & Switchgear Requirements
    const protection = protectionEngine.evaluateProtection({
      supplyPhase,
      maxAcCurrentA: acCable.maxAcCurrent,
      stringCount: stringing.stringCount,
      stringVocMax: stringing.stringVocMax
    });

    // 8. Earthing & Lightning Protection
    const earthing = earthingEngine.evaluateEarthing({
      proposedCapacityKw: proposedKw,
      surveyPitsNeeded: survey.earthing_pits_needed,
      structureType: mounting.requiredStructureType
    });

    // 9. BOS Accessories Requirements
    const bos = {
      mc4ConnectorPairs: stringing.stringCount * 2,
      conduitLengthM: Math.ceil(dcCable.totalDcLengthMeters * 0.6 + acCable.totalAcLengthMeters),
      mountingFastenerSets: capacity.panelCount * 4,
      midClamps: Math.max(0, (capacity.panelCount - stringing.stringCount) * 2),
      endClamps: stringing.stringCount * 4
    };

    return {
      capacity,
      area,
      stringing,
      inverter,
      mounting,
      cables: {
        dc: dcCable,
        ac: acCable
      },
      protection,
      earthing,
      bos,
      validationSummary: {
        isValid: allBlockers.length === 0,
        approvalEligible: allBlockers.length === 0 && area.approvalEligible,
        blockers: allBlockers,
        warnings: allWarnings
      }
    };
  }
};
