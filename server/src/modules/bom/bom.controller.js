/**
 * BOM HTTP Controller
 */

import { bomService } from './bom.service.js';
import { sendSuccess } from '../../utils/response.js';

export const bomController = {
  async generateBom(req, res, next) {
    try {
      const surveyId = req.params.surveyId || req.body.survey_id;
      const bom = await bomService.generateBom(surveyId, req.body, req.user);
      return sendSuccess(res, bom, { message: 'Engineering BOM generated successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getBom(req, res, next) {
    try {
      const bom = await bomService.getBom(req.params.id);
      return sendSuccess(res, bom);
    } catch (err) {
      next(err);
    }
  },

  async listRevisions(req, res, next) {
    try {
      const boms = await bomService.listRevisions(req.params.surveyId);
      return sendSuccess(res, boms);
    } catch (err) {
      next(err);
    }
  },

  async approveBom(req, res, next) {
    try {
      const bom = await bomService.approveBom(req.params.id, req.user);
      return sendSuccess(res, bom, { message: 'BOM revision approved successfully for installation' });
    } catch (err) {
      next(err);
    }
  },

  async rejectBom(req, res, next) {
    try {
      const bom = await bomService.rejectBom(req.params.id, req.body.reason, req.user);
      return sendSuccess(res, bom, { message: 'BOM revision rejected' });
    } catch (err) {
      next(err);
    }
  },

  async listBoms(req, res, next) {
    try {
      const boms = await bomService.listBoms(req.query);
      return sendSuccess(res, boms);
    } catch (err) {
      next(err);
    }
  }
};
