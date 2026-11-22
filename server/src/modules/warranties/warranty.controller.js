import { sendSuccess } from '../../utils/response.js';
import * as warrantyService from './warranty.service.js';

export async function listWarranties(req, res, next) {
  try {
    const result = await warrantyService.listWarranties(req.query);
    return sendSuccess(res, result.warranties, {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getWarranty(req, res, next) {
  try {
    const warranty = await warrantyService.getWarranty(req.params.id);
    return sendSuccess(res, warranty);
  } catch (err) {
    next(err);
  }
}

export async function getWarrantyByCertificate(req, res, next) {
  try {
    const warranty = await warrantyService.getWarrantyByCertificate(req.params.certNumber);
    return sendSuccess(res, warranty);
  } catch (err) {
    next(err);
  }
}

export async function listPolicies(req, res, next) {
  try {
    const policies = await warrantyService.listWarrantyPolicies(req.query);
    return sendSuccess(res, policies);
  } catch (err) {
    next(err);
  }
}

export async function createManualWarranty(req, res, next) {
  try {
    const warranty = await warrantyService.createManualWarranty(req.body, req.user);
    return sendSuccess(res, warranty, { message: 'Warranty certificate registered successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function verifyClaim(req, res, next) {
  try {
    const verification = await warrantyService.verifyWarrantyClaim(req.body);
    return sendSuccess(res, verification);
  } catch (err) {
    next(err);
  }
}

export async function lookupSerialHistory(req, res, next) {
  try {
    const data = await warrantyService.lookupSerialFullHistory(req.params.serial);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}
