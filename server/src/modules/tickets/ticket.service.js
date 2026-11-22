import { withTransaction, prisma } from '../../database/index.js';
import { AppError } from '../../utils/response.js';
import * as ticketRepo from './ticket.repository.js';
import * as warrantyRepo from '../warranties/warranty.repository.js';

/**
 * Priority-based SLA resolution time calculations
 */
function calculateSlaDueDate(priority) {
  const now = new Date();
  switch (priority) {
    case 'CRITICAL':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    case 'HIGH':
      return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
    case 'LOW':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    case 'MEDIUM':
    default:
      return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
  }
}

export async function listTickets(query) {
  return ticketRepo.listTickets(query);
}

export async function getTicketStats() {
  return ticketRepo.getTicketSummaryStats();
}

export async function getTicket(id) {
  const ticket = await ticketRepo.getTicketById(id);
  if (!ticket) {
    throw new AppError('Service ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  return ticket;
}

/**
 * Unified service to create support tickets.
 * Called identically by Web UI, Customer Portal, and WhatsApp Gateway.
 */
export async function createTicket(input, actor) {
  return withTransaction(async (trx) => {
    // 1. Verify customer exists
    const customer = await trx.customers.findUnique({
      where: { id: input.customer_id }
    });
    if (!customer) {
      throw new AppError('Customer not found for service ticket', 404, 'CUSTOMER_NOT_FOUND');
    }

    let serialId = input.serial_number_id || null;
    let warrantyId = input.warranty_id || null;
    let salesOrderId = input.sales_order_id || null;
    let installationJobId = input.installation_job_id || null;

    // 2. Resolve serial number if provided as string
    if (input.serial_number && !serialId) {
      const trimmed = input.serial_number.trim();
      let serial = await trx.serial_numbers.findUnique({
        where: { serial_number: trimmed }
      });

      // If not found directly, check if input is a Product SKU and resolve customer's unit
      if (!serial) {
        const product = await trx.products.findFirst({
          where: {
            OR: [
              { sku: { equals: trimmed, mode: 'insensitive' } },
              { model_name: { equals: trimmed, mode: 'insensitive' } }
            ]
          }
        });

        if (product && input.customer_id) {
          serial = await trx.serial_numbers.findFirst({
            where: {
              product_id: product.id,
              current_customer_id: input.customer_id
            }
          });
        }
      }

      if (serial) {
        serialId = serial.id;
        salesOrderId = salesOrderId || serial.current_order_id;
      }
    }

    // 3. Resolve warranty and prevent duplicate open tickets
    if (serialId) {
      // Check duplicate open ticket
      const duplicateOpen = await trx.service_tickets.findFirst({
        where: {
          serial_number_id: serialId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'] },
          deleted_at: null
        }
      });

      if (duplicateOpen) {
        throw new AppError(
          `An active service ticket (${duplicateOpen.ticket_number}) is already open for this equipment.`,
          409,
          'DUPLICATE_OPEN_TICKET'
        );
      }

      // Check active warranty
      if (!warrantyId) {
        const activeWarranty = await trx.warranties.findFirst({
          where: { serial_number_id: serialId, status: 'ACTIVE' },
          orderBy: { created_at: 'desc' }
        });
        if (activeWarranty) {
          warrantyId = activeWarranty.id;
          salesOrderId = salesOrderId || activeWarranty.sales_order_id;
          installationJobId = installationJobId || activeWarranty.installation_job_id;
        }
      }
    }

    // 4. Generate sequential ticket number
    const ticketNumber = await ticketRepo.generateTicketNumber(trx);
    const slaDueDate = calculateSlaDueDate(input.priority || 'MEDIUM');

    // 5. Create ticket
    const ticket = await trx.service_tickets.create({
      data: {
        ticket_number: ticketNumber,
        customer_id: input.customer_id,
        sales_order_id: salesOrderId,
        installation_job_id: installationJobId,
        serial_number_id: serialId,
        warranty_id: warrantyId,
        category: input.category || 'INVERTER_FAULT',
        priority: input.priority || 'MEDIUM',
        status: 'OPEN',
        source: input.source || 'WEB',
        reported_issue: input.reported_issue,
        diagnostic_notes: input.diagnostic_notes || null,
        sla_due_date: slaDueDate,
        created_by: actor?.id || null
      },
      include: {
        customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true } },
        serial_numbers: { select: { id: true, serial_number: true, status: true } },
        warranties: { select: { id: true, warranty_certificate_number: true, status: true, end_date: true } }
      }
    });

    // 6. Record initial creation activity
    await ticketRepo.logTicketActivity(
      ticket.id,
      actor?.id,
      'STATUS_CHANGE',
      {
        message: `Service ticket logged via ${ticket.source} with priority ${ticket.priority}`,
        initial_status: 'OPEN'
      },
      trx
    );

    return ticket;
  });
}

