import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as dispatchController from './dispatch.controller.js';
import {
  createDispatchSchema,
  updateDispatchStatusSchema,
  listDispatchesSchema
} from './dispatch.validation.js';

const router = Router();

// All dispatch routes require authenticated user
router.use(authenticate);

router.get(
  '/',
  requirePermission('dispatches:read'),
  validate(listDispatchesSchema, 'query'),
  dispatchController.listDispatches
);

router.get(
  '/:id',
  requirePermission('dispatches:read'),
  dispatchController.getDispatch
);

router.post(
  '/',
  requirePermission('dispatches:create'),
  validate(createDispatchSchema),
  dispatchController.createDispatch
);

router.patch(
  '/:id/status',
  requirePermission('dispatches:update'),
  validate(updateDispatchStatusSchema),
  dispatchController.updateDispatchStatus
);

export default router;
