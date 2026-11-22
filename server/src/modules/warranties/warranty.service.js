import { withTransaction, prisma } from '../../database/index.js';
import { AppError } from '../../utils/response.js';
import * as warrantyRepo from './warranty.repository.js';

export async function listWarranties(query) {
  return warrantyRepo.listWarranties(query);
}

export async function getWarranty(id) {
  const warranty = await warrantyRepo.getWarrantyById(id);
  if (!warranty) {
    throw new AppError('Warranty record not found', 404, 'WARRANTY_NOT_FOUND');
  }
  return warranty;
}

export async function getWarrantyByCertificate(certNumber) {
  const warranty = await warrantyRepo.getWarrantyByCertNumber(certNumber);
  if (!warranty) {
    throw new AppError('Warranty certificate not found', 404, 'CERTIFICATE_NOT_FOUND');
  }
  return warranty;
}

export async function listWarrantyPolicies(query) {
  return warrantyRepo.listPolicies(query);
}

/**
 * Automatically registers warranties for all installed hardware upon commissioning sign-off.
 * Invoked by installation.service.js inside customer commissioning sign-off transaction.
 */
export async function autoRegisterWarrantiesForCommissionedJob(jobId, trx) {
  const client = trx || prisma;

  // 1. Fetch job with order, customer, and all dispatches with serials
  const job = await client.installation_jobs.findUnique({
    where: { id: jobId },
    include: {
      sales_orders: {
        include: {
          customers: true,
          dispatches: {
            include: {
              dispatch_serials: {
                include: {
                  serial_numbers: {
                    include: {
                      products: {
                        include: {
                          product_categories: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!job || !job.sales_orders) {
    return [];
  }

  const order = job.sales_orders;
  const customerId = order.customer_id;
  const startDate = new Date();

  // Fetch active policies
  const allPolicies = await client.product_warranty_policies.findMany({
    where: { is_active: true }
  });

  const registeredWarranties = [];

  // Collect unique installed serials from all dispatches
  const serialMap = new Map();
  for (const d of order.dispatches || []) {
    for (const ds of d.dispatch_serials || []) {
      if (ds.serial_numbers && !serialMap.has(ds.serial_number_id)) {
        serialMap.set(ds.serial_number_id, ds.serial_numbers);
      }
    }
  }

  // 2. Register warranty for each installed serialized hardware unit
  for (const [serialId, serial] of serialMap.entries()) {
    const product = serial.products;
    const catName = (product?.product_categories?.name || '').toLowerCase();
    const productName = (product?.model_name || product?.brand || '').toLowerCase();

    // Determine applicable policy
    let matchingPolicy = null;
    if (catName.includes('panel') || catName.includes('module') || productName.includes('panel') || productName.includes('wp')) {
      matchingPolicy = allPolicies.find((p) => p.policy_code === 'POL-PANEL-PERF-25Y') || allPolicies[0];
    } else if (catName.includes('inverter') || productName.includes('inverter')) {
      matchingPolicy = allPolicies.find((p) => p.policy_code === 'POL-INVERTER-5Y') || allPolicies[0];
    } else if (catName.includes('structure')) {
      matchingPolicy = allPolicies.find((p) => p.policy_code === 'POL-STRUCTURE-10Y') || allPolicies[0];
    } else if (catName.includes('acdb') || catName.includes('dcdb') || catName.includes('protection')) {
      matchingPolicy = allPolicies.find((p) => p.policy_code === 'POL-BOS-2Y') || allPolicies[0];
    } else {
      matchingPolicy = allPolicies.find((p) => p.policy_code === 'POL-INVERTER-5Y') || allPolicies[0];
    }

    const durationMonths = matchingPolicy?.duration_months || 60;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const certNumber = await warrantyRepo.generateWarrantyCertNumber(client);

    const policySnapshot = {
      policy_code: matchingPolicy?.policy_code || 'POL-CUSTOM',
      policy_name: matchingPolicy?.policy_name || 'Standard Equipment Warranty',
      warranty_type: matchingPolicy?.warranty_type || 'REPLACEMENT',
      duration_months: durationMonths,
      terms_and_conditions: matchingPolicy?.terms_and_conditions || 'Standard manufacturer defect replacement terms.'
    };

    const warranty = await client.warranties.create({
      data: {
        warranty_certificate_number: certNumber,
        customer_id: customerId,
        sales_order_id: order.id,
        installation_job_id: jobId,
        serial_number_id: serialId,
        product_id: product?.id,
        policy_snapshot: policySnapshot,
        start_date: startDate,
        end_date: endDate,
        status: 'ACTIVE'
      }
    });

    registeredWarranties.push(warranty);
  }

  // 3. Register standard workmanship & installation warranty for the whole plant
  const workmanshipPolicy = allPolicies.find((p) => p.policy_code === 'POL-STRUCTURE-10Y' || p.warranty_type === 'WORKMANSHIP') || allPolicies[0];
  const wmDuration = workmanshipPolicy?.duration_months || 60;
  const wmEndDate = new Date(startDate);
  wmEndDate.setMonth(wmEndDate.getMonth() + wmDuration);

  const wmCertNumber = await warrantyRepo.generateWarrantyCertNumber(client);
  const wmWarranty = await client.warranties.create({
    data: {
      warranty_certificate_number: wmCertNumber,
      customer_id: customerId,
      sales_order_id: order.id,
      installation_job_id: jobId,
      policy_snapshot: {
        policy_code: workmanshipPolicy?.policy_code || 'POL-WORKMANSHIP-5Y',
        policy_name: 'Solar Plant System Workmanship & Mounting Warranty',
        warranty_type: 'WORKMANSHIP',
        duration_months: wmDuration,
        terms_and_conditions: 'Covers physical mounting integrity, cable terminations, weatherproofing and structural anchoring.'
      },
      start_date: startDate,
      end_date: wmEndDate,
      status: 'ACTIVE'
    }
  });
  registeredWarranties.push(wmWarranty);

  return registeredWarranties;
}

/**
 * Manually register a warranty (e.g. for pre-existing or external systems)
 */
export async function createManualWarranty(input, actor) {
  return withTransaction(async (trx) => {
    let policy = null;
    if (input.policy_code) {
      policy = await warrantyRepo.getPolicyByCode(input.policy_code, trx);
    }

    const durationMonths = input.duration_months || policy?.duration_months || 60;
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const certNumber = await warrantyRepo.generateWarrantyCertNumber(trx);

    const policySnapshot = {
      policy_code: policy?.policy_code || 'POL-MANUAL',
      policy_name: policy?.policy_name || 'Manual Equipment Warranty',
      warranty_type: policy?.warranty_type || 'REPLACEMENT',
      duration_months: durationMonths,
      terms_and_conditions: input.terms_override || policy?.terms_and_conditions || 'Standard coverage.'
    };

    return warrantyRepo.createWarranty({
      warranty_certificate_number: certNumber,
      customer_id: input.customer_id,
      sales_order_id: input.sales_order_id,
      installation_job_id: input.installation_job_id || null,
      serial_number_id: input.serial_number_id || null,
      product_id: input.product_id,
      policy_snapshot: policySnapshot,
      start_date: startDate,
      end_date: endDate,
      status: 'ACTIVE'
    }, trx);
  });
}

/**
 * Claim validation rule engine:
 * 1. Serial exists
 * 2. Active warranty exists and is not expired
 * 3. Matches customer if provided
 * 4. No duplicate open service ticket
 */
export async function verifyWarrantyClaim(input) {
  const { serial_number, customer_id } = input;
  const trimmed = (serial_number || '').trim();

  let serial = await prisma.serial_numbers.findUnique({
    where: { serial_number: trimmed },
    include: {
      products: true,
      customers: { select: { id: true, full_name: true, phone_e164: true } }
    }
  });

  // If not found directly, check if user entered a Product SKU
  if (!serial) {
    const product = await prisma.products.findFirst({
      where: {
        OR: [
          { sku: { equals: trimmed, mode: 'insensitive' } },
          { model_name: { equals: trimmed, mode: 'insensitive' } }
        ]
      }
    });

    if (product) {
      if (customer_id) {
        serial = await prisma.serial_numbers.findFirst({
          where: {
            product_id: product.id,
            current_customer_id: customer_id
          },
          include: {
            products: true,
            customers: { select: { id: true, full_name: true, phone_e164: true } }
          }
        });
      }

      if (!serial) {
        return {
          is_valid: false,
          is_product_sku: true,
          reason_code: 'IS_PRODUCT_SKU',
          message: `'${trimmed}' is a Product Catalog Code (SKU) for ${product.brand} ${product.model_name}. Please enter the physical serial number (starts with SN-...) located on the equipment barcode or commissioning certificate.`
        };
      }
    }
  }

  if (!serial) {
    return {
      is_valid: false,
      reason_code: 'SERIAL_NOT_FOUND',
      message: `Serial number ${trimmed} is not registered in the system.`
    };
  }

  // Check active warranty
  const warranty = await prisma.warranties.findFirst({
    where: {
      serial_number_id: serial.id,
      status: 'ACTIVE'
    },
    include: {
      sales_orders: { select: { id: true, order_number: true } },
      customers: { select: { id: true, full_name: true, phone_e164: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  if (!warranty) {
    return {
      is_valid: false,
      serial,
      reason_code: 'NO_ACTIVE_WARRANTY',
      message: `No active warranty found for serial number ${serial_number}.`
    };
  }

  // Check expiry
  if (new Date(warranty.end_date) < new Date()) {
    return {
      is_valid: false,
      serial,
      warranty,
      reason_code: 'WARRANTY_EXPIRED',
      message: `Warranty ${warranty.warranty_certificate_number} expired on ${new Date(warranty.end_date).toLocaleDateString()}.`
    };
  }

  // Check customer ownership if customer_id provided
  if (customer_id && warranty.customer_id !== customer_id) {
    return {
      is_valid: false,
      serial,
      warranty,
      reason_code: 'CUSTOMER_MISMATCH',
      message: `This equipment is registered to a different customer.`
    };
  }

  // Check for duplicate open service ticket
  const openTicket = await prisma.service_tickets.findFirst({
    where: {
      serial_number_id: serial.id,
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'] }
    }
  });

  if (openTicket) {
    return {
      is_valid: false,
      serial,
      warranty,
      reason_code: 'DUPLICATE_OPEN_TICKET',
      message: `An active service ticket (${openTicket.ticket_number}) is already open for this equipment.`,
      existing_ticket: openTicket
    };
  }

  return {
    is_valid: true,
    serial,
    warranty,
    message: 'Equipment has a valid active warranty and is eligible for service / RMA claims.'
  };
}

/**
 * One-path serial hardware lookup:
 * Resolves product specs, current warehouse/status, customer, sales order,
 * installation job, active warranty, service tickets, and RMA replacement swaps.
 */
export async function lookupSerialFullHistory(serialNumber) {
  const serial = await prisma.serial_numbers.findUnique({
    where: { serial_number: serialNumber },
    include: {
      products: {
        include: {
          product_categories: true
        }
      },
      warehouses: true,
      customers: true,
      sales_orders: true,
      serial_movements: {
        orderBy: { created_at: 'desc' },
        take: 20
      },
      warranties: {
        orderBy: { created_at: 'desc' }
      },
      service_tickets: {
        orderBy: { created_at: 'desc' }
      },
      warranty_replacements_warranty_replacements_defective_serial_idToserial_numbers: {
        include: {
          service_tickets: true,
          serial_numbers_warranty_replacements_replacement_serial_idToserial_numbers: true
        }
      },
      warranty_replacements_warranty_replacements_replacement_serial_idToserial_numbers: {
        include: {
          service_tickets: true,
          serial_numbers_warranty_replacements_defective_serial_idToserial_numbers: true
        }
      }
    }
  });

  if (!serial) {
    throw new AppError(`Serial number '${serialNumber}' not found`, 404, 'SERIAL_NOT_FOUND');
  }

  const activeWarranty = serial.warranties.find(
    (w) => w.status === 'ACTIVE' && new Date(w.end_date) >= new Date()
  ) || null;

  const openTickets = serial.service_tickets.filter(
    (t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
  );

  return {
    serial,
    activeWarranty,
    openTickets,
    replacementHistory: {
      replacedAsDefective: serial.warranty_replacements_warranty_replacements_defective_serial_idToserial_numbers,
      installedAsReplacement: serial.warranty_replacements_warranty_replacements_replacement_serial_idToserial_numbers
    }
  };
}
