import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as procurementController from './procurement.controller.js';
import {
  listSuppliersSchema,
  createSupplierSchema,
  listPurchaseOrdersSchema,
  createPurchaseOrderSchema,
  listGoodsReceiptsSchema,
  recordGoodsReceiptSchema,
  listSerialsSchema,
  verifySerialSchema
} from './procurement.validation.js';

export const procurementRouter = Router();
export const serialsRouter = Router();

// ==================== PROCUREMENT ROUTES ====================

// 1. Suppliers
procurementRouter.get(
  '/suppliers',
  authenticate,
  requirePermission('suppliers:read'),
  validate(listSuppliersSchema, 'query'),
  procurementController.listSuppliers
);

procurementRouter.get(
  '/suppliers/:id',
  authenticate,
  requirePermission('suppliers:read'),
  procurementController.getSupplier
);

procurementRouter.post(
  '/suppliers',
  authenticate,
  requirePermission('suppliers:create'),
  validate(createSupplierSchema),
  procurementController.createSupplier
);

// 2. Purchase Orders
procurementRouter.get(
  '/purchase-orders',
  authenticate,
  requirePermission('purchase_orders:read'),
  validate(listPurchaseOrdersSchema, 'query'),
  procurementController.listPurchaseOrders
);

procurementRouter.get(
  '/purchase-orders/:id',
  authenticate,
  requirePermission('purchase_orders:read'),
  procurementController.getPurchaseOrder
);

procurementRouter.post(
  '/purchase-orders',
  authenticate,
  requirePermission('purchase_orders:create'),
  validate(createPurchaseOrderSchema),
  procurementController.createPurchaseOrder
);

procurementRouter.post(
  '/purchase-orders/:id/approve',
  authenticate,
  requirePermission('purchase_orders:approve'),
  procurementController.approvePurchaseOrder
);

// 3. Goods Receipts (GRN)
procurementRouter.get(
  '/goods-receipts',
  authenticate,
  requirePermission('goods_receipts:read'),
  validate(listGoodsReceiptsSchema, 'query'),
  procurementController.listGoodsReceipts
);

procurementRouter.post(
  '/goods-receipts',
  authenticate,
  requirePermission('goods_receipts:create'),
  validate(recordGoodsReceiptSchema),
  procurementController.recordGoodsReceipt
);

// ==================== SERIALS ROUTES ====================

serialsRouter.get(
  '/',
  authenticate,
  requirePermission('serials:read'),
  validate(listSerialsSchema, 'query'),
  procurementController.listSerialNumbers
);

serialsRouter.get(
  '/:serial',
  authenticate,
  requirePermission('serials:read'),
  procurementController.getSerialNumberTrace
);

serialsRouter.post(
  '/verify',
  authenticate,
  requirePermission('serials:scan'),
  validate(verifySerialSchema),
  procurementController.verifySerial
);

export default procurementRouter;
