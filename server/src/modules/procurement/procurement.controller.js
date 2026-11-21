import * as procurementService from './procurement.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listSuppliers(req, res, next) {
  try {
    const result = await procurementService.listSuppliers(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getSupplier(req, res, next) {
  try {
    const supplier = await procurementService.getSupplier(req.params.id);
    return sendSuccess(res, supplier);
  } catch (err) {
    next(err);
  }
}

export async function createSupplier(req, res, next) {
  try {
    const supplier = await procurementService.createSupplier(req.body, req.user);
    return sendSuccess(res, supplier, null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listPurchaseOrders(req, res, next) {
  try {
    const result = await procurementService.listPurchaseOrders(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseOrder(req, res, next) {
  try {
    const po = await procurementService.getPurchaseOrder(req.params.id);
    return sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
}

export async function createPurchaseOrder(req, res, next) {
  try {
    const po = await procurementService.createPurchaseOrder(req.body, req.user);
    return sendSuccess(res, po, null, 201);
  } catch (err) {
    next(err);
  }
}

export async function approvePurchaseOrder(req, res, next) {
  try {
    const po = await procurementService.approvePurchaseOrder(req.params.id, req.user);
    return sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
}

export async function recordGoodsReceipt(req, res, next) {
  try {
    const grn = await procurementService.recordGoodsReceipt(req.body, req.user);
    return sendSuccess(res, grn, null, 201);
  } catch (err) {
    next(err);
  }
}

export async function listGoodsReceipts(req, res, next) {
  try {
    const result = await procurementService.listGoodsReceipts(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function listSerialNumbers(req, res, next) {
  try {
    const result = await procurementService.listSerialNumbers(req.query);
    return sendSuccess(res, result.data, { pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getSerialNumberTrace(req, res, next) {
  try {
    const trace = await procurementService.getSerialNumberTrace(req.params.serial);
    return sendSuccess(res, trace);
  } catch (err) {
    next(err);
  }
}

export async function verifySerial(req, res, next) {
  try {
    const result = await procurementService.verifySerial(req.body);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
