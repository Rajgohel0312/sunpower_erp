/**
 * CRM & Lead Management Database Repository
 * Uses custom parameterized query builder.
 */

import { db } from '../../database/index.js';

export const crmRepository = {
  /**
   * Generates next sequential human-readable lead number (LEAD-YYYY-00001)
   */
  async getNextLeadNumber(client = null) {
    const rows = await db.raw("SELECT nextval('lead_number_seq') AS seq", [], client);
    const seq = String(rows[0].seq).padStart(5, '0');
    const year = new Date().getFullYear();
    return `LEAD-${year}-${seq}`;
  },

  /**
   * Generates next sequential human-readable customer code (CUST-YYYY-00001)
   */
  async getNextCustomerCode(client = null) {
    const rows = await db.raw("SELECT nextval('customer_code_seq') AS seq", [], client);
    const seq = String(rows[0].seq).padStart(5, '0');
    const year = new Date().getFullYear();
    return `CUST-${year}-${seq}`;
  },

  // ---------------------------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------------------------

  async createLead(leadData, client = null) {
    return db
      .insertInto('leads', leadData)
      .returning('*')
      .executeTakeFirst(client);
  },

  async findLeadById(id, client = null) {
    return db
      .select(
        'l.id',
        'l.lead_number',
        'l.source',
        'l.stage',
        'l.customer_id',
        'l.assigned_to',
        'l.full_name',
        'l.phone_e164',
        'l.email',
        'l.site_address',
        'l.city',
        'l.state',
        'l.pincode',
        'l.monthly_electricity_bill',
        'l.requested_capacity_kw',
        'l.system_type',
        'l.lost_reason',
        'l.notes',
        'l.converted_at',
        'l.created_by',
        'l.created_at',
        'l.updated_at',
        'u.full_name AS assigned_to_name',
        'u.email AS assigned_to_email',
        'c.customer_code',
        'c.full_name AS customer_name'
      )
      .from('leads AS l')
      .leftJoin('users AS u', 'l.assigned_to', 'u.id')
      .leftJoin('customers AS c', 'l.customer_id', 'c.id')
      .where('l.id', '=', id)
      .whereNull('l.deleted_at')
      .executeTakeFirst(client);
  },

  async findLeadByNumber(leadNumber, client = null) {
    return db
      .select('*')
      .from('leads')
      .where('lead_number', '=', leadNumber)
      .whereNull('deleted_at')
      .executeTakeFirst(client);
  },

  async findLeadsByPhone(phoneE164, client = null) {
    return db
      .select('id', 'lead_number', 'full_name', 'phone_e164', 'stage', 'source', 'created_at')
      .from('leads')
      .where('phone_e164', '=', phoneE164)
      .whereNull('deleted_at')
      .orderBy('created_at', 'DESC')
      .execute(client);
  },

  async updateLead(id, data, client = null) {
    const updatePayload = {
      ...data,
      updated_at: new Date()
    };

    return db
      .update('leads', updatePayload)
      .where('id', '=', id)
      .whereNull('deleted_at')
      .returning('*')
      .executeTakeFirst(client);
  },

  async listLeads({ page = 1, limit = 20, stage, source, assigned_to, search, sort_by = 'created_at', sort_order = 'DESC' }, client = null) {
    const offset = (page - 1) * limit;

    let query = db
      .select(
        'l.id',
        'l.lead_number',
        'l.source',
        'l.stage',
        'l.customer_id',
        'l.assigned_to',
        'l.full_name',
        'l.phone_e164',
        'l.email',
        'l.city',
        'l.requested_capacity_kw',
        'l.monthly_electricity_bill',
        'l.system_type',
        'l.created_at',
        'u.full_name AS assigned_to_name'
      )
      .from('leads AS l')
      .leftJoin('users AS u', 'l.assigned_to', 'u.id')
      .whereNull('l.deleted_at');

    if (stage) {
      query.andWhere('l.stage', '=', stage);
    }
    if (source) {
      query.andWhere('l.source', '=', source);
    }
    if (assigned_to) {
      query.andWhere('l.assigned_to', '=', assigned_to);
    }
    if (search) {
      query.andWhere(g => {
        g.where('l.full_name', 'ILIKE', `%${search}%`)
         .orWhere('l.phone_e164', 'ILIKE', `%${search}%`)
         .orWhere('l.lead_number', 'ILIKE', `%${search}%`);
      });
    }

    const orderColumn = `l.${sort_by}`;
    const rows = await query
      .orderBy(orderColumn, sort_order)
      .limit(limit)
      .offset(offset)
      .execute(client);

    // Count query
    let countQuery = db
      .select('COUNT(*) AS total')
      .from('leads AS l')
      .whereNull('l.deleted_at');

    if (stage) countQuery.andWhere('l.stage', '=', stage);
    if (source) countQuery.andWhere('l.source', '=', source);
    if (assigned_to) countQuery.andWhere('l.assigned_to', '=', assigned_to);
    if (search) {
      countQuery.andWhere(g => {
        g.where('l.full_name', 'ILIKE', `%${search}%`)
         .orWhere('l.phone_e164', 'ILIKE', `%${search}%`)
         .orWhere('l.lead_number', 'ILIKE', `%${search}%`);
      });
    }

    const countRes = await countQuery.executeTakeFirst(client);
    const total = parseInt(countRes?.total || '0', 10);

    return {
      leads: rows,
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

  async createActivity({ lead_id, actor_id, activity_type, details }, client = null) {
    return db
      .insertInto('lead_activities', {
        lead_id,
        actor_id,
        activity_type,
        details: typeof details === 'string' ? JSON.stringify({ note: details }) : details
      })
      .returning('*')
      .executeTakeFirst(client);
  },

  async listActivitiesByLead(leadId, client = null) {
    return db
      .select(
        'la.id',
        'la.lead_id',
        'la.activity_type',
        'la.details',
        'la.created_at',
        'la.actor_id',
        'u.full_name AS actor_name',
        'u.email AS actor_email'
      )
      .from('lead_activities AS la')
      .leftJoin('users AS u', 'la.actor_id', 'u.id')
      .where('la.lead_id', '=', leadId)
      .orderBy('la.created_at', 'DESC')
      .execute(client);
  },

  // ---------------------------------------------------------------------------
  // FOLLOW-UPS
  // ---------------------------------------------------------------------------

  async createFollowUp(data, client = null) {
    return db
      .insertInto('follow_ups', data)
      .returning('*')
      .executeTakeFirst(client);
  },

  async findFollowUpById(id, client = null) {
    return db
      .select('*')
      .from('follow_ups')
      .where('id', '=', id)
      .executeTakeFirst(client);
  },

  async updateFollowUp(id, data, client = null) {
    const payload = { ...data, updated_at: new Date() };
    if (data.status === 'COMPLETED' && !data.completed_at) {
      payload.completed_at = new Date();
    }
    return db
      .update('follow_ups', payload)
      .where('id', '=', id)
      .returning('*')
      .executeTakeFirst(client);
  },

  async listFollowUpsByLead(leadId, client = null) {
    return db
      .select(
        'f.id',
        'f.lead_id',
        'f.assigned_to',
        'f.scheduled_at',
        'f.status',
        'f.notes',
        'f.completed_at',
        'f.created_at',
        'u.full_name AS assigned_to_name'
      )
      .from('follow_ups AS f')
      .leftJoin('users AS u', 'f.assigned_to', 'u.id')
      .where('f.lead_id', '=', leadId)
      .orderBy('f.scheduled_at', 'ASC')
      .execute(client);
  },

  // ---------------------------------------------------------------------------
  // CUSTOMERS
  // ---------------------------------------------------------------------------

  async createCustomer(custData, client = null) {
    return db
      .insertInto('customers', custData)
      .returning('*')
      .executeTakeFirst(client);
  },

  async findCustomerById(id, client = null) {
    return db
      .select('*')
      .from('customers')
      .where('id', '=', id)
      .whereNull('deleted_at')
      .executeTakeFirst(client);
  },

  async findCustomerByPhone(phoneE164, client = null) {
    return db
      .select('*')
      .from('customers')
      .where('phone_e164', '=', phoneE164)
      .whereNull('deleted_at')
      .executeTakeFirst(client);
  },

  async findCustomerByCode(customerCode, client = null) {
    return db
      .select('*')
      .from('customers')
      .where('customer_code', '=', customerCode)
      .whereNull('deleted_at')
      .executeTakeFirst(client);
  },

  async updateCustomer(id, data, client = null) {
    return db
      .update('customers', { ...data, updated_at: new Date() })
      .where('id', '=', id)
      .whereNull('deleted_at')
      .returning('*')
      .executeTakeFirst(client);
  },

  async listCustomers({ page = 1, limit = 20, customer_type, search, sort_by = 'created_at', sort_order = 'DESC' }, client = null) {
    const offset = (page - 1) * limit;

    let query = db
      .select(
        'c.id',
        'c.customer_code',
        'c.full_name',
        'c.phone_e164',
        'c.email',
        'c.customer_type',
        'c.gstin',
        'c.created_at'
      )
      .from('customers AS c')
      .whereNull('c.deleted_at');

    if (customer_type) {
      query.andWhere('c.customer_type', '=', customer_type);
    }
    if (search) {
      query.andWhere(g => {
        g.where('c.full_name', 'ILIKE', `%${search}%`)
         .orWhere('c.phone_e164', 'ILIKE', `%${search}%`)
         .orWhere('c.customer_code', 'ILIKE', `%${search}%`);
      });
    }

    const rows = await query
      .orderBy(`c.${sort_by}`, sort_order)
      .limit(limit)
      .offset(offset)
      .execute(client);

    let countQuery = db
      .select('COUNT(*) AS total')
      .from('customers AS c')
      .whereNull('c.deleted_at');

    if (customer_type) countQuery.andWhere('c.customer_type', '=', customer_type);
    if (search) {
      countQuery.andWhere(g => {
        g.where('c.full_name', 'ILIKE', `%${search}%`)
         .orWhere('c.phone_e164', 'ILIKE', `%${search}%`)
         .orWhere('c.customer_code', 'ILIKE', `%${search}%`);
      });
    }

    const countRes = await countQuery.executeTakeFirst(client);
    const total = parseInt(countRes?.total || '0', 10);

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

  async createCustomerAddress(addressData, client = null) {
    return db
      .insertInto('customer_addresses', addressData)
      .returning('*')
      .executeTakeFirst(client);
  },

  async listCustomerAddresses(customerId, client = null) {
    return db
      .select('*')
      .from('customer_addresses')
      .where('customer_id', '=', customerId)
      .orderBy('is_primary', 'DESC')
      .execute(client);
  },

  // ---------------------------------------------------------------------------
  // TIMELINE
  // ---------------------------------------------------------------------------

  async getCustomerTimeline(customerId, client = null) {
    const leads = await db
      .select('id', 'lead_number', 'stage', 'source', 'requested_capacity_kw', 'created_at')
      .from('leads')
      .where('customer_id', '=', customerId)
      .orderBy('created_at', 'DESC')
      .execute(client);

    const addresses = await this.listCustomerAddresses(customerId, client);

    const docs = await db
      .select('id', 'doc_type', 'file_name', 'size_bytes', 'created_at')
      .from('customer_documents')
      .where('customer_id', '=', customerId)
      .orderBy('created_at', 'DESC')
      .execute(client);

    return {
      leads,
      addresses,
      documents: docs
    };
  }
};
