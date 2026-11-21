import * as inventoryService from './inventory.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getWarehouses(req, res, next) {
  try {
    const warehouses = await inventoryService.getWarehouses();
    return sendSuccess(res, warehouses);
  } catch (err) {
    next(err);
  }
}

export async function getWarehouse(req, res, next) {
  try {
    const warehouse = await inventoryService.getWarehouse(req.params.id);
    return sendSuccess(res, warehouse);
  } catch (err) {
    next(err);
  }
}

export async function getStockBalances(req, res, next) {
  try {
    const result = await inventoryService.getStockBalances(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getStockMovements(req, res, next) {
  try {
    const result = await inventoryService.getStockMovements(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function reserveStock(req, res, next) {
  try {
    const reservations = await inventoryService.reserveStock(req.body, req.user);
    return sendSuccess(res, reservations, null, 201);
  } catch (err) {
    next(err);
  }
}

export async function releaseStock(req, res, next) {
  try {
    const result = await inventoryService.releaseStock(req.body, req.user);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function adjustStock(req, res, next) {
  try {
    const result = await inventoryService.adjustStock(req.body, req.user);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
