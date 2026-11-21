/**
 * Phase 5 — Quotation Engine, Indian Solar Tax, PM Surya Ghar Subsidy & Sales Orders Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/index.js';
import {
  calculatePmSuryaGharSubsidy,
  calculateSolarGstSplit,
  generateDefaultPaymentMilestones,
  calculateQuotationPricing
} from '../../src/modules/quotations/quotation.pricing.js';
import {
  createQuotationSchema,
  reviewQuotationSchema,
  rejectQuotationSchema
} from '../../src/modules/quotations/quotation.validation.js';
import * as quotationService from '../../src/modules/quotations/quotation.service.js';
import * as orderService from '../../src/modules/orders/order.service.js';

describe('Phase 5 — Indian Solar Tax & PM Surya Ghar Subsidy Engine', () => {
  it('accurately calculates PM Surya Ghar Central Subsidy based on capacity and customer type', () => {
    // Residential Tier 1: 1 kW -> ₹30,000
    assert.equal(calculatePmSuryaGharSubsidy(1.0, 'RESIDENTIAL'), 30000.00);

    // Residential Tier 2: 2 kW -> ₹60,000
    assert.equal(calculatePmSuryaGharSubsidy(2.0, 'RESIDENTIAL'), 60000.00);

    // Residential Tier 3+: 3 kW capped at ₹78,000
    assert.equal(calculatePmSuryaGharSubsidy(3.0, 'RESIDENTIAL'), 78000.00);
    assert.equal(calculatePmSuryaGharSubsidy(5.4, 'RESIDENTIAL'), 78000.00);
    assert.equal(calculatePmSuryaGharSubsidy(10.0, 'RESIDENTIAL'), 78000.00);

    // Commercial / Industrial: Not eligible for central residential subsidy
    assert.equal(calculatePmSuryaGharSubsidy(5.0, 'COMMERCIAL'), 0.00);
    assert.equal(calculatePmSuryaGharSubsidy(10.0, 'INDUSTRIAL'), 0.00);
  });

  it('accurately calculates Indian Solar 70:30 GST split (12% goods + 18% services = 13.8% composite)', () => {
    const taxable = 200000.00;
    const split = calculateSolarGstSplit(taxable);

    // 70% Goods = ₹1,40,000 @ 12% = ₹16,800
    assert.equal(split.taxableGoodsAmount, 140000.00);
    assert.equal(split.taxGoodsAmount, 16800.00);

    // 30% Services = ₹60,000 @ 18% = ₹10,800
    assert.equal(split.taxableServicesAmount, 60000.00);
    assert.equal(split.taxServicesAmount, 10800.00);

    // Total tax = ₹27,600 (exact 13.80% of ₹2,00,000)
    assert.equal(split.taxTotal, 27600.00);
    assert.equal(split.effectiveRatePct, 13.80);
  });

  it('generates exact 4-milestone payment schedule totaling 100% of proposal amount', () => {
    const total = 227600.00;
    const milestones = generateDefaultPaymentMilestones(total);

    assert.equal(milestones.length, 4);
    assert.equal(milestones[0].milestone, 'BOOKING');
    assert.equal(milestones[0].percentage, 10);
    assert.equal(milestones[1].milestone, 'MATERIAL_DISPATCH');
    assert.equal(milestones[1].percentage, 70);
    assert.equal(milestones[2].milestone, 'INSTALLATION_COMPLETE');
    assert.equal(milestones[2].percentage, 15);
    assert.equal(milestones[3].milestone, 'NET_METERING');
    assert.equal(milestones[3].percentage, 5);

    const sumMilestones = milestones.reduce((sum, m) => sum + m.amount, 0);
    assert.equal(Math.round(sumMilestones), total);
  });

  it('calculateQuotationPricing computes hardware, installation, transport, tax, and net payable correctly', () => {
    const pricing = calculateQuotationPricing({
      systemCapacityKw: 5.0,
      items: [
        { item_name: 'PV Panels 540W', quantity: 10, unit_price: 11500, tax_rate_pct: 12 },
        { item_name: 'Inverter 5kW', quantity: 1, unit_price: 45000, tax_rate_pct: 12 }
      ],
      installationCharges: 12500, // ₹2,500/kW * 5kW
      transportCharges: 2500,
      discountAmount: 5000,
      customerType: 'RESIDENTIAL'
    });

    // Hardware = (10 * 11500) + 45000 = 1,60,000
    assert.equal(pricing.hardware_subtotal, 160000.00);
    assert.equal(pricing.installation_charges, 12500.00);
    assert.equal(pricing.transport_charges, 2500.00);

    // Subtotal = 1,60,000 + 12,500 + 2,500 = 1,75,000
    assert.equal(pricing.subtotal, 175000.00);
    assert.equal(pricing.discount_amount, 5000.00);

    // Taxable = 1,75,000 - 5,000 = 1,70,000
    assert.equal(pricing.taxable_amount, 170000.00);

    // Tax (13.8%) = 1,70,000 * 0.138 = 23,460
    assert.equal(pricing.tax_total, 23460.00);

    // Grand Total = 1,70,000 + 23,460 = 1,93,460
    assert.equal(pricing.grand_total, 193460.00);

    // Subsidy (5kW residential) = ₹78,000
    assert.equal(pricing.subsidy_amount, 78000.00);

    // Net Customer Payable = 1,93,460 - 78,000 = 1,15,460
    assert.equal(pricing.net_payable, 115460.00);
  });
});

describe('Phase 5 — Quotation Zod Boundary Validation', () => {
  it('createQuotationSchema requires bom_id, lead_id, or customer_id', () => {
    const invalid = createQuotationSchema.safeParse({
      discount_amount: 1000
    });
    assert.equal(invalid.success, false);

    const validWithBom = createQuotationSchema.safeParse({
      bom_id: 'a0000000-0000-0000-0000-000000000001'
    });
    assert.equal(validWithBom.success, true);
  });

  it('reviewQuotationSchema requires comments when rejecting', () => {
    const invalid = reviewQuotationSchema.safeParse({
      decision: 'REJECT',
      comments: ''
    });
    assert.equal(invalid.success, false);

    const valid = reviewQuotationSchema.safeParse({
      decision: 'APPROVE'
    });
    assert.equal(valid.success, true);
  });

  it('rejectQuotationSchema enforces minimum 3 characters for rejection reason', () => {
    const invalid = rejectQuotationSchema.safeParse({
      rejection_reason: 'no'
    });
    assert.equal(invalid.success, false);

    const valid = rejectQuotationSchema.safeParse({
      rejection_reason: 'Customer chose alternative vendor'
    });
    assert.equal(valid.success, true);
  });
});

describe('Phase 5 — Full Commercial Quotation & Sales Order Lifecycle', () => {
  let adminUser = null;
  let testLead = null;
  let testBom = null;
  let testQuotation = null;
  let testOrder = null;

  it('prerequisites: loads admin user, qualified lead, and existing project BOM', async () => {
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user must exist');

    testBom = await prisma.project_boms.findFirst({
      where: { status: 'APPROVED' },
      include: {
        leads: true,
        project_bom_items: true
      }
    });

    if (!testBom) {
      testBom = await prisma.project_boms.findFirst({
        include: {
          leads: true,
          project_bom_items: true
        }
      });
    }

    assert.ok(testBom, 'An existing project BOM must exist from Phase 4 tests');
  });

  it('creates commercial quotation from BOM and calculates Indian Solar GST and subsidy', async () => {
    testQuotation = await quotationService.createQuotation({
      bom_id: testBom.id,
      lead_id: testBom.lead_id,
      system_capacity_kw: Number(testBom.system_capacity_kw),
      discount_amount: 3000,
      commercial_terms: '25-Year Panel Performance Warranty, 5-Year Inverter Warranty.'
    }, adminUser);

    assert.ok(testQuotation.id);
    assert.ok(testQuotation.quotation_number.startsWith('QT-'));
    assert.equal(testQuotation.status, 'DRAFT');
    assert.equal(testQuotation.version, 1);
    assert.ok(Number(testQuotation.grand_total) > 0);
    assert.ok(Number(testQuotation.tax_total) > 0);
    assert.ok(Number(testQuotation.net_payable) > 0);
    assert.equal(Number(testQuotation.discount_amount), 3000);
    assert.ok(testQuotation.quotation_items.length > 0);
  });

  it('updates draft quotation with custom installation charges and discounts', async () => {
    const updated = await quotationService.updateQuotation(testQuotation.id, {
      installation_charges: 15000,
      discount_amount: 5000
    }, adminUser);

    assert.equal(Number(updated.installation_charges), 15000);
    assert.equal(Number(updated.discount_amount), 5000);
    testQuotation = updated;
  });

  it('submits quotation for manager review and transitions status to PENDING_APPROVAL', async () => {
    const submitted = await quotationService.submitForApproval(testQuotation.id, adminUser);
    assert.equal(submitted.status, 'PENDING_APPROVAL');
  });

  it('approves commercial quotation by manager and transitions status to APPROVED', async () => {
    const approved = await quotationService.reviewQuotation(testQuotation.id, {
      decision: 'APPROVE',
      comments: 'Margin acceptable. Approved for customer dispatch.'
    }, adminUser);

    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approved_by, adminUser.id);
    assert.ok(approved.approved_at);
  });

  it('sends quotation proposal to customer: captures immutable snapshot and advances lead stage to QUOTATION_SENT', async () => {
    const sent = await quotationService.sendQuotation(testQuotation.id, {
      channel: 'WHATSAPP'
    }, adminUser);

    assert.equal(sent.status, 'SENT');
    assert.ok(sent.sent_at);
    assert.ok(sent.snapshot_data, 'Snapshot must be captured');
    assert.equal(sent.snapshot_data.sent_channel, 'WHATSAPP');
    assert.ok(sent.snapshot_data.financials.grand_total > 0);

    // Verify linked lead stage advanced to QUOTATION_SENT
    if (testQuotation.lead_id) {
      const lead = await prisma.leads.findUnique({ where: { id: testQuotation.lead_id } });
      assert.equal(lead.stage, 'QUOTATION_SENT');
    }
  });

  it('customer accepts quotation proposal and advances linked lead', async () => {
    const accepted = await quotationService.acceptQuotation(testQuotation.id, {
      accepted_by_name: 'Customer Representative',
      notes: 'Customer confirmed payment terms over phone.'
    }, adminUser);

    assert.equal(accepted.status, 'ACCEPTED');
    assert.ok(accepted.accepted_at);

    if (testQuotation.lead_id) {
      const lead = await prisma.leads.findUnique({ where: { id: testQuotation.lead_id } });
      assert.equal(lead.stage, 'NEGOTIATION');
    }
  });

  it('converts accepted quotation into confirmed Sales Order (SO-YYYY-XXXXX) and wins lead', async () => {
    testOrder = await orderService.convertQuotationToOrder({
      quotation_id: testQuotation.id,
      advance_payment_received: 25000,
      installation_target_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: 'Customer requested installation on weekend.'
    }, adminUser);

    assert.ok(testOrder.id);
    assert.ok(testOrder.order_number.startsWith('SO-'));
    assert.equal(testOrder.status, 'CONFIRMED');
    assert.equal(testOrder.quotation_id, testQuotation.id);
    assert.equal(Number(testOrder.advance_payment_received), 25000);
    assert.equal(testOrder.payment_status, 'PARTIALLY_PAID');
    assert.ok(testOrder.snapshot_data, 'Sales order must store immutable snapshot');
    assert.ok(testOrder.snapshot_data.items.length > 0);

    // Verify quotation status became CONVERTED
    const qAfter = await prisma.quotations.findUnique({ where: { id: testQuotation.id } });
    assert.equal(qAfter.status, 'CONVERTED');

    // Verify lead stage transitioned to WON
    if (testQuotation.lead_id) {
      const lead = await prisma.leads.findUnique({ where: { id: testQuotation.lead_id } });
      assert.equal(lead.stage, 'WON');
    }
  });

  it('rejects payments that exceed the remaining balance or are invalid', async () => {
    const net = Number(testOrder.net_customer_payable);
    const advance = Number(testOrder.advance_payment_received);
    const remaining = net - advance;

    // 1. Rejects payment greater than remaining balance
    await assert.rejects(
      async () => {
        await orderService.recordOrderPayment(testOrder.id, {
          amount: remaining + 5000,
          payment_method: 'UPI'
        }, adminUser);
      },
      (err) => {
        assert.equal(err.code, 'EXCEEDS_OUTSTANDING_BALANCE');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 2. Rejects zero or negative payment amount
    await assert.rejects(
      async () => {
        await orderService.recordOrderPayment(testOrder.id, {
          amount: 0,
          payment_method: 'CASH'
        }, adminUser);
      },
      (err) => {
        assert.equal(err.code, 'INVALID_PAYMENT_AMOUNT');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it('records customer payment against sales order and verifies payment status', async () => {
    // Record remaining balance
    const remainingBalance = Number(testOrder.net_customer_payable) - Number(testOrder.advance_payment_received);
    const updatedOrder = await orderService.recordOrderPayment(testOrder.id, {
      amount: remainingBalance,
      payment_method: 'NEFT',
      reference_id: 'NEFT-AXIS-20261122',
      notes: 'Full balance settled prior to dispatch.'
    }, adminUser);

    assert.equal(updatedOrder.payment_status, 'FULLY_PAID');
    assert.equal(Number(updatedOrder.advance_payment_received), Number(testOrder.net_customer_payable));
    assert.ok(Array.isArray(updatedOrder.snapshot_data?.recorded_payments));
    assert.ok(updatedOrder.snapshot_data.recorded_payments.length >= 1);
  });

  it('rejects recording additional payment when order is already fully paid', async () => {
    await assert.rejects(
      async () => {
        await orderService.recordOrderPayment(testOrder.id, {
          amount: 1000,
          payment_method: 'UPI'
        }, adminUser);
      },
      (err) => {
        assert.equal(err.code, 'ORDER_FULLY_PAID');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it('updates order execution status through operational lifecycle', async () => {
    const reservedOrder = await orderService.updateOrderStatus(testOrder.id, {
      status: 'MATERIAL_RESERVED',
      notes: 'BOM materials reserved in Ahmedabad Central Warehouse.'
    }, adminUser);

    assert.equal(reservedOrder.status, 'MATERIAL_RESERVED');

    const inProgressOrder = await orderService.updateOrderStatus(testOrder.id, {
      status: 'INSTALLATION_IN_PROGRESS',
      notes: 'Technician crew deployed on roof.'
    }, adminUser);

    assert.equal(inProgressOrder.status, 'INSTALLATION_IN_PROGRESS');
  });

  it('lists quotations and sales orders with pagination and status filters', async () => {
    const qList = await quotationService.listQuotations({ page: 1, limit: 10 });
    assert.ok(qList.data.length >= 1);
    assert.ok(qList.pagination.total >= 1);

    const oList = await orderService.listOrders({ page: 1, limit: 10 });
    assert.ok(oList.data.length >= 1);
    assert.ok(oList.pagination.total >= 1);
  });
});
