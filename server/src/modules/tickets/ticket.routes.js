import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as ticketController from './ticket.controller.js';
import {
  listTicketsSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  assignTechnicianSchema,
  addActivityNoteSchema,
  executeRmaSwapSchema
} from './ticket.validation.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('tickets:read'),
  validate(listTicketsSchema, 'query'),
  ticketController.listTickets
);

router.get(
  '/stats',
  requirePermission('tickets:read'),
  ticketController.getTicketStats
);

router.get(
  '/:id',
  requirePermission('tickets:read'),
  ticketController.getTicket
);

router.post(
  '/',
  requirePermission('tickets:create'),
  validate(createTicketSchema),
  ticketController.createTicket
);

router.patch(
  '/:id/status',
  requirePermission('tickets:update'),
  validate(updateTicketStatusSchema),
  ticketController.updateTicketStatus
);

router.post(
  '/:id/assign',
  requirePermission('tickets:assign'),
  validate(assignTechnicianSchema),
  ticketController.assignTechnician
);

router.post(
  '/:id/notes',
  requirePermission('tickets:update'),
  validate(addActivityNoteSchema),
  ticketController.addActivityNote
);

router.post(
  '/:id/rma-swap',
  requirePermission('rma:execute'),
  validate(executeRmaSwapSchema),
  ticketController.executeRmaSwap
);

export default router;
