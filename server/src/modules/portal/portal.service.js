import { AppError } from '../../utils/response.js';
import { prisma } from '../../database/prisma.js';
import * as ticketRepo from '../tickets/ticket.repository.js';

/**
 * Resolves the Customer record for the user or explicit ID
 */
export async function resolveCustomerForUser(user, explicitCustomerId = null) {
  // 1. Explicit customer ID support
  if (explicitCustomerId) {
    const customer = await prisma.customers.findUnique({
      where: { id: explicitCustomerId, deleted_at: null }
    });
    if (customer) return customer;
  }

  // 2. Direct match by phone
  if (user?.phone || user?.phone_e164) {
    const phone = user.phone || user.phone_e164;
    const customer = await prisma.customers.findFirst({
      where: { phone_e164: phone, deleted_at: null }
    });
    if (customer) return customer;
  }

  // 3. Match by email
  if (user?.email) {
    const customer = await prisma.customers.findFirst({
      where: { email: user.email, deleted_at: null }
    });
    if (customer) return customer;
  }

  // 4. Fallback: return the most recently active customer for preview/staff mode
  const fallbackCustomer = await prisma.customers.findFirst({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' }
  });
  if (fallbackCustomer) return fallbackCustomer;

  throw new AppError('No associated customer profile found for your account', 404, 'CUSTOMER_NOT_FOUND');
}

/**
 * Customer Profile & Solar Plant Overview
 */
export async function getCustomerProfile(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  const [addresses, ordersCount, warrantiesCount, ticketsCount] = await Promise.all([
    prisma.customer_addresses.findMany({
      where: { customer_id: customer.id }
    }),
    prisma.sales_orders.count({
      where: { customer_id: customer.id, deleted_at: null }
    }),
    prisma.warranties.count({
      where: { customer_id: customer.id, status: 'ACTIVE' }
    }),
    prisma.service_tickets.count({
      where: { customer_id: customer.id, deleted_at: null, status: { notIn: ['CLOSED', 'CANCELLED'] } }
    })
  ]);

  return {
    customer,
    addresses,
    stats: {
      total_projects: ordersCount,
      active_warranties: warrantiesCount,
      open_tickets: ticketsCount
    }
  };
}

/**
 * Customer Solar Projects with Lifecycle Milestones
 */
export async function getCustomerProjects(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  const orders = await prisma.sales_orders.findMany({
    where: { customer_id: customer.id, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      installation_jobs: {
        select: {
          id: true,
          job_number: true,
          status: true,
          scheduled_start: true,
          scheduled_end: true
        }
      },
      dispatches: {
        select: {
          id: true,
          dispatch_number: true,
          status: true,
          driver_name: true,
          vehicle_number: true
        }
      },
      invoices: {
        where: { deleted_at: null },
        select: {
          id: true,
          invoice_number: true,
          grand_total: true,
          amount_paid: true,
          amount_due: true,
          status: true
        }
      }
    }
  });

  return orders.map((order) => {
    let milestoneStep = 1;
    let milestoneLabel = 'Order Confirmed & Engineering Design';

    if (order.status === 'COMMISSIONED') {
      milestoneStep = 5;
      milestoneLabel = 'System Commissioned & Generating Green Power';
    } else if (order.status === 'INSTALLATION_IN_PROGRESS') {
      milestoneStep = 4;
      milestoneLabel = 'Rooftop Solar Installation in Progress';
    } else if (order.status === 'DISPATCHED') {
      milestoneStep = 3;
      milestoneLabel = 'Solar Hardware Dispatched to Site';
    } else if (order.status === 'MATERIAL_RESERVED') {
      milestoneStep = 2;
      milestoneLabel = 'Hardware Allocated & Procurement Complete';
    }

    return {
      id: order.id,
      order_number: order.order_number,
      contract_value: order.net_customer_payable || order.total_amount,
      payment_status: order.payment_status,
      fulfillment_status: order.status,
      milestone_step: milestoneStep,
      milestone_label: milestoneLabel,
      installation_job: order.installation_jobs[0] || null,
      dispatches: order.dispatches,
      invoices: order.invoices,
      created_at: order.created_at
    };
  });
}

