import { sendSuccess } from '../../utils/response.js';
import * as portalService from './portal.service.js';

export async function getProfile(req, res, next) {
  try {
    const profile = await portalService.getCustomerProfile(req.user, req.query.customer_id);
    return sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function getProjects(req, res, next) {
  try {
    const projects = await portalService.getCustomerProjects(req.user, req.query.customer_id);
    return sendSuccess(res, projects);
  } catch (err) {
    next(err);
  }
}

export async function getProjectDetail(req, res, next) {
  try {
    const project = await portalService.getCustomerProjectDetail(req.params.id, req.user);
    return sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

export async function getInvoices(req, res, next) {
  try {
    const invoices = await portalService.getCustomerInvoices(req.user, req.query.customer_id);
    return sendSuccess(res, invoices);
  } catch (err) {
    next(err);
  }
}

export async function getPayments(req, res, next) {
  try {
    const payments = await portalService.getCustomerPayments(req.user, req.query.customer_id);
    return sendSuccess(res, payments);
  } catch (err) {
    next(err);
  }
}

export async function getWarranties(req, res, next) {
  try {
    const warranties = await portalService.getCustomerWarranties(req.user, req.query.customer_id);
    return sendSuccess(res, warranties);
  } catch (err) {
    next(err);
  }
}

export async function getTickets(req, res, next) {
  try {
    const tickets = await portalService.getCustomerTickets(req.user, req.query.customer_id);
    return sendSuccess(res, tickets);
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req, res, next) {
  try {
    const ticket = await portalService.createCustomerTicket(req.body, req.user);
    return sendSuccess(res, ticket, { message: 'Service ticket submitted successfully' }, 201);
  } catch (err) {
    next(err);
  }
}
