import { sendSuccess } from '../../utils/response.js';
import * as installationService from './installation.service.js';

export async function listInstallationJobs(req, res, next) {
  try {
    const result = await installationService.listInstallationJobs(req.query);
    return sendSuccess(res, result.jobs, {
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

export async function getInstallationJob(req, res, next) {
  try {
    const job = await installationService.getInstallationJob(req.params.id);
    return sendSuccess(res, job);
  } catch (err) {
    next(err);
  }
}

export async function createInstallationJob(req, res, next) {
  try {
    const job = await installationService.createInstallationJob(req.body, req.user);
    return sendSuccess(res, job, { message: 'Installation job scheduled successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateJobStatus(req, res, next) {
  try {
    const updated = await installationService.updateJobStatus(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'Installation job status updated' });
  } catch (err) {
    next(err);
  }
}

export async function updateChecklistStep(req, res, next) {
  try {
    const updated = await installationService.updateChecklistStep(
      req.params.id,
      req.params.stepKey,
      req.body,
      req.user
    );
    return sendSuccess(res, updated, { message: 'Checklist step updated' });
  } catch (err) {
    next(err);
  }
}

export async function uploadInstallationPhoto(req, res, next) {
  try {
    const photo = await installationService.uploadInstallationPhoto(req.params.id, req.body, req.user);
    return sendSuccess(res, photo, { message: 'Installation photo uploaded' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function submitCustomerSignoff(req, res, next) {
  try {
    const job = await installationService.submitCustomerSignoff(req.params.id, req.body, req.user);
    return sendSuccess(res, job, { message: 'Customer commissioning signoff recorded' });
  } catch (err) {
    next(err);
  }
}
