/**
 * CRM & Lead Management HTTP Controller
 * Encapsulates HTTP request handling, response envelope generation, and status codes.
 */

import { crmService } from './crm.service.js';
import { sendSuccess } from '../../utils/response.js';

export const crmController = {
  // Check Duplicate
  async checkDuplicates(req, res, next) {
    try {
      const result = await crmService.checkDuplicates(req.query.phone);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  // ---------------------------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------------------------

  async createLead(req, res, next) {
    try {
      const lead = await crmService.createLead(req.body, req.user);
      return sendSuccess(res, lead, { message: 'Lead created successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async listLeads(req, res, next) {
    try {
      const result = await crmService.listLeads(req.query);
      return sendSuccess(res, result.leads, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async getLead(req, res, next) {
    try {
      const lead = await crmService.getLead(req.params.id);
      return sendSuccess(res, lead);
    } catch (err) {
      next(err);
    }
  },

  async updateLead(req, res, next) {
    try {
      const updated = await crmService.updateLead(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, { message: 'Lead updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async assignLead(req, res, next) {
    try {
      const updated = await crmService.assignLead(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, { message: 'Lead assigned successfully' });
    } catch (err) {
      next(err);
    }
  },

  async convertLead(req, res, next) {
    try {
      const result = await crmService.convertLead(req.params.id, req.body, req.user);
      return sendSuccess(res, result, { message: 'Lead converted to customer successfully' });
    } catch (err) {
      next(err);
    }
  },

  async addActivity(req, res, next) {
    try {
      const activity = await crmService.addActivity(req.params.id, req.body, req.user);
      return sendSuccess(res, activity, { message: 'Activity logged successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async createFollowUp(req, res, next) {
    try {
      const followUp = await crmService.createFollowUp(req.params.id, req.body, req.user);
      return sendSuccess(res, followUp, { message: 'Follow-up scheduled successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async updateFollowUp(req, res, next) {
    try {
      const updated = await crmService.updateFollowUp(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, { message: 'Follow-up updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  // ---------------------------------------------------------------------------
  // CUSTOMERS
  // ---------------------------------------------------------------------------

  async createCustomer(req, res, next) {
    try {
      const customer = await crmService.createCustomer(req.body, req.user);
      return sendSuccess(res, customer, { message: 'Customer created successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async listCustomers(req, res, next) {
    try {
      const result = await crmService.listCustomers(req.query);
      return sendSuccess(res, result.customers, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async getCustomer(req, res, next) {
    try {
      const customer = await crmService.getCustomer(req.params.id);
      return sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  },

  async updateCustomer(req, res, next) {
    try {
      const updated = await crmService.updateCustomer(req.params.id, req.body);
      return sendSuccess(res, updated, { message: 'Customer updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async addCustomerAddress(req, res, next) {
    try {
      const address = await crmService.addCustomerAddress(req.params.id, req.body);
      return sendSuccess(res, address, { message: 'Address added successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getCustomerTimeline(req, res, next) {
    try {
      const timeline = await crmService.getCustomerTimeline(req.params.id);
      return sendSuccess(res, timeline);
    } catch (err) {
      next(err);
    }
  }
};
