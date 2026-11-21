/**
 * Rooftop Site Surveys & Engineering BOM HTTP Controller
 */

import { surveyService } from './survey.service.js';
import { sendSuccess } from '../../utils/response.js';

export const surveyController = {
  async scheduleSurvey(req, res, next) {
    try {
      const survey = await surveyService.scheduleSurvey(req.body, req.user);
      return sendSuccess(res, survey, { message: 'Site survey scheduled successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getSurvey(req, res, next) {
    try {
      const survey = await surveyService.getSurvey(req.params.id);
      return sendSuccess(res, survey);
    } catch (err) {
      next(err);
    }
  },

  async listSurveys(req, res, next) {
    try {
      const result = await surveyService.listSurveys(req.query);
      return sendSuccess(res, result.surveys, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async updateSurveySpecs(req, res, next) {
    try {
      const survey = await surveyService.updateSurveySpecs(req.params.id, req.body, req.user);
      return sendSuccess(res, survey, { message: 'Rooftop survey specs updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async submitSurvey(req, res, next) {
    try {
      const survey = await surveyService.submitSurvey(req.params.id, req.user);
      return sendSuccess(res, survey, { message: 'Survey submitted for engineering approval' });
    } catch (err) {
      next(err);
    }
  },

  async reviewSurvey(req, res, next) {
    try {
      const survey = await surveyService.reviewSurvey(req.params.id, req.body, req.user);
      return sendSuccess(res, survey, { message: `Survey marked as ${req.body.decision}` });
    } catch (err) {
      next(err);
    }
  },

  async addPhoto(req, res, next) {
    try {
      const photo = await surveyService.addPhoto(req.params.id, req.body, req.user);
      return sendSuccess(res, photo, { message: 'Survey photo recorded successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async generateBom(req, res, next) {
    try {
      const bom = await surveyService.generateBom(req.params.id, req.body, req.user);
      return sendSuccess(res, bom, { message: 'Engineering BOM generated successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getBom(req, res, next) {
    try {
      const bom = await surveyService.getBom(req.params.id);
      return sendSuccess(res, bom);
    } catch (err) {
      next(err);
    }
  }
};
