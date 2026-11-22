import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as warrantyController from './warranty.controller.js';
import {
  listWarrantiesSchema,
  createWarrantySchema,
  verifyClaimSchema,
  listPoliciesSchema
} from './warranty.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('warranties:read'),
  validate(listWarrantiesSchema, 'query'),
  warrantyController.listWarranties
);

router.get(
  '/policies',
  requirePermission('warranties:read'),
  validate(listPoliciesSchema, 'query'),
  warrantyController.listPolicies
);

router.post(
  '/verify-claim',
  requirePermission('tickets:create'),
  validate(verifyClaimSchema),
  warrantyController.verifyClaim
);

router.get(
  '/certificate/:certNumber',
  requirePermission('warranties:read'),
  warrantyController.getWarrantyByCertificate
);

router.get(
  '/serial/:serial',
  requirePermission('warranties:read'),
  warrantyController.lookupSerialHistory
);

router.get(
  '/:id',
  requirePermission('warranties:read'),
  warrantyController.getWarranty
);

router.post(
  '/',
  requirePermission('warranties:create'),
  validate(createWarrantySchema),
  warrantyController.createManualWarranty
);

export default router;
