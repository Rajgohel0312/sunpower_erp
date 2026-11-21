import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/response.js';
import * as orderRepo from './order.repository.js';
import * as quotationRepo from '../quotations/quotation.repository.js';
import { crmRepository } from '../crm/crm.repository.js';

/**
 * Converts an accepted quotation into an operationally confirmed Sales Order
 * Creates an immutable commercial snapshot of pricing, items, and BOM.
 */
export async function convertQuotationToOrder(input, actor) {
  const quotation = await quotationRepo.getQuotationById(input.quotation_id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (!['ACCEPTED', 'SENT', 'APPROVED'].includes(quotation.status)) {
    throw new AppError(`Cannot convert quotation in status ${quotation.status} to a sales order`, 400, 'INVALID_STATUS');
  }

  // 1. Resolve or auto-create Customer
  let customerId = quotation.customer_id;
  if (!customerId && quotation.lead_id) {
    const lead = await prisma.leads.findUnique({ where: { id: quotation.lead_id } });
    if (lead?.customer_id) {
      customerId = lead.customer_id;
    } else if (lead) {
      // Auto-create customer record from lead data
      const customerCode = await crmRepository.getNextCustomerCode();
      const newCustomer = await prisma.customers.create({
        data: {
          customer_code: customerCode,
          full_name: lead.full_name,
          phone_e164: lead.phone_e164,
          email: lead.email || null,
          customer_type: 'RESIDENTIAL',
          created_by: actor?.id || null
        }
      });
      customerId = newCustomer.id;

      // Link customer to lead
      await prisma.leads.update({
        where: { id: lead.id },
        data: { customer_id: customerId }
      });
    }
  }

  if (!customerId) {
    throw new AppError('A valid customer record is required to confirm a sales order', 400, 'CUSTOMER_REQUIRED');
  }

  // 2. Compute payment status based on advance payment
  const advance = Number(input.advance_payment_received) || 0;
  const netPayable = Number(quotation.net_payable);
  let paymentStatus = 'PENDING';
  if (advance >= netPayable && netPayable > 0) {
    paymentStatus = 'FULLY_PAID';
  } else if (advance > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  // 3. Compile full immutable snapshot
  const customer = await prisma.customers.findUnique({ where: { id: customerId } });
  const snapshotData = {
    quotation_number: quotation.quotation_number,
    system_capacity_kw: Number(quotation.system_capacity_kw),
    customer: {
      id: customer.id,
      code: customer.customer_code,
      name: customer.full_name,
      phone: customer.phone_e164,
      email: customer.email,
      customer_type: customer.customer_type,
      gstin: customer.gstin
    },
    financials: {
      hardware_subtotal: Number(quotation.hardware_subtotal),
      installation_charges: Number(quotation.installation_charges),
      transport_charges: Number(quotation.transport_charges),
      subtotal: Number(quotation.subtotal),
      discount_amount: Number(quotation.discount_amount),
      taxable_amount: Number(quotation.taxable_amount),
      tax_goods_amount: Number(quotation.tax_goods_amount),
      tax_services_amount: Number(quotation.tax_services_amount),
      tax_total: Number(quotation.tax_total),
      grand_total: Number(quotation.grand_total),
      subsidy_amount: Number(quotation.subsidy_amount),
      net_payable: Number(quotation.net_payable)
    },
    payment_terms: quotation.payment_terms,
    commercial_terms: quotation.commercial_terms,
    items: quotation.quotation_items.map((i) => ({
      item_name: i.item_name,
      quantity: Number(i.quantity),
      unit_code: i.unit_code,
      unit_price: Number(i.unit_price),
      tax_rate_pct: Number(i.tax_rate_pct),
      total_price: Number(i.total_price),
      product_id: i.product_id,
      sku: i.products?.sku || null,
      brand: i.products?.brand || null
    })),
    converted_at: new Date().toISOString(),
    converted_by: actor?.full_name || actor?.email || 'System'
  };

  // 4. Generate Order Number SO-YYYY-XXXXX
  const orderNumber = await orderRepo.generateOrderNumber();

  // 5. Create Order & Update Quotation status to CONVERTED
  const order = await orderRepo.createOrderRecord({
    order_number: orderNumber,
    quotation_id: quotation.id,
    customer_id: customerId,
    lead_id: quotation.lead_id || null,
    survey_id: quotation.survey_id || null,
    bom_id: quotation.bom_id,
    system_capacity_kw: Number(quotation.system_capacity_kw),
    total_amount: Number(quotation.grand_total),
    subsidy_amount: Number(quotation.subsidy_amount),
    net_customer_payable: netPayable,
    advance_payment_received: advance,
    payment_status: paymentStatus,
    status: 'CONFIRMED',
    snapshot_data: snapshotData,
    confirmed_by: actor?.id || null,
    installation_target_date: input.installation_target_date || null,
    notes: input.notes || null
  });

  // 6. Advance Lead Stage to WON in CRM
  if (quotation.lead_id) {
    try {
      await prisma.leads.update({
        where: { id: quotation.lead_id },
        data: {
          stage: 'WON',
          updated_at: new Date()
        }
      });

      await crmRepository.createActivity({
        lead_id: quotation.lead_id,
        actor_id: actor?.id || null,
        activity_type: 'STAGE_CHANGE',
        details: `Sales Order ${orderNumber} confirmed (Gross: ₹${Number(quotation.grand_total).toLocaleString('en-IN')}, Net: ₹${netPayable.toLocaleString('en-IN')}). Lead officially WON.`
      });
    } catch (e) {
      console.warn('Could not update lead to WON:', e.message);
    }
  }

  return await orderRepo.getOrderById(order.id);
}

/**
 * Retrieves sales order by ID
 */
export async function getOrder(id, actor) {
  const order = await orderRepo.getOrderById(id);
  if (!order) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }
  return order;
}

/**
 * Lists sales orders with filters and pagination
 */
export async function listOrders(query, actor) {
  return await orderRepo.listOrders(query);
}

/**
 * Updates sales order execution status
 */
export async function updateOrderStatus(id, { status, notes }, actor) {
  const order = await orderRepo.getOrderById(id);
  if (!order) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  return await orderRepo.updateOrderStatus(id, status, notes);
}

/**
 * Records customer payment against sales order
 */
export async function recordOrderPayment(id, { amount, payment_method, reference_id, notes }, actor) {
  const order = await orderRepo.getOrderById(id);
  if (!order) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  const currentAdvance = Number(order.advance_payment_received || 0);
  const netPayable = Number(order.net_customer_payable || 0);
  const remainingDue = Number(Math.max(0, netPayable - currentAdvance).toFixed(2));

  // 1. Guard against recording payments when order is already fully settled (remaining balance = 0)
  if (order.payment_status === 'FULLY_PAID' || remainingDue <= 0) {
    throw new AppError(
      'Order is already fully paid. Outstanding balance is ₹0. No further payments can be recorded.',
      400,
      'ORDER_FULLY_PAID',
      { advanceReceived: currentAdvance, netCustomerPayable: netPayable }
    );
  }

  // 2. Validate amount is positive
  const paymentAmount = Number(Number(amount).toFixed(2));
  if (paymentAmount <= 0) {
    throw new AppError('Payment amount must be greater than zero.', 400, 'INVALID_PAYMENT_AMOUNT');
  }

  // 3. Guard against payment exceeding remaining outstanding balance
  if (paymentAmount > remainingDue) {
    throw new AppError(
      `Payment amount (₹${paymentAmount.toLocaleString('en-IN')}) cannot exceed the remaining outstanding balance of ₹${remainingDue.toLocaleString('en-IN')}.`,
      400,
      'EXCEEDS_OUTSTANDING_BALANCE',
      { remainingDue, attemptedAmount: paymentAmount }
    );
  }

  const newAdvance = Number((currentAdvance + paymentAmount).toFixed(2));
  const newPaymentStatus = newAdvance >= netPayable ? 'FULLY_PAID' : 'PARTIALLY_PAID';

  // 4. Capture payment in immutable snapshot recorded_payments ledger
  const currentSnapshot = typeof order.snapshot_data === 'object' && order.snapshot_data !== null
    ? { ...order.snapshot_data }
    : {};
  const recordedPayments = Array.isArray(currentSnapshot.recorded_payments)
    ? [...currentSnapshot.recorded_payments]
    : [];

  recordedPayments.push({
    amount: paymentAmount,
    payment_method: payment_method || 'NEFT',
    reference_id: reference_id || null,
    notes: notes || null,
    recorded_at: new Date().toISOString(),
    recorded_by: actor?.full_name || actor?.email || 'User'
  });
  currentSnapshot.recorded_payments = recordedPayments;

  await orderRepo.updateOrderPayment(id, newAdvance, newPaymentStatus, currentSnapshot);
  return await orderRepo.getOrderById(id);
}

export const recordPayment = recordOrderPayment;
