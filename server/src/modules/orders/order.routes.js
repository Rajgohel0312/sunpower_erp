import { Router } from 'express';
import { orderController } from './order.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderFromQuotationSchema,
  updateOrderStatusSchema,
  recordOrderPaymentSchema,
  listOrdersQuerySchema
} from './order.validation.js';

export const orderRouter = Router();

orderRouter.use(authenticate);

// List sales orders
orderRouter.get(
  '/',
  requirePermission('orders:read'),
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders
);

// Convert accepted quotation to sales order
orderRouter.post(
  '/',
  requirePermission('orders:manage'),
  validate({ body: createOrderFromQuotationSchema }),
  orderController.convertQuotation
);

// Get single sales order
orderRouter.get(
  '/:id',
  requirePermission('orders:read'),
  orderController.getOrder
);

// Update order execution status
orderRouter.patch(
  '/:id/status',
  requirePermission('orders:manage'),
  validate({ body: updateOrderStatusSchema }),
  orderController.updateStatus
);

// Record customer payment
orderRouter.post(
  '/:id/payments',
  requirePermission('orders:manage'),
  validate({ body: recordOrderPaymentSchema }),
  orderController.recordPayment
);
