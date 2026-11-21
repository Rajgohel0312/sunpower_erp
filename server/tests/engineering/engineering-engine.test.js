/**
 * Unit Test Suite for Tier A: Pure Physics & Engineering Engines
 * Verifies mathematical formulas, temperature corrections, electrical safety limits,
 * and area calculations independent of database state.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { capacityEngine } from '../../src/modules/engineering/engines/capacity.engine.js';
import { areaEngine } from '../../src/modules/engineering/engines/area.engine.js';
import { stringEngine } from '../../src/modules/engineering/engines/string.engine.js';
import { inverterEngine } from '../../src/modules/engineering/engines/inverter.engine.js';
import { mountingEngine } from '../../src/modules/engineering/engines/mounting.engine.js';
import { cableEngine } from '../../src/modules/engineering/engines/cable.engine.js';
import { protectionEngine } from '../../src/modules/engineering/engines/protection.engine.js';
import { earthingEngine } from '../../src/modules/engineering/engines/earthing.engine.js';

describe('Tier A Engineering Engines — Capacity Engine', () => {
  it('correctly calculates module count and installed capacity for standard 540W modules', () => {
    const result = capacityEngine.calculateModuleCapacity(5.4, 540);
    assert.equal(result.panelCount, 10);
    assert.equal(result.actualDcCapacityKw, 5.4);
    assert.equal(result.oversizingDeltaKw, 0);
  });

  it('rounds up module count and tracks positive delta when target is not multiple', () => {
    // 5.0 kW requested with 540W modules: ceil(5000 / 540) = 10 modules = 5.4 kW
    const result = capacityEngine.calculateModuleCapacity(5.0, 540);
    assert.equal(result.panelCount, 10);
    assert.equal(result.actualDcCapacityKw, 5.4);
    assert.equal(result.oversizingDeltaKw, 0.4);
  });
});

describe('Tier A Engineering Engines — Area Engine', () => {
  it('calculates gross module area and required footprint with 1.65 inter-row pitch factor', () => {
    // 10 modules: 2.278m x 1.134m = 2.583252 m² = ~27.806 sqft per module
    // 10 modules = ~278.06 sq ft gross
    // With 1.65 pitch = ~459 sq ft required
    const result = areaEngine.evaluateAreaFeasibility({
      shadowFreeAreaSqft: 600,
      proposedCapacityKw: 5.4,
      panelCount: 10,
      moduleLengthMm: 2278,
      moduleWidthMm: 1134,
      pitchFactor: 1.65
    });
    assert.ok(result.requiredSqft >= 450);
    assert.equal(result.isFeasible, true);
    assert.equal(result.status, 'VERIFIED_FEASIBLE');
    assert.equal(result.approvalEligible, true);
  });

  it('flags AREA_INSUFFICIENT and blocks approval when available space is deficient', () => {
    // 200 sq ft available vs ~459 sq ft required
    const result = areaEngine.evaluateAreaFeasibility({
      shadowFreeAreaSqft: 200,
      proposedCapacityKw: 5.4,
      panelCount: 10,
      moduleLengthMm: 2278,
      moduleWidthMm: 1134,
      pitchFactor: 1.65
    });
    assert.equal(result.isFeasible, false);
    assert.equal(result.status, 'AREA_INSUFFICIENT');
    assert.equal(result.approvalEligible, false); // Hard gate
    assert.ok(result.deficitSqft > 0);
    assert.ok(result.maxFeasibleCapacityKw < 5.4);
  });
});

describe('Tier A Engineering Engines — String Engine', () => {
  it('applies winter temperature correction and detects cold Voc', () => {
    // 10 modules, Voc=49.5V, tempCoeff=-0.270%/C, at 5C (delta=-20C => +5.4% => 52.17V/mod)
    // 1 string of 10 modules = ~521.7 V
    const result = stringEngine.designStrings({
      panelCount: 10,
      moduleVoc: 49.50,
      moduleVmp: 41.80,
      moduleIsc: 13.85,
      moduleImp: 12.92,
      tempCoeffVocPct: -0.270,
      tempMinC: 5,
      tempMaxCellC: 65,
      inverterVdcMax: 600,
      inverterVmpptMin: 140,
      inverterVmpptMax: 550,
      inverterMaxInputCurrentA: 16.0,
      inverterMpptTrackers: 1
    });

    assert.equal(result.isValid, true);
    assert.equal(result.stringCount, 1);
    assert.ok(result.stringVocMax > 500 && result.stringVocMax < 550);
  });

  it('rejects strings exceeding inverter max DC voltage (INVERTER_VOLTAGE_EXCEEDED)', () => {
    // 12 modules split across 2 strings (6 modules/string = ~313 V), but inverter max is only 280V
    const result = stringEngine.designStrings({
      panelCount: 12,
      moduleVoc: 49.50,
      moduleVmp: 41.80,
      moduleIsc: 13.85,
      moduleImp: 12.92,
      tempCoeffVocPct: -0.270,
      tempMinC: 5,
      tempMaxCellC: 65,
      inverterVdcMax: 280, // Lower than string Voc (~313V)
      inverterVmpptMin: 140,
      inverterVmpptMax: 260,
      inverterMaxInputCurrentA: 16.0,
      inverterMpptTrackers: 1
    });

    assert.equal(result.isValid, false);
    const voltageBlocker = result.blockers.find(b => b.code === 'INVERTER_VOLTAGE_EXCEEDED');
    assert.ok(voltageBlocker, 'Must flag INVERTER_VOLTAGE_EXCEEDED');
  });
});

describe('Tier A Engineering Engines — Inverter Engine', () => {
  it('verifies phase matching between grid supply and inverter', () => {
    const singleMatch = inverterEngine.evaluateCompatibility({
      actualDcCapacityKw: 5.4,
      supplyPhase: 'SINGLE',
      inverterSpecs: { rated_ac_power_w: 5000, phase: 'SINGLE' }
    });
    assert.equal(singleMatch.isCompatible, true);
    assert.equal(singleMatch.blockers.length, 0);

    const mismatch = inverterEngine.evaluateCompatibility({
      actualDcCapacityKw: 5.4,
      supplyPhase: 'SINGLE',
      inverterSpecs: { rated_ac_power_w: 5000, phase: 'THREE' }
    });
    assert.equal(mismatch.isCompatible, false);
    const phaseBlocker = mismatch.blockers.find(b => b.code === 'INVERTER_PHASE_MISMATCH');
    assert.ok(phaseBlocker, 'Must flag INVERTER_PHASE_MISMATCH');
  });

  it('calculates DC/AC ratio and flags excessive oversizing', () => {
    // 5.4 kW DC on 5 kW AC inverter = 1.08 ratio (Optimal)
    const optimal = inverterEngine.evaluateCompatibility({
      actualDcCapacityKw: 5.4,
      supplyPhase: 'SINGLE',
      inverterSpecs: { rated_ac_power_w: 5000, phase: 'SINGLE' }
    });
    assert.equal(optimal.dcAcRatio, 1.08);

    // 7.5 kW DC on 5 kW AC inverter = 1.50 ratio (> 1.40 threshold)
    const overloaded = inverterEngine.evaluateCompatibility({
      actualDcCapacityKw: 7.5,
      supplyPhase: 'SINGLE',
      inverterSpecs: { rated_ac_power_w: 5000, phase: 'SINGLE' }
    });
    assert.equal(overloaded.dcAcRatio, 1.5);
    const ratioBlocker = overloaded.blockers.find(b => b.code === 'DC_AC_RATIO_EXCESSIVE');
    assert.ok(ratioBlocker, 'Must flag DC_AC_RATIO_EXCESSIVE');
  });
});

describe('Tier A Engineering Engines — Mounting Engine', () => {
  it('selects rail-less tin shed clamps for METAL_SHEET substrate', () => {
    const selection = mountingEngine.evaluateMounting({
      roofType: 'METAL_SHEET',
      structureType: 'STANDARD_GI',
      proposedCapacityKw: 6.0
    });
    assert.equal(selection.targetSubstrate, 'METAL_SHEET');
    assert.equal(selection.requiredStructureType, 'FLUSH_MOUNT');
    assert.equal(selection.structQty, 6);
  });

  it('never automatically upgrades to elevated super structure on space deficit alone', () => {
    // Passing area deficit must NOT change structure type to ELEVATED_SUPER_STRUCTURE
    const normal = mountingEngine.evaluateMounting({
      roofType: 'RCC_FLAT',
      structureType: 'STANDARD_GI',
      proposedCapacityKw: 6.0,
      areaEvaluation: { status: 'AREA_INSUFFICIENT' }
    });
    assert.equal(normal.requiredStructureType, 'STANDARD_GI');
    assert.notEqual(normal.requiredStructureType, 'ELEVATED_SUPER_STRUCTURE');
  });

  it('honors explicit user selection of ELEVATED_SUPER_STRUCTURE', () => {
    const elevated = mountingEngine.evaluateMounting({
      roofType: 'RCC_FLAT',
      structureType: 'ELEVATED_SUPER_STRUCTURE',
      proposedCapacityKw: 6.0
    });
    assert.equal(elevated.requiredStructureType, 'ELEVATED_SUPER_STRUCTURE');
  });
});

describe('Tier A Engineering Engines — Cable & Protection Engines', () => {
  it('computes DC voltage drop on hot rooftop (70°C) using Ohm\'s law', () => {
    // 20m run on 4 sq mm tinned copper:
    const dcDrop = cableEngine.calculateDcCable({
      distanceMeters: 20,
      stringCount: 1,
      stringImp: 12.92,
      stringVmp: 400.0,
      conductorCrossSectionSqmm: 4.0
    });
    assert.ok(dcDrop.voltageDropPct < 1.5);
    assert.equal(dcDrop.isDropCompliant, true);
  });

  it('sizes AC breaker at 1.25x continuous current rating per safety standards', () => {
    // 5kW single phase (230V): Imax = 22.7 A => 1.25x = 28.375 A => Next standard MCB is 32 A
    const protection = protectionEngine.evaluateProtection({
      supplyPhase: 'SINGLE',
      maxAcCurrentA: 22.7,
      stringCount: 1,
      stringVocMax: 450
    });
    assert.equal(protection.acdb.breakerRatingA, 32);
    assert.equal(protection.acdb.poles, 2);
    assert.equal(protection.acdb.phase, 'SINGLE');
  });

  it('mandates lightning protection and dedicated 3rd earthing pit for systems >= 5 kW', () => {
    const earthingSmall = earthingEngine.evaluateEarthing({ proposedCapacityKw: 3.0 });
    assert.equal(earthingSmall.totalRecommendedPits, 2);
    assert.equal(earthingSmall.requiresLightningArrester, false);

    const earthingLarge = earthingEngine.evaluateEarthing({ proposedCapacityKw: 5.4 });
    assert.equal(earthingLarge.totalRecommendedPits, 3);
    assert.equal(earthingLarge.requiresLightningArrester, true);
  });
});