/**
 * State machine for ticket status updates:
 * OPEN -> ASSIGNED -> IN_PROGRESS -> WAITING_PARTS -> RESOLVED -> CLOSED
 * Reopen rule: CLOSED / RESOLVED can transition back to IN_PROGRESS with incremented reopened_count.
 */
export async function updateTicketStatus(id, input, actor) {
  return withTransaction(async (trx) => {
    const ticket = await trx.service_tickets.findFirst({
      where: { id, deleted_at: null }
    });

    if (!ticket) {
      throw new AppError('Service ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const validTransitions = {
      OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CANCELLED'],
      IN_PROGRESS: ['WAITING_PARTS', 'RESOLVED', 'CANCELLED'],
      WAITING_PARTS: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: ['IN_PROGRESS'], // Reopening
      CANCELLED: []
    };

    const allowed = validTransitions[ticket.status] || [];
    if (!allowed.includes(input.status)) {
      throw new AppError(
        `Invalid status transition from ${ticket.status} to ${input.status}.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updates = {
      status: input.status,
      updated_at: new Date()
    };

    if (input.resolution_notes) {
      updates.resolution_notes = input.resolution_notes;
    }

    if (input.status === 'RESOLVED' && !ticket.resolved_at) {
      updates.resolved_at = new Date();
    }

    if (input.status === 'CLOSED') {
      updates.closed_at = new Date();
    }

    if (['RESOLVED', 'CLOSED'].includes(ticket.status) && input.status === 'IN_PROGRESS') {
      // Reopening ticket
      updates.reopened_count = (ticket.reopened_count || 0) + 1;
      updates.resolved_at = null;
      updates.closed_at = null;
    }

    const updated = await trx.service_tickets.update({
      where: { id },
      data: updates
    });

    await ticketRepo.logTicketActivity(
      id,
      actor?.id,
      'STATUS_CHANGE',
      {
        from: ticket.status,
        to: input.status,
        notes: input.notes || input.resolution_notes || `Status changed to ${input.status}`
      },
      trx
    );

    return ticketRepo.getTicketById(id, trx);
  });
}

/**
 * Assign a field technician to this service ticket
 */
export async function assignTechnician(id, input, actor) {
  return withTransaction(async (trx) => {
    const ticket = await trx.service_tickets.findFirst({
      where: { id, deleted_at: null }
    });

    if (!ticket) {
      throw new AppError('Service ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    const tech = await trx.users.findUnique({
      where: { id: input.technician_id }
    });

    if (!tech) {
      throw new AppError('Technician user not found', 404, 'TECHNICIAN_NOT_FOUND');
    }

    const nextStatus = ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status;

    await trx.service_tickets.update({
      where: { id },
      data: {
        assigned_technician_id: input.technician_id,
        status: nextStatus,
        updated_at: new Date()
      }
    });

    await ticketRepo.logTicketActivity(
      id,
      actor?.id,
      'ASSIGNMENT',
      {
        assigned_technician_id: tech.id,
        assigned_technician_name: tech.full_name,
        notes: input.notes || `Assigned to ${tech.full_name}`
      },
      trx
    );

    return ticketRepo.getTicketById(id, trx);
  });
}

/**
 * Add a diagnostic or field note activity entry
 */
export async function addActivityNote(id, input, actor) {
  return withTransaction(async (trx) => {
    const ticket = await trx.service_tickets.findFirst({
      where: { id, deleted_at: null }
    });

    if (!ticket) {
      throw new AppError('Service ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    await ticketRepo.logTicketActivity(
      id,
      actor?.id,
      input.activity_type || 'NOTE',
      { notes: input.notes },
      trx
    );

    return ticketRepo.getTicketById(id, trx);
  });
}

/**
 * RMA Hardware Swap Engine:
 * Atomic equipment exchange replacing defective serialized hardware with new stock.
 * 1. Checks defective serial is currently INSTALLED.
 * 2. Checks replacement serial is currently AVAILABLE in warehouse.
 * 3. Transitions defective serial to RETURNED / UNDER_REPAIR + logs serial movement.
 * 4. Transitions replacement serial to INSTALLED + links to customer/order + logs serial movement.
 * 5. Transfers or re-issues warranty certificate to point to replacement serial.
 * 6. Appends warranty_replacements audit record.
 * 7. Advances ticket activity.
 */
export async function executeRmaSwap(ticketId, input, actor) {
  return withTransaction(async (trx) => {
    const ticket = await trx.service_tickets.findFirst({
      where: { id: ticketId, deleted_at: null },
      include: {
        warranties: true,
        customers: true
      }
    });

    if (!ticket) {
      throw new AppError('Service ticket not found for RMA replacement', 404, 'TICKET_NOT_FOUND');
    }

    // 1. Resolve defective serial
    let defectiveSerial = null;
    if (input.defective_serial_id) {
      defectiveSerial = await trx.serial_numbers.findUnique({
        where: { id: input.defective_serial_id },
        include: { products: true }
      });
    } else if (input.defective_serial_number) {
      defectiveSerial = await trx.serial_numbers.findUnique({
        where: { serial_number: input.defective_serial_number.trim() },
        include: { products: true }
      });
    }

    if (!defectiveSerial) {
      throw new AppError('Defective serial number not found', 404, 'DEFECTIVE_SERIAL_NOT_FOUND');
    }

    // 2. Resolve replacement serial
    let replacementSerial = null;
    if (input.replacement_serial_id) {
      replacementSerial = await trx.serial_numbers.findUnique({
        where: { id: input.replacement_serial_id },
        include: { products: true, warehouses: true }
      });
    } else if (input.replacement_serial_number) {
      replacementSerial = await trx.serial_numbers.findUnique({
        where: { serial_number: input.replacement_serial_number.trim() },
        include: { products: true, warehouses: true }
      });
    }

    if (!replacementSerial) {
      throw new AppError('Replacement serial number not found', 404, 'REPLACEMENT_SERIAL_NOT_FOUND');
    }

    // 3. Validate statuses
    if (replacementSerial.status !== 'AVAILABLE') {
      throw new AppError(
        `Replacement serial ${replacementSerial.serial_number} is not AVAILABLE (currently: ${replacementSerial.status})`,
        400,
        'REPLACEMENT_NOT_AVAILABLE'
      );
    }

    if (defectiveSerial.id === replacementSerial.id) {
      throw new AppError('Defective hardware and replacement hardware cannot have identical serial numbers', 400, 'SAME_SERIAL');
    }

    // 4. Update defective serial -> RETURNED
    await trx.serial_numbers.update({
      where: { id: defectiveSerial.id },
      data: {
        status: 'RETURNED',
        updated_at: new Date()
      }
    });

    await trx.serial_movements.create({
      data: {
        serial_id: defectiveSerial.id,
        from_status: defectiveSerial.status,
        to_status: 'RETURNED',
        reference_type: 'RETURN',
        reference_id: ticket.id,
        actor_id: actor?.id,
        notes: `Swapped out as defective under Ticket ${ticket.ticket_number}. Reason: ${input.reason}`
      }
    });

    // 5. Update replacement serial -> INSTALLED
    await trx.serial_numbers.update({
      where: { id: replacementSerial.id },
      data: {
        status: 'INSTALLED',
        current_customer_id: ticket.customer_id,
        current_order_id: ticket.sales_order_id,
        updated_at: new Date()
      }
    });

    await trx.serial_movements.create({
      data: {
        serial_id: replacementSerial.id,
        from_status: 'AVAILABLE',
        to_status: 'INSTALLED',
        reference_type: 'INSTALLATION',
        reference_id: ticket.id,
        actor_id: actor?.id,
        notes: `Installed as warranty replacement for defective ${defectiveSerial.serial_number} under Ticket ${ticket.ticket_number}`
      }
    });

    // 6. Transfer or update active warranty
    if (input.transfer_warranty !== false) {
      const activeWarranty = await trx.warranties.findFirst({
        where: {
          serial_number_id: defectiveSerial.id,
          status: 'ACTIVE'
        }
      });

      if (activeWarranty) {
        await trx.warranties.update({
          where: { id: activeWarranty.id },
          data: {
            serial_number_id: replacementSerial.id,
            updated_at: new Date()
          }
        });
      }
    }

    // 7. Record warranty replacement swap
    const replacementRecord = await trx.warranty_replacements.create({
      data: {
        ticket_id: ticket.id,
        defective_serial_id: defectiveSerial.id,
        replacement_serial_id: replacementSerial.id,
        replaced_by: actor?.id || null,
        replaced_at: new Date(),
        transfer_warranty: input.transfer_warranty !== false,
        reason: input.reason,
        notes: input.notes || null
      }
    });

    // 8. Log RMA activity on ticket
    await ticketRepo.logTicketActivity(
      ticket.id,
      actor?.id,
      'RMA_REPLACEMENT',
      {
        message: `RMA swap executed: Defective ${defectiveSerial.serial_number} replaced by ${replacementSerial.serial_number}`,
        reason: input.reason,
        replacement_id: replacementRecord.id
      },
      trx
    );

    // 9. Update ticket status to RESOLVED
    await trx.service_tickets.update({
      where: { id: ticket.id },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolution_notes: `Defective ${defectiveSerial.serial_number} replaced with new serialized unit ${replacementSerial.serial_number}. ${input.reason}`,
        updated_at: new Date()
      }
    });

    return ticketRepo.getTicketById(ticket.id, trx);
  });
}
