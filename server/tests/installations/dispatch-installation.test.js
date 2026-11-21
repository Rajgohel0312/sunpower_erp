import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/index.js';
import * as dispatchService from '../../src/modules/dispatches/dispatch.service.js';
import * as installationService from '../../src/modules/installations/installation.service.js';
import * as dispatchController from '../../src/modules/dispatches/dispatch.controller.js';
import * as installationController from '../../src/modules/installations/installation.controller.js';

describe('Phase 7 — Material Dispatch, Installation Execution & Commissioning', () => {
  let adminUser = null;
  let ahmWarehouse = null;
  let serializedProduct = null;
  let nonSerializedProduct = null;
  let testCustomer = null;
  let testQuotation = null;
  let testOrder = null;
  let testSerial = null;
  let createdDispatch = null;
  let createdJob = null;

  before(async () => {
    // 1. Fetch admin user
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user must exist');

    // 2. Fetch warehouse
    ahmWarehouse = await prisma.warehouses.findFirst({
      where: { code: 'WH-AHM-01' }
    });
    assert.ok(ahmWarehouse, 'Ahmedabad warehouse must exist');

    // 3. Fetch products
    serializedProduct = await prisma.products.findFirst({
      where: { is_serial_tracked: true, sku: 'INV-GROWATT-5KW-1P' }
    });
    if (!serializedProduct) {
      serializedProduct = await prisma.products.findFirst({ where: { is_serial_tracked: true } });
    }
    assert.ok(serializedProduct, 'Serialized product must exist');

    nonSerializedProduct = await prisma.products.findFirst({
      where: { is_serial_tracked: false, sku: 'CBL-DC-POLYCAB-4SQMM' }
    });
    if (!nonSerializedProduct) {
      nonSerializedProduct = await prisma.products.findFirst({ where: { is_serial_tracked: false } });
    }
    assert.ok(nonSerializedProduct, 'Non-serialized product must exist');

    // 4. Create customer and quotation if not present
    testCustomer = await prisma.customers.create({
      data: {
        customer_code: `CUST-DISP-${Date.now()}`,
        full_name: 'Bhavesh Shah',
        phone_e164: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        customer_type: 'RESIDENTIAL'
      }
    });

    testQuotation = await prisma.quotations.create({
      data: {
        quotation_number: `QT-DISP-${Date.now()}`,
        customers: { connect: { id: testCustomer.id } },
        system_capacity_kw: 5.0,
        hardware_subtotal: 160000,
        installation_charges: 25000,
        transport_charges: 5000,
        subtotal: 190000,
        taxable_amount: 190000,
        tax_total: 26220,
        grand_total: 216220,
        subsidy_amount: 78000,
        net_payable: 138220,
        status: 'ACCEPTED',
        valid_until: new Date(Date.now() + 30 * 86400000)
      }
    });

    testOrder = await prisma.sales_orders.create({
      data: {
        order_number: `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        quotations: { connect: { id: testQuotation.id } },
        customers: { connect: { id: testCustomer.id } },
        system_capacity_kw: 5.0,
        total_amount: 216220,
        subsidy_amount: 78000,
        net_customer_payable: 138220,
        status: 'CONFIRMED',
        advance_payment_received: 50000,
        payment_status: 'PARTIALLY_PAID',
        snapshot_data: { items: [] }
      }
    });

    // 5. Seed a test serial number in AVAILABLE state
    const serialStr = `SN-DISP-TEST-${Date.now()}`;
    testSerial = await prisma.serial_numbers.create({
      data: {
        serial_number: serialStr,
        product_id: serializedProduct.id,
        warehouse_id: ahmWarehouse.id,
        status: 'AVAILABLE'
      }
    });
    assert.ok(testSerial, 'Test serial must be created');
  });

  it('rejects dispatch if serialized item count does not match serial numbers provided', async () => {
    await assert.rejects(
      async () => {
        await dispatchService.createDispatch(
          {
            sales_order_id: testOrder.id,
            warehouse_id: ahmWarehouse.id,
            driver_name: 'Ramesh Patel',
            driver_phone: '+919876543210',
            vehicle_number: 'GJ-01-AB-1234',
            items: [
              { product_id: serializedProduct.id, quantity: 2 } // requires 2 serials
            ],
            serial_numbers: [testSerial.serial_number] // only 1 provided
          },
          adminUser
        );
      },
      (err) => {
        assert.equal(err.code, 'SERIAL_COUNT_MISMATCH');
        return true;
      }
    );
  });

  it('rejects dispatch if serial number is not found in inventory', async () => {
    await assert.rejects(
      async () => {
        await dispatchService.createDispatch(
          {
            sales_order_id: testOrder.id,
            warehouse_id: ahmWarehouse.id,
            driver_name: 'Ramesh Patel',
            driver_phone: '+919876543210',
            vehicle_number: 'GJ-01-AB-1234',
            items: [
              { product_id: serializedProduct.id, quantity: 1 }
            ],
            serial_numbers: ['SN-NON-EXISTENT-99999']
          },
          adminUser
        );
      },
      (err) => {
        assert.equal(err.code, 'SERIALS_NOT_FOUND');
        return true;
      }
    );
  });

  it('creates dispatch (DSP-YYYY-XXXXX), allocates serials, and advances order status to DISPATCHED', async () => {
    createdDispatch = await dispatchService.createDispatch(
      {
        sales_order_id: testOrder.id,
        warehouse_id: ahmWarehouse.id,
        driver_name: 'Ramesh Patel',
        driver_phone: '+919876543210',
        vehicle_number: 'GJ-01-AB-1234',
        delivery_notes: 'Handle solar inverter with care; secure with straps.',
        items: [
          { product_id: serializedProduct.id, quantity: 1 },
          { product_id: nonSerializedProduct.id, quantity: 50 }
        ],
        serial_numbers: [testSerial.serial_number]
      },
      adminUser
    );

    assert.ok(createdDispatch);
    assert.match(createdDispatch.dispatch_number, /^DSP-\d{4}-\d{5}$/);
    assert.equal(createdDispatch.status, 'PREPARED');
    assert.equal(createdDispatch.dispatch_items.length, 2);
    assert.equal(createdDispatch.dispatch_serials.length, 1);

    // Verify serial status advanced to DISPATCHED
    const updatedSerial = await prisma.serial_numbers.findUnique({
      where: { id: testSerial.id }
    });
    assert.equal(updatedSerial.status, 'DISPATCHED');

    // Verify sales order status advanced to DISPATCHED
    const updatedOrder = await prisma.sales_orders.findUnique({
      where: { id: testOrder.id }
    });
    assert.equal(updatedOrder.status, 'DISPATCHED');
  });

  it('updates dispatch delivery status to IN_TRANSIT and DELIVERED with delivered_at timestamp', async () => {
    const inTransit = await dispatchService.updateDispatchStatus(
      createdDispatch.id,
      { status: 'IN_TRANSIT' },
      adminUser
    );
    assert.equal(inTransit.status, 'IN_TRANSIT');

    const delivered = await dispatchService.updateDispatchStatus(
      createdDispatch.id,
      { status: 'DELIVERED', delivery_notes: 'Delivered at customer rooftop site.' },
      adminUser
    );
    assert.equal(delivered.status, 'DELIVERED');
    assert.ok(delivered.delivered_at, 'delivered_at must be populated');
  });

  it('schedules an installation job (JOB-YYYY-XXXXX) and initializes the 8 mandatory checklist steps', async () => {
    const scheduledStart = new Date(Date.now() + 2 * 86400000).toISOString();
    createdJob = await installationService.createInstallationJob(
      {
        sales_order_id: testOrder.id,
        dispatch_id: createdDispatch.id,
        team_lead_id: adminUser.id,
        scheduled_start: scheduledStart,
        technicians: [
          { technician_id: adminUser.id, role_in_team: 'TEAM_LEAD' }
        ]
      },
      adminUser
    );

    assert.ok(createdJob);
    assert.match(createdJob.job_number, /^JOB-\d{4}-\d{5}$/);
    assert.equal(createdJob.status, 'ASSIGNED');
    assert.equal(createdJob.installation_technicians.length, 1);

    // Verify 8 standard solar installation checklist items were initialized
    assert.equal(createdJob.installation_checklists.length, 8);
    const stepKeys = createdJob.installation_checklists.map((c) => c.step_key);
    assert.ok(stepKeys.includes('ROOF_STRUCTURE_ANCHORING'));
    assert.ok(stepKeys.includes('EARTHING_RESISTANCE_TEST'));
    assert.ok(stepKeys.includes('AC_VOLTAGE_PHASE_SYNC'));
    assert.ok(stepKeys.includes('NET_METERING_TEST'));

    // Check all are initially false
    assert.ok(createdJob.installation_checklists.every((c) => c.is_completed === false));
  });

  it('updates installation checklist step and records measured technical value', async () => {
    const updated = await installationService.updateChecklistStep(
      createdJob.id,
      'EARTHING_RESISTANCE_TEST',
      {
        is_completed: true,
        measured_value: '1.8 Ohms',
        remarks: 'Measured using 3-point fall of potential digital earth tester. Passed.'
      },
      adminUser
    );

    const earthingStep = updated.installation_checklists.find(
      (c) => c.step_key === 'EARTHING_RESISTANCE_TEST'
    );
    assert.ok(earthingStep);
    assert.equal(earthingStep.is_completed, true);
    assert.equal(earthingStep.measured_value, '1.8 Ohms');
  });

  it('uploads geotagged photo evidence for the installation job', async () => {
    const photo = await installationService.uploadInstallationPhoto(
      createdJob.id,
      {
        photo_category: 'STRUCTURE',
        file_url: 'https://storage.sunpower.com/installations/job-001/structure_anchors.jpg',
        caption: 'South-facing elevated HDGI mounting structure with M10 anchor bolts',
        gps_lat: 23.0225,
        gps_lng: 72.5714
      },
      adminUser
    );

    assert.ok(photo);
    assert.equal(photo.photo_category, 'STRUCTURE');
    assert.equal(photo.caption, 'South-facing elevated HDGI mounting structure with M10 anchor bolts');
  });

  it('rejects customer sign-off and commissioning if mandatory checklist steps are incomplete', async () => {
    await assert.rejects(
      async () => {
        await installationService.submitCustomerSignoff(
          createdJob.id,
          {
            customer_name: 'Bhavesh Shah',
            customer_phone: '+919876543210',
            customer_signature_svg: '<svg><path d="M10 10 L50 50"/></svg>',
            customer_rating: 5
          },
          adminUser
        );
      },
      (err) => {
        assert.equal(err.code, 'MANDATORY_CHECKLIST_INCOMPLETE');
        return true;
      }
    );
  });

  it('completes remaining checklist steps and successfully commissions installation with certificate (CERT-YYYY-XXXXX)', async () => {
    // Complete remaining 7 steps
    const remainingSteps = [
      'ROOF_STRUCTURE_ANCHORING',
      'MODULE_CLAMP_TORQUE_CHECK',
      'DC_POLARITY_CHECK',
      'LIGHTNING_ARRESTER_CHECK',
      'AC_VOLTAGE_PHASE_SYNC',
      'INVERTER_ONLINE_APP_SYNC',
      'NET_METERING_TEST'
    ];

    for (const stepKey of remainingSteps) {
      await installationService.updateChecklistStep(
        createdJob.id,
        stepKey,
        {
          is_completed: true,
          measured_value: 'Verified OK'
        },
        adminUser
      );
    }

    // Now submit customer commissioning sign-off
    const commissionedJob = await installationService.submitCustomerSignoff(
      createdJob.id,
      {
        customer_name: 'Bhavesh Shah',
        customer_phone: '+919876543210',
        customer_signature_svg: '<svg viewBox="0 0 100 100"><path d="M10 80 Q 52.5 10, 95 80" stroke="black"/></svg>',
        customer_rating: 5,
        customer_feedback: 'Excellent installation team. Very professional wiring and earthing setup.',
        is_net_meter_installed: true,
        discom_consumer_number: 'UGVCL-08291048',
        tested_peak_power_kw: 5.1
      },
      adminUser
    );

    assert.ok(commissionedJob);
    assert.equal(commissionedJob.status, 'COMMISSIONED');
    const signoff = commissionedJob.installation_signoffs[0];
    assert.ok(signoff);
    assert.match(signoff.certificate_number, /^CERT-\d{4}-\d{5}$/);
    assert.equal(signoff.customer_name, 'Bhavesh Shah');
    assert.equal(signoff.is_net_meter_installed, true);

    // Verify sales order status advanced to COMMISSIONED
    const finalOrder = await prisma.sales_orders.findUnique({
      where: { id: testOrder.id }
    });
    assert.equal(finalOrder.status, 'COMMISSIONED');

    // Verify serial numbers advanced to INSTALLED
    const finalSerial = await prisma.serial_numbers.findUnique({
      where: { id: testSerial.id }
    });
    assert.equal(finalSerial.status, 'INSTALLED');

    // Verify serial movement was recorded
    const movements = await prisma.serial_movements.findMany({
      where: { serial_id: testSerial.id, to_status: 'INSTALLED' }
    });
    assert.ok(movements.length > 0, 'Serial movement record for INSTALLED must exist');
  });

  it('verifies listDispatches and listInstallationJobs controllers return valid HTTP 200 with standard pagination envelope', async () => {
    // 1. Test dispatchController.listDispatches
    let dispatchRes = {
      statusCode: null,
      body: null,
      status(code) {
        assert.equal(typeof code, 'number', 'Status code must be a number');
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    await dispatchController.listDispatches({ query: { page: '1', limit: '10' } }, dispatchRes, (err) => {
      if (err) throw err;
    });

    assert.equal(dispatchRes.statusCode, 200);
    assert.ok(Array.isArray(dispatchRes.body.data));
    assert.ok(dispatchRes.body.meta.pagination);
    assert.equal(dispatchRes.body.meta.pagination.page, 1);
    assert.equal(typeof dispatchRes.body.meta.pagination.total, 'number');

    // 2. Test installationController.listInstallationJobs
    let jobRes = {
      statusCode: null,
      body: null,
      status(code) {
        assert.equal(typeof code, 'number', 'Status code must be a number');
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    await installationController.listInstallationJobs({ query: { page: '1', limit: '10' } }, jobRes, (err) => {
      if (err) throw err;
    });

    assert.equal(jobRes.statusCode, 200);
    assert.ok(Array.isArray(jobRes.body.data));
    assert.ok(jobRes.body.meta.pagination);
    assert.equal(jobRes.body.meta.pagination.page, 1);
    assert.equal(typeof jobRes.body.meta.pagination.total, 'number');
  });
});
