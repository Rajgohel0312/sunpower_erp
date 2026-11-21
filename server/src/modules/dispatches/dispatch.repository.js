import { prisma } from '../../database/index.js';

/**
 * Generates formatted sequential dispatch number: DSP-YYYY-XXXXX
 */
export async function generateDispatchNumber(tx = null) {
  const client = tx || prisma;
  const currentYear = new Date().getFullYear();
  const seqRes = await client.$queryRawUnsafe(`SELECT nextval('dispatch_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `DSP-${currentYear}-${seqNum}`;
}

/**
 * Lists material dispatches with pagination, filtering, and search
 */
export async function listDispatches({ page = 1, limit = 10, search, status, warehouse_id, sales_order_id }) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = { deleted_at: null };
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (warehouse_id) {
    where.warehouse_id = warehouse_id;
  }
  if (sales_order_id) {
    where.sales_order_id = sales_order_id;
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { dispatch_number: { contains: q, mode: 'insensitive' } },
      { driver_name: { contains: q, mode: 'insensitive' } },
      { vehicle_number: { contains: q, mode: 'insensitive' } },
      { sales_orders: { order_number: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [dispatches, total] = await Promise.all([
    prisma.dispatches.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        warehouses: { select: { id: true, code: true, name: true, city: true } },
        sales_orders: {
          select: {
            id: true,
            order_number: true,
            status: true,
            system_capacity_kw: true,
            customers: { select: { id: true, full_name: true, phone_e164: true } }
          }
        },
        dispatch_items: {
          include: {
            products: { select: { id: true, sku: true, brand: true, model_name: true, unit_code: true } }
          }
        },
        dispatch_serials: {
          include: {
            serial_numbers: { select: { id: true, serial_number: true, status: true } },
            products: { select: { id: true, sku: true, brand: true } }
          }
        }
      }
    }),
    prisma.dispatches.count({ where })
  ]);

  return {
    dispatches,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / take) || 1
  };
}

/**
 * Fetches single dispatch by UUID with complete details
 */
export async function getDispatchById(id, tx = null) {
  const client = tx || prisma;
  return client.dispatches.findUnique({
    where: { id },
    include: {
      warehouses: { select: { id: true, code: true, name: true, city: true, address_line1: true } },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          status: true,
          system_capacity_kw: true,
          customers: { select: { id: true, full_name: true, phone_e164: true } }
        }
      },
      dispatch_items: {
        include: {
          products: {
            select: {
              id: true,
              sku: true,
              brand: true,
              model_name: true,
              unit_code: true,
              is_serial_tracked: true
            }
          }
        }
      },
      dispatch_serials: {
        include: {
          serial_numbers: { select: { id: true, serial_number: true, status: true } },
          products: { select: { id: true, sku: true, brand: true, model_name: true } }
        }
      },
      installation_jobs: {
        select: {
          id: true,
          job_number: true,
          status: true,
          scheduled_start: true
        }
      }
    }
  });
}

/**
 * Creates dispatch header in database
 */
export async function createDispatchRecord(data, tx = null) {
  const client = tx || prisma;
  return client.dispatches.create({
    data: {
      dispatch_number: data.dispatch_number,
      sales_order_id: data.sales_order_id,
      warehouse_id: data.warehouse_id,
      driver_name: data.driver_name,
      driver_phone: data.driver_phone,
      vehicle_number: data.vehicle_number,
      dispatch_date: data.dispatch_date ? new Date(data.dispatch_date) : new Date(),
      delivery_target_date: data.delivery_target_date ? new Date(data.delivery_target_date) : null,
      delivery_notes: data.delivery_notes || null,
      status: 'PREPARED',
      created_by: data.created_by || null
    }
  });
}

/**
 * Bulk creates line items for a dispatch
 */
export async function createDispatchItems(items, tx = null) {
  const client = tx || prisma;
  return client.dispatch_items.createMany({
    data: items
  });
}

/**
 * Bulk creates serial associations for a dispatch
 */
export async function createDispatchSerials(serials, tx = null) {
  const client = tx || prisma;
  return client.dispatch_serials.createMany({
    data: serials
  });
}

/**
 * Updates dispatch status (e.g. IN_TRANSIT, DELIVERED)
 */
export async function updateDispatchStatus(id, updateData, tx = null) {
  const client = tx || prisma;
  return client.dispatches.update({
    where: { id },
    data: {
      ...updateData,
      updated_at: new Date()
    }
  });
}

/**
 * Fetches serial numbers by serial string values
 */
export async function findSerialsByNumbers(serialNumbers, tx = null) {
  const client = tx || prisma;
  return client.serial_numbers.findMany({
    where: {
      serial_number: { in: serialNumbers }
    },
    include: {
      products: { select: { id: true, sku: true, is_serial_tracked: true } }
    }
  });
}

/**
 * Batch updates serial number statuses
 */
export async function updateSerialStatus(serialIds, status, tx = null) {
  const client = tx || prisma;
  return client.serial_numbers.updateMany({
    where: {
      id: { in: serialIds }
    },
    data: {
      status,
      updated_at: new Date()
    }
  });
}

/**
 * Batch creates serial movement audit entries
 */
export async function recordSerialMovements(movements, tx = null) {
  const client = tx || prisma;
  return client.serial_movements.createMany({
    data: movements
  });
}
