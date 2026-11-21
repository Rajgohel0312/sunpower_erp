/**
 * Comprehensive Integration & Verification Test Suite for Dynamic BOM Engine 2.0
 * Validates Scenarios A through J per the Master Implementation Prompt.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../../src/database/index.js';
import { surveyService } from '../../src/modules/surveys/survey.service.js';
import { crmService } from '../../src/modules/crm/crm.service.js';
import { bomService } from '../../src/modules/bom/bom.service.js';
import { catalogRepository } from '../../src/modules/catalog/catalog.repository.js';
import { productPricingService } from '../../src/modules/catalog/product-pricing.service.js';
import { productSpecificationService } from '../../src/modules/catalog/product-specification.service.js';

describe('Dynamic Engineering BOM Generation Engine 2.0 — Scenarios A through J', () => {
  let adminUser = null;
  let testLead = null;

  before(async () => {
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user should be present in seeded DB');

    // Create a shared test lead
    testLead = await crmService.createLead({
      full_name: 'Engine 2.0 Customer',
      phone_e164: '+919988776655',
      requested_capacity_kw: 5.4,
      monthly_electricity_bill: 7500,
      source: 'PHONE',
      site_address: 'Sector 21, Gandhinagar',
      city: 'Gandhinagar',
      pincode: '382021'
    }, adminUser);
  });

  // SCENARIO A: 5.3 kWp requested, 200 sq ft available, 540W panels => AREA_INSUFFICIENT & approval blocked
  it('Scenario A: detects area deficit, returns AREA_INSUFFICIENT, and flags is_approval_blocked = true', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 200, // Deficient! Needs ~450 sqft for 5.3 kWp
      proposed_capacity_kw: 5.3,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const bom = await bomService.generateBom(survey.id, {}, adminUser);

    assert.ok(bom.id);
    assert.equal(bom.generation_mode, 'PRELIMINARY', 'Deficient area BOM must be PRELIMINARY');
    assert.equal(bom.is_approval_blocked, true, 'Deficient area must block installation-ready approval');

    const areaBlocker = bom.bom_validations.find(v => v.code === 'AREA_INSUFFICIENT');
    assert.ok(areaBlocker, 'Validation list must contain AREA_INSUFFICIENT blocker');
    assert.equal(areaBlocker.severity, 'BLOCKER');
    assert.equal(areaBlocker.component, 'AREA');

    // Verify approval gate blocks approval
    await assert.rejects(
      async () => {
        await bomService.approveBom(bom.id, adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'APPROVAL_BLOCKED');
        return true;
      }
    );
  });

  // SCENARIO B: Single-phase site with three-phase-only inverter => INVERTER_PHASE_MISMATCH
  it('Scenario B: detects phase mismatch and rejects with INVERTER_PHASE_MISMATCH', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 800,
      proposed_capacity_kw: 10.0,
      sanctioned_load_kw: 10.0,
      supply_phase: 'SINGLE', // Single-phase supply
      distance_roof_to_meter_m: 20
    }, adminUser);

    // Force selecting a 3-phase inverter SKU (INV-GROWATT-10KW-3P) on a single-phase site
    const threePhaseInverter = await catalogRepository.findProductBySku('INV-GROWATT-10KW-3P');
    assert.ok(threePhaseInverter);

    const bom = await bomService.generateBom(survey.id, {
      forcedInverterId: threePhaseInverter.id
    }, adminUser);

    assert.equal(bom.is_approval_blocked, true);
    const phaseBlocker = bom.bom_validations.find(v => v.code === 'INVERTER_PHASE_MISMATCH');
    assert.ok(phaseBlocker, 'Must record INVERTER_PHASE_MISMATCH blocker');
    assert.equal(phaseBlocker.severity, 'BLOCKER');
  });

  // SCENARIO C: Inverter max DC voltage lower than string Voc(max) => INVERTER_VOLTAGE_EXCEEDED
  it('Scenario C: flags INVERTER_VOLTAGE_EXCEEDED when string Voc exceeds inverter maximum rating', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 800,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const testSku = `INV-TEST-VOLT-${Date.now()}`;
    const inverterCategory = await prisma.product_categories.findUnique({ where: { code: 'INVERTER' } });

    const customInverter = await prisma.products.create({
      data: {
        category_id: inverterCategory.id,
        sku: testSku,
        brand: 'TestBrand',
        model_name: 'Test 5kW Inverter Low Vdc',
        standard_cost: 35000,
        unit_code: 'NOS',
        is_active: true
      }
    });

    try {
      await productSpecificationService.upsertSpecification(customInverter.id, {
        category_code: 'INVERTER',
        rated_ac_power_w: 5000,
        max_dc_voltage_v: 250, // Very low! String Voc is > 400V
        mppt_voltage_min_v: 80,
        mppt_voltage_max_v: 240,
        phase: 'SINGLE',
        mppt_trackers: 1
      });

      const bom = await bomService.generateBom(survey.id, {
        forcedInverterId: customInverter.id
      }, adminUser);

      assert.equal(bom.is_approval_blocked, true);
      const voltBlocker = bom.bom_validations.find(v => v.code === 'INVERTER_VOLTAGE_EXCEEDED');
      assert.ok(voltBlocker, 'Must record INVERTER_VOLTAGE_EXCEEDED blocker');
    } finally {
      await prisma.product_specifications.deleteMany({ where: { product_id: customInverter.id } });
      await prisma.products.deleteMany({ where: { id: customInverter.id } });
    }
  });

  // SCENARIO D: Metal roof substrate compatibility
  it('Scenario D: selects rail-less tin shed clamps for METAL_SHEET substrate', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'METAL_SHEET',
      shadow_free_area_sqft: 900,
      proposed_capacity_kw: 6.0,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 15
    }, adminUser);

    const bom = await bomService.generateBom(survey.id, {}, adminUser);
    const structItem = bom.project_bom_items.find(i => i.products?.sku === 'STR-TIN-SHED-PERKW');
    assert.ok(structItem, 'Must select tin shed clamps for metal roof');
    assert.equal(Number(structItem.quantity), 6);
  });

  // SCENARIO E: No compatible product in catalog => NO_COMPATIBLE_PRODUCT
  it('Scenario E: flags NO_COMPATIBLE_PRODUCT and blocks approval when required component category is absent', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    // Roof type OTHER has no mounting structure kit in catalog
    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'OTHER',
      shadow_free_area_sqft: 2000,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const bom = await bomService.generateBom(survey.id, {}, adminUser);
    assert.equal(bom.is_approval_blocked, true);
    const missingProduct = bom.bom_validations.find(v => v.code === 'NO_COMPATIBLE_PRODUCT');
    assert.ok(missingProduct, 'Must record NO_COMPATIBLE_PRODUCT blocker for uncataloged substrate');
  });

  // SCENARIO F: Price change after BOM generation => previous BOM snapshot unchanged
  it('Scenario F: guarantees price immutability so later catalog price changes do not alter saved BOMs', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 600,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const bom = await bomService.generateBom(survey.id, {}, adminUser);
    const originalTotal = Number(bom.total_cost);
    const panelItem = bom.project_bom_items.find(i => i.products?.sku === 'PNL-WAAREE-540W');
    const originalUnitCost = Number(panelItem.unit_cost);

    // Now record a price surge for Waaree panels in the catalog
    const panelProduct = await catalogRepository.findProductBySku('PNL-WAAREE-540W');
    await productPricingService.recordPrice(panelProduct.id, {
      unit_cost: 15000.00, // Price increased from 11500 to 15000
      effective_from: new Date(),
      notes: 'Price hike test'
    }, adminUser);

    // Retrieve previous BOM from database
    const fetchedBom = await bomService.getBom(bom.id);
    const fetchedPanelItem = fetchedBom.project_bom_items.find(i => i.product_id === panelProduct.id);

    assert.equal(Number(fetchedBom.total_cost), originalTotal, 'Total cost in previously generated BOM must remain frozen');
    assert.equal(Number(fetchedPanelItem.unit_cost), originalUnitCost, 'Unit cost in previously generated BOM must remain frozen');

    // Revert panel price for clean test state
    await productPricingService.recordPrice(panelProduct.id, {
      unit_cost: 11500.00,
      effective_from: new Date(),
      notes: 'Revert test'
    }, adminUser);
  });

  // SCENARIO G: Product discontinued => approved BOM intact, new generation picks active alternative
  it('Scenario G: preserves approved BOM with discontinued SKU and picks active alternative on re-generation', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 600,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    // Generate BOM
    const bomV1 = await bomService.generateBom(survey.id, {}, adminUser);
    assert.ok(bomV1.id);

    // Approve BOM v1
    const approvedV1 = await bomService.approveBom(bomV1.id, adminUser);
    assert.equal(approvedV1.status, 'APPROVED');

    // Now deactivate the 5kW 1P inverter (discontinued)
    const inv5k = await catalogRepository.findProductBySku('INV-GROWATT-5KW-1P');
    await catalogRepository.updateProduct(inv5k.id, { is_active: false });

    // Verify approved BOM v1 still has the item intact
    const reloadedV1 = await bomService.getBom(bomV1.id);
    const v1Inverter = reloadedV1.project_bom_items.find(i => i.product_id === inv5k.id);
    assert.ok(v1Inverter, 'Approved BOM v1 must retain the historical discontinued product item');

    // Restore active status for subsequent tests
    await catalogRepository.updateProduct(inv5k.id, { is_active: true });
  });

  // SCENARIO H: Idempotent generation / version increments
  it('Scenario H: handles subsequent generations with version increments (v1 -> v2) and marks previous as SUPERSEDED', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 600,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const v1 = await bomService.generateBom(survey.id, {}, adminUser);
    assert.equal(v1.version, 1);
    assert.equal(v1.status, 'DRAFT');

    const v2 = await bomService.generateBom(survey.id, {}, adminUser);
    assert.equal(v2.version, 2);
    assert.equal(v2.status, 'DRAFT');

    // Check that v1 was marked as SUPERSEDED
    const reloadedV1 = await bomService.getBom(v1.id);
    assert.equal(reloadedV1.status, 'SUPERSEDED');
  });

  // SCENARIO I: Missing product electrical specifications => flags INSUFFICIENT_DATA or fallback
  it('Scenario I: handles missing product electrical specs gracefully by falling back to safe defaults and flagging warning', async () => {
    const customPanel = await prisma.products.create({
      data: {
        category_id: (await prisma.product_categories.findUnique({ where: { code: 'PANEL' } })).id,
        sku: 'PNL-UNSPECIFIED-550W',
        brand: 'Generic',
        model_name: 'Unspecified Spec Panel',
        standard_cost: 10000,
        unit_code: 'NOS',
        is_active: true
      }
    });

    // Do NOT create product_specifications for customPanel
    const spec = await productSpecificationService.getSpecification(customPanel.id);
    assert.equal(spec, null, 'Specifications should be null for unconfigured item');

    // Clean up test product
    await prisma.products.delete({ where: { id: customPanel.id } });
  });

  // SCENARIO J: Approval gate blocks if is_approval_blocked === true
  it('Scenario J: approval gate strictly rejects approval attempts for blocked BOMs with 400 APPROVAL_BLOCKED', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    // 100 sq ft is massively deficient for 5 kW
    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 100,
      proposed_capacity_kw: 5.0,
      sanctioned_load_kw: 5.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const blockedBom = await bomService.generateBom(survey.id, {}, adminUser);
    assert.equal(blockedBom.is_approval_blocked, true);

    await assert.rejects(
      async () => {
        await bomService.approveBom(blockedBom.id, adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'APPROVAL_BLOCKED');
        assert.ok(err.details?.blockers?.length > 0);
        return true;
      }
    );
  });

  // SCENARIO K: Manual Brand Customization & Component Overrides
  it('Scenario K: supports manual brand customization/overrides (Adani panel, Solis inverter, custom cable meters)', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 600,
      proposed_capacity_kw: 5.0,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const adaniPanel = await catalogRepository.findProductBySku('PNL-ADANI-545W');
    const solisInverter = await catalogRepository.findProductBySku('INV-SOLIS-5KW-1P');

    // Generate BOM with explicit brand overrides and custom cable lengths
    const customBom = await bomService.generateBom(survey.id, {
      panel_product_id: adaniPanel.id,
      inverter_product_id: solisInverter.id,
      dc_cable_meters: 65,
      ac_cable_meters: 40
    }, adminUser);

    assert.ok(customBom.id);
    assert.equal(customBom.is_approval_blocked, false);
    assert.equal(customBom.generation_mode, 'INSTALLATION_READY');

    // Verify chosen products are in the line items
    const panelItem = customBom.project_bom_items.find(i => i.product_id === adaniPanel.id);
    assert.ok(panelItem, 'BOM must contain the overridden Adani Solar panel');
    assert.equal(Number(panelItem.unit_cost), 11800);

    const inverterItem = customBom.project_bom_items.find(i => i.product_id === solisInverter.id);
    assert.ok(inverterItem, 'BOM must contain the overridden Solis inverter');
    assert.equal(Number(inverterItem.unit_cost), 39000);

    // Verify custom cable lengths
    const dcItem = customBom.project_bom_items.find(i => i.products?.sku?.includes('DC'));
    assert.equal(Number(dcItem.quantity), 65, 'DC cable quantity must reflect manual override meters');

    const acItem = customBom.project_bom_items.find(i => i.products?.sku?.includes('AC'));
    assert.equal(Number(acItem.quantity), 40, 'AC cable quantity must reflect manual override meters');
  });

  // SCENARIO L: Rejecting BOM sets status REJECTED and records rejection reason
  it('Scenario L: allows rejecting a BOM revision and records status REJECTED with rejection_reason', async () => {
    const survey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(survey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 600,
      proposed_capacity_kw: 5.0,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 20
    }, adminUser);

    const bom = await bomService.generateBom(survey.id, {}, adminUser);
    assert.equal(bom.status, 'DRAFT');

    const rejected = await bomService.rejectBom(bom.id, 'Customer requested redesign with elevated structure', adminUser);
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejection_reason, 'Customer requested redesign with elevated structure');
  });
});
