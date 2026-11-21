/**
 * Phase 6 — Procurement, Multi-Warehouse Inventory Ledger & Concurrency-Safe Serialized Inventory Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/database/index.js';
import * as inventoryService from '../../src/modules/inventory/inventory.service.js';
import * as procurementService from '../../src/modules/procurement/procurement.service.js';

describe('Phase 6 — Multi-Warehouse Procurement & Inventory Ledger', () => {
  let adminUser = null;
  let ahmWarehouse = null;
  let srtWarehouse = null;
  let testSupplier = null;
  let serializedProduct = null;
  let nonSerializedProduct = null;
  let testPo = null;
  let testGrn = null;
  let testSalesOrder = null;

  it('prerequisites: loads admin user, baseline warehouses, products, and existing sales order', async () => {
    adminUser = await prisma.users.findFirst({
      where: { email: 'admin@sunpower.com' }
    });
    assert.ok(adminUser, 'Admin user must exist');

    const warehouses = await inventoryService.getWarehouses();
    assert.ok(warehouses.length >= 2, 'At least 2 baseline warehouses must exist');
    ahmWarehouse = warehouses.find((w) => w.code === 'WH-AHM-01');
    srtWarehouse = warehouses.find((w) => w.code === 'WH-SRT-01');
    assert.ok(ahmWarehouse, 'Ahmedabad Central Warehouse must exist');
    assert.ok(srtWarehouse, 'Surat Regional Depot must exist');

    // Retrieve a serialized product (Inverter) and non-serialized product (Cable)
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

    // Retrieve or create a confirmed sales order for reservation testing
    testSalesOrder = await prisma.sales_orders.findFirst({
      where: { status: 'CONFIRMED' }
    });
    if (!testSalesOrder) {
      testSalesOrder = await prisma.sales_orders.findFirst();
    }
    if (!testSalesOrder) {
      let testCustomer = await prisma.customers.findFirst();
      if (!testCustomer) {
        testCustomer = await prisma.customers.create({
          data: {
            customer_code: `CUST-TEST-${Date.now()}`,
            full_name: 'Inventory Test Customer',
            phone_e164: '+919999988888',
            customer_type: 'RESIDENTIAL'
          }
        });
      }
      let testQuotation = await prisma.quotations.findFirst();
      if (!testQuotation) {
        testQuotation = await prisma.quotations.create({
          data: {
            quotation_number: `QT-TEST-${Date.now()}`,
            customers: { connect: { id: testCustomer.id } },
            system_capacity_kw: 5.0,
            hardware_subtotal: 150000,
            installation_charges: 25000,
            transport_charges: 5000,
            subtotal: 180000,
            taxable_amount: 180000,
            tax_total: 24840,
            grand_total: 204840,
            subsidy_amount: 78000,
            net_payable: 126840,
            status: 'ACCEPTED',
            valid_until: new Date(Date.now() + 30 * 86400000)
          }
        });
      }
      testSalesOrder = await prisma.sales_orders.create({
        data: {
          order_number: `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
          quotations: { connect: { id: testQuotation.id } },
          customers: { connect: { id: testCustomer.id } },
          system_capacity_kw: 5.0,
          total_amount: 204840,
          subsidy_amount: 78000,
          net_customer_payable: 126840,
          status: 'CONFIRMED',
          advance_payment_received: 50000,
          payment_status: 'PARTIALLY_PAID',
          snapshot_data: { items: [] }
        }
      });
    }
    assert.ok(testSalesOrder, 'A sales order must exist for reservation testing');
  });

  it('creates and onboards a new solar equipment supplier with auto-generated code', async () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    testSupplier = await procurementService.createSupplier({
      name: `Goldi Solar Pvt Ltd ${randomSuffix}`,
      contact_person: 'Ishver Dholakiya',
      phone_e164: `+919879${randomSuffix}01`,
      email: `procurement${randomSuffix}@goldisolar.com`,
      gstin: '24AAACG1234F1Z9',
      payment_terms_days: 45,
      city: 'Surat',
      state: 'Gujarat',
      pincode: '394110'
    }, adminUser);

    assert.ok(testSupplier.id);
    assert.ok(testSupplier.supplier_code.startsWith('SUP-'));
    assert.equal(testSupplier.payment_terms_days, 45);
    assert.equal(testSupplier.is_active, true);
  });

  it('drafts a Purchase Order (PO-YYYY-XXXXX) with item totals and 12% GST calculation', async () => {
    testPo = await procurementService.createPurchaseOrder({
      supplier_id: testSupplier.id,
      warehouse_id: ahmWarehouse.id,
      expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      notes: 'Initial procurement for residential project pipelines.',
      items: [
        {
          product_id: serializedProduct.id,
          quantity_ordered: 5,
          unit_price: 38000,
          tax_rate_pct: 12
        },
        {
          product_id: nonSerializedProduct.id,
          quantity_ordered: 200,
          unit_price: 65,
          tax_rate_pct: 18
        }
      ]
    }, adminUser);

    assert.ok(testPo.id);
    assert.ok(testPo.po_number.startsWith('PO-'));
    assert.equal(testPo.status, 'DRAFT');
    assert.equal(testPo.purchase_order_items.length, 2);

    // Item 1: 5 * 38000 = 1,90,000 + 12% GST (22,800) = 2,12,800
    // Item 2: 200 * 65 = 13,000 + 18% GST (2,340) = 15,340
    // Subtotal = 2,03,000 | Tax = 25,140 | Total = 2,28,140
    assert.equal(Number(testPo.subtotal), 203000.00);
    assert.equal(Number(testPo.tax_amount), 25140.00);
    assert.equal(Number(testPo.total_amount), 228140.00);
  });

  it('approves the Purchase Order for vendor issuance', async () => {
    const approved = await procurementService.approvePurchaseOrder(testPo.id, adminUser);
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approved_by, adminUser.id);
    assert.ok(approved.approved_at);
  });

  it('records Goods Receipt Note (GRN), captures serials, and updates stock balances & movements atomically', async () => {
    const poItemSerialized = testPo.purchase_order_items.find((i) => i.product_id === serializedProduct.id);
    const poItemNonSerialized = testPo.purchase_order_items.find((i) => i.product_id === nonSerializedProduct.id);

    // Initial stock balance check
    const initialBal = await prisma.stock_balances.findUnique({
      where: {
        product_id_warehouse_id: {
          product_id: serializedProduct.id,
          warehouse_id: ahmWarehouse.id
        }
      }
    });
    const initialOnHand = initialBal ? Number(initialBal.quantity_on_hand) : 0;

    const uniqueRunId = Date.now().toString().slice(-6);
    const serialList = [
      { product_id: serializedProduct.id, serial_number: `SN-INV-AHM-${uniqueRunId}-01` },
      { product_id: serializedProduct.id, serial_number: `SN-INV-AHM-${uniqueRunId}-02` },
      { product_id: serializedProduct.id, serial_number: `SN-INV-AHM-${uniqueRunId}-03` }
    ];

    testGrn = await procurementService.recordGoodsReceipt({
      po_id: testPo.id,
      supplier_id: testSupplier.id,
      warehouse_id: ahmWarehouse.id,
      invoice_challan_number: `INV-VEND-${uniqueRunId}`,
      invoice_challan_date: new Date().toISOString().split('T')[0],
      notes: 'Received partial shipment from factory via V-Trans.',
      items: [
        {
          po_item_id: poItemSerialized.id,
          product_id: serializedProduct.id,
          quantity_received: 3,
          quantity_accepted: 3,
          quantity_rejected: 0,
          unit_cost: 38000
        },
        {
          po_item_id: poItemNonSerialized.id,
          product_id: nonSerializedProduct.id,
          quantity_received: 100,
          quantity_accepted: 100,
          quantity_rejected: 0,
          unit_cost: 65
        }
      ],
      serials: serialList
    }, adminUser);

    assert.ok(testGrn.id);
    assert.ok(testGrn.grn_number.startsWith('GRN-'));
    assert.equal(testGrn.goods_receipt_items.length, 2);

    // Verify stock balance was increased
    const updatedBal = await prisma.stock_balances.findUnique({
      where: {
        product_id_warehouse_id: {
          product_id: serializedProduct.id,
          warehouse_id: ahmWarehouse.id
        }
      }
    });
    assert.equal(Number(updatedBal.quantity_on_hand), initialOnHand + 3);
    assert.equal(Number(updatedBal.quantity_available), Number(updatedBal.quantity_on_hand) - Number(updatedBal.quantity_reserved));

    // Verify append-only stock movement created
    const movement = await prisma.stock_movements.findFirst({
      where: {
        reference_type: 'GOODS_RECEIPT',
        reference_id: testGrn.id,
        product_id: serializedProduct.id
      }
    });
    assert.ok(movement);
    assert.equal(movement.movement_type, 'PURCHASE_RECEIPT');
    assert.equal(Number(movement.quantity), 3);

    // Verify serial numbers created in AVAILABLE state
    const createdSerials = await prisma.serial_numbers.findMany({
      where: {
        serial_number: { in: serialList.map((s) => s.serial_number) }
      }
    });
    assert.equal(createdSerials.length, 3);
    for (const s of createdSerials) {
      assert.equal(s.status, 'AVAILABLE');
      assert.equal(s.warehouse_id, ahmWarehouse.id);
      assert.equal(s.grn_id, testGrn.id);
    }
  });

  it('rejects duplicate serial numbers and serial count mismatch for serialized equipment', async () => {
    const uniqueRunId = Date.now().toString().slice(-6);

    // 1. Rejects when accepted quantity is 2 but only 1 serial is provided
    await assert.rejects(
      async () => {
        await procurementService.recordGoodsReceipt({
          supplier_id: testSupplier.id,
          warehouse_id: ahmWarehouse.id,
          items: [
            {
              product_id: serializedProduct.id,
              quantity_received: 2,
              quantity_accepted: 2,
              unit_cost: 38000
            }
          ],
          serials: [
            { product_id: serializedProduct.id, serial_number: `SN-TEST-ONLYONE-${uniqueRunId}` }
          ]
        }, adminUser);
      },
      (err) => {
        assert.equal(err.code, 'SERIAL_COUNT_MISMATCH');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 2. Rejects when duplicate serials are provided in payload
    await assert.rejects(
      async () => {
        await procurementService.recordGoodsReceipt({
          supplier_id: testSupplier.id,
          warehouse_id: ahmWarehouse.id,
          items: [
            {
              product_id: serializedProduct.id,
              quantity_received: 2,
              quantity_accepted: 2,
              unit_cost: 38000
            }
          ],
          serials: [
            { product_id: serializedProduct.id, serial_number: `SN-DUP-${uniqueRunId}` },
            { product_id: serializedProduct.id, serial_number: `SN-DUP-${uniqueRunId}` }
          ]
        }, adminUser);
      },
      (err) => {
        assert.equal(err.code, 'DUPLICATE_SERIAL');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it('verifies serial numbers via barcode scanner lookup endpoint', async () => {
    const existingSerial = await prisma.serial_numbers.findFirst({
      where: { status: 'AVAILABLE', warehouse_id: ahmWarehouse.id }
    });
    assert.ok(existingSerial);

    // 1. Valid scan: exists and matches product and warehouse
    const validScan = await procurementService.verifySerial({
      serial_number: existingSerial.serial_number,
      expected_product_id: existingSerial.product_id,
      expected_warehouse_id: existingSerial.warehouse_id
    });
    assert.equal(validScan.isValid, true);
    assert.ok(validScan.serial);

    // 2. Invalid scan: wrong warehouse
    const wrongWhScan = await procurementService.verifySerial({
      serial_number: existingSerial.serial_number,
      expected_warehouse_id: srtWarehouse.id
    });
    assert.equal(wrongWhScan.isValid, false);
    assert.equal(wrongWhScan.reason, 'WAREHOUSE_MISMATCH');

    // 3. Invalid scan: non-existent serial
    const notFoundScan = await procurementService.verifySerial({
      serial_number: 'SN-DOES-NOT-EXIST-99999'
    });
    assert.equal(notFoundScan.isValid, false);
    assert.equal(notFoundScan.reason, 'SERIAL_NOT_FOUND');
  });

  it('concurrency test: simultaneous reservation attempts on the last available stock unit prevent overselling', async () => {
    // 1. Setup exact stock: Set warehouse available quantity to exactly 1 unit for a dedicated test product
    const testBal = await prisma.stock_balances.findUnique({
      where: {
        product_id_warehouse_id: {
          product_id: nonSerializedProduct.id,
          warehouse_id: ahmWarehouse.id
        }
      }
    });

    const currentAvailable = Number(testBal.quantity_available);
    assert.ok(currentAvailable >= 1, 'At least 1 unit available for concurrency test');

    // Create 2 fake sales orders to compete for the exact remaining stock
    const so1 = testSalesOrder;
    const so2 = await prisma.sales_orders.create({
      data: {
        order_number: `SO-CONC-TEST-${Date.now().toString().slice(-5)}`,
        quotation_id: testSalesOrder.quotation_id,
        customer_id: testSalesOrder.customer_id,
        bom_id: testSalesOrder.bom_id,
        system_capacity_kw: 5.0,
        total_amount: 100000,
        net_customer_payable: 100000,
        advance_payment_received: 20000,
        status: 'CONFIRMED',
        snapshot_data: { items: [] }
      }
    });

    // Both requests attempt to reserve ALL currently available units simultaneously
    const attempt1 = inventoryService.reserveStock({
      sales_order_id: so1.id,
      items: [{ product_id: nonSerializedProduct.id, warehouse_id: ahmWarehouse.id, quantity: currentAvailable }]
    }, adminUser);

    const attempt2 = inventoryService.reserveStock({
      sales_order_id: so2.id,
      items: [{ product_id: nonSerializedProduct.id, warehouse_id: ahmWarehouse.id, quantity: currentAvailable }]
    }, adminUser);

    const results = await Promise.allSettled([attempt1, attempt2]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one reservation must succeed, and the second must be rejected with INSUFFICIENT_STOCK
    assert.equal(successes.length, 1, 'Exactly one concurrent reservation must succeed');
    assert.equal(failures.length, 1, 'Second concurrent reservation must fail');
    assert.ok(failures[0].reason.message.includes('Insufficient stock'));

    // Verify stock balance consistency: available cannot be negative!
    const finalBal = await prisma.stock_balances.findUnique({
      where: {
        product_id_warehouse_id: {
          product_id: nonSerializedProduct.id,
          warehouse_id: ahmWarehouse.id
        }
      }
    });
    assert.equal(Number(finalBal.quantity_available), 0, 'Available stock must be exactly 0, never negative');
    assert.ok(Number(finalBal.quantity_reserved) >= currentAvailable);

    // Cleanup: Release the reservation
    const winningOrderId = successes[0] === results[0] ? so1.id : so2.id;
    await inventoryService.releaseStock({ sales_order_id: winningOrderId, reason: 'Concurrency test cleanup' }, adminUser);

    const restoredBal = await prisma.stock_balances.findUnique({
      where: {
        product_id_warehouse_id: {
          product_id: nonSerializedProduct.id,
          warehouse_id: ahmWarehouse.id
        }
      }
    });
    assert.equal(Number(restoredBal.quantity_available), currentAvailable, 'Available stock restored after release');
  });

  it('performs audited stock adjustment and rejects adjustments causing negative inventory', async () => {
    // 1. Valid positive adjustment
    const adjResult = await inventoryService.adjustStock({
      product_id: nonSerializedProduct.id,
      warehouse_id: ahmWarehouse.id,
      quantity_delta: 25,
      reason: 'Physical inventory cycle count audit surplus',
      notes: 'Found unopened roll of cable on shelf 4'
    }, adminUser);

    assert.ok(adjResult.movement);
    assert.equal(adjResult.movement.movement_type, 'ADJUSTMENT');
    assert.equal(Number(adjResult.movement.quantity), 25);

    // 2. Reject negative adjustment exceeding on-hand quantity
    await assert.rejects(
      async () => {
        await inventoryService.adjustStock({
          product_id: nonSerializedProduct.id,
          warehouse_id: ahmWarehouse.id,
          quantity_delta: -999999,
          reason: 'Massive scrap write-off'
        }, adminUser);
      },
      (err) => {
        assert.ok(err.message.includes('negative'));
        return true;
      }
    );
  });
});
