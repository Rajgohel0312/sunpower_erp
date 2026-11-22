import { AppError } from '../../utils/response.js';
import { prisma, withTransaction } from '../../database/prisma.js';
import * as financeRepo from './finance.repository.js';

// Minor-unit helper to prevent JS floating-point issues (Paise conversion)
const toPaise = (amt) => Math.round(Number(amt || 0) * 100);
const fromPaise = (paise) => Number((paise / 100).toFixed(2));

/**
 * Creates Milestone Invoice for a Sales Order
 */
export async function createInvoice(data, actor) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: data.sales_order_id },
    include: {
      customers: true,
      quotations: true
    }
  });

  if (!salesOrder) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  const invoiceNumber = await financeRepo.generateInvoiceNumber();
  const milestonePct = Number(data.milestone_percentage || 20);
  const contractValue = Number(salesOrder.net_customer_payable || salesOrder.total_amount || 300000);

  let itemsData = [];
  let subtotal = 0;
  let taxableGoodsAmount = 0;
  let taxableServicesAmount = 0;
  let taxGoods = 0;
  let taxServices = 0;
  let grandTotal = 0;

  if (data.items && data.items.length > 0) {
    // Custom line items supplied
    for (const item of data.items) {
      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.unit_price || 0);
      const taxRate = Number(item.tax_rate_pct || 12);

      const lineTaxablePaise = Math.round(toPaise(unitPrice) * qty);
      const lineTaxPaise = Math.round(lineTaxablePaise * (taxRate / 100));
      const lineTotalPaise = lineTaxablePaise + lineTaxPaise;

      const taxable = fromPaise(lineTaxablePaise);
      const taxAmt = fromPaise(lineTaxPaise);
      const total = fromPaise(lineTotalPaise);

      subtotal += taxable;
      if (item.item_type === 'SERVICE' || item.item_type === 'CIVIL_WORKS') {
        taxableServicesAmount += taxable;
        taxServices += taxAmt;
      } else {
        taxableGoodsAmount += taxable;
        taxGoods += taxAmt;
      }

      itemsData.push({
        product_id: item.product_id || null,
        item_type: item.item_type || 'HARDWARE',
        description: item.description,
        hsn_sac_code: item.hsn_sac_code || '995465',
        quantity: qty,
        unit_code: item.unit_code || 'NOS',
        unit_price: unitPrice,
        taxable_amount: taxable,
        tax_rate_pct: taxRate,
        tax_amount: taxAmt,
        total_amount: total
      });
    }

    grandTotal = fromPaise(toPaise(subtotal) + toPaise(taxGoods) + toPaise(taxServices));
  } else {
    // Milestone-based 70:30 Statutory Solar EPC Rule
    const milestoneBasePaise = Math.round((toPaise(contractValue) * milestonePct) / 100);
    const milestoneBase = fromPaise(milestoneBasePaise);

    // 70% Goods @ 12% GST
    const goodsTaxablePaise = Math.round(milestoneBasePaise * 0.70);
    const goodsTaxPaise = Math.round(goodsTaxablePaise * 0.12);
    const goodsTotalPaise = goodsTaxablePaise + goodsTaxPaise;

    // 30% Services @ 18% GST
    const servicesTaxablePaise = milestoneBasePaise - goodsTaxablePaise;
    const servicesTaxPaise = Math.round(servicesTaxablePaise * 0.18);
    const servicesTotalPaise = servicesTaxablePaise + servicesTaxPaise;

    taxableGoodsAmount = fromPaise(goodsTaxablePaise);
    taxGoods = fromPaise(goodsTaxPaise);
    taxableServicesAmount = fromPaise(servicesTaxablePaise);
    taxServices = fromPaise(servicesTaxPaise);

    subtotal = milestoneBase;
    grandTotal = fromPaise(goodsTotalPaise + servicesTotalPaise);

    const milestoneLabelMap = {
      ADVANCE: 'Advance Booking & Engineering Milestone',
      DELIVERY: 'Material Delivery & Hardware Dispatch Milestone',
      INSTALLATION_COMPLETE: 'Installation & Technical Completion Milestone',
      NET_METERING: 'Grid Sync & Net Metering Milestone',
      FINAL_SETTLEMENT: 'Final Project Settlement Milestone',
      AD_HOC: 'Ad-hoc Progress Billing'
    };
    const milestoneLabel = milestoneLabelMap[data.milestone_type] || 'Solar EPC Milestone';

    itemsData = [
      {
        item_type: 'HARDWARE',
        description: `${milestoneLabel} - Solar PV Equipment & Hardware Component (70%)`,
        hsn_sac_code: '995465',
        quantity: 1,
        unit_code: 'SET',
        unit_price: taxableGoodsAmount,
        taxable_amount: taxableGoodsAmount,
        tax_rate_pct: 12.00,
        tax_amount: taxGoods,
        total_amount: fromPaise(goodsTotalPaise)
      },
      {
        item_type: 'SERVICE',
        description: `${milestoneLabel} - Turnkey Erection, Civil & Commissioning Services (30%)`,
        hsn_sac_code: '995465',
        quantity: 1,
        unit_code: 'JOB',
        unit_price: taxableServicesAmount,
        taxable_amount: taxableServicesAmount,
        tax_rate_pct: 18.00,
        tax_amount: taxServices,
        total_amount: fromPaise(servicesTotalPaise)
      }
    ];
  }

  const taxTotal = fromPaise(toPaise(taxGoods) + toPaise(taxServices));

  // Snapshot of order and pricing
  const snapshotData = {
    sales_order_number: salesOrder.order_number,
    total_contract_value: contractValue,
    customer_name: salesOrder.customers.full_name,
    customer_phone: salesOrder.customers.phone_e164,
    customer_gstin: salesOrder.customers.gstin,
    milestone_type: data.milestone_type,
    milestone_percentage: milestonePct,
    items: itemsData
  };

  const invoiceData = {
    invoice_number: invoiceNumber,
    sales_order_id: data.sales_order_id,
    customer_id: salesOrder.customer_id,
    milestone_type: data.milestone_type,
    milestone_percentage: milestonePct,
    invoice_date: new Date(),
    due_date: new Date(data.due_date),
    subtotal: subtotal,
    taxable_amount: subtotal,
    tax_goods_amount: taxGoods,
    tax_services_amount: taxServices,
    tax_total: taxTotal,
    grand_total: grandTotal,
    amount_paid: 0.00,
    amount_due: grandTotal,
    status: 'ISSUED',
    hsn_sac_code: '995465',
    snapshot_data: snapshotData,
    notes: data.notes || null,
    created_by: actor?.id || null
  };

  return await financeRepo.createInvoiceRecord(invoiceData, itemsData);
}

