/**
 * BOM Domain Service (Tier C Orchestrator)
 * Coordinates engineering calculation, product mapping, pricing, and revision persistence.
 */

import { bomRepository } from './bom.repository.js';
import { engineeringService } from '../engineering/engineering.service.js';
import { productMappingService } from '../product-mapping/product-mapping.service.js';
import { bomGenerator } from './bom.generator.js';
import { bomPricing } from './bom.pricing.js';
import { bomValidator } from './bom.validator.js';
import { surveyRepository } from '../surveys/survey.repository.js';
import { withTransaction } from '../../database/index.js';
import { AppError } from '../../utils/response.js';

export const bomService = {
  /**
   * Generates a new Engineering Bill of Materials revision for a rooftop site survey
   * @param {string} surveyId - Target survey UUID
   * @param {Object} input - Manual overrides or options
   * @param {Object} actor - Authenticated engineer / admin user
   */
  async generateBom(surveyId, input = {}, actor) {
    const survey = await surveyRepository.findSurveyById(surveyId);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }

    if (!survey.proposed_capacity_kw || Number(survey.proposed_capacity_kw) <= 0) {
      throw new AppError('Survey does not have a valid proposed_capacity_kw to size BOM.', 400, 'CAPACITY_REQUIRED');
    }

    // 1. TIER A: Pure Engineering Requirements Generation
    const requirements = engineeringService.generateRequirements(survey, input.reference_specs || {});

    // 2. TIER B: Product Mapping & Technical Compatibility Check
    const mappingResults = await productMappingService.mapRequirements(requirements, input);

    // 3. TIER C: Line Item Assembly & Sizing Quantities
    const items = bomGenerator.generateItems(requirements, mappingResults, input);

    // 4. Commercial Pricing Calculation
    const pricing = bomPricing.calculateTotals(items);

    // 5. Final Multi-Variable Validation & Approval Gating
    const validation = bomValidator.validateBOM({ requirements, mappingResults, items });

    // 6. Transactional Persistence & Version Incrementing
    return withTransaction(async (trx) => {
      const nextVersion = (await bomRepository.findLatestVersion(surveyId, trx)) + 1;
      await bomRepository.supersedeDraftBoms(surveyId, trx);
      const bomNumber = await bomRepository.getNextBomNumber(trx);

      const inverterAcWatts = Number(mappingResults.mapping?.inverter?.selected?.rated_capacity_w || (requirements.inverter.targetAcPowerKw * 1000) || 5000);
      const dcAcRatio = Number(((requirements.capacity.actualDcCapacityKw * 1000) / inverterAcWatts).toFixed(2));

      const engineeringSnapshot = {
        electrical: {
          total_modules: requirements.capacity.panelCount,
          strings_count: requirements.stringing.stringCount,
          modules_per_string: requirements.stringing.modulesPerString,
          voc_max_v: requirements.stringing.stringVocMax,
          vmp_min_v: requirements.stringing.stringVmpMin,
          vmp_stc_v: requirements.stringing.stringVmpStc,
          dc_ac_ratio: dcAcRatio,
          voltage_drop_dc_pct: requirements.cables?.dc?.voltageDropPct || 0,
          voltage_drop_ac_pct: requirements.cables?.ac?.voltageDropPct || 0
        },
        mechanical: {
          gross_module_area_sqft: requirements.area.grossModuleAreaSqft || Number((requirements.capacity.panelCount * 27.81).toFixed(1)),
          required_footprint_sqft: requirements.area.requiredFootprintSqft || requirements.area.requiredSqft,
          available_area_sqft: requirements.area.availableSqft,
          area_deficit_sqft: requirements.area.deficitSqft || 0,
          max_feasible_capacity_kw: requirements.area.maxFeasibleCapacityKw
        },
        protection: {
          ac_breaker_rating_a: requirements.protection?.acdb?.breakerRatingA || 32,
          ac_poles: requirements.protection?.acdb?.poles || 2,
          earthing_pits: requirements.earthing?.totalRecommendedPits || 2,
          lightning_protection_required: requirements.earthing?.requiresLightningArrester || false
        },
        capacity: requirements.capacity,
        area: requirements.area,
        stringing: {
          stringCount: requirements.stringing.stringCount,
          modulesPerString: requirements.stringing.modulesPerString,
          stringVocMax: requirements.stringing.stringVocMax,
          stringVmpMin: requirements.stringing.stringVmpMin,
          stringVmpStc: requirements.stringing.stringVmpStc
        },
        inverter: requirements.inverter,
        mounting: requirements.mounting,
        cables: requirements.cables,
        bos: requirements.bos
      };

      const createdBom = await bomRepository.createBomWithItems(
        {
          bom_number: bomNumber,
          survey_id: surveyId,
          lead_id: survey.lead_id,
          customer_id: survey.customer_id,
          version: nextVersion,
          system_capacity_kw: requirements.capacity.actualDcCapacityKw,
          status: 'DRAFT',
          total_cost: pricing.grandTotalCost,
          generation_mode: validation.generationMode,
          is_approval_blocked: validation.isApprovalBlocked,
          engineering_snapshot: engineeringSnapshot,
          created_by: actor?.id || null
        },
        items,
        validation.validations,
        trx
      );

      return createdBom;
    });
  },

  /**
   * Retrieves BOM with items, specifications, and validations
   */
  async getBom(id) {
    const bom = await bomRepository.findBomById(id);
    if (!bom) {
      throw new AppError('Bill of Materials not found.', 404, 'BOM_NOT_FOUND');
    }
    return bom;
  },

  /**
   * Lists all historical BOM revisions for a survey
   */
  async listRevisions(surveyId) {
    return bomRepository.listBomsBySurveyId(surveyId);
  },

  /**
   * Approves a BOM revision for installation / procurement
   */
  async approveBom(id, actor) {
    const bom = await bomRepository.findBomById(id);
    if (!bom) {
      throw new AppError('Bill of Materials not found.', 404, 'BOM_NOT_FOUND');
    }

    if (bom.is_approval_blocked || bom.generation_mode === 'PRELIMINARY') {
      const blockers = bom.bom_validations?.filter(v => v.severity === 'BLOCKER') || [];
      const reasons = blockers.map(b => `[${b.code}]: ${b.description}`).join('; ');
      throw new AppError(
        `Cannot approve BOM with critical engineering failures: ${reasons || 'Engineering rules not satisfied.'}`,
        400,
        'APPROVAL_BLOCKED',
        { blockers }
      );
    }

    if (bom.status === 'APPROVED') {
      throw new AppError('BOM revision is already approved.', 400, 'ALREADY_APPROVED');
    }

    return bomRepository.updateStatus(id, 'APPROVED', actor.id);
  },

  /**
   * Rejects a BOM revision
   */
  async rejectBom(id, reason, actor) {
    const bom = await bomRepository.findBomById(id);
    if (!bom) {
      throw new AppError('Bill of Materials not found.', 404, 'BOM_NOT_FOUND');
    }
    return bomRepository.updateStatus(id, 'REJECTED', actor.id);
  }
};
