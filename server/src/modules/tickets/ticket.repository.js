import { prisma } from '../../database/index.js';

export async function generateTicketNumber(trx) {
  const client = trx || prisma;
  const seqResult = await client.$queryRaw`SELECT nextval('service_ticket_number_seq') as next_val`;
  const nextVal = seqResult[0]?.next_val || 1;
  const year = new Date().getFullYear();
  return `TCK-${year}-${String(nextVal).padStart(5, '0')}`;
}

export async function createTicket(data, trx) {
  const client = trx || prisma;
  return client.service_tickets.create({
    data,
    include: {
      customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true } },
      serial_numbers: { select: { id: true, serial_number: true, status: true, product_id: true } },
      sales_orders: { select: { id: true, order_number: true } },
      warranties: { select: { id: true, warranty_certificate_number: true, status: true, end_date: true } }
    }
  });
}

export async function listTickets(params = {}, trx) {
  const client = trx || prisma;
  const {
    page = 1,
    limit = 10,
    customer_id,
    status,
    priority,
    category,
    assigned_technician_id,
    search
  } = params;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;
  const take = safeLimit;

  const where = { deleted_at: null };

  if (customer_id) where.customer_id = customer_id;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (assigned_technician_id) where.assigned_technician_id = assigned_technician_id;

  if (search && search.trim() !== '') {
    const term = search.trim();
    where.OR = [
      { ticket_number: { contains: term, mode: 'insensitive' } },
      { reported_issue: { contains: term, mode: 'insensitive' } },
      { customers: { full_name: { contains: term, mode: 'insensitive' } } },
      { serial_numbers: { serial_number: { contains: term, mode: 'insensitive' } } }
    ];
  }

  const [total, tickets] = await Promise.all([
    client.service_tickets.count({ where }),
    client.service_tickets.findMany({
      where,
      include: {
        customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true } },
        serial_numbers: {
          select: {
            id: true,
            serial_number: true,
            status: true,
            products: { select: { id: true, brand: true, model_name: true, sku: true } }
          }
        },
        sales_orders: { select: { id: true, order_number: true, system_capacity_kw: true } },
        users_service_tickets_assigned_technician_idTousers: {
          select: { id: true, full_name: true, email: true }
        },
        warranties: {
          select: { id: true, warranty_certificate_number: true, status: true, end_date: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ],
      skip,
      take
    })
  ]);

  return {
    tickets,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1
  };
}

export async function getTicketById(id, trx) {
  const client = trx || prisma;
  return client.service_tickets.findFirst({
    where: { id, deleted_at: null },
    include: {
      customers: {
        include: {
          customer_addresses: true
        }
      },
      serial_numbers: {
        include: {
          products: {
            include: { product_categories: true }
          },
          warehouses: { select: { id: true, name: true, code: true } }
        }
      },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          system_capacity_kw: true,
          created_at: true
        }
      },
      installation_jobs: {
        select: {
          id: true,
          job_number: true,
          status: true,
          scheduled_start: true,
          actual_completion: true
        }
      },
      warranties: true,
      users_service_tickets_assigned_technician_idTousers: {
        select: { id: true, full_name: true, email: true, phone_e164: true }
      },
      users_service_tickets_created_byTousers: {
        select: { id: true, full_name: true }
      },
      ticket_activities: {
        include: {
          users: { select: { id: true, full_name: true } }
        },
        orderBy: { created_at: 'asc' }
      },
      warranty_replacements: {
        include: {
          serial_numbers_warranty_replacements_defective_serial_idToserial_numbers: true,
          serial_numbers_warranty_replacements_replacement_serial_idToserial_numbers: true,
          users: { select: { id: true, full_name: true } }
        }
      }
    }
  });
}

export async function updateTicket(id, data, trx) {
  const client = trx || prisma;
  return client.service_tickets.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date()
    }
  });
}

export async function logTicketActivity(ticketId, actorId, activityType, details = {}, trx) {
  const client = trx || prisma;
  return client.ticket_activities.create({
    data: {
      ticket_id: ticketId,
      actor_id: actorId || null,
      activity_type: activityType,
      details: typeof details === 'string' ? { message: details } : details
    }
  });
}

export async function createWarrantyReplacement(data, trx) {
  const client = trx || prisma;
  return client.warranty_replacements.create({
    data,
    include: {
      serial_numbers_warranty_replacements_defective_serial_idToserial_numbers: true,
      serial_numbers_warranty_replacements_replacement_serial_idToserial_numbers: true
    }
  });
}

export async function getTicketSummaryStats(trx) {
  const client = trx || prisma;
  const [totalOpen, criticalHigh, waitingParts, resolved] = await Promise.all([
    client.service_tickets.count({
      where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }, deleted_at: null }
    }),
    client.service_tickets.count({
      where: {
        priority: { in: ['CRITICAL', 'HIGH'] },
        status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
        deleted_at: null
      }
    }),
    client.service_tickets.count({
      where: { status: 'WAITING_PARTS', deleted_at: null }
    }),
    client.service_tickets.count({
      where: { status: { in: ['RESOLVED', 'CLOSED'] }, deleted_at: null }
    })
  ]);

  return {
    totalOpen,
    criticalHigh,
    waitingParts,
    resolved
  };
}
