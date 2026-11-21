/**
 * Rooftop Site Surveys & Engineering BOM Domain Service
 */

import { surveyRepository } from './survey.repository.js';
import { catalogRepository } from '../catalog/catalog.repository.js';
import { crmRepository } from '../crm/crm.repository.js';
import { userRepository } from '../users/user.repository.js';
import { bomService } from '../bom/bom.service.js';
import { withTransaction } from '../../database/index.js';
import { AppError } from '../../utils/response.js';

export const surveyService = {
  /**
   * Schedule a new rooftop site survey for a lead or customer
   */
  async scheduleSurvey(input, actor) {
    // 1. Validate assigned engineer
    const engineer = await userRepository.findById(input.assigned_engineer_id);
    if (!engineer || !engineer.is_active) {
      throw new AppError('Assigned engineer was not found or is inactive.', 400, 'INVALID_ENGINEER');
    }

    return withTransaction(async (trx) => {
      let lead = null;
      let customerId = input.customer_id || null;

      // 2. Validate linked lead
      if (input.lead_id) {
        lead = await crmRepository.findLeadById(input.lead_id, trx);
        if (!lead) {
          throw new AppError('Linked lead not found.', 404, 'LEAD_NOT_FOUND');
        }

        if (lead.customer_id && !customerId) {
          customerId = lead.customer_id;
        }

        // Advance lead stage to SURVEY_SCHEDULED
        await crmRepository.updateLead(lead.id, {
          stage: 'SURVEY_SCHEDULED'
        }, trx);
      }

      // 3. Generate sequential survey number
      const surveyNumber = await surveyRepository.getNextSurveyNumber(trx);

      // 4. Create Survey
      const survey = await surveyRepository.createSurvey({
        survey_number: surveyNumber,
        lead_id: input.lead_id || null,
        customer_id: customerId,
        assigned_engineer_id: input.assigned_engineer_id,
        scheduled_at: new Date(input.scheduled_at),
        status: 'SCHEDULED',
        proposed_capacity_kw: lead?.requested_capacity_kw || null,
        notes: input.notes || null,
        created_by: actor.id
      }, trx);

      // 5. If linked to lead, log activity
      if (lead) {
        await crmRepository.createActivity({
          lead_id: lead.id,
          actor_id: actor.id,
          activity_type: 'STAGE_CHANGE',
          details: {
            action: 'SURVEY_SCHEDULED',
            from_stage: lead.stage,
            to_stage: 'SURVEY_SCHEDULED',
            survey_id: survey.id,
            survey_number: survey.survey_number,
            scheduled_at: input.scheduled_at,
            engineer_name: engineer.full_name
          }
        }, trx);
      }

      return survey;
    });
  },

  /**
   * Get single survey by ID
   */
  async getSurvey(id) {
    const survey = await surveyRepository.findSurveyById(id);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }
    return survey;
  },

  /**
   * List site surveys with filtering
   */
  async listSurveys(queryParams) {
    return surveyRepository.listSurveys(queryParams);
  },

  /**
   * Update rooftop feasibility specifications (Engineer field work)
   */
  async updateSurveySpecs(id, input, actor) {
    const survey = await surveyRepository.findSurveyById(id);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }

    if (['APPROVED', 'CANCELLED'].includes(survey.status)) {
      throw new AppError(`Cannot modify a survey in '${survey.status}' status.`, 400, 'INVALID_SURVEY_STATE');
    }

    // Auto-advance to IN_PROGRESS if currently SCHEDULED
    const newStatus = survey.status === 'SCHEDULED' ? 'IN_PROGRESS' : survey.status;

    return surveyRepository.updateSurvey(id, {
      ...input,
      status: newStatus
    });
  },

  /**
   * Submit survey for engineering management review
   */
  async submitSurvey(id, actor) {
    const survey = await surveyRepository.findSurveyById(id);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }

    if (survey.status === 'APPROVED') {
      throw new AppError('Survey has already been approved.', 400, 'ALREADY_APPROVED');
    }

    // Validation: ensure required rooftop specs are filled
    if (!survey.roof_type || !survey.proposed_capacity_kw || !survey.sanctioned_load_kw) {
      throw new AppError(
        'Rooftop feasibility requires roof_type, proposed_capacity_kw, and sanctioned_load_kw before submission.',
        400,
        'INCOMPLETE_SURVEY_SPECS'
      );
    }

    return surveyRepository.updateSurvey(id, {
      status: 'SUBMITTED'
    });
  },

  /**
   * Review survey: approve or request revision
   */
  async reviewSurvey(id, input, actor) {
    const survey = await surveyRepository.findSurveyById(id);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }

    if (survey.status !== 'SUBMITTED' && survey.status !== 'IN_PROGRESS') {
      throw new AppError(`Only submitted surveys can be reviewed. Current status: ${survey.status}`, 400, 'INVALID_SURVEY_STATE');
    }

    return withTransaction(async (trx) => {
      const updated = await surveyRepository.updateSurvey(id, {
        status: input.decision,
        reviewed_by: actor.id,
        reviewed_at: new Date(),
        review_comments: input.comments || null
      }, trx);

      // If approved and linked to lead, transition lead to SURVEY_APPROVED
      if (input.decision === 'APPROVED' && survey.lead_id) {
        await crmRepository.updateLead(survey.lead_id, {
          stage: 'SURVEY_APPROVED'
        }, trx);

        await crmRepository.createActivity({
          lead_id: survey.lead_id,
          actor_id: actor.id,
          activity_type: 'STAGE_CHANGE',
          details: {
            action: 'SURVEY_APPROVED',
            from_stage: 'SURVEY_SCHEDULED',
            to_stage: 'SURVEY_APPROVED',
            survey_number: survey.survey_number,
            comments: input.comments || null
          }
        }, trx);
      }

      return updated;
    });
  },

  /**
   * Add photo to survey
   */
  async addPhoto(surveyId, input, actor) {
    const survey = await surveyRepository.findSurveyById(surveyId);
    if (!survey) {
      throw new AppError('Site survey not found.', 404, 'SURVEY_NOT_FOUND');
    }

    return surveyRepository.addPhoto({
      survey_id: surveyId,
      photo_category: input.photo_category || 'ROOF_PANORAMA',
      file_url: input.file_url,
      caption: input.caption || null,
      lat: input.lat || null,
      lng: input.lng || null
    });
  },

  /**
   * Automatically generate Engineering Bill of Materials (BOM) based on survey specs
   * Delegates to Engineering BOM Generation Engine 2.0 (bomService)
   */
  async generateBom(surveyId, input, actor) {
    return bomService.generateBom(surveyId, input, actor);
  },

  /**
   * Get BOM details by ID
   */
  async getBom(id) {
    return bomService.getBom(id);
  }
};
