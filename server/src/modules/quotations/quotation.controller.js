import { sendSuccess } from '../../utils/response.js';
import * as quotationService from './quotation.service.js';

export const quotationController = {
  async createQuotation(req, res, next) {
    try {
      const quotation = await quotationService.createQuotation(req.body, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation generated successfully' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getQuotation(req, res, next) {
    try {
      const quotation = await quotationService.getQuotation(req.params.id, req.user);
      return sendSuccess(res, quotation);
    } catch (err) {
      next(err);
    }
  },

  async listQuotations(req, res, next) {
    try {
      const result = await quotationService.listQuotations(req.query, req.user);
      return sendSuccess(res, result.data, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async updateQuotation(req, res, next) {
    try {
      const quotation = await quotationService.updateQuotation(req.params.id, req.body, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async submitForApproval(req, res, next) {
    try {
      const quotation = await quotationService.submitForApproval(req.params.id, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation submitted for manager approval' });
    } catch (err) {
      next(err);
    }
  },

  async reviewQuotation(req, res, next) {
    try {
      const quotation = await quotationService.reviewQuotation(req.params.id, req.body, req.user);
      return sendSuccess(res, quotation, { message: `Quotation ${req.body.decision.toLowerCase()}d successfully` });
    } catch (err) {
      next(err);
    }
  },

  async sendQuotation(req, res, next) {
    try {
      const quotation = await quotationService.sendQuotation(req.params.id, req.body, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation dispatched and snapshot captured' });
    } catch (err) {
      next(err);
    }
  },

  async acceptQuotation(req, res, next) {
    try {
      const quotation = await quotationService.acceptQuotation(req.params.id, req.body, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation accepted by customer' });
    } catch (err) {
      next(err);
    }
  },

  async rejectQuotation(req, res, next) {
    try {
      const quotation = await quotationService.rejectQuotation(req.params.id, req.body, req.user);
      return sendSuccess(res, quotation, { message: 'Quotation marked as rejected' });
    } catch (err) {
      next(err);
    }
  }
};
