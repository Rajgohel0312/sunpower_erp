/**
 * CRM & Lead Management Routes
 * Mounts at /api/v1/crm
 */

import { Router } from 'express';
import { crmController } from './crm.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  convertLeadSchema,
  createActivitySchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerAddressSchema,
  listLeadsQuerySchema,
  listCustomersQuerySchema,
  duplicateCheckQuerySchema
} from './crm.schemas.js';

const router = Router();

// Protect all CRM routes by default
router.use(authenticate);

// -----------------------------------------------------------------------------
// DUPLICATE CHECK
// -----------------------------------------------------------------------------
router.get(
  '/leads/duplicates/check',
  requirePermission('leads:read'),
  validate({ query: duplicateCheckQuerySchema }),
  crmController.checkDuplicates
);

// -----------------------------------------------------------------------------
// LEADS
// -----------------------------------------------------------------------------
router.get(
  '/leads',
  requirePermission('leads:read'),
  validate({ query: listLeadsQuerySchema }),
  crmController.listLeads
);

router.post(
  '/leads',
  requirePermission('leads:create'),
  validate({ body: createLeadSchema }),
  crmController.createLead
);

router.get(
  '/leads/:id',
  requirePermission('leads:read'),
  crmController.getLead
);

router.patch(
  '/leads/:id',
  requirePermission('leads:update'),
  validate({ body: updateLeadSchema }),
  crmController.updateLead
);

router.post(
  '/leads/:id/assign',
  requirePermission('leads:assign'),
  validate({ body: assignLeadSchema }),
  crmController.assignLead
);

router.post(
  '/leads/:id/convert',
  requirePermission('leads:convert'),
  validate({ body: convertLeadSchema }),
  crmController.convertLead
);

router.post(
  '/leads/:id/activities',
  requirePermission('leads:update'),
  validate({ body: createActivitySchema }),
  crmController.addActivity
);

router.post(
  '/leads/:id/follow-ups',
  requirePermission('leads:update'),
  validate({ body: createFollowUpSchema }),
  crmController.createFollowUp
);

router.patch(
  '/follow-ups/:id',
  requirePermission('leads:update'),
  validate({ body: updateFollowUpSchema }),
  crmController.updateFollowUp
);

// -----------------------------------------------------------------------------
// CUSTOMERS
// -----------------------------------------------------------------------------
router.get(
  '/customers',
  requirePermission('customers:read'),
  validate({ query: listCustomersQuerySchema }),
  crmController.listCustomers
);

router.post(
  '/customers',
  requirePermission('customers:manage'),
  validate({ body: createCustomerSchema }),
  crmController.createCustomer
);

router.get(
  '/customers/:id',
  requirePermission('customers:read'),
  crmController.getCustomer
);

router.patch(
  '/customers/:id',
  requirePermission('customers:manage'),
  validate({ body: updateCustomerSchema }),
  crmController.updateCustomer
);

router.post(
  '/customers/:id/addresses',
  requirePermission('customers:manage'),
  validate({ body: createCustomerAddressSchema }),
  crmController.addCustomerAddress
);

router.get(
  '/customers/:id/timeline',
  requirePermission('customers:read'),
  crmController.getCustomerTimeline
);

export default router;
