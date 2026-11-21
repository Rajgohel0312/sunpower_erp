import * as procurementRepo from './procurement.repository.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/response.js';

/**
 * Lists suppliers with pagination & search
 */
export async function listSuppliers(query) {
  return await procurementRepo.listSuppliers(query);
}

/**
 * Retrieves supplier by ID
 */
export async function getSupplier(id) {
  const supplier = await procurementRepo.getSupplierById(id);
  if (!supplier) {
    throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
  }
  return supplier;
}

/**
 * Onboards a new supplier
 */
export async function createSupplier(input, actor) {
  const supplierCode = await procurementRepo.generateSupplierCode();
  return await procurementRepo.createSupplier({
    ...input,
    supplier_code: supplierCode
  });
}

/**
 * Lists purchase orders with status filtering & pagination
 */
export async function listPurchaseOrders(query) {
  return await procurementRepo.listPurchaseOrders(query);
}

/**
 * Retrieves purchase order by ID
 */
export async function getPurchaseOrder(id) {
  const po = await procurementRepo.getPurchaseOrderById(id);
  if (!po) {
    throw new AppError('Purchase order not found', 404, 'PURCHASE_ORDER_NOT_FOUND');
  }
  return po;
}

/**
 * Drafts a new Purchase Order
 */
export async function createPurchaseOrder(input, actor) {
  // 1. Verify Supplier & Warehouse
  const [supplier, warehouse] = await Promise.all([
    prisma.suppliers.findUnique({ where: { id: input.supplier_id } }),
    prisma.warehouses.findUnique({ where: { id: input.warehouse_id } })
  ]);

  if (!supplier || !supplier.is_active) {
    throw new AppError('Active supplier required', 400, 'INVALID_SUPPLIER');
  }
  if (!warehouse || !warehouse.is_active) {
    throw new AppError('Active destination warehouse required', 400, 'INVALID_WAREHOUSE');
  }

  // 2. Calculate Item Totals and PO Financials
  let subtotal = 0;
  let taxAmount = 0;

  const items = input.items.map((it) => {
    const qty = Number(it.quantity_ordered);
    const unitPrice = Number(it.unit_price);
    const itemSubtotal = Number((qty * unitPrice).toFixed(2));
    const taxRate = Number(it.tax_rate_pct || 12.00);
    const itemTax = Number(((itemSubtotal * taxRate) / 100).toFixed(2));
    const itemTotal = Number((itemSubtotal + itemTax).toFixed(2));

    subtotal += itemSubtotal;
    taxAmount += itemTax;

    return {
      product_id: it.product_id,
      quantity_ordered: qty,
      unit_price: unitPrice,
      tax_rate_pct: taxRate,
      total_amount: itemTotal
    };
  });

  const totalAmount = Number((subtotal + taxAmount).toFixed(2));
  const poNumber = await procurementRepo.generatePONumber();

  return await procurementRepo.createPurchaseOrder(
    {
      po_number: poNumber,
      supplier_id: input.supplier_id,
      warehouse_id: input.warehouse_id,
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(taxAmount.toFixed(2)),
      total_amount: totalAmount,
      expected_delivery_date: input.expected_delivery_date,
      notes: input.notes,
      created_by: actor?.id
    },
    items
  );
}

/**
 * Approves a Purchase Order for Vendor Issuance
 */
export async function approvePurchaseOrder(id, actor) {
  const po = await procurementRepo.getPurchaseOrderById(id);
  if (!po) {
    throw new AppError('Purchase order not found', 404, 'PURCHASE_ORDER_NOT_FOUND');
  }

  if (po.status !== 'DRAFT' && po.status !== 'SUBMITTED') {
    throw new AppError(`Cannot approve purchase order with status ${po.status}`, 400, 'INVALID_PO_STATUS');
  }

  return await procurementRepo.approvePurchaseOrder(id, actor?.id);
}

/**
 * Records Goods Receipt Note (GRN) & Inwards Inventory
 */
