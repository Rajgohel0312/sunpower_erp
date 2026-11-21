import { sendSuccess } from '../../utils/response.js';
import * as dispatchService from './dispatch.service.js';

export async function listDispatches(req, res, next) {
  try {
    const result = await dispatchService.listDispatches(req.query);
    return sendSuccess(res, result.dispatches, {
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

export async function getDispatch(req, res, next) {
  try {
    const dispatch = await dispatchService.getDispatch(req.params.id);
    return sendSuccess(res, dispatch);
  } catch (err) {
    next(err);
  }
}

export async function createDispatch(req, res, next) {
  try {
    const dispatch = await dispatchService.createDispatch(req.body, req.user);
    return sendSuccess(res, dispatch, { message: 'Dispatch created successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateDispatchStatus(req, res, next) {
  try {
    const updated = await dispatchService.updateDispatchStatus(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'Dispatch status updated successfully' });
  } catch (err) {
    next(err);
  }
}
