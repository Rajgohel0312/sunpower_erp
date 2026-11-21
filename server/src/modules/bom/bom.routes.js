/**
 * BOM Express Router
 * Mounts at /api/v1/boms
 */

import { Router } from 'express';
import { bomController } from './bom.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

export const bomRouter = Router();

bomRouter.use(authenticate);

bomRouter.post(
  '/generate/:surveyId',
  requirePermission('bom:manage'),
  bomController.generateBom
);

bomRouter.get(
  '/:id',
  requirePermission('bom:read'),
  bomController.getBom
);

bomRouter.get(
  '/survey/:surveyId/revisions',
  requirePermission('bom:read'),
  bomController.listRevisions
);

bomRouter.post(
  '/:id/approve',
  requirePermission('bom:manage'),
  bomController.approveBom
);

bomRouter.post(
  '/:id/reject',
  requirePermission('bom:manage'),
  bomController.rejectBom
);

export default bomRouter;