/**
 * Customer Solar Project Detail
 */
export async function getCustomerProjectDetail(orderId, user) {
  const customer = await resolveCustomerForUser(user);

  const order = await prisma.sales_orders.findFirst({
    where: { id: orderId, customer_id: customer.id, deleted_at: null },
    include: {
      customers: true,
      quotations: true,
      installation_jobs: {
        include: {
          installation_photos: true,
          installation_signoffs: true
        }
      },
      dispatches: {
        include: {
          dispatch_items: true
        }
      },
      invoices: {
        where: { deleted_at: null },
        include: {
          invoice_items: true
        }
      },
      warranties: true
    }
  });

  if (!order) {
    throw new AppError('Solar project not found or access denied', 404, 'PROJECT_NOT_FOUND');
  }

  return order;
}

/**
 * Customer Invoices & Billing
 */
export async function getCustomerInvoices(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  return await prisma.invoices.findMany({
    where: { customer_id: customer.id, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      invoice_items: true,
      sales_orders: {
        select: {
          order_number: true,
          total_amount: true,
          net_customer_payable: true
        }
      },
      payment_allocations: {
        include: {
          payments: {
            select: {
              payment_number: true,
              payment_mode: true,
              transaction_reference: true,
              payment_date: true
            }
          }
        }
      }
    }
  });
}

/**
 * Customer Payment History & Receipts
 */
export async function getCustomerPayments(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  return await prisma.payments.findMany({
    where: { customer_id: customer.id },
    orderBy: { created_at: 'desc' },
    include: {
      sales_orders: {
        select: { order_number: true }
      },
      payment_allocations: {
        include: {
          invoices: {
            select: {
              invoice_number: true,
              grand_total: true
            }
          }
        }
      }
    }
  });
}

/**
 * Customer Warranties & Digital Certificates
 */
export async function getCustomerWarranties(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  return await prisma.warranties.findMany({
    where: { customer_id: customer.id, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      products: {
        select: {
          model_name: true,
          brand: true,
          sku: true
        }
      },
      serial_numbers: {
        select: {
          serial_number: true
        }
      },
      sales_orders: {
        select: {
          order_number: true
        }
      }
    }
  });
}

/**
 * Customer Service Tickets
 */
export async function getCustomerTickets(user, queryCustomerId) {
  const customer = await resolveCustomerForUser(user, queryCustomerId);

  return await prisma.service_tickets.findMany({
    where: { customer_id: customer.id, deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      sales_orders: {
        select: { order_number: true }
      },
      ticket_activities: {
        orderBy: { created_at: 'desc' }
      }
    }
  });
}

/**
 * Customer Creates New Support / Service Ticket
 */
export async function createCustomerTicket(ticketData, user) {
  const customer = await resolveCustomerForUser(user);

  const ticketNumber = await ticketRepo.generateTicketNumber();
  const slaDueDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const ticket = await prisma.service_tickets.create({
    data: {
      ticket_number: ticketNumber,
      customer_id: customer.id,
      sales_order_id: ticketData.sales_order_id || null,
      category: ticketData.category || 'INVERTER_FAULT',
      priority: ticketData.priority || 'MEDIUM',
      status: 'OPEN',
      source: 'PORTAL',
      reported_issue: ticketData.reported_issue,
      sla_due_date: slaDueDate,
      created_by: user.id
    },
    include: {
      customers: true,
      sales_orders: true
    }
  });

  await prisma.ticket_activities.create({
    data: {
      ticket_id: ticket.id,
      actor_id: user.id,
      activity_type: 'CREATED_BY_CUSTOMER',
      details: {
        reported_issue: ticketData.reported_issue,
        category: ticket.category
      }
    }
  });

  return ticket;
}
