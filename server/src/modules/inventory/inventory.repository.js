import { prisma } from '../../database/prisma.js';

/**
 * Generates formatted human-readable stock movement number: SM-YYYY-XXXXX
 */
export async function generateMovementNumber() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('stock_movement_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `SM-${currentYear}-${seqNum}`;
}

/**
 * Lists all active warehouses
 */
export async function listWarehouses() {
  return await prisma.warehouses.findMany({
    where: { is_active: true },
    include: {
      users: {
        select: { id: true, full_name: true, email: true, phone_e164: true }
      }
    },
    orderBy: { name: 'asc' }
  });
}

/**
 * Retrieves a single warehouse by ID
 */
export async function getWarehouseById(id) {
  return await prisma.warehouses.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, full_name: true, email: true, phone_e164: true }
      }
    }
  });
}

/**
 * Lists multi-warehouse stock balances with pagination, filters, and product details
 */
export async function listStockBalances({
  warehouse_id,
  category_id,
  search,
  low_stock = false,
  page = 1,
  limit = 10
}) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (warehouse_id) where.warehouse_id = warehouse_id;

  if (category_id || search) {
    where.products = {};
    if (category_id) where.products.category_id = category_id;
    if (search && search.trim()) {
      const q = search.trim();
      where.products.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model_name: { contains: q, mode: 'insensitive' } }
      ];
    }
  }

  // Raw low_stock filter if requested
  if (low_stock === true || low_stock === 'true') {
    where.quantity_available = {
      lte: prisma.stock_balances.fields?.reorder_level || 10
    };
  }

  const [balances, total] = await Promise.all([
    prisma.stock_balances.findMany({
      where,
      skip,
      take,
      include: {
        products: {
          include: {
            product_categories: { select: { id: true, name: true, code: true } }
          }
        },
        warehouses: {
          select: { id: true, code: true, name: true, city: true }
        }
      },
      orderBy: [
        { quantity_available: 'asc' },
        { updated_at: 'desc' }
      ]
    }),
    prisma.stock_balances.count({ where })
  ]);

  return {
    data: balances,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Retrieves a single stock balance record for a product and warehouse
 */
export async function getStockBalance(productId, warehouseId) {
  return await prisma.stock_balances.findUnique({
    where: {
      product_id_warehouse_id: {
        product_id: productId,
        warehouse_id: warehouseId
      }
    },
    include: {
      products: true,
      warehouses: true
    }
  });
}

/**
 * Lists append-only stock movements ledger
 */
export async function listStockMovements({
  warehouse_id,
  product_id,
  movement_type,
  reference_type,
  page = 1,
  limit = 10
}) {
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const take = Math.max(1, Number(limit));

  const where = {};
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (product_id) where.product_id = product_id;
  if (movement_type) where.movement_type = movement_type;
  if (reference_type) where.reference_type = reference_type;

  const [movements, total] = await Promise.all([
    prisma.stock_movements.findMany({
      where,
      skip,
      take,
      include: {
        products: {
          select: { id: true, sku: true, brand: true, model_name: true, unit_code: true }
        },
        warehouses: {
          select: { id: true, code: true, name: true }
        },
        users: {
          select: { id: true, full_name: true, email: true }
        }
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.stock_movements.count({ where })
  ]);

  return {
    data: movements,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1
    }
  };
}

/**
 * Concurrency-Safe Stock Reservation for Sales Order Items
 * Uses pessimistic row locking (SELECT ... FOR UPDATE) ordered by ID to eliminate deadlocks.
 */
export async function executeStockReservation({ salesOrderId, items, actorId }) {
  return await prisma.$transaction(async (tx) => {
    // 1. Sort reservation requests by product_id and warehouse_id for consistent lock acquisition
    const sortedItems = [...items].sort((a, b) => {
      const cmpProd = a.product_id.localeCompare(b.product_id);
      if (cmpProd !== 0) return cmpProd;
      return a.warehouse_id.localeCompare(b.warehouse_id);
    });

    const reservationResults = [];

    for (const item of sortedItems) {
      const { product_id, warehouse_id, quantity } = item;
      const requestedQty = Number(quantity);

      // 2. Lock stock balance row pessimistically
      const lockedRows = await tx.$queryRaw`
        SELECT * FROM stock_balances
        WHERE product_id = ${product_id}::uuid AND warehouse_id = ${warehouse_id}::uuid
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new Error(`No stock balance record exists for product ${product_id} in warehouse ${warehouse_id}`);
      }

      const balance = lockedRows[0];
      const onHand = Number(balance.quantity_on_hand);
      const reserved = Number(balance.quantity_reserved);
      const available = Number(balance.quantity_available);

      // 3. Strict Concurrency Validation: available = on_hand - reserved
      if (available < requestedQty) {
        throw new Error(
          `Insufficient stock for product. Available: ${available}, Requested: ${requestedQty}`
        );
      }

      const newReserved = Number((reserved + requestedQty).toFixed(3));
      const newAvailable = Number((onHand - newReserved).toFixed(3));

      // 4. Update Stock Balance
      await tx.stock_balances.update({
        where: { id: balance.id },
        data: {
          quantity_reserved: newReserved,
          quantity_available: newAvailable,
          updated_at: new Date()
        }
      });

      // 5. Generate Movement Number
      const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('stock_movement_number_seq') AS seq`);
      const seqNum = String(seqRes[0].seq).padStart(5, '0');
      const movementNumber = `SM-${new Date().getFullYear()}-${seqNum}`;

      // 6. Record Append-Only Stock Movement
      await tx.stock_movements.create({
        data: {
          movement_number: movementNumber,
          product_id,
          warehouse_id,
          movement_type: 'ORDER_RESERVATION',
          quantity: requestedQty,
          quantity_on_hand_before: onHand,
          quantity_on_hand_after: onHand, // Reservation doesn't decrease on-hand until dispatch
          reference_type: 'SALES_ORDER',
          reference_id: salesOrderId,
          actor_id: actorId || null,
          notes: `Stock reserved for Sales Order`
        }
      });

      // 7. Upsert Stock Reservation Record
      const reservation = await tx.stock_reservations.upsert({
        where: {
          sales_order_id_product_id_warehouse_id: {
            sales_order_id: salesOrderId,
            product_id,
            warehouse_id
          }
        },
        create: {
          sales_order_id: salesOrderId,
          product_id,
          warehouse_id,
          quantity_reserved: requestedQty,
          status: 'ACTIVE',
          created_by: actorId || null
        },
        update: {
          quantity_reserved: { increment: requestedQty },
          status: 'ACTIVE',
          updated_at: new Date()
        }
      });

      // 8. If Product is Serial-Tracked, allocate and reserve specific serial numbers
      const product = await tx.products.findUnique({
        where: { id: product_id },
        select: { is_serial_tracked: true, sku: true }
      });

      if (product?.is_serial_tracked) {
        // Lock required number of available serials
        const availableSerials = await tx.$queryRaw`
          SELECT id, serial_number FROM serial_numbers
          WHERE product_id = ${product_id}::uuid
            AND warehouse_id = ${warehouse_id}::uuid
            AND status = 'AVAILABLE'
          LIMIT ${Math.round(requestedQty)}
          FOR UPDATE
        `;

        if (availableSerials.length < Math.round(requestedQty)) {
          throw new Error(
            `Insufficient available serial numbers for serialized product ${product.sku}. Available: ${availableSerials.length}, Needed: ${Math.round(requestedQty)}`
          );
        }

        for (const s of availableSerials) {
          await tx.serial_numbers.update({
            where: { id: s.id },
            data: {
              status: 'RESERVED',
              current_order_id: salesOrderId,
              updated_at: new Date()
            }
          });

          await tx.serial_movements.create({
            data: {
              serial_id: s.id,
              from_status: 'AVAILABLE',
              to_status: 'RESERVED',
              from_warehouse_id: warehouse_id,
              to_warehouse_id: warehouse_id,
              reference_type: 'ORDER_RESERVATION',
              reference_id: salesOrderId,
              actor_id: actorId || null,
              notes: `Serial reserved for Sales Order`
            }
          });
        }
      }

      reservationResults.push(reservation);
    }

    return reservationResults;
  });
}

/**
 * Releases Stock Reservations for a Sales Order
 */
export async function releaseStockReservation({ salesOrderId, actorId, reason }) {
  return await prisma.$transaction(async (tx) => {
    const reservations = await tx.stock_reservations.findMany({
      where: {
        sales_order_id: salesOrderId,
        status: 'ACTIVE'
      }
    });

    if (!reservations || reservations.length === 0) {
      return { releasedCount: 0 };
    }

    // Sort by product_id and warehouse_id
    const sortedRes = [...reservations].sort((a, b) => {
      const cmp = a.product_id.localeCompare(b.product_id);
      if (cmp !== 0) return cmp;
      return a.warehouse_id.localeCompare(b.warehouse_id);
    });

    for (const res of sortedRes) {
      const qty = Number(res.quantity_reserved);

      // Lock row
      const locked = await tx.$queryRaw`
        SELECT * FROM stock_balances
        WHERE product_id = ${res.product_id}::uuid AND warehouse_id = ${res.warehouse_id}::uuid
        FOR UPDATE
      `;

      if (locked.length > 0) {
        const bal = locked[0];
        const onHand = Number(bal.quantity_on_hand);
        const curReserved = Number(bal.quantity_reserved);
        const newReserved = Math.max(0, Number((curReserved - qty).toFixed(3)));
        const newAvailable = Number((onHand - newReserved).toFixed(3));

        await tx.stock_balances.update({
          where: { id: bal.id },
          data: {
            quantity_reserved: newReserved,
            quantity_available: newAvailable,
            updated_at: new Date()
          }
        });

        // Record stock movement
        const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('stock_movement_number_seq') AS seq`);
        const seqNum = String(seqRes[0].seq).padStart(5, '0');
        const movementNumber = `SM-${new Date().getFullYear()}-${seqNum}`;

        await tx.stock_movements.create({
          data: {
            movement_number: movementNumber,
            product_id: res.product_id,
            warehouse_id: res.warehouse_id,
            movement_type: 'RESERVATION_RELEASE',
            quantity: -qty,
            quantity_on_hand_before: onHand,
            quantity_on_hand_after: onHand,
            reference_type: 'SALES_ORDER',
            reference_id: salesOrderId,
            actor_id: actorId || null,
            notes: reason || 'Reservation released / order cancelled'
          }
        });
      }

      // Mark reservation CANCELLED
      await tx.stock_reservations.update({
        where: { id: res.id },
        data: {
          status: 'CANCELLED',
          updated_at: new Date()
        }
      });

      // Release reserved serial numbers back to AVAILABLE
      const reservedSerials = await tx.serial_numbers.findMany({
        where: {
          product_id: res.product_id,
          current_order_id: salesOrderId,
          status: 'RESERVED'
        }
      });

      for (const s of reservedSerials) {
        await tx.serial_numbers.update({
          where: { id: s.id },
          data: {
            status: 'AVAILABLE',
            current_order_id: null,
            updated_at: new Date()
          }
        });

        await tx.serial_movements.create({
          data: {
            serial_id: s.id,
            from_status: 'RESERVED',
            to_status: 'AVAILABLE',
            from_warehouse_id: s.warehouse_id,
            to_warehouse_id: s.warehouse_id,
            reference_type: 'RESERVATION_RELEASE',
            reference_id: salesOrderId,
            actor_id: actorId || null,
            notes: 'Serial reservation released back to available stock'
          }
        });
      }
    }

    return { releasedCount: reservations.length };
  });
}

/**
 * Audited Stock Adjustment (physical inventory count correction, damage)
 */
export async function executeStockAdjustment({
  productId,
  warehouseId,
  quantityDelta,
  reason,
  notes,
  actorId
}) {
  return await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT * FROM stock_balances
      WHERE product_id = ${productId}::uuid AND warehouse_id = ${warehouseId}::uuid
      FOR UPDATE
    `;

    if (!locked || locked.length === 0) {
      throw new Error('Stock balance record not found');
    }

    const bal = locked[0];
    const onHandBefore = Number(bal.quantity_on_hand);
    const reserved = Number(bal.quantity_reserved);
    const delta = Number(quantityDelta);
    const onHandAfter = Number((onHandBefore + delta).toFixed(3));

    if (onHandAfter < 0) {
      throw new Error(`Adjustment would result in negative on-hand stock (${onHandAfter})`);
    }

    const availableAfter = Number((onHandAfter - reserved).toFixed(3));
    if (availableAfter < 0) {
      throw new Error(
        `Adjustment would reduce stock below currently reserved quantity (${reserved})`
      );
    }

    await tx.stock_balances.update({
      where: { id: bal.id },
      data: {
        quantity_on_hand: onHandAfter,
        quantity_available: availableAfter,
        updated_at: new Date()
      }
    });

    const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('stock_movement_number_seq') AS seq`);
    const seqNum = String(seqRes[0].seq).padStart(5, '0');
    const movementNumber = `SM-${new Date().getFullYear()}-${seqNum}`;

    const movement = await tx.stock_movements.create({
      data: {
        movement_number: movementNumber,
        product_id: productId,
        warehouse_id: warehouseId,
        movement_type: 'ADJUSTMENT',
        quantity: delta,
        quantity_on_hand_before: onHandBefore,
        quantity_on_hand_after: onHandAfter,
        reference_type: 'STOCK_ADJUSTMENT',
        reference_id: bal.id,
        actor_id: actorId || null,
        notes: notes ? `${reason}: ${notes}` : reason
      }
    });

    return {
      balance: await tx.stock_balances.findUnique({ where: { id: bal.id } }),
      movement
    };
  });
}
