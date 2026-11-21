import { prisma } from '../../database/prisma.js';

/**
 * Generates formatted human-readable supplier code: SUP-YYYY-XXXXX
 */
export async function generateSupplierCode() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('supplier_code_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `SUP-${currentYear}-${seqNum}`;
}

/**
 * Generates formatted human-readable purchase order number: PO-YYYY-XXXXX
 */
export async function generatePONumber() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('purchase_order_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `PO-${currentYear}-${seqNum}`;
}

/**
 * Generates formatted human-readable goods receipt number: GRN-YYYY-XXXXX
 */
export async function generateGRNNumber() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('goods_receipt_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `GRN-${currentYear}-${seqNum}`;
}

/**
 * Lists suppliers with search and pagination
 */
export async function listSuppliers({ search, is_active, page = 1, limit = 10 }) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (is_active !== undefined) {
    where.is_active = is_active === true || is_active === 'true';
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { supplier_code: { contains: q, mode: 'insensitive' } },
      { contact_person: { contains: q, mode: 'insensitive' } },
      { phone_e164: { contains: q, mode: 'insensitive' } },
      { gstin: { contains: q, mode: 'insensitive' } }
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.suppliers.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' }
    }),
    prisma.suppliers.count({ where })
  ]);

  return {
    data: suppliers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Retrieves supplier by ID
 */
export async function getSupplierById(id) {
  return await prisma.suppliers.findUnique({
    where: { id },
    include: {
      purchase_orders: {
        take: 5,
        orderBy: { created_at: 'desc' }
      }
    }
  });
}

/**
 * Creates new supplier
 */
export async function createSupplier(data) {
  return await prisma.suppliers.create({
    data: {
      supplier_code: data.supplier_code,
      name: data.name,
      contact_person: data.contact_person || null,
      phone_e164: data.phone_e164,
      email: data.email || null,
      gstin: data.gstin || null,
      payment_terms_days: data.payment_terms_days || 30,
      address_line1: data.address_line1 || null,
      city: data.city || null,
      state: data.state || 'Gujarat',
      pincode: data.pincode || null,
      is_active: true
    }
  });
}

/**
 * Lists purchase orders with filters and pagination
 */
export async function listPurchaseOrders({
  supplier_id,
  warehouse_id,
  status,
  search,
  page = 1,
  limit = 10
}) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (supplier_id) where.supplier_id = supplier_id;
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (status && status !== 'ALL') where.status = status;

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { po_number: { contains: q, mode: 'insensitive' } },
      { suppliers: { name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.purchase_orders.findMany({
      where,
      skip,
      take,
      include: {
        suppliers: { select: { id: true, supplier_code: true, name: true, phone_e164: true } },
        warehouses: { select: { id: true, code: true, name: true } },
        purchase_order_items: {
          include: {
            products: { select: { id: true, sku: true, brand: true, model_name: true, unit_code: true, is_serial_tracked: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.purchase_orders.count({ where })
  ]);

  return {
    data: orders,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Retrieves purchase order by ID
 */
export async function getPurchaseOrderById(id) {
  return await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      suppliers: true,
      warehouses: true,
      purchase_order_items: {
        include: {
          products: {
            include: {
              product_categories: true
            }
          }
        }
      },
      goods_receipts: {
        orderBy: { received_at: 'desc' }
      }
    }
  });
}

/**
 * Creates a purchase order with items in a transaction
 */
export async function createPurchaseOrder(poData, items) {
  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchase_orders.create({
      data: {
        po_number: poData.po_number,
        supplier_id: poData.supplier_id,
        warehouse_id: poData.warehouse_id,
        status: 'DRAFT',
        subtotal: poData.subtotal,
        tax_amount: poData.tax_amount,
        total_amount: poData.total_amount,
        expected_delivery_date: poData.expected_delivery_date ? new Date(poData.expected_delivery_date) : null,
        notes: poData.notes || null,
        created_by: poData.created_by || null,
        purchase_order_items: {
          create: items.map((it) => ({
            product_id: it.product_id,
            quantity_ordered: it.quantity_ordered,
            quantity_received: 0,
            unit_price: it.unit_price,
            tax_rate_pct: it.tax_rate_pct || 12.00,
            total_amount: it.total_amount
          }))
        }
      },
      include: {
        purchase_order_items: true,
        suppliers: true,
        warehouses: true
      }
    });

    return po;
  });
}

/**
 * Approves a purchase order
 */
export async function approvePurchaseOrder(id, actorId) {
  return await prisma.purchase_orders.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approved_by: actorId,
      approved_at: new Date(),
      updated_at: new Date()
    },
    include: {
      purchase_order_items: true,
      suppliers: true
    }
  });
}

/**
 * Executes Goods Receipt Note (GRN):
 * Atomically updates stock balances, adds append-only stock movements,
 * updates PO item received quantities, and records serialized assets.
 */
export async function executeGoodsReceipt({ grnData, items, serials = [] }) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create Goods Receipt Header
    const grn = await tx.goods_receipts.create({
      data: {
        grn_number: grnData.grn_number,
        po_id: grnData.po_id || null,
        supplier_id: grnData.supplier_id,
        warehouse_id: grnData.warehouse_id,
        invoice_challan_number: grnData.invoice_challan_number || null,
        invoice_challan_date: grnData.invoice_challan_date ? new Date(grnData.invoice_challan_date) : null,
        status: 'RECEIVED',
        notes: grnData.notes || null,
        received_by: grnData.received_by
      }
    });

    // 2. Process Goods Receipt Line Items & Stock Updates
    for (const item of items) {
      const acceptedQty = Number(item.quantity_accepted);
      const receivedQty = Number(item.quantity_received);
      const rejectedQty = Number(item.quantity_rejected || 0);

      // Create GRN item
      await tx.goods_receipt_items.create({
        data: {
          grn_id: grn.id,
          po_item_id: item.po_item_id || null,
          product_id: item.product_id,
          quantity_received: receivedQty,
          quantity_accepted: acceptedQty,
          quantity_rejected: rejectedQty,
          rejection_reason: item.rejection_reason || null,
          unit_cost: item.unit_cost
        }
      });

      // Update PO item quantity_received if PO is linked
      if (item.po_item_id) {
        await tx.purchase_order_items.update({
          where: { id: item.po_item_id },
          data: {
            quantity_received: { increment: acceptedQty }
          }
        });
      }

      // If accepted quantity > 0, update Stock Balances & record Stock Movement
      if (acceptedQty > 0) {
        // Lock or upsert stock_balances row
        const existingBalance = await tx.stock_balances.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: item.product_id,
              warehouse_id: grnData.warehouse_id
            }
          }
        });

        const onHandBefore = existingBalance ? Number(existingBalance.quantity_on_hand) : 0;
        const reservedBefore = existingBalance ? Number(existingBalance.quantity_reserved) : 0;
        const onHandAfter = Number((onHandBefore + acceptedQty).toFixed(3));
        const availableAfter = Number((onHandAfter - reservedBefore).toFixed(3));

        await tx.stock_balances.upsert({
          where: {
            product_id_warehouse_id: {
              product_id: item.product_id,
              warehouse_id: grnData.warehouse_id
            }
          },
          create: {
            product_id: item.product_id,
            warehouse_id: grnData.warehouse_id,
            quantity_on_hand: acceptedQty,
            quantity_reserved: 0,
            quantity_available: acceptedQty,
            updated_at: new Date()
          },
          update: {
            quantity_on_hand: onHandAfter,
            quantity_available: availableAfter,
            updated_at: new Date()
          }
        });

        // Generate stock movement number
        const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('stock_movement_number_seq') AS seq`);
        const seqNum = String(seqRes[0].seq).padStart(5, '0');
        const movementNumber = `SM-${new Date().getFullYear()}-${seqNum}`;

        // Append-only stock ledger entry
        await tx.stock_movements.create({
          data: {
            movement_number: movementNumber,
            product_id: item.product_id,
            warehouse_id: grnData.warehouse_id,
            movement_type: 'PURCHASE_RECEIPT',
            quantity: acceptedQty,
            quantity_on_hand_before: onHandBefore,
            quantity_on_hand_after: onHandAfter,
            reference_type: 'GOODS_RECEIPT',
            reference_id: grn.id,
            actor_id: grnData.received_by,
            notes: `Goods receipt from supplier via ${grn.grn_number}`
          }
        });
      }
    }

    // 3. Process Serial Numbers for Serialized Products
    if (Array.isArray(serials) && serials.length > 0) {
      for (const s of serials) {
        // Insert serial number
        const serialRecord = await tx.serial_numbers.create({
          data: {
            serial_number: s.serial_number.trim(),
            product_id: s.product_id,
            warehouse_id: grnData.warehouse_id,
            status: 'AVAILABLE',
            grn_id: grn.id,
            manufacturing_date: s.manufacturing_date ? new Date(s.manufacturing_date) : null
          }
        });

        // Record initial serial movement
        await tx.serial_movements.create({
          data: {
            serial_id: serialRecord.id,
            from_status: null,
            to_status: 'AVAILABLE',
            from_warehouse_id: null,
            to_warehouse_id: grnData.warehouse_id,
            reference_type: 'GOODS_RECEIPT',
            reference_id: grn.id,
            actor_id: grnData.received_by,
            notes: `Serial captured upon Goods Receipt ${grn.grn_number}`
          }
        });
      }
    }

    // 4. Update linked Purchase Order status if all items received
    if (grnData.po_id) {
      const poItems = await tx.purchase_order_items.findMany({
        where: { po_id: grnData.po_id }
      });

      const allReceived = poItems.every(
        (pi) => Number(pi.quantity_received) >= Number(pi.quantity_ordered)
      );
      const someReceived = poItems.some(
        (pi) => Number(pi.quantity_received) > 0
      );

      await tx.purchase_orders.update({
        where: { id: grnData.po_id },
        data: {
          status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'APPROVED',
          updated_at: new Date()
        }
      });
    }

    return await tx.goods_receipts.findUnique({
      where: { id: grn.id },
      include: {
        goods_receipt_items: {
          include: { products: true }
        },
        suppliers: true,
        warehouses: true
      }
    });
  });
}

/**
 * Lists Goods Receipts (GRN) with pagination
 */
export async function listGoodsReceipts({
  po_id,
  supplier_id,
  warehouse_id,
  search,
  page = 1,
  limit = 10
}) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (po_id) where.po_id = po_id;
  if (supplier_id) where.supplier_id = supplier_id;
  if (warehouse_id) where.warehouse_id = warehouse_id;

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { grn_number: { contains: q, mode: 'insensitive' } },
      { invoice_challan_number: { contains: q, mode: 'insensitive' } },
      { suppliers: { name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [receipts, total] = await Promise.all([
    prisma.goods_receipts.findMany({
      where,
      skip,
      take,
      include: {
        suppliers: { select: { id: true, supplier_code: true, name: true } },
        warehouses: { select: { id: true, code: true, name: true } },
        goods_receipt_items: {
          include: {
            products: { select: { id: true, sku: true, brand: true, model_name: true, is_serial_tracked: true } }
          }
        },
        users: { select: { id: true, full_name: true } }
      },
      orderBy: { received_at: 'desc' }
    }),
    prisma.goods_receipts.count({ where })
  ]);

  return {
    data: receipts,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Serial Number Subsystem: Lists and searches serialized assets
 */
export async function listSerialNumbers({
  product_id,
  warehouse_id,
  current_order_id,
  status,
  search,
  page = 1,
  limit = 10
}) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (product_id) where.product_id = product_id;
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (current_order_id) where.current_order_id = current_order_id;
  if (status && status !== 'ALL') where.status = status;

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { serial_number: { contains: q, mode: 'insensitive' } },
      { products: { sku: { contains: q, mode: 'insensitive' } } },
      { products: { brand: { contains: q, mode: 'insensitive' } } },
      { products: { model_name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [serials, total] = await Promise.all([
    prisma.serial_numbers.findMany({
      where,
      skip,
      take,
      include: {
        products: {
          select: { id: true, sku: true, brand: true, model_name: true, rated_capacity_w: true }
        },
        warehouses: {
          select: { id: true, code: true, name: true }
        },
        sales_orders: {
          select: { id: true, order_number: true }
        },
        customers: {
          select: { id: true, customer_code: true, full_name: true, phone_e164: true }
        }
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.serial_numbers.count({ where })
  ]);

  return {
    data: serials,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Serial Traceability Lookup: Returns serial asset, linked customer, order, and entire timeline of movements
 */
export async function getSerialNumberTrace(serialNumber) {
  return await prisma.serial_numbers.findUnique({
    where: { serial_number: serialNumber.trim() },
    include: {
      products: {
        include: {
          product_categories: true,
          product_specifications: true
        }
      },
      warehouses: true,
      sales_orders: {
        select: { id: true, order_number: true, confirmed_at: true }
      },
      customers: {
        select: { id: true, customer_code: true, full_name: true, phone_e164: true }
      },
      goods_receipts: {
        select: { id: true, grn_number: true, invoice_challan_number: true, received_at: true }
      },
      serial_movements: {
        include: {
          users: { select: { id: true, full_name: true } },
          warehouses_serial_movements_from_warehouse_idTowarehouses: { select: { code: true, name: true } },
          warehouses_serial_movements_to_warehouse_idTowarehouses: { select: { code: true, name: true } }
        },
        orderBy: { created_at: 'desc' }
      }
    }
  });
}
