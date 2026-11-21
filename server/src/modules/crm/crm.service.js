/**
 * CRM & Lead Management Business Logic Service
 * Strictly enforces business rules, state machine transitions, transactions, and auditing.
 */

import { crmRepository } from './crm.repository.js';
import { userRepository } from '../users/user.repository.js';
import { normalizePhone } from './crm.schemas.js';
import { AppError } from '../../utils/response.js';
import { withTransaction } from '../../database/index.js';

// Allowed State Machine Transitions
const ALLOWED_STAGE_TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['SURVEY_SCHEDULED', 'LOST'],
  SURVEY_SCHEDULED: ['SURVEY_APPROVED', 'QUALIFIED', 'LOST'],
  SURVEY_APPROVED: ['QUOTATION_SENT', 'LOST'],
  QUOTATION_SENT: ['NEGOTIATION', 'WON', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [], // Terminal stage
  LOST: ['NEW'] // Can be reopened
};

export const crmService = {
  /**
   * Check for potential duplicate leads before or during creation
   * Does NOT merge silently per PRD rule.
   */
  async checkDuplicates(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw new AppError('Invalid phone number provided for duplicate check.', 400, 'INVALID_PHONE');
    }

    const matches = await crmRepository.findLeadsByPhone(normalized);
    const existingCustomer = await crmRepository.findCustomerByPhone(normalized);

    return {
      phone_e164: normalized,
      has_duplicates: matches.length > 0 || !!existingCustomer,
      matching_leads: matches,
      existing_customer: existingCustomer ? {
        id: existingCustomer.id,
        customer_code: existingCustomer.customer_code,
        full_name: existingCustomer.full_name
      } : null
    };
  },

  /**
   * Create new lead with auto-generated lead number and initial audit activity
   */
  async createLead(input, actor) {
    return withTransaction(async (trx) => {
      // 1. Generate sequence-based lead number
      const leadNumber = await crmRepository.getNextLeadNumber(trx);

      // 2. Insert lead
      const lead = await crmRepository.createLead({
        lead_number: leadNumber,
        full_name: input.full_name,
        phone_e164: input.phone_e164,
        email: input.email || null,
        source: input.source || 'MANUAL',
        stage: 'NEW',
        site_address: input.site_address || null,
        city: input.city || null,
        state: input.state || 'Gujarat',
        pincode: input.pincode || null,
        monthly_electricity_bill: input.monthly_electricity_bill != null ? input.monthly_electricity_bill : null,
        requested_capacity_kw: input.requested_capacity_kw != null ? input.requested_capacity_kw : null,
        system_type: input.system_type || 'ON_GRID',
        notes: input.notes || null,
        assigned_to: input.assigned_to || null,
        created_by: actor.id
      }, trx);

      // 3. Record initial activity
      await crmRepository.createActivity({
        lead_id: lead.id,
        actor_id: actor.id,
        activity_type: 'STAGE_CHANGE',
        details: {
          action: 'LEAD_CREATED',
          stage: 'NEW',
          source: lead.source,
          created_by_name: actor.fullName || actor.email
        }
      }, trx);

      // 4. If note provided, log as initial note
      if (input.notes) {
        await crmRepository.createActivity({
          lead_id: lead.id,
          actor_id: actor.id,
          activity_type: 'NOTE',
          details: { note: input.notes }
        }, trx);
      }

      return lead;
    });
  },

  /**
   * Retrieve single lead with associated activities and follow-ups
   */
  async getLead(id) {
    const lead = await crmRepository.findLeadById(id);
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    const [activities, followUps, surveys] = await Promise.all([
      crmRepository.listActivitiesByLead(id),
      crmRepository.listFollowUpsByLead(id),
      crmRepository.listSurveysByLead(id)
    ]);

    return {
      ...lead,
      activities,
      follow_ups: followUps,
      surveys: (surveys || []).map(s => ({
        ...s,
        assigned_engineer_name: s.users_surveys_assigned_engineer_idTousers?.full_name || null,
        assigned_engineer_email: s.users_surveys_assigned_engineer_idTousers?.email || null,
        photos_count: s._count?.survey_photos || 0,
        boms_count: s._count?.project_boms || 0
      }))
    };
  },

  /**
   * List leads with filters, search, and pagination
   */
  async listLeads(queryParams) {
    return crmRepository.listLeads(queryParams);
  },

  /**
   * Update lead details and enforce stage transition state machine
   */
  async updateLead(id, input, actor) {
    const existing = await crmRepository.findLeadById(id);
    if (!existing) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    return withTransaction(async (trx) => {
      // 1. Stage transition check
      if (input.stage && input.stage !== existing.stage) {
        const allowed = ALLOWED_STAGE_TRANSITIONS[existing.stage] || [];
        if (!allowed.includes(input.stage)) {
          throw new AppError(
            `Invalid stage transition from '${existing.stage}' to '${input.stage}'. Allowed: [${allowed.join(', ')}]`,
            400,
            'INVALID_STAGE_TRANSITION'
          );
        }

        if (input.stage === 'LOST' && (!input.lost_reason || !input.lost_reason.trim())) {
          throw new AppError('A reason is required when marking a lead as LOST.', 400, 'LOST_REASON_REQUIRED');
        }

        // Record stage transition activity
        await crmRepository.createActivity({
          lead_id: id,
          actor_id: actor.id,
          activity_type: 'STAGE_CHANGE',
          details: {
            from_stage: existing.stage,
            to_stage: input.stage,
            reason: input.lost_reason || null,
            updated_by: actor.fullName || actor.email
          }
        }, trx);
      }

      // 2. Perform update
      const updated = await crmRepository.updateLead(id, input, trx);
      return updated;
    });
  },

  /**
   * Assign lead to sales representative
   */
  async assignLead(id, { assigned_to, notes }, actor) {
    const lead = await crmRepository.findLeadById(id);
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    // Verify assigned user exists and is active
    const assignee = await userRepository.findById(assigned_to);
    if (!assignee || !assignee.is_active) {
      throw new AppError('Assigned user not found or inactive.', 400, 'INVALID_ASSIGNEE');
    }

    return withTransaction(async (trx) => {
      const updated = await crmRepository.updateLead(id, { assigned_to }, trx);

      // Log assignment activity
      await crmRepository.createActivity({
        lead_id: id,
        actor_id: actor.id,
        activity_type: 'ASSIGNMENT',
        details: {
          previous_assigned_to: lead.assigned_to,
          assigned_to,
          assignee_name: assignee.full_name,
          notes: notes || null
        }
      }, trx);

      return updated;
    });
  },

  /**
   * Transactional and idempotent lead-to-customer conversion
   */
  async convertLead(id, input, actor) {
    const lead = await crmRepository.findLeadById(id);
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    // Idempotency: if already converted, return existing customer
    if (lead.customer_id) {
      const existingCustomer = await crmRepository.findCustomerById(lead.customer_id);
      return {
        already_converted: true,
        lead,
        customer: existingCustomer
      };
    }

    return withTransaction(async (trx) => {
      // 1. Check if customer with this phone number already exists
      let customer = await crmRepository.findCustomerByPhone(lead.phone_e164, trx);

      if (!customer) {
        // Create new customer
        const customerCode = await crmRepository.getNextCustomerCode(trx);
        customer = await crmRepository.createCustomer({
          customer_code: customerCode,
          full_name: lead.full_name,
          phone_e164: lead.phone_e164,
          email: lead.email || null,
          customer_type: input.customer_type || 'RESIDENTIAL',
          gstin: input.gstin || null,
          created_by: actor.id
        }, trx);

        // If lead has address, create site address for customer
        if (lead.site_address || lead.city || lead.pincode) {
          await crmRepository.createCustomerAddress({
            customer_id: customer.id,
            address_type: 'SITE',
            address_line1: lead.site_address || 'Site Address',
            city: lead.city || 'Ahmedabad',
            state: lead.state || 'Gujarat',
            pincode: lead.pincode || '380001',
            is_primary: true
          }, trx);
        }
      }

      // 2. Link customer to lead
      const updateData = {
        customer_id: customer.id,
        converted_at: new Date()
      };

      // Progress stage to QUALIFIED if currently in NEW or CONTACTED
      if (['NEW', 'CONTACTED'].includes(lead.stage)) {
        updateData.stage = 'QUALIFIED';
      }

      const updatedLead = await crmRepository.updateLead(id, updateData, trx);

      // 3. Record conversion activity
      await crmRepository.createActivity({
        lead_id: id,
        actor_id: actor.id,
        activity_type: 'CONVERSION',
        details: {
          customer_id: customer.id,
          customer_code: customer.customer_code,
          converted_by: actor.fullName || actor.email,
          notes: input.notes || null
        }
      }, trx);

      return {
        already_converted: false,
        lead: updatedLead,
        customer
      };
    });
  },

  /**
   * Log an activity against a lead (Call, WhatsApp, Meeting, Note)
   */
  async addActivity(leadId, input, actor) {
    const lead = await crmRepository.findLeadById(leadId);
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    return crmRepository.createActivity({
      lead_id: leadId,
      actor_id: actor.id,
      activity_type: input.activity_type,
      details: input.details
    });
  },

  /**
   * Schedule a follow-up for a lead
   */
  async createFollowUp(leadId, input, actor) {
    if (new Date(input.scheduled_at).getTime() < Date.now() - 5 * 60 * 1000) {
      throw new AppError('Follow-up scheduled date and time cannot be in the past. Please select today or a future date.', 400, 'PAST_DATE_NOT_ALLOWED');
    }

    const lead = await crmRepository.findLeadById(leadId);
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    const assignedTo = input.assigned_to || lead.assigned_to || actor.id;

    return crmRepository.createFollowUp({
      lead_id: leadId,
      assigned_to: assignedTo,
      scheduled_at: input.scheduled_at,
      status: 'PENDING',
      notes: input.notes || null
    });
  },

  /**
   * Update follow-up status (e.g. mark COMPLETED)
   */
  async updateFollowUp(followUpId, input, actor) {
    const existing = await crmRepository.findFollowUpById(followUpId);
    if (!existing) {
      throw new AppError('Follow-up not found.', 404, 'FOLLOW_UP_NOT_FOUND');
    }

    return crmRepository.updateFollowUp(followUpId, input);
  },

  // ---------------------------------------------------------------------------
  // CUSTOMER SERVICES
  // ---------------------------------------------------------------------------

  async createCustomer(input, actor) {
    const existing = await crmRepository.findCustomerByPhone(input.phone_e164);
    if (existing) {
      throw new AppError(
        `A customer with phone number ${input.phone_e164} already exists (${existing.customer_code}).`,
        409,
        'CUSTOMER_PHONE_EXISTS'
      );
    }

    return withTransaction(async (trx) => {
      const customerCode = await crmRepository.getNextCustomerCode(trx);

      const customer = await crmRepository.createCustomer({
        customer_code: customerCode,
        full_name: input.full_name,
        phone_e164: input.phone_e164,
        email: input.email || null,
        customer_type: input.customer_type || 'RESIDENTIAL',
        gstin: input.gstin || null,
        created_by: actor.id
      }, trx);

      if (input.address) {
        await crmRepository.createCustomerAddress({
          customer_id: customer.id,
          address_type: input.address.address_type || 'SITE',
          address_line1: input.address.address_line1,
          address_line2: input.address.address_line2 || null,
          city: input.address.city,
          state: input.address.state || 'Gujarat',
          pincode: input.address.pincode,
          lat: input.address.lat || null,
          lng: input.address.lng || null,
          is_primary: input.address.is_primary !== undefined ? input.address.is_primary : true
        }, trx);
      }

      return customer;
    });
  },

  async getCustomer(id) {
    const customer = await crmRepository.findCustomerById(id);
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    const addresses = await crmRepository.listCustomerAddresses(id);

    return {
      ...customer,
      addresses
    };
  },

  async listCustomers(queryParams) {
    return crmRepository.listCustomers(queryParams);
  },

  async updateCustomer(id, input) {
    const customer = await crmRepository.findCustomerById(id);
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    return crmRepository.updateCustomer(id, input);
  },

  async addCustomerAddress(customerId, input) {
    const customer = await crmRepository.findCustomerById(customerId);
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    return crmRepository.createCustomerAddress({
      customer_id: customerId,
      ...input
    });
  },

  async getCustomerTimeline(id) {
    const customer = await crmRepository.findCustomerById(id);
    if (!customer) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    const timeline = await crmRepository.getCustomerTimeline(id);
    return {
      customer,
      ...timeline
    };
  }
};
