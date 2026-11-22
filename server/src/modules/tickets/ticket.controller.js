import { sendSuccess } from '../../utils/response.js';
import * as ticketService from './ticket.service.js';

export async function listTickets(req, res, next) {
  try {
    const result = await ticketService.listTickets(req.query);
    return sendSuccess(res, result.tickets, {
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

export async function getTicketStats(req, res, next) {
  try {
    const stats = await ticketService.getTicketStats();
    return sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req, res, next) {
  try {
    const ticket = await ticketService.getTicket(req.params.id);
    return sendSuccess(res, ticket);
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req, res, next) {
  try {
    const ticket = await ticketService.createTicket(req.body, req.user);
    return sendSuccess(res, ticket, { message: 'Service ticket created successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateTicketStatus(req, res, next) {
  try {
    const updated = await ticketService.updateTicketStatus(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'Ticket status updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function assignTechnician(req, res, next) {
  try {
    const updated = await ticketService.assignTechnician(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'Technician assigned successfully' });
  } catch (err) {
    next(err);
  }
}

export async function addActivityNote(req, res, next) {
  try {
    const updated = await ticketService.addActivityNote(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'Activity note added successfully' });
  } catch (err) {
    next(err);
  }
}

export async function executeRmaSwap(req, res, next) {
  try {
    const updated = await ticketService.executeRmaSwap(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, { message: 'RMA equipment swap completed successfully' });
  } catch (err) {
    next(err);
  }
}