export async function recordGoodsReceipt(input, actor) {
  // 1. Verify Destination Warehouse & Supplier
  const [warehouse, supplier] = await Promise.all([
    prisma.warehouses.findUnique({ where: { id: input.warehouse_id } }),
    prisma.suppliers.findUnique({ where: { id: input.supplier_id } })
  ]);

  if (!warehouse || !warehouse.is_active) {
    throw new AppError('Active destination warehouse required', 400, 'INVALID_WAREHOUSE');
  }
  if (!supplier) {
    throw new AppError('Supplier required', 400, 'INVALID_SUPPLIER');
  }

  // 2. Check Serialized Products Verification
  const serials = input.serials || [];
  const serialMap = new Map();
  for (const s of serials) {
    const sn = s.serial_number.trim();
    if (serialMap.has(sn)) {
      throw new AppError(`Duplicate serial number ${sn} provided in payload`, 400, 'DUPLICATE_SERIAL');
    }
    serialMap.set(sn, s.product_id);
  }

  // Verify whether products require serial tracking and validate counts
  for (const item of input.items) {
    const product = await prisma.products.findUnique({
      where: { id: item.product_id },
      select: { id: true, sku: true, is_serial_tracked: true }
    });

    if (product?.is_serial_tracked) {
      const acceptedQty = Number(item.quantity_accepted);
      const providedSerials = serials.filter((s) => s.product_id === item.product_id);

      if (providedSerials.length !== Math.round(acceptedQty)) {
        throw new AppError(
          `Product ${product.sku} requires serial tracking. Exactly ${Math.round(acceptedQty)} serial numbers required, but ${providedSerials.length} provided.`,
          400,
          'SERIAL_COUNT_MISMATCH'
        );
      }
    }
  }

  // Check if any serial number already exists in DB
  if (serials.length > 0) {
    const existingSerials = await prisma.serial_numbers.findMany({
      where: {
        serial_number: { in: Array.from(serialMap.keys()) }
      },
      select: { serial_number: true }
    });

    if (existingSerials.length > 0) {
      throw new AppError(
        `Serial number(s) already exist in database: ${existingSerials.map((e) => e.serial_number).join(', ')}`,
        400,
        'SERIAL_ALREADY_EXISTS'
      );
    }
  }

  // 3. Generate GRN Number
  const grnNumber = await procurementRepo.generateGRNNumber();

  return await procurementRepo.executeGoodsReceipt({
    grnData: {
      grn_number: grnNumber,
      po_id: input.po_id,
      supplier_id: input.supplier_id,
      warehouse_id: input.warehouse_id,
      invoice_challan_number: input.invoice_challan_number,
      invoice_challan_date: input.invoice_challan_date,
      notes: input.notes,
      received_by: actor?.id
    },
    items: input.items,
    serials
  });
}

/**
 * Lists Goods Receipts (GRN)
 */
export async function listGoodsReceipts(query) {
  return await procurementRepo.listGoodsReceipts(query);
}

/**
 * Lists and searches serialized asset registry
 */
export async function listSerialNumbers(query) {
  return await procurementRepo.listSerialNumbers(query);
}

/**
 * Serial Traceability Timeline
 */
export async function getSerialNumberTrace(serialNumber) {
  const trace = await procurementRepo.getSerialNumberTrace(serialNumber);
  if (!trace) {
    throw new AppError(`Serial number ${serialNumber} not found`, 404, 'SERIAL_NOT_FOUND');
  }
  return trace;
}

/**
 * Barcode Scanner Verification Endpoint
 */
export async function verifySerial({ serial_number, expected_product_id, expected_warehouse_id }) {
  const serial = await procurementRepo.getSerialNumberTrace(serial_number);
  if (!serial) {
    return {
      isValid: false,
      reason: 'SERIAL_NOT_FOUND',
      message: `Serial number ${serial_number} does not exist in registry.`
    };
  }

  if (expected_product_id && serial.product_id !== expected_product_id) {
    return {
      isValid: false,
      reason: 'PRODUCT_MISMATCH',
      message: `Serial number belongs to ${serial.products?.sku || serial.product_id}, not the requested product.`,
      serial
    };
  }

  if (expected_warehouse_id && serial.warehouse_id !== expected_warehouse_id) {
    return {
      isValid: false,
      reason: 'WAREHOUSE_MISMATCH',
      message: `Serial number is located at warehouse ${serial.warehouses?.code || serial.warehouse_id}, not the current warehouse.`,
      serial
    };
  }

  if (serial.status !== 'AVAILABLE' && serial.status !== 'RESERVED') {
    return {
      isValid: false,
      reason: 'INVALID_STATUS',
      message: `Serial number is in state ${serial.status}. Only AVAILABLE or RESERVED items can be processed.`,
      serial
    };
  }

  return {
    isValid: true,
    serial
  };
}
