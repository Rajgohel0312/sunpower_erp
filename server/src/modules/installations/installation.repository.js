import { prisma } from '../../database/index.js';

/**
 * Generates formatted sequential job number: JOB-YYYY-XXXXX
 */
export async function generateJobNumber(tx = null) {
  const client = tx || prisma;
  const currentYear = new Date().getFullYear();
  const seqRes = await client.$queryRawUnsafe(`SELECT nextval('installation_job_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `JOB-${currentYear}-${seqNum}`;
}

/**
 * Generates formatted commissioning certificate number: CERT-YYYY-XXXXX
 */
export async function generateCertificateNumber(tx = null) {
  const client = tx || prisma;
  const currentYear = new Date().getFullYear();
  const seqRes = await client.$queryRawUnsafe(`SELECT nextval('commissioning_cert_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `CERT-${currentYear}-${seqNum}`;
}

/**
 * Lists installation jobs with search and pagination
 */
export async function listInstallationJobs({ page = 1, limit = 10, search, status, team_lead_id, sales_order_id }) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = { deleted_at: null };
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (team_lead_id) {
    where.team_lead_id = team_lead_id;
  }
  if (sales_order_id) {
    where.sales_order_id = sales_order_id;
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { job_number: { contains: q, mode: 'insensitive' } },
      { sales_orders: { order_number: { contains: q, mode: 'insensitive' } } },
      { sales_orders: { customers: { full_name: { contains: q, mode: 'insensitive' } } } },
      { users_installation_jobs_team_lead_idTousers: { full_name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.installation_jobs.findMany({
      where,
      skip,
      take,
      orderBy: { scheduled_start: 'desc' },
      include: {
        users_installation_jobs_team_lead_idTousers: { select: { id: true, full_name: true, phone_e164: true, email: true } },
        sales_orders: {
          select: {
            id: true,
            order_number: true,
            status: true,
            system_capacity_kw: true,
            customers: { select: { id: true, full_name: true, phone_e164: true } }
          }
        },
        dispatches: {
          select: {
            id: true,
            dispatch_number: true,
            status: true,
            vehicle_number: true,
            driver_name: true
          }
        },
        installation_technicians: {
          include: {
            users: { select: { id: true, full_name: true, phone_e164: true } }
          }
        },
        installation_signoffs: {
          select: {
            id: true,
            certificate_number: true,
            customer_name: true,
            signed_at: true,
            customer_rating: true
          }
        }
      }
    }),
    prisma.installation_jobs.count({ where })
  ]);

  return {
    jobs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / take) || 1
  };
}

/**
 * Fetches single installation job by UUID with complete checklist, team, and photo details
 */
export async function getInstallationJobById(id, tx = null) {
  const client = tx || prisma;
  return client.installation_jobs.findUnique({
    where: { id },
    include: {
      users_installation_jobs_team_lead_idTousers: { select: { id: true, full_name: true, phone_e164: true, email: true } },
      users_installation_jobs_created_byTousers: { select: { id: true, full_name: true } },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          status: true,
          system_capacity_kw: true,
          total_amount: true,
          subsidy_amount: true,
          net_customer_payable: true,
          advance_payment_received: true,
          payment_status: true,
          customers: {
            select: {
              id: true,
              full_name: true,
              phone_e164: true,
              email: true,
              customer_addresses: true
            }
          },
          leads: {
            select: {
              id: true,
              lead_number: true,
              site_address: true,
              city: true,
              pincode: true,
              system_type: true
            }
          }
        }
      },
      dispatches: {
        include: {
          dispatch_items: {
            include: {
              products: { select: { id: true, sku: true, brand: true, model_name: true } }
            }
          },
          dispatch_serials: {
            include: {
              serial_numbers: { select: { id: true, serial_number: true, status: true } },
              products: { select: { id: true, sku: true, brand: true } }
            }
          }
        }
      },
      installation_technicians: {
        include: {
          users: { select: { id: true, full_name: true, phone_e164: true } }
        }
      },
      installation_checklists: {
        orderBy: { category: 'asc' }
      },
      installation_photos: {
        orderBy: { created_at: 'desc' }
      },
      installation_signoffs: true
    }
  });
}

/**
 * Creates installation job record in database
 */
export async function createJobRecord(data, tx = null) {
  const client = tx || prisma;
  return client.installation_jobs.create({
    data: {
      job_number: data.job_number,
      sales_order_id: data.sales_order_id,
      dispatch_id: data.dispatch_id || null,
      team_lead_id: data.team_lead_id || null,
      scheduled_start: new Date(data.scheduled_start),
      scheduled_end: data.scheduled_end ? new Date(data.scheduled_end) : null,
      status: 'ASSIGNED',
      created_by: data.created_by || null
    }
  });
}

/**
 * Assigns technicians to job
 */
export async function assignTechnicians(techAssignments, tx = null) {
  const client = tx || prisma;
  return client.installation_technicians.createMany({
    data: techAssignments,
    skipDuplicates: true
  });
}

/**
 * Initializes standard checklist items for an installation job
 */
export async function initializeChecklist(items, tx = null) {
  const client = tx || prisma;
  return client.installation_checklists.createMany({
    data: items,
    skipDuplicates: true
  });
}

/**
 * Updates status of an installation job
 */
export async function updateJobStatus(id, updateData, tx = null) {
  const client = tx || prisma;
  return client.installation_jobs.update({
    where: { id },
    data: {
      ...updateData,
      updated_at: new Date()
    }
  });
}

/**
 * Updates checklist step status and measured value
 */
export async function updateChecklistStep(jobId, stepKey, updateData, tx = null) {
  const client = tx || prisma;
  return client.installation_checklists.updateMany({
    where: {
      installation_job_id: jobId,
      step_key: stepKey
    },
    data: {
      ...updateData,
      completed_at: updateData.is_completed ? new Date() : null
    }
  });
}

/**
 * Creates photo evidence record for an installation job
 */
export async function createInstallationPhoto(photoData, tx = null) {
  const client = tx || prisma;
  return client.installation_photos.create({
    data: photoData
  });
}

/**
 * Records customer digital sign-off and commissioning certificate
 */
export async function createSignoffRecord(signoffData, tx = null) {
  const client = tx || prisma;
  return client.installation_signoffs.create({
    data: signoffData
  });
}