/**
 * Lists Invoices with filters and pagination
 */
export async function listInvoices(query) {
  return await financeRepo.listInvoices(query);
}

/**
 * Gets Invoice by ID
 */
export async function getInvoice(id) {
  const invoice = await financeRepo.getInvoiceById(id);
  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  }
  return invoice;
}

/**
 * Records a Customer Payment
 */
export async function recordPayment(data, actor) {
  // Idempotency check
  if (data.idempotency_key) {
    const existing = await financeRepo.findPaymentByIdempotencyKey(data.idempotency_key);
    if (existing) {
      return existing;
    }
  }

  const paymentNumber = await financeRepo.generatePaymentNumber();
  const paymentAmount = Number(data.amount);

  // Normalize payment mode to allowed enum
  const modeMap = {
    NEFT_RTGS: 'NEFT',
    CREDIT_CARD: 'BANK_TRANSFER'
  };
  const normalizedMode = modeMap[data.payment_mode] || data.payment_mode || 'NEFT';

  return await withTransaction(async (tx) => {
    const payment = await tx.payments.create({
      data: {
        payment_number: paymentNumber,
        customer_id: data.customer_id,
        sales_order_id: data.sales_order_id || null,
        amount: paymentAmount,
        unallocated_amount: paymentAmount,
        payment_mode: normalizedMode,
        transaction_reference: data.transaction_reference,
        payment_date: data.payment_date ? new Date(data.payment_date) : new Date(),
        status: 'VERIFIED',
        verified_by: actor?.id || null,
        verified_at: new Date(),
        idempotency_key: data.idempotency_key || null,
        notes: data.notes || null,
        created_by: actor?.id || null
      },
      include: {
        customers: true,
        sales_orders: true
      }
    });

    // Auto-allocate if invoice specified
    if (data.auto_allocate_invoice_id) {
      const invoice = await tx.invoices.findUnique({
        where: { id: data.auto_allocate_invoice_id }
      });

      if (invoice && invoice.status !== 'PAID' && Number(invoice.amount_due) > 0) {
        const invDue = Number(invoice.amount_due);
        const allocAmt = Math.min(paymentAmount, invDue);

        if (allocAmt > 0) {
          await tx.payment_allocations.create({
            data: {
              payment_id: payment.id,
              invoice_id: invoice.id,
              allocated_amount: allocAmt,
              allocated_by: actor?.id || null
            }
          });

          const newUnallocated = fromPaise(toPaise(paymentAmount) - toPaise(allocAmt));
          await tx.payments.update({
            where: { id: payment.id },
            data: { unallocated_amount: newUnallocated }
          });

          const newPaid = fromPaise(toPaise(invoice.amount_paid) + toPaise(allocAmt));
          const newDue = fromPaise(toPaise(invoice.amount_due) - toPaise(allocAmt));
          const newStatus = newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx.invoices.update({
            where: { id: invoice.id },
            data: {
              amount_paid: newPaid,
              amount_due: newDue,
              status: newStatus
            }
          });

          // Sync sales order payment status
          if (invoice.sales_order_id) {
            await syncSalesOrderPaymentStatus(invoice.sales_order_id, tx);
          }
        }
      }
    }

    return payment;
  });
}

