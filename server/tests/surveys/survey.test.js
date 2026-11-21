/**
 * Rooftop Site Surveys & Engineering BOM Automated Test Suite (Phase 4)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { surveyService } from '../../src/modules/surveys/survey.service.js';
import { crmService } from '../../src/modules/crm/crm.service.js';
import { prisma } from '../../src/database/index.js';
import {
  scheduleSurveySchema,
  updateSurveySpecsSchema,
  reviewSurveySchema
} from '../../src/modules/surveys/survey.schemas.js';

describe('Phase 4 — Rooftop Site Survey Zod Boundaries', () => {
  it('scheduleSurveySchema requires either lead_id or customer_id', () => {
    const invalid = scheduleSurveySchema.safeParse({
      assigned_engineer_id: 'a0000000-0000-0000-0000-000000000001',
      scheduled_at: new Date().toISOString()
    });
    assert.equal(invalid.success, false);
  });

  it('updateSurveySpecsSchema validates roof_type and numeric parameters', () => {
    const valid = updateSurveySpecsSchema.safeParse({
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 450,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 25
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.roof_type, 'RCC_FLAT');
  });

  it('reviewSurveySchema enforces mandatory comments when REVISION_REQUIRED', () => {
    const invalid = reviewSurveySchema.safeParse({
      decision: 'REVISION_REQUIRED',
      comments: ''
    });
    assert.equal(invalid.success, false);

    const valid = reviewSurveySchema.safeParse({
      decision: 'REVISION_REQUIRED',
      comments: 'Please re-measure South-facing obstruction angles'
    });
    assert.equal(valid.success, true);
  });
});

describe('Phase 4 — Survey Execution & Engineering BOM Workflow', () => {
  let testLead = null;
  let adminUser = null;
  let testSurvey = null;

  it('prerequisites: fetches admin user and creates a qualified lead', async () => {
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user should exist in seeded DB');

    // Create a fresh lead for the survey
    testLead = await crmService.createLead({
      full_name: 'Survey Test Customer',
      phone_e164: '+919112233445',
      requested_capacity_kw: 5.0,
      monthly_electricity_bill: 6500,
      source: 'PHONE',
      site_address: '101 Sunshine Heights, Drive-in Road',
      city: 'Ahmedabad',
      pincode: '380054'
    }, adminUser);

    assert.ok(testLead.id);
    assert.equal(testLead.stage, 'NEW');

    // Qualify the lead
    testLead = await crmService.updateLead(testLead.id, { stage: 'CONTACTED' }, adminUser);
    testLead = await crmService.updateLead(testLead.id, { stage: 'QUALIFIED' }, adminUser);
    assert.equal(testLead.stage, 'QUALIFIED');
  });

  it('schedules a rooftop site survey and advances lead stage to SURVEY_SCHEDULED', async () => {
    testSurvey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      notes: 'Terrace accessible via internal stairs.'
    }, adminUser);

    assert.ok(testSurvey.id);
    assert.ok(testSurvey.survey_number.startsWith('SRV-'));
    assert.equal(testSurvey.status, 'SCHEDULED');
    assert.equal(testSurvey.lead_id, testLead.id);

    // Verify lead stage automatically moved to SURVEY_SCHEDULED
    const updatedLead = await crmService.getLead(testLead.id);
    assert.equal(updatedLead.stage, 'SURVEY_SCHEDULED');

    // Verify activity logged
    const activities = updatedLead.activities;
    const surveyActivity = activities.find(a => a.activity_type === 'STAGE_CHANGE' && a.details?.action === 'SURVEY_SCHEDULED');
    assert.ok(surveyActivity, 'Activity should log survey scheduling');
  });

  it('records rooftop technical specifications and advances status to IN_PROGRESS', async () => {
    const updated = await surveyService.updateSurveySpecs(testSurvey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 400,
      proposed_capacity_kw: 5.4,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      discom_provider: 'UGVCL',
      consumer_number: '12345678901',
      distance_roof_to_meter_m: 20,
      structure_type: 'STANDARD_GI',
      earthing_pits_needed: 2
    }, adminUser);

    assert.equal(updated.status, 'IN_PROGRESS');
    assert.equal(updated.roof_type, 'RCC_FLAT');
    assert.equal(Number(updated.proposed_capacity_kw), 5.4);
  });

  it('submits survey for engineering review', async () => {
    const submitted = await surveyService.submitSurvey(testSurvey.id, adminUser);
    assert.equal(submitted.status, 'SUBMITTED');
  });

  it('approves survey and advances linked lead stage to SURVEY_APPROVED', async () => {
    const approved = await surveyService.reviewSurvey(testSurvey.id, {
      decision: 'APPROVED',
      comments: 'Rooftop structural integrity verified. Clear shadow-free area confirmed.'
    }, adminUser);

    assert.equal(approved.status, 'APPROVED');
    assert.ok(approved.reviewed_at);

    // Verify lead stage is now SURVEY_APPROVED
    const updatedLead = await crmService.getLead(testLead.id);
    assert.equal(updatedLead.stage, 'SURVEY_APPROVED');
  });

  it('automatically sizes and generates Engineering Bill of Materials (BOM)', async () => {
    const bom = await surveyService.generateBom(testSurvey.id, {}, adminUser);

    assert.ok(bom.id);
    assert.ok(bom.bom_number.startsWith('BOM-'));
    assert.equal(Number(bom.system_capacity_kw), 5.4);
    assert.equal(bom.status, 'DRAFT');
    assert.ok(Number(bom.total_cost) > 50000, 'Total BOM cost should be computed');

    // Check items
    const items = bom.project_bom_items;
    assert.ok(items.length >= 7, 'Smart BOM must include modules, inverter, structure, DC cable, AC cable, boxes, earthing, LA and BOS');

    // 5.4 kW with 540W modules = 10 modules
    const modulesItem = items.find(i => i.products?.sku?.includes('WAAREE') || i.products?.sku?.includes('PNL'));
    assert.ok(modulesItem);
    assert.equal(Number(modulesItem.quantity), 10);

    // Inverter (5kW 1P since single phase)
    const inverterItem = items.find(i => i.products?.sku === 'INV-GROWATT-5KW-1P');
    assert.ok(inverterItem, 'Should select Growatt 5kW 1-Phase inverter for 5.4kW single phase');
    assert.equal(Number(inverterItem.quantity), 1);

    // Lightning Arrester (auto included since 5.4 kW >= 5 kW)
    const laItem = items.find(i => i.products?.sku === 'LA-LIGHTNING-ARRESTER-KIT');
    assert.ok(laItem, 'LA kit should be auto-included for >= 5 kW');

    // BOS Kit
    const bosItem = items.find(i => i.products?.sku === 'ACC-INSTALL-KIT-PERKW');
    assert.ok(bosItem, 'BOS kit should be included');
    assert.equal(Number(bosItem.quantity), 6); // ceil(5.4) = 6
  });

  it('smart BOM adapts structure to STR-TIN-SHED-PERKW for METAL_SHEET roofs', async () => {
    // Schedule a metal sheet survey
    const metalSurvey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(metalSurvey.id, {
      roof_type: 'METAL_SHEET',
      shadow_free_area_sqft: 800,
      proposed_capacity_kw: 6.0,
      sanctioned_load_kw: 6.0,
      supply_phase: 'SINGLE',
      distance_roof_to_meter_m: 15
    }, adminUser);

    const metalBom = await surveyService.generateBom(metalSurvey.id, {}, adminUser);
    const items = metalBom.project_bom_items;

    const structItem = items.find(i => i.products?.sku === 'STR-TIN-SHED-PERKW');
    assert.ok(structItem, 'Metal sheet roof must automatically select tin shed clamp kit');
    assert.equal(Number(structItem.quantity), 6);
  });

  it('smart BOM selects 3-phase inverter and 3-phase ACDB for THREE phase supply', async () => {
    const threePhaseSurvey = await surveyService.scheduleSurvey({
      lead_id: testLead.id,
      assigned_engineer_id: adminUser.id,
      scheduled_at: new Date().toISOString()
    }, adminUser);

    await surveyService.updateSurveySpecs(threePhaseSurvey.id, {
      roof_type: 'RCC_FLAT',
      shadow_free_area_sqft: 1200,
      proposed_capacity_kw: 10.0,
      sanctioned_load_kw: 12.0,
      supply_phase: 'THREE',
      distance_roof_to_meter_m: 30
    }, adminUser);

    const threePhaseBom = await surveyService.generateBom(threePhaseSurvey.id, {}, adminUser);
    const items = threePhaseBom.project_bom_items;

    const inv3p = items.find(i => i.products?.sku === 'INV-GROWATT-10KW-3P');
    assert.ok(inv3p, 'Three-phase 10kW system must select Growatt 10kW 3P');

    const acdb3p = items.find(i => i.products?.sku === 'BOX-ACDB-3P-10KW');
    assert.ok(acdb3p, 'Three-phase system must select 3-Phase ACDB box');
  });
});
