/**
 * Rooftop Site Surveys & Engineering BOM Express Router
 * Mounts at /api/v1/surveys
 */

import { Router } from 'express';
import { surveyController } from './survey.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  scheduleSurveySchema,
  updateSurveySpecsSchema,
  reviewSurveySchema,
  addSurveyPhotoSchema,
  listSurveysQuerySchema,
  generateBomSchema
} from './survey.schemas.js';

export const surveyRouter = Router();

surveyRouter.use(authenticate);

// -----------------------------------------------------------------------------
// SURVEYS
// -----------------------------------------------------------------------------
surveyRouter.get(
  '/',
  requirePermission('surveys:read'),
  validate({ query: listSurveysQuerySchema }),
  surveyController.listSurveys
);

surveyRouter.post(
  '/',
  requirePermission('surveys:create'),
  validate({ body: scheduleSurveySchema }),
  surveyController.scheduleSurvey
);

surveyRouter.get(
  '/:id',
  requirePermission('surveys:read'),
  surveyController.getSurvey
);

surveyRouter.patch(
  '/:id',
  requirePermission('surveys:update'),
  validate({ body: updateSurveySpecsSchema }),
  surveyController.updateSurveySpecs
);

surveyRouter.post(
  '/:id/submit',
  requirePermission('surveys:update'),
  surveyController.submitSurvey
);

surveyRouter.post(
  '/:id/review',
  requirePermission('surveys:approve'),
  validate({ body: reviewSurveySchema }),
  surveyController.reviewSurvey
);

// -----------------------------------------------------------------------------
// PHOTOS
// -----------------------------------------------------------------------------
surveyRouter.post(
  '/:id/photos',
  requirePermission('surveys:update'),
  validate({ body: addSurveyPhotoSchema }),
  surveyController.addPhoto
);

// -----------------------------------------------------------------------------
// BILL OF MATERIALS (BOM)
// -----------------------------------------------------------------------------
surveyRouter.post(
  '/:id/bom',
  requirePermission('bom:manage'),
  validate({ body: generateBomSchema }),
  surveyController.generateBom
);

surveyRouter.get(
  '/bom/:id',
  requirePermission('bom:read'),
  surveyController.getBom
);

export default surveyRouter;
