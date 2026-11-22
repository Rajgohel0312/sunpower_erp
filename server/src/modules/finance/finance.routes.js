import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as financeController from './finance.controller.js';
import {
  listInvoicesSchema,
  createInvoiceSchema,
  listPaymentsSchema,
  recordPaymentSchema,
  allocatePaymentSchema,
  listExpensesSchema,
  createExpenseSchema
} from './finance.validation.js';

const router = Router();

router.use(authenticate);

// Invoices
router.get(
  '/invoices',
  requirePermission('invoices:read'),
  validate(listInvoicesSchema, 'query'),
  financeController.listInvoices
);

router.get(
  '/invoices/:id',
  requirePermission('invoices:read'),
  financeController.getInvoice
);

router.post(
  '/invoices',
  requirePermission('invoices:create'),
  validate(createInvoiceSchema),
  financeController.createInvoice
);

// Payments
router.get(
  '/payments',
  requirePermission('payments:read'),
  validate(listPaymentsSchema, 'query'),
  financeController.listPayments
);

router.get(
  '/payments/:id',
  requirePermission('payments:read'),
  financeController.getPayment
);

router.post(
  '/payments',
  requirePermission('payments:create'),
  validate(recordPaymentSchema),
  financeController.recordPayment
);

router.post(
  '/payments/:id/allocate',
  requirePermission('payments:verify'),
  validate(allocatePaymentSchema),
  financeController.allocatePayment
);

// Direct Project Expenses
router.get(
  '/expenses',
  requirePermission('expenses:read'),
  validate(listExpensesSchema, 'query'),
  financeController.listExpenses
);

router.post(
  '/expenses',
  requirePermission('expenses:create'),
  validate(createExpenseSchema),
  financeController.createExpense
);

router.post(
  '/expenses/:id/approve',
  requirePermission('expenses:approve'),
  financeController.approveExpense
);

// Project Profitability & AR Aging Reports
router.get(
  '/profitability/:orderId',
  requirePermission('finance:report'),
  financeController.getProjectProfitability
);

router.get(
  '/aging',
  requirePermission('invoices:read'),
  financeController.getAccountsReceivableAging
);

export default router;
