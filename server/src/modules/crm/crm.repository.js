/**
 * CRM & Lead Management Database Repository
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const crmRepository = {
  /**
   * Generates next sequential human-readable lead number (LEAD-YYYY-00001)
   */
  async getNextLeadNumber(tx = null) {
    const client = tx || prisma;
    const rows = await client.$queryRaw`SELECT nextval('lead_number_seq') AS seq`;
    const seq = String(rows[0].seq).padStart(5, '0');
    const year = new Date().getFullYear();
    return `LEAD-${year}-${seq}`;
  },

  /**
   * Generates next sequential human-readable customer code (CUST-YYYY-00001)
   */
  async getNextCustomerCode(tx = null) {
    const client = tx || prisma;
    const rows = await client.$queryRaw`SELECT nextval('customer_code_seq') AS seq`;
    const seq = String(rows[0].seq).padStart(5, '0');
    const year = new Date().getFullYear();
    return `CUST-${year}-${seq}`;
  },

  // ---------------------------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------------------------

  async createLead(leadData, tx = null) {
    const client = tx || prisma;
    return client.leads.create({
      data: leadData
    });
  },

  async findLeadById(id, tx = null) {
    const client = tx || prisma;
    const lead = await client.leads.findFirst({
      where: {
        id,
        deleted_at: null
      },
      include: {
        users_leads_assigned_toTousers: {
          select: { full_name: true, email: true }
        },
        customers: {
          select: { customer_code: true, full_name: true }
        }
      }
    });

    if (!lead) return null;

    const {
      users_leads_assigned_toTousers,
      customers,
      ...leadFields
    } = lead;

    return {
      ...leadFields,
      assigned_to_name: users_leads_assigned_toTousers?.full_name || null,
      assigned_to_email: users_leads_assigned_toTousers?.email || null,
      customer_code: customers?.customer_code || null,
      customer_name: customers?.full_name || null
    };
  },

  async findLeadByNumber(leadNumber, tx = null) {
    const client = tx || prisma;
    return client.leads.findFirst({
      where: {
        lead_number: leadNumber,
        deleted_at: null
      }
    });
  },

  async findLeadsByPhone(phoneE164, tx = null) {
    const client = tx || prisma;
    return client.leads.findMany({
      where: {
        phone_e164: phoneE164,
        deleted_at: null
      },
      select: {
        id: true,
        lead_number: true,
        full_name: true,
        phone_e164: true,
        stage: true,
        source: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });
  },

  async updateLead(id, data, tx = null) {
    const client = tx || prisma;
    return client.leads.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  },

  async listLeads({ page = 1, limit = 20, stage, source, assigned_to, search, sort_by = 'created_at', sort_order = 'DESC' }, tx = null) {
    const client = tx || prisma;
    const where = {
      deleted_at: null
    };

    if (stage) where.stage = stage;
    if (source) where.source = source;
    if (assigned_to) where.assigned_to = assigned_to;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { phone_e164: { contains: search, mode: 'insensitive' } },
        { lead_number: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    const validSortCol = ['created_at', 'full_name', 'stage', 'monthly_electricity_bill', 'lead_number'].includes(sort_by)
      ? sort_by
      : 'created_at';
    orderBy[validSortCol] = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      client.leads.findMany({
        where,
        select: {
          id: true,
          lead_number: true,
          source: true,
          stage: true,
          customer_id: true,
          assigned_to: true,
          full_name: true,
          phone_e164: true,
          email: true,
          city: true,
          requested_capacity_kw: true,
          monthly_electricity_bill: true,
          system_type: true,
          created_at: true,
          users_leads_assigned_toTousers: {
            select: { full_name: true }
          }
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      client.leads.count({ where })
    ]);

    const mappedRows = rows.map(r => {
      const { users_leads_assigned_toTousers, ...leadData } = r;
      return {
        ...leadData,
        assigned_to_name: users_leads_assigned_toTousers?.full_name || null
      };
    });

    return {
      leads: mappedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // ---------------------------------------------------------------------------
  // ACTIVITIES
  // ---------------------------------------------------------------------------

  async createActivity({ lead_id, actor_id, activity_type, details }, tx = null) {
    const client = tx || prisma;
    return client.lead_activities.create({
      data: {
        lead_id,
        actor_id: actor_id || null,
        activity_type,
        details: typeof details === 'string' ? { note: details } : details
      }
    });
  },

  async listActivitiesByLead(leadId, tx = null) {
    const client = tx || prisma;
    const rows = await client.lead_activities.findMany({
      where: { lead_id: leadId },
      include: {
        users: {
          select: { full_name: true, email: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return rows.map(r => {
      const { users, ...act } = r;
      return {
        ...act,
        actor_name: users?.full_name || null,
        actor_email: users?.email || null
      };
    });
  },

  // ---------------------------------------------------------------------------
  // FOLLOW-UPS
  // ---------------------------------------------------------------------------

  async createFollowUp(data, tx = null) {
    const client = tx || prisma;
    return client.follow_ups.create({
      data
    });
  },

  async findFollowUpById(id, tx = null) {
    const client = tx || prisma;
    return client.follow_ups.findUnique({
      where: { id }
    });
  },

  async updateFollowUp(id, data, tx = null) {
    const client = tx || prisma;
    const payload = { ...data, updated_at: new Date() };
    if (data.status === 'COMPLETED' && !data.completed_at) {
      payload.completed_at = new Date();
    }
    return client.follow_ups.update({
      where: { id },
      data: payload
    });
  },

  async listFollowUpsByLead(leadId, tx = null) {
    const client = tx || prisma;
    const rows = await client.follow_ups.findMany({
      where: { lead_id: leadId },
      include: {
        users: {
          select: { full_name: true }
        }
      },
      orderBy: { scheduled_at: 'asc' }
    });

    return rows.map(r => {
      const { users, ...f } = r;
      return {
        ...f,
        assigned_to_name: users?.full_name || null
      };
    });
  },

  // ---------------------------------------------------------------------------
  // SURVEYS LINKED TO LEAD
  // ---------------------------------------------------------------------------

  async listSurveysByLead(leadId, tx = null) {
    const client = tx || prisma;
    return client.surveys.findMany({
      where: { lead_id: leadId },
      include: {
        users_surveys_assigned_engineer_idTousers: {
          select: { id: true, full_name: true, email: true }
        },
        _count: {
          select: { survey_photos: true, project_boms: true }
        }
      },
      orderBy: { scheduled_at: 'desc' }
    });
  },

  // ---------------------------------------------------------------------------
  // CUSTOMERS
  // ---------------------------------------------------------------------------

  async createCustomer(custData, tx = null) {
    const client = tx || prisma;
    return client.customers.create({
      data: custData
    });
  },

  async findCustomerById(id, tx = null) {
    const client = tx || prisma;
    return client.customers.findFirst({
      where: {
        id,
        deleted_at: null
      }
    });
  },

  async findCustomerByPhone(phoneE164, tx = null) {
    const client = tx || prisma;
    return client.customers.findFirst({
      where: {
        phone_e164: phoneE164,
        deleted_at: null
      }
    });
  },

  async findCustomerByCode(customerCode, tx = null) {
    const client = tx || prisma;
    return client.customers.findFirst({
      where: {
        customer_code: customerCode,
        deleted_at: null
      }
    });
  },

  async updateCustomer(id, data, tx = null) {
    const client = tx || prisma;
    return client.customers.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  },

  async listCustomers({ page = 1, limit = 20, customer_type, search, sort_by = 'created_at', sort_order = 'DESC' }, tx = null) {
    const client = tx || prisma;
    const where = {
      deleted_at: null
    };

    if (customer_type) where.customer_type = customer_type;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { phone_e164: { contains: search, mode: 'insensitive' } },
        { customer_code: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    const validCol = ['created_at', 'full_name', 'customer_code'].includes(sort_by) ? sort_by : 'created_at';
    orderBy[validCol] = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      client.customers.findMany({
        where,
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          customer_type: true,
          gstin: true,
          created_at: true
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      client.customers.count({ where })
    ]);

    return {
      customers: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // ---------------------------------------------------------------------------
  // CUSTOMER ADDRESSES
  // ---------------------------------------------------------------------------

  async createCustomerAddress(addressData, tx = null) {
    const client = tx || prisma;
    return client.customer_addresses.create({
      data: addressData
    });
  },

  async listCustomerAddresses(customerId, tx = null) {
    const client = tx || prisma;
    return client.customer_addresses.findMany({
      where: { customer_id: customerId },
      orderBy: { is_primary: 'desc' }
    });
  },

  // ---------------------------------------------------------------------------
  // TIMELINE
  // ---------------------------------------------------------------------------

  async getCustomerTimeline(customerId, tx = null) {
    const client = tx || prisma;
    const [leads, addresses, docs] = await Promise.all([
      client.leads.findMany({
        where: { customer_id: customerId },
        select: {
          id: true,
          lead_number: true,
          stage: true,
          source: true,
          requested_capacity_kw: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      }),
      this.listCustomerAddresses(customerId, client),
      client.customer_documents.findMany({
        where: { customer_id: customerId },
        select: {
          id: true,
          doc_type: true,
          file_name: true,
          size_bytes: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      leads,
      addresses,
      documents: docs
    };
  }
};

export default crmRepository;