/**
 * Lists Payments with filters
 */
export async function listPayments(query) {
  return await financeRepo.listPayments(query);
}

/**
 * Gets Payment by ID
 */
export async function getPayment(id) {
  const payment = await financeRepo.getPaymentById(id);
  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }
  return payment;
}

/**
 * Allocates Payment to an Invoice with Pessimistic Checks
 */
export async function allocatePayment(data, actor) {
  const { payment_id, invoice_id, amount } = data;
  const allocAmount = Number(amount);

  return await withTransaction(async (tx) => {
    const payment = await tx.payments.findUnique({
      where: { id: payment_id }
    });
    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    const invoice = await tx.invoices.findUnique({
      where: { id: invoice_id }
    });
    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    const unallocated = Number(payment.unallocated_amount);
    const amountDue = Number(invoice.amount_due);

    if (allocAmount > unallocated) {
      throw new AppError(
        `Allocation amount (₹${allocAmount.toFixed(2)}) exceeds available unallocated payment (₹${unallocated.toFixed(2)})`,
        400,
        'EXCEEDS_UNALLOCATED_AMOUNT'
      );
    }

    if (allocAmount > amountDue) {
      throw new AppError(
        `Allocation amount (₹${allocAmount.toFixed(2)}) exceeds invoice amount due (₹${amountDue.toFixed(2)})`,
        400,
        'EXCEEDS_AMOUNT_DUE'
      );
    }

    const allocation = await tx.payment_allocations.create({
      data: {
        payment_id: payment.id,
        invoice_id: invoice.id,
        allocated_amount: allocAmount,
        allocated_by: actor?.id || null
      }
    });

    const newUnallocated = fromPaise(toPaise(unallocated) - toPaise(allocAmount));
    await tx.payments.update({
      where: { id: payment.id },
      data: { unallocated_amount: newUnallocated }
    });

    const newPaid = fromPaise(toPaise(invoice.amount_paid) + toPaise(allocAmount));
    const newDue = fromPaise(toPaise(invoice.amount_due) - toPaise(allocAmount));
    const newStatus = newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await tx.invoices.update({
      where: { id: invoice.id },
      data: {
        amount_paid: newPaid,
        amount_due: newDue,
        status: newStatus
      }
    });

    if (invoice.sales_order_id) {
      await syncSalesOrderPaymentStatus(invoice.sales_order_id, tx);
    }

    return allocation;
  });
}

/**
 * Internal Helper: Syncs Sales Order payment status from invoices/allocations
 */
async function syncSalesOrderPaymentStatus(salesOrderId, tx = prisma) {
  const order = await tx.sales_orders.findUnique({
    where: { id: salesOrderId },
    select: { id: true, net_customer_payable: true, total_amount: true }
  });
  if (!order) return;

  const totalContract = Number(order.net_customer_payable || order.total_amount || 0);

  const invoices = await tx.invoices.findMany({
    where: { sales_order_id: salesOrderId, deleted_at: null },
    select: { amount_paid: true, grand_total: true }
  });

  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);

  let newPaymentStatus = 'PENDING';
  if (totalPaid >= totalContract && totalContract > 0) {
    newPaymentStatus = 'FULLY_PAID';
  } else if (totalPaid > 0) {
    newPaymentStatus = 'PARTIALLY_PAID';
  }

  await tx.sales_orders.update({
    where: { id: salesOrderId },
    data: { payment_status: newPaymentStatus }
  });
}

/**
 * Creates Direct Project Expense
 */
export async function createExpense(data, actor) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: data.sales_order_id }
  });
  if (!salesOrder) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  // Normalize category to allowed DB check constraint
  const catMap = {
    LABOUR: 'LABOR',
    SUBCONTRACTOR: 'MISCELLANEOUS',
    TRANSPORT: 'TRANSPORT',
    BOS_CONSUMABLES: 'ELECTRICAL_CONSUMABLES',
    LIAISONING: 'LIASONING',
    CRANE_EQUIPMENT: 'CRANE_RENTAL',
    OTHER: 'MISCELLANEOUS'
  };
  const normalizedCategory = catMap[data.category] || data.category || 'LABOR';

  const expenseNumber = await financeRepo.generateExpenseNumber();

  return await financeRepo.createExpenseRecord({
    expense_number: expenseNumber,
    sales_order_id: data.sales_order_id,
    category: normalizedCategory,
    vendor_name: data.vendor_name,
    amount: Number(data.amount),
    expense_date: data.expense_date ? new Date(data.expense_date) : new Date(),
    receipt_url: data.receipt_url || null,
    status: 'APPROVED',
    recorded_by: actor?.id || null,
    approved_by: actor?.id || null,
    notes: data.notes || null
  });
}

