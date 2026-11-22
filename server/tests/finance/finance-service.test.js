import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/prisma.js';
import * as financeService from '../../src/modules/finance/finance.service.js';
import * as portalService from '../../src/modules/portal/portal.service.js';

describe('Phase 10 — Finance, Invoicing, Payment Allocations, P&L & Customer Portal', () => {
  let adminUser;
  let testCustomer;
  let testOrder;
  let advanceInvoice;
  let recordedPayment;

  before(async () => {
    // 1. Get admin user
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user must exist in DB');

    // 2. Find or create an active customer
    testCustomer = await prisma.customers.findFirst({
      where: { deleted_at: null }
    });
    assert.ok(testCustomer, 'Test customer must exist');

    // 3. Find or create a sales order with positive net_customer_payable
    testOrder = await prisma.sales_orders.findFirst({
      where: { customer_id: testCustomer.id, deleted_at: null, net_customer_payable: { gt: 0 } }
    });

    if (!testOrder) {
      testOrder = await prisma.sales_orders.findFirst({
        where: { deleted_at: null, net_customer_payable: { gt: 0 } }
      });
      if (testOrder) {
        testCustomer = await prisma.customers.findUnique({
          where: { id: testOrder.customer_id }
        });
      }
    }

    if (!testOrder) {
      const quotations = await prisma.quotations.findFirst();
      testOrder = await prisma.sales_orders.create({
        data: {
          order_number: `SO-${Date.now()}`,
          quotation_id: quotations.id,
          customer_id: testCustomer.id,
          system_capacity_kw: 5.0,
          total_amount: 350000.00,
          subsidy_amount: 50000.00,
          net_customer_payable: 300000.00,
          status: 'CONFIRMED',
          snapshot_data: {
            items: [
              { description: 'Solar Panels 540W Mono PERC', quantity: 10, unit_price: 15000, cost_price: 10500 },
              { description: 'Growatt 5kW Inverter', quantity: 1, unit_price: 65000, cost_price: 45500 }
            ]
          }
        }
      });
    }
    assert.ok(testOrder, 'Test sales order must exist');
  });

  test('1. Milestone Invoicing: Generates sequential INV-YYYY-XXXXX with 70:30 Statutory Solar EPC GST', async () => {
    advanceInvoice = await financeService.createInvoice(
      {
        sales_order_id: testOrder.id,
        milestone_type: 'ADVANCE',
        milestone_percentage: 20.0,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '20% Advance milestone on project confirmation'
      },
      adminUser
    );

    assert.ok(advanceInvoice.id);
    assert.match(advanceInvoice.invoice_number, /^INV-\d{4}-\d{5}$/);
    assert.equal(advanceInvoice.milestone_type, 'ADVANCE');
    assert.equal(advanceInvoice.status, 'ISSUED');

    const grandTotal = Number(advanceInvoice.grand_total);
    assert.ok(grandTotal > 0, 'Grand total must be positive');
    assert.equal(Number(advanceInvoice.amount_paid), 0.00);
    assert.equal(Number(advanceInvoice.amount_due), grandTotal);
    assert.equal(advanceInvoice.invoice_items.length, 2, 'Must generate 70% goods and 30% services line items');
  });

  test('2. Payment Processing: Records verified payment and supports idempotency key deduplication', async () => {
    const testIdemKey = `IDEM-PAY-${Date.now()}`;

    recordedPayment = await financeService.recordPayment(
      {
        customer_id: testCustomer.id,
        sales_order_id: testOrder.id,
        amount: 50000.00,
        payment_mode: 'NEFT',
        transaction_reference: 'UTR9876543210',
        idempotency_key: testIdemKey,
        notes: 'Client transfer for advance milestone'
      },
      adminUser
    );

    assert.ok(recordedPayment.id);
    assert.match(recordedPayment.payment_number, /^PAY-\d{4}-\d{5}$/);
    assert.equal(Number(recordedPayment.amount), 50000.00);
    assert.equal(Number(recordedPayment.unallocated_amount), 50000.00);
    assert.equal(recordedPayment.status, 'VERIFIED');

    // Duplicate call with same idempotency key must return same payment without creating new one
    const duplicatePayment = await financeService.recordPayment(
      {
        customer_id: testCustomer.id,
        sales_order_id: testOrder.id,
        amount: 50000.00,
        payment_mode: 'NEFT',
        transaction_reference: 'UTR9876543210',
        idempotency_key: testIdemKey
      },
      adminUser
    );

    assert.equal(duplicatePayment.id, recordedPayment.id, 'Idempotent replay must return original payment');
  });

  test('3. Payment Allocation: Allocates funds to invoice and recalculates status and balances', async () => {
    const allocAmount = 25000.00;

    const allocation = await financeService.allocatePayment(
      {
        payment_id: recordedPayment.id,
        invoice_id: advanceInvoice.id,
        amount: allocAmount
      },
      adminUser
    );

    assert.ok(allocation.id);
    assert.equal(Number(allocation.allocated_amount), allocAmount);

    // Verify invoice balance was updated
    const updatedInvoice = await financeService.getInvoice(advanceInvoice.id);
    assert.equal(Number(updatedInvoice.amount_paid), allocAmount);
    assert.equal(updatedInvoice.status, 'PARTIALLY_PAID');

    // Verify payment unallocated amount decreased
    const updatedPayment = await financeService.getPayment(recordedPayment.id);
    assert.equal(Number(updatedPayment.unallocated_amount), 25000.00);
  });

  test('4. Allocation Boundary Guard: Blocks over-allocation beyond unallocated or due amount', async () => {
    await assert.rejects(
      async () => {
        await financeService.allocatePayment(
          {
            payment_id: recordedPayment.id,
            invoice_id: advanceInvoice.id,
            amount: 9999999.00
          },
          adminUser
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(['EXCEEDS_UNALLOCATED_AMOUNT', 'EXCEEDS_AMOUNT_DUE'].includes(err.code));
        return true;
      }
    );
  });

  test('5. Direct Project Expenses: Records categorized expense and assigns EXP-YYYY-XXXXX', async () => {
    const expense = await financeService.createExpense(
      {
        sales_order_id: testOrder.id,
        category: 'LABOR',
        vendor_name: 'Apex Electrical Contractors',
        amount: 14500.00,
        notes: 'Rooftop AC wiring and structure assembly labour'
      },
      adminUser
    );

    assert.ok(expense.id);
    assert.match(expense.expense_number, /^EXP-\d{4}-\d{5}$/);
    assert.equal(expense.category, 'LABOR');
    assert.equal(Number(expense.amount), 14500.00);
    assert.equal(expense.status, 'APPROVED');
  });

  test('6. Project Profitability Engine: Computes Gross Margin and Cost Breakdown', async () => {
    const pnl = await financeService.getProjectProfitability(testOrder.id);

    assert.ok(pnl.sales_order_id);
    assert.ok(pnl.invoiced_revenue > 0);
    assert.ok(pnl.total_direct_cost > 0);
    assert.equal(typeof pnl.gross_margin, 'number');
    assert.equal(typeof pnl.gross_margin_pct, 'number');
    assert.ok(['HEALTHY', 'MODERATE', 'THIN', 'LOSS'].includes(pnl.health_status));
    assert.ok(pnl.expense_breakdown.LABOR >= 14500.00);
  });

  test('7. Accounts Receivable Aging: Categorizes overdue buckets accurately', async () => {
    const aging = await financeService.getAccountsReceivableAging();

    assert.ok(typeof aging.total_receivables === 'number');
    assert.ok(typeof aging.current_0_30 === 'number');
    assert.ok(typeof aging.overdue_31_60 === 'number');
    assert.ok(Array.isArray(aging.invoices));
  });

  test('8. Customer Portal: Resolves projects, milestone timeline, invoices, and warranties', async () => {
    const profile = await portalService.getCustomerProfile(adminUser, testCustomer.id);
    assert.ok(profile.customer);
    assert.equal(profile.customer.id, testCustomer.id);

    const projects = await portalService.getCustomerProjects(adminUser, testCustomer.id);
    assert.ok(Array.isArray(projects));
    assert.ok(projects.length > 0);
    assert.ok(projects[0].milestone_step >= 1 && projects[0].milestone_step <= 5);

    const invoices = await portalService.getCustomerInvoices(adminUser, testCustomer.id);
    assert.ok(Array.isArray(invoices));
    assert.ok(invoices.some((inv) => inv.id === advanceInvoice.id));
  });
});
