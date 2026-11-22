import { prisma } from '../../database/index.js';

export async function generateWarrantyCertNumber(trx) {
  const client = trx || prisma;
  const seqResult = await client.$queryRaw`SELECT nextval('warranty_cert_number_seq') as next_val`;
  const nextVal = seqResult[0]?.next_val || 1;
  const year = new Date().getFullYear();
  return `WAR-${year}-${String(nextVal).padStart(5, '0')}`;
}

export async function createWarranty(data, trx) {
  const client = trx || prisma;
  return client.warranties.create({
    data,
    include: {
      customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true } },
      products: { select: { id: true, sku: true, brand: true, model_name: true, category_id: true } },
      serial_numbers: { select: { id: true, serial_number: true, status: true } },
      sales_orders: { select: { id: true, order_number: true, system_capacity_kw: true } }
    }
  });
}

export async function listWarranties(params = {}, trx) {
  const client = trx || prisma;
  const { page = 1, limit = 10, customer_id, sales_order_id, serial_number_id, status, search } = params;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;
  const take = safeLimit;

  const where = {};

  if (customer_id) where.customer_id = customer_id;
  if (sales_order_id) where.sales_order_id = sales_order_id;
  if (serial_number_id) where.serial_number_id = serial_number_id;
  if (status) where.status = status;

  if (search && search.trim() !== '') {
    const term = search.trim();
    where.OR = [
      { warranty_certificate_number: { contains: term, mode: 'insensitive' } },
      { customers: { full_name: { contains: term, mode: 'insensitive' } } },
      { serial_numbers: { serial_number: { contains: term, mode: 'insensitive' } } },
      { products: { model_name: { contains: term, mode: 'insensitive' } } }
    ];
  }

  const [total, warranties] = await Promise.all([
    client.warranties.count({ where }),
    client.warranties.findMany({
      where,
      include: {
        customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true, email: true } },
        products: { select: { id: true, sku: true, brand: true, model_name: true, category_id: true } },
        serial_numbers: { select: { id: true, serial_number: true, status: true } },
        sales_orders: { select: { id: true, order_number: true, system_capacity_kw: true } },
        installation_jobs: { select: { id: true, job_number: true, status: true } }
      },
      orderBy: { created_at: 'desc' },
      skip,
      take
    })
  ]);

  return {
    warranties,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1
  };
}

export async function getWarrantyById(id, trx) {
  const client = trx || prisma;
  return client.warranties.findUnique({
    where: { id },
    include: {
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          customer_type: true
        }
      },
      products: {
        include: {
          product_categories: true
        }
      },
      serial_numbers: {
        include: {
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
        include: {
          installation_signoffs: true
        }
      },
      service_tickets: {
        orderBy: { created_at: 'desc' },
        take: 5
      }
    }
  });
}

export async function getWarrantyByCertNumber(certNumber, trx) {
  const client = trx || prisma;
  return client.warranties.findUnique({
    where: { warranty_certificate_number: certNumber },
    include: {
      customers: { select: { id: true, customer_code: true, full_name: true, phone_e164: true } },
      products: true,
      serial_numbers: true,
      sales_orders: true,
      installation_jobs: true
    }
  });
}

export async function findActiveWarrantyForSerial(serialNumberId, trx) {
  const client = trx || prisma;
  return client.warranties.findFirst({
    where: {
      serial_number_id: serialNumberId,
      status: 'ACTIVE'
    },
    orderBy: { created_at: 'desc' }
  });
}

export async function listPolicies(query = {}, trx) {
  const client = trx || prisma;
  const where = {};
  if (query.is_active !== undefined) where.is_active = query.is_active;
  if (query.category_id) where.category_id = query.category_id;

  return client.product_warranty_policies.findMany({
    where,
    orderBy: { created_at: 'asc' }
  });
}

export async function getPolicyByCode(policyCode, trx) {
  const client = trx || prisma;
  return client.product_warranty_policies.findUnique({
    where: { policy_code: policyCode }
  });
}

export async function updateWarranty(id, data, trx) {
  const client = trx || prisma;
  return client.warranties.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date()
    }
  });
}
