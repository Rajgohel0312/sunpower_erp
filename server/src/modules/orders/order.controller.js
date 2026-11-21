import { sendSuccess } from '../../utils/response.js';
import * as orderService from './order.service.js';

export const orderController = {
  async convertQuotation(req, res, next) {
    try {
      const order = await orderService.convertQuotationToOrder(req.body, req.user);
      return sendSuccess(res, order, { message: 'Quotation successfully converted to confirmed Sales Order' }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getOrder(req, res, next) {
    try {
      const order = await orderService.getOrder(req.params.id, req.user);
      return sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  },

  async listOrders(req, res, next) {
    try {
      const result = await orderService.listOrders(req.query, req.user);
      return sendSuccess(res, result.data, { pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const order = await orderService.updateOrderStatus(req.params.id, req.body, req.user);
      return sendSuccess(res, order, { message: `Order status updated to ${req.body.status}` });
    } catch (err) {
      next(err);
    }
  },

  async recordPayment(req, res, next) {
    try {
      const order = await orderService.recordOrderPayment(req.params.id, req.body, req.user);
      return sendSuccess(res, order, { message: 'Customer payment recorded successfully' });
    } catch (err) {
      next(err);
    }
  }
};
