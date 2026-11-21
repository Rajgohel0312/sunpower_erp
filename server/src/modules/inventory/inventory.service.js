import * as inventoryRepo from './inventory.repository.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/response.js';

/**
 * Lists all active warehouses
 */
export async function getWarehouses() {
  return await inventoryRepo.listWarehouses();
}

/**
 * Gets a single warehouse by ID
 */
export async function getWarehouse(id) {
  const warehouse = await inventoryRepo.getWarehouseById(id);
  if (!warehouse) {
    throw new AppError('Warehouse not found', 404, 'WAREHOUSE_NOT_FOUND');
  }
  return warehouse;
}

/**
 * Lists multi-warehouse stock balances with pagination & filtering
 */
export async function getStockBalances(query) {
  return await inventoryRepo.listStockBalances(query);
}

/**
 * Lists physical stock movements ledger
 */
export async function getStockMovements(query) {
  return await inventoryRepo.listStockMovements(query);
}

/**
 * Concurrency-Safe Stock Reservation for a Sales Order
 */
export async function reserveStock({ sales_order_id, items }, actor) {
  // 1. Verify Sales Order Exists
  const order = await prisma.sales_orders.findUnique({
    where: { id: sales_order_id }
  });

  if (!order) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status === 'CANCELLED') {
    throw new AppError('Cannot reserve stock for a cancelled sales order', 400, 'ORDER_CANCELLED');
  }

  try {
    const reservations = await inventoryRepo.executeStockReservation({
      salesOrderId: sales_order_id,
      items,
      actorId: actor?.id
    });

    // 2. Advance Sales Order Status to MATERIAL_RESERVED if currently CONFIRMED
    if (order.status === 'CONFIRMED') {
      await prisma.sales_orders.update({
        where: { id: sales_order_id },
        data: {
          status: 'MATERIAL_RESERVED',
          updated_at: new Date()
        }
      });
    }

    return reservations;
  } catch (err) {
    if (err.message && err.message.includes('Insufficient stock')) {
      throw new AppError(err.message, 400, 'INSUFFICIENT_STOCK');
    }
    if (err.message && err.message.includes('Insufficient available serial numbers')) {
      throw new AppError(err.message, 400, 'INSUFFICIENT_SERIALS');
    }
    throw new AppError(err.message || 'Stock reservation failed', 400, 'RESERVATION_FAILED');
  }
}

/**
 * Releases Stock Reservations for a Sales Order
 */
export async function releaseStock({ sales_order_id, reason }, actor) {
  const order = await prisma.sales_orders.findUnique({
    where: { id: sales_order_id }
  });

  if (!order) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  const result = await inventoryRepo.releaseStockReservation({
    salesOrderId: sales_order_id,
    actorId: actor?.id,
    reason
  });

  return result;
}

/**
 * Adjusts Physical Stock Balances (audited count corrections, damage)
 */
export async function adjustStock({ product_id, warehouse_id, quantity_delta, reason, notes }, actor) {
  try {
    return await inventoryRepo.executeStockAdjustment({
      productId: product_id,
      warehouseId: warehouse_id,
      quantityDelta: quantity_delta,
      reason,
      notes,
      actorId: actor?.id
    });
  } catch (err) {
    throw new AppError(err.message || 'Stock adjustment failed', 400, 'ADJUSTMENT_FAILED');
  }
}
