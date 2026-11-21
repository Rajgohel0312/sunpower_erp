import { Router } from 'express';
import { quotationController } from './quotation.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  reviewQuotationSchema,
  sendQuotationSchema,
  acceptQuotationSchema,
  rejectQuotationSchema,
  listQuotationsQuerySchema
} from './quotation.validation.js';

export const quotationRouter = Router();

quotationRouter.use(authenticate);

// List quotations
quotationRouter.get(
  '/',
  requirePermission('quotations:read'),
  validate({ query: listQuotationsQuerySchema }),
  quotationController.listQuotations
);

// Create quotation
quotationRouter.post(
  '/',
  requirePermission('quotations:create'),
  validate({ body: createQuotationSchema }),
  quotationController.createQuotation
);

// Get single quotation
quotationRouter.get(
  '/:id',
  requirePermission('quotations:read'),
  quotationController.getQuotation
);

// Update quotation draft
quotationRouter.patch(
  '/:id',
  requirePermission('quotations:create'),
  validate({ body: updateQuotationSchema }),
  quotationController.updateQuotation
);

// Submit for manager approval
quotationRouter.post(
  '/:id/submit',
  requirePermission('quotations:create'),
  quotationController.submitForApproval
);

// Manager review & approval
quotationRouter.post(
  '/:id/review',
  requirePermission('quotations:approve'),
  validate({ body: reviewQuotationSchema }),
  quotationController.reviewQuotation
);

// Send proposal to customer (captures immutable snapshot)
quotationRouter.post(
  '/:id/send',
  requirePermission('quotations:create'),
  validate({ body: sendQuotationSchema }),
  quotationController.sendQuotation
);

// Customer accepts quotation
quotationRouter.post(
  '/:id/accept',
  requirePermission('quotations:create'),
  validate({ body: acceptQuotationSchema }),
  quotationController.acceptQuotation
);

// Customer rejects quotation
quotationRouter.post(
  '/:id/reject',
  requirePermission('quotations:create'),
  validate({ body: rejectQuotationSchema }),
  quotationController.rejectQuotation
);
