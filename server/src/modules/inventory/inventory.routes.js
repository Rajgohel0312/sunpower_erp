import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as inventoryController from './inventory.controller.js';
import {
  listStockSchema,
  listMovementsSchema,
  reserveStockSchema,
  releaseReservationSchema,
  adjustStockSchema
} from './inventory.validation.js';

const router = Router();

// 1. Warehouse Endpoints
router.get(
  '/warehouses',
  authenticate,
  requirePermission('inventory:read'),
  inventoryController.getWarehouses
);

router.get(
  '/warehouses/:id',
  authenticate,
  requirePermission('inventory:read'),
  inventoryController.getWarehouse
);

// 2. Stock Balances
router.get(
  '/stock',
  authenticate,
  requirePermission('inventory:read'),
  validate(listStockSchema, 'query'),
  inventoryController.getStockBalances
);

// 3. Stock Movements (Append-only physical ledger)
router.get(
  '/movements',
  authenticate,
  requirePermission('inventory:read'),
  validate(listMovementsSchema, 'query'),
  inventoryController.getStockMovements
);

// 4. Concurrency-Safe Stock Reservation
router.post(
  '/reservations',
  authenticate,
  requirePermission('inventory:reserve'),
  validate(reserveStockSchema),
  inventoryController.reserveStock
);

// 5. Stock Reservation Release
router.post(
  '/reservations/release',
  authenticate,
  requirePermission('inventory:reserve'),
  validate(releaseReservationSchema),
  inventoryController.releaseStock
);

// 6. Audited Stock Adjustment
router.post(
  '/adjustments',
  authenticate,
  requirePermission('inventory:adjust'),
  validate(adjustStockSchema),
  inventoryController.adjustStock
);

export default router;
