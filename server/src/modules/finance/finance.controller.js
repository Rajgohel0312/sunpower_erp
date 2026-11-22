import { sendSuccess } from '../../utils/response.js';
import * as financeService from './finance.service.js';

export async function listInvoices(req, res, next) {
  try {
    const result = await financeService.listInvoices(req.query);
    return sendSuccess(res, result.invoices, {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req, res, next) {
  try {
    const invoice = await financeService.getInvoice(req.params.id);
    return sendSuccess(res, invoice);
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req, res, next) {
  try {
    const invoice = await financeService.createInvoice(req.body, req.user);
    return sendSuccess(res, invoice, { message: 'Milestone invoice generated successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function listPayments(req, res, next) {
  try {
    const result = await financeService.listPayments(req.query);
    return sendSuccess(res, result.payments, {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getPayment(req, res, next) {
  try {
    const payment = await financeService.getPayment(req.params.id);
    return sendSuccess(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function recordPayment(req, res, next) {
  try {
    const payment = await financeService.recordPayment(req.body, req.user);
    return sendSuccess(res, payment, { message: 'Customer payment verified & recorded successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function allocatePayment(req, res, next) {
  try {
    const allocation = await financeService.allocatePayment(
      {
        payment_id: req.params.id || req.body.payment_id,
        invoice_id: req.body.invoice_id,
        amount: req.body.amount
      },
      req.user
    );
    return sendSuccess(res, allocation, { message: 'Payment allocated to invoice successfully' }, 200);
  } catch (err) {
    next(err);
  }
}

export async function listExpenses(req, res, next) {
  try {
    const result = await financeService.listExpenses(req.query);
    return sendSuccess(res, result.expenses, {
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req, res, next) {
  try {
    const expense = await financeService.createExpense(req.body, req.user);
    return sendSuccess(res, expense, { message: 'Direct project expense recorded successfully' }, 201);
  } catch (err) {
    next(err);
  }
}

export async function approveExpense(req, res, next) {
  try {
    const expense = await financeService.approveExpense(req.params.id, req.user);
    return sendSuccess(res, expense, { message: 'Project expense approved' }, 200);
  } catch (err) {
    next(err);
  }
}

export async function getProjectProfitability(req, res, next) {
  try {
    const pnl = await financeService.getProjectProfitability(req.params.orderId);
    return sendSuccess(res, pnl);
  } catch (err) {
    next(err);
  }
}

export async function getAccountsReceivableAging(req, res, next) {
  try {
    const aging = await financeService.getAccountsReceivableAging();
    return sendSuccess(res, aging);
  } catch (err) {
    next(err);
  }
}
