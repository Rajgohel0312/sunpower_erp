import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/index.js';
import * as warrantyService from '../../src/modules/warranties/warranty.service.js';
import * as ticketService from '../../src/modules/tickets/ticket.service.js';
import * as dispatchService from '../../src/modules/dispatches/dispatch.service.js';
import * as installationService from '../../src/modules/installations/installation.service.js';
import * as procurementService from '../../src/modules/procurement/procurement.service.js';

describe('Phase 8 — Warranty Registration, Service Tickets & RMA Hardware Swaps', () => {
  let adminUser = null;
  let testWarehouse = null;
  let testCustomer = null;
  let testProduct = null;
  let testOrder = null;
  let installedSerial = null;
  let replacementSerial = null;
  let testJob = null;
  let createdTicket = null;

  before(async () => {
    // 1. Admin user
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user must exist');

    // 2. Warehouse
    testWarehouse = await prisma.warehouses.findFirst({
      where: { code: 'WH-AHM-01' }
    });
    assert.ok(testWarehouse, 'Warehouse must exist');

    // 3. Product (Inverter)
    testProduct = await prisma.products.findFirst({
      where: { is_serial_tracked: true, sku: 'INV-GROWATT-5KW-1P' }
    });
    if (!testProduct) {
      testProduct = await prisma.products.findFirst({ where: { is_serial_tracked: true } });
    }
    assert.ok(testProduct, 'Serialized product must exist');

    // 4. Create customer
    testCustomer = await prisma.customers.create({
      data: {
        customer_code: `CUST-WAR-${Date.now()}`,
        full_name: 'Harish Mehta',
        phone_e164: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        customer_type: 'RESIDENTIAL'
      }
    });

    // 5. Create quotation & sales order
    const quotation = await prisma.quotations.create({
      data: {
        quotation_number: `QT-WAR-${Date.now()}`,
        customer_id: testCustomer.id,
        system_capacity_kw: 5.0,
        subtotal: 250000,
        taxable_amount: 250000,
        tax_total: 30000,
        grand_total: 280000,
        net_payable: 280000,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ACCEPTED'
      }
    });

    testOrder = await prisma.sales_orders.create({
      data: {
        order_number: `SO-WAR-${Date.now()}`,
        quotation_id: quotation.id,
        customer_id: testCustomer.id,
        system_capacity_kw: 5.0,
        total_amount: 280000,
        net_customer_payable: 280000,
        snapshot_data: { items: [] },
        status: 'CONFIRMED'
      }
    });

    // 6. Create two serial numbers (one to install, one available for RMA replacement)
    installedSerial = await prisma.serial_numbers.create({
      data: {
        serial_number: `SN-TEST-INST-${Date.now()}`,
        product_id: testProduct.id,
        warehouse_id: testWarehouse.id,
        status: 'AVAILABLE'
      }
    });

    replacementSerial = await prisma.serial_numbers.create({
      data: {
        serial_number: `SN-TEST-REPL-${Date.now()}`,
        product_id: testProduct.id,
        warehouse_id: testWarehouse.id,
        status: 'AVAILABLE'
      }
    });
  });

  it('1. Manufacturer Warranty Policies: seeded policies are active with valid duration', async () => {
    const policies = await warrantyService.listWarrantyPolicies({});
    assert.ok(Array.isArray(policies) && policies.length >= 4, 'Standard policies must exist');

    const inverterPolicy = policies.find((p) => p.policy_code === 'POL-INVERTER-5Y');
    assert.ok(inverterPolicy, 'Inverter policy must exist');
    assert.strictEqual(inverterPolicy.duration_months, 60);
    assert.strictEqual(inverterPolicy.warranty_type, 'REPLACEMENT');

    const panelPerf = policies.find((p) => p.policy_code === 'POL-PANEL-PERF-25Y');
    assert.ok(panelPerf, 'Panel performance policy must exist');
    assert.strictEqual(panelPerf.duration_months, 300);
  });

  it('2. Manual Warranty Registration: generates WAR-YYYY-XXXXX with frozen policy snapshot', async () => {
    const warranty = await warrantyService.createManualWarranty({
      customer_id: testCustomer.id,
      sales_order_id: testOrder.id,
      product_id: testProduct.id,
      policy_code: 'POL-INVERTER-5Y',
      duration_months: 60
    }, adminUser);

    assert.ok(warranty, 'Warranty must be created');
    assert.match(warranty.warranty_certificate_number, /^WAR-\d{4}-\d{5}$/, 'Must have WAR-YYYY-XXXXX format');
    assert.strictEqual(warranty.customer_id, testCustomer.id);
    assert.strictEqual(warranty.status, 'ACTIVE');
    assert.strictEqual(warranty.policy_snapshot.policy_code, 'POL-INVERTER-5Y');
    assert.strictEqual(warranty.policy_snapshot.duration_months, 60);

    const start = new Date(warranty.start_date).getTime();
    const end = new Date(warranty.end_date).getTime();
    assert.ok(end > start, 'End date must be after start date');
  });

  it('3. Automatic Warranty Issuance on Commissioning Sign-Off', async () => {
    // A) Dispatch the installed serial
    const dispatch = await dispatchService.createDispatch({
      sales_order_id: testOrder.id,
      warehouse_id: testWarehouse.id,
      driver_name: 'Ramesh Patel',
      vehicle_number: 'GJ-01-AX-9911',
      items: [{ product_id: testProduct.id, quantity: 1 }],
      serial_numbers: [installedSerial.serial_number]
    }, adminUser);

    assert.ok(dispatch, 'Dispatch must be created');

    // B) Schedule installation job
    const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    testJob = await installationService.createInstallationJob({
      sales_order_id: testOrder.id,
      dispatch_id: dispatch.id,
      scheduled_start: scheduledStart
    }, adminUser);

    assert.ok(testJob, 'Installation job created');

    // C) Complete mandatory checklist steps
    const checklistSteps = [
      'ROOF_STRUCTURE_ANCHORING',
      'MODULE_CLAMP_TORQUE_CHECK',
      'DC_POLARITY_CHECK',
      'EARTHING_RESISTANCE_TEST',
      'LIGHTNING_ARRESTER_CHECK',
      'AC_VOLTAGE_PHASE_SYNC',
      'INVERTER_ONLINE_APP_SYNC',
      'NET_METERING_TEST'
    ];

    for (const stepKey of checklistSteps) {
      await installationService.updateChecklistStep(testJob.id, stepKey, {
        is_completed: true,
        measured_value: '1.2 Ohms / 415V PASS'
      }, adminUser);
    }

    // D) Submit Commissioning Sign-off
    const commissionedJob = await installationService.submitCustomerSignoff(testJob.id, {
      customer_name: testCustomer.full_name,
      customer_phone: testCustomer.phone_e164,
      customer_signature_svg: '<svg><path d="M10 10 L50 50" /></svg>',
      customer_rating: 5,
      customer_feedback: 'Excellent installation quality',
      is_net_meter_installed: true
    }, adminUser);

    assert.strictEqual(commissionedJob.status, 'COMMISSIONED');

    // E) Verify warranties were automatically generated for the customer
    const customerWarranties = await warrantyService.listWarranties({ customer_id: testCustomer.id });
    assert.ok(customerWarranties.warranties.length >= 2, 'Should have issued warranties upon commissioning');

    const serialWarranty = customerWarranties.warranties.find((w) => w.serial_number_id === installedSerial.id);
    assert.ok(serialWarranty, 'Installed serial must have an auto-registered warranty');
    assert.strictEqual(serialWarranty.status, 'ACTIVE');
    assert.match(serialWarranty.warranty_certificate_number, /^WAR-\d{4}-\d{5}$/);
  });

  it('4. Claim Validation Engine: verifies warranty validity and guards against errors', async () => {
    // A) Valid serial with active warranty
    const validCheck = await warrantyService.verifyWarrantyClaim({
      serial_number: installedSerial.serial_number,
      customer_id: testCustomer.id
    });
    assert.strictEqual(validCheck.is_valid, true);
    assert.ok(validCheck.warranty, 'Should return active warranty');

    // B) Non-existent serial
    const notFoundCheck = await warrantyService.verifyWarrantyClaim({
      serial_number: 'SN-DOES-NOT-EXIST-999'
    });
    assert.strictEqual(notFoundCheck.is_valid, false);
    assert.strictEqual(notFoundCheck.reason_code, 'SERIAL_NOT_FOUND');

    // C) Customer mismatch
    const otherCustomer = await prisma.customers.create({
      data: {
        customer_code: `CUST-OTHER-${Date.now()}`,
        full_name: 'Other Person',
        phone_e164: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        customer_type: 'RESIDENTIAL'
      }
    });

    const mismatchCheck = await warrantyService.verifyWarrantyClaim({
      serial_number: installedSerial.serial_number,
      customer_id: otherCustomer.id
    });
    assert.strictEqual(mismatchCheck.is_valid, false);
    assert.strictEqual(mismatchCheck.reason_code, 'CUSTOMER_MISMATCH');
  });

  it('5. Service Ticket Creation: generates TCK-YYYY-XXXXX and SLA deadline based on priority', async () => {
    createdTicket = await ticketService.createTicket({
      customer_id: testCustomer.id,
      serial_number: installedSerial.serial_number,
      category: 'INVERTER_FAULT',
      priority: 'HIGH',
      source: 'WEB',
      reported_issue: 'Inverter error code E04 - Grid overvoltage fault detected'
    }, adminUser);

    assert.ok(createdTicket, 'Ticket must be created');
    assert.match(createdTicket.ticket_number, /^TCK-\d{4}-\d{5}$/, 'Must have TCK-YYYY-XXXXX format');
    assert.strictEqual(createdTicket.status, 'OPEN');
    assert.strictEqual(createdTicket.priority, 'HIGH');
    assert.strictEqual(createdTicket.serial_number_id, installedSerial.id);
    assert.ok(createdTicket.sla_due_date, 'SLA due date must be populated');

    // Check SLA duration is ~48h for HIGH priority
    const slaMs = new Date(createdTicket.sla_due_date).getTime() - new Date(createdTicket.created_at).getTime();
    assert.ok(slaMs >= 47 * 60 * 60 * 1000 && slaMs <= 49 * 60 * 60 * 1000, 'SLA due date must be ~48 hours for HIGH');

    // Check duplicate open ticket prevention
    await assert.rejects(
      async () => {
        await ticketService.createTicket({
          customer_id: testCustomer.id,
          serial_number: installedSerial.serial_number,
          category: 'INVERTER_FAULT',
          reported_issue: 'Second ticket attempt for same faulty unit'
        }, adminUser);
      },
      (err) => {
        assert.strictEqual(err.code, 'DUPLICATE_OPEN_TICKET');
        return true;
      }
    );
  });

  it('6. Ticket Lifecycle State Machine: validates transitions and notes', async () => {
    // A) Assign technician
    const assigned = await ticketService.assignTechnician(createdTicket.id, {
      technician_id: adminUser.id,
      notes: 'Assigned to senior electrical technician'
    }, adminUser);
    assert.strictEqual(assigned.status, 'ASSIGNED');

    // B) Invalid transition test (ASSIGNED -> CLOSED is not allowed without RESOLVED)
    await assert.rejects(
      async () => {
        await ticketService.updateTicketStatus(createdTicket.id, { status: 'CLOSED' }, adminUser);
      },
      (err) => {
        assert.strictEqual(err.code, 'INVALID_STATUS_TRANSITION');
        return true;
      }
    );

    // C) Valid transition: ASSIGNED -> IN_PROGRESS
    const inProgress = await ticketService.updateTicketStatus(createdTicket.id, {
      status: 'IN_PROGRESS',
      notes: 'Technician on-site inspecting inverter'
    }, adminUser);
    assert.strictEqual(inProgress.status, 'IN_PROGRESS');

    // D) Add diagnostic note
    const noted = await ticketService.addActivityNote(createdTicket.id, {
      activity_type: 'DIAGNOSTIC',
      notes: 'Internal IGBT gate driver burned out. Unit requires warranty RMA replacement.'
    }, adminUser);
    assert.ok(noted.ticket_activities.length >= 3, 'Activities must be logged');
  });

  it('7. RMA Hardware Replacement Engine: executes atomic serialized swap and warranty transfer', async () => {
    // Execute RMA Swap: defective (installedSerial) -> replacement (replacementSerial)
    const swappedTicket = await ticketService.executeRmaSwap(createdTicket.id, {
      defective_serial_id: installedSerial.id,
      replacement_serial_id: replacementSerial.id,
      reason: 'IGBT breakdown under grid surge; manufacturer replacement approved',
      transfer_warranty: true
    }, adminUser);

    assert.ok(swappedTicket, 'RMA swap completed');
    assert.strictEqual(swappedTicket.status, 'RESOLVED');

    // Verify defective serial status moved to RETURNED
    const updatedDefective = await prisma.serial_numbers.findUnique({
      where: { id: installedSerial.id }
    });
    assert.strictEqual(updatedDefective.status, 'RETURNED');

    // Verify replacement serial status moved to INSTALLED
    const updatedReplacement = await prisma.serial_numbers.findUnique({
      where: { id: replacementSerial.id }
    });
    assert.strictEqual(updatedReplacement.status, 'INSTALLED');
    assert.strictEqual(updatedReplacement.current_customer_id, testCustomer.id);

    // Verify warranty carried over to replacement serial
    const activeWarranty = await prisma.warranties.findFirst({
      where: { serial_number_id: replacementSerial.id, status: 'ACTIVE' }
    });
    assert.ok(activeWarranty, 'Active warranty must be transferred to the replacement serial');

    // Verify warranty replacement record created
    const replacementRecord = await prisma.warranty_replacements.findFirst({
      where: { ticket_id: createdTicket.id }
    });
    assert.ok(replacementRecord, 'Warranty replacement record must be created');
    assert.strictEqual(replacementRecord.defective_serial_id, installedSerial.id);
    assert.strictEqual(replacementRecord.replacement_serial_id, replacementSerial.id);

    // Verify serial movements recorded for both serials
    const defectiveMovement = await prisma.serial_movements.findFirst({
      where: { serial_id: installedSerial.id, to_status: 'RETURNED' }
    });
    assert.ok(defectiveMovement, 'Movement to RETURNED must be recorded');

    const replacementMovement = await prisma.serial_movements.findFirst({
      where: { serial_id: replacementSerial.id, to_status: 'INSTALLED' }
    });
    assert.ok(replacementMovement, 'Movement to INSTALLED must be recorded');
  });

  it('8. Single-Path Serial Hardware Lookup: resolves equipment specs, warranty, tickets, and RMA history', async () => {
    const history = await warrantyService.lookupSerialFullHistory(replacementSerial.serial_number);
    assert.ok(history.serial, 'Serial found');
    assert.strictEqual(history.serial.status, 'INSTALLED');
    assert.ok(history.activeWarranty, 'Active warranty linked');
    assert.strictEqual(history.replacementHistory.installedAsReplacement.length, 1);
    assert.strictEqual(
      history.replacementHistory.installedAsReplacement[0].defective_serial_id,
      installedSerial.id
    );
  });

  it('9. Intelligent SKU Resolution: getSerialNumberTrace resolves SKU to product details and available inventory serials', async () => {
    const trace = await procurementService.getSerialNumberTrace('INV-GROWATT-5KW-1P');
    assert.strictEqual(trace.is_product_sku, true, 'Must identify as product SKU');
    assert.strictEqual(trace.sku, 'INV-GROWATT-5KW-1P');
    assert.strictEqual(trace.brand, 'Growatt');
    assert.ok(trace.total_available >= 0, 'Total available calculated');
    assert.ok(Array.isArray(trace.available_serials), 'Returns available serials list');
    assert.ok(trace.message.includes('INV-GROWATT-5KW-1P'), 'Helpful explanatory message included');
  });

  it('10. Claim Verification SKU Resolution: verifyWarrantyClaim detects Product SKU and resolves to customer installed unit', async () => {
    // When customer has an installed unit of that product
    const claimRes = await warrantyService.verifyWarrantyClaim({
      serial_number: testProduct.sku,
      customer_id: testCustomer.id
    });
    assert.strictEqual(claimRes.is_valid, true, 'Automatically resolves to customer installed serial and verifies active warranty');
    assert.ok(claimRes.serial, 'Resolved serial is populated');
    assert.strictEqual(claimRes.serial.id, replacementSerial.id);

    // When no customer specified or unknown customer
    const claimNoCust = await warrantyService.verifyWarrantyClaim({
      serial_number: testProduct.sku
    });
    assert.strictEqual(claimNoCust.is_valid, false);
    assert.strictEqual(claimNoCust.reason_code, 'IS_PRODUCT_SKU');
    assert.ok(claimNoCust.message.includes('Product Catalog Code'), 'Explains it is a product SKU');
  });
});
