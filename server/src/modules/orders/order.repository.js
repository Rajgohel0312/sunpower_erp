import { prisma } from '../../database/prisma.js';

/**
 * Generates formatted human-readable sales order number: SO-YYYY-XXXXX
 */
export async function generateOrderNumber() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('sales_order_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `SO-${currentYear}-${seqNum}`;
}

/**
 * Creates sales order and updates quotation to CONVERTED in transaction
 */
export async function createOrderRecord(orderData) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.sales_orders.create({
      data: {
        order_number: orderData.order_number,
        quotation_id: orderData.quotation_id,
        customer_id: orderData.customer_id,
        lead_id: orderData.lead_id || null,
        survey_id: orderData.survey_id || null,
        bom_id: orderData.bom_id,
        system_capacity_kw: orderData.system_capacity_kw,
        total_amount: orderData.total_amount,
        subsidy_amount: orderData.subsidy_amount || 0,
        net_customer_payable: orderData.net_customer_payable,
        advance_payment_received: orderData.advance_payment_received || 0,
        payment_status: orderData.payment_status || 'PENDING',
        status: orderData.status || 'CONFIRMED',
        snapshot_data: orderData.snapshot_data,
        confirmed_by: orderData.confirmed_by || null,
        confirmed_at: new Date(),
        installation_target_date: orderData.installation_target_date ? new Date(orderData.installation_target_date) : null,
        notes: orderData.notes || null
      }
    });

    await tx.quotations.update({
      where: { id: orderData.quotation_id },
      data: {
        status: 'CONVERTED',
        updated_at: new Date()
      }
    });

    return order;
  });
}

/**
 * Retrieves sales order by ID with all relations
 */
export async function getOrderById(id) {
  return await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          customer_type: true,
          gstin: true
        }
      },
      quotations: {
        select: {
          id: true,
          quotation_number: true,
          grand_total: true,
          net_payable: true,
          payment_terms: true
        }
      },
      project_boms: {
        select: {
          id: true,
          bom_number: true,
          system_capacity_kw: true,
          total_cost: true
        }
      },
      leads: {
        select: {
          id: true,
          lead_number: true,
          full_name: true,
          phone_e164: true
        }
      },
      surveys: {
        select: {
          id: true,
          survey_number: true,
          roof_type: true
        }
      },
      users: {
        select: {
          id: true,
          full_name: true,
          email: true
        }
      }
    }
  });
}

/**
 * Lists sales orders with standardized integer sanitization, pagination, and search
 */
export async function listOrders({
  page = 1,
  limit = 10,
  search = '',
  status = 'ALL',
  customer_id
} = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const whereClause = {
    deleted_at: null
  };

  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  if (customer_id) {
    whereClause.customer_id = customer_id;
  }

  if (search && search.trim()) {
    const s = search.trim();
    whereClause.OR = [
      { order_number: { contains: s, mode: 'insensitive' } },
      { customers: { full_name: { contains: s, mode: 'insensitive' } } },
      { customers: { customer_code: { contains: s, mode: 'insensitive' } } },
      { customers: { phone_e164: { contains: s, mode: 'insensitive' } } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.sales_orders.findMany({
      where: whereClause,
      skip,
      take: safeLimit,
      orderBy: { created_at: 'desc' },
      include: {
        customers: {
          select: {
            id: true,
            customer_code: true,
            full_name: true,
            phone_e164: true
          }
        },
        quotations: {
          select: {
            id: true,
            quotation_number: true
          }
        },
        project_boms: {
          select: {
            id: true,
            bom_number: true
          }
        }
      }
    }),
    prisma.sales_orders.count({ where: whereClause })
  ]);

  return {
    data: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

/**
 * Updates sales order status
 */
export async function updateOrderStatus(id, status, notes = null) {
  const updateData = {
    status,
    updated_at: new Date()
  };
  if (notes) updateData.notes = notes;

  return await prisma.sales_orders.update({
    where: { id },
    data: updateData
  });
}

/**
 * Updates payment received on sales order
 */
export async function updateOrderPayment(id, advanceReceived, paymentStatus, snapshotData = null) {
  const data = {
    advance_payment_received: advanceReceived,
    payment_status: paymentStatus,
    updated_at: new Date()
  };
  if (snapshotData) {
    data.snapshot_data = snapshotData;
  }

  return await prisma.sales_orders.update({
    where: { id },
    data
  });
}