/**
 * Lists Expenses
 */
export async function listExpenses(query) {
  return await financeRepo.listExpenses(query);
}

/**
 * Approves an Expense
 */
export async function approveExpense(id, actor) {
  return await financeRepo.updateExpenseStatus(id, 'APPROVED', actor?.id || null);
}

/**
 * Project Profitability / P&L Gross Margin Engine
 */
export async function getProjectProfitability(salesOrderId) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: salesOrderId },
    include: {
      customers: true,
      quotations: true,
      dispatches: {
        include: {
          dispatch_items: true
        }
      },
      invoices: {
        where: { deleted_at: null },
        include: {
          invoice_items: true
        }
      },
      project_expenses: {
        where: { status: 'APPROVED' }
      }
    }
  });

  if (!salesOrder) {
    throw new AppError('Sales order not found', 404, 'ORDER_NOT_FOUND');
  }

  const contractValue = Number(salesOrder.net_customer_payable || salesOrder.total_amount || 0);

  // 1. Invoiced Revenue & Cash Collected
  let invoicedRevenue = 0;
  let cashCollected = 0;
  let receivables = 0;

  for (const inv of salesOrder.invoices) {
    invoicedRevenue += Number(inv.grand_total);
    cashCollected += Number(inv.amount_paid);
    receivables += Number(inv.amount_due);
  }

  // 2. Hardware Direct Cost
  let hardwareCost = 0;
  let isCostDataComplete = true;

  if (salesOrder.snapshot_data && salesOrder.snapshot_data.items && Array.isArray(salesOrder.snapshot_data.items)) {
    for (const item of salesOrder.snapshot_data.items) {
      const unitPrice = Number(item.unit_price || 0);
      const qty = Number(item.quantity || 1);
      const costEst = item.cost_price ? Number(item.cost_price) * qty : unitPrice * 0.70 * qty;
      hardwareCost += costEst;
    }
  } else {
    hardwareCost = contractValue * 0.65;
    isCostDataComplete = false;
  }

  // 3. Direct Project Site Expenses Breakdown
  let directExpensesTotal = 0;
  const expenseBreakdown = {
    LABOR: 0,
    TRANSPORT: 0,
    CRANE_RENTAL: 0,
    LIASONING: 0,
    ELECTRICAL_CONSUMABLES: 0,
    CIVIL_MATERIALS: 0,
    MISCELLANEOUS: 0
  };

  for (const exp of salesOrder.project_expenses) {
    const amt = Number(exp.amount);
    directExpensesTotal += amt;
    if (expenseBreakdown[exp.category] !== undefined) {
      expenseBreakdown[exp.category] += amt;
    } else {
      expenseBreakdown.MISCELLANEOUS += amt;
    }
  }

  // 4. Gross Margin Calculations
  const totalDirectCost = fromPaise(toPaise(hardwareCost) + toPaise(directExpensesTotal));
  const recognizedRevenue = invoicedRevenue > 0 ? invoicedRevenue : contractValue;
  const grossMargin = fromPaise(toPaise(recognizedRevenue) - toPaise(totalDirectCost));
  const grossMarginPct = recognizedRevenue > 0 ? Number(((grossMargin / recognizedRevenue) * 100).toFixed(2)) : 0;

  let healthStatus = 'HEALTHY';
  if (grossMarginPct < 0) {
    healthStatus = 'LOSS';
  } else if (grossMarginPct < 15) {
    healthStatus = 'THIN';
  } else if (grossMarginPct < 25) {
    healthStatus = 'MODERATE';
  }

  return {
    sales_order_id: salesOrder.id,
    order_number: salesOrder.order_number,
    customer_name: salesOrder.customers.full_name,
    contract_value: contractValue,
    invoiced_revenue: fromPaise(toPaise(invoicedRevenue)),
    cash_collected: fromPaise(toPaise(cashCollected)),
    outstanding_receivables: fromPaise(toPaise(receivables)),
    hardware_cost: fromPaise(toPaise(hardwareCost)),
    direct_expenses_total: fromPaise(toPaise(directExpensesTotal)),
    expense_breakdown: expenseBreakdown,
    total_direct_cost: totalDirectCost,
    gross_margin: grossMargin,
    gross_margin_pct: grossMarginPct,
    health_status: healthStatus,
    is_cost_data_complete: isCostDataComplete,
    invoices_count: salesOrder.invoices.length,
    expenses_count: salesOrder.project_expenses.length
  };
}

/**
 * Accounts Receivable Aging Analysis
 */
export async function getAccountsReceivableAging() {
  return await financeRepo.getAccountsReceivableSummary();
}
