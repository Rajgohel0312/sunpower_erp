import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as installationController from './installation.controller.js';
import {
  createInstallationJobSchema,
  updateJobStatusSchema,
  updateChecklistStepSchema,
  uploadInstallationPhotoSchema,
  submitSignoffSchema,
  listInstallationJobsSchema
} from './installation.validation.js';

const router = Router();

// All installation routes require authenticated user
router.use(authenticate);

router.get(
  '/',
  requirePermission('installations:read'),
  validate(listInstallationJobsSchema, 'query'),
  installationController.listInstallationJobs
);

router.get(
  '/:id',
  requirePermission('installations:read'),
  installationController.getInstallationJob
);

router.post(
  '/',
  requirePermission('installations:create'),
  validate(createInstallationJobSchema),
  installationController.createInstallationJob
);

router.patch(
  '/:id/status',
  requirePermission('installations:update'),
  validate(updateJobStatusSchema),
  installationController.updateJobStatus
);

router.patch(
  '/:id/checklist/:stepKey',
  requirePermission('installations:update'),
  validate(updateChecklistStepSchema),
  installationController.updateChecklistStep
);

router.post(
  '/:id/photos',
  requirePermission('installations:update'),
  validate(uploadInstallationPhotoSchema),
  installationController.uploadInstallationPhoto
);

router.post(
  '/:id/signoff',
  requirePermission('installations:commission'),
  validate(submitSignoffSchema),
  installationController.submitCustomerSignoff
);

export default router;
