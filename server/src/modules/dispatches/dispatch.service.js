import { withTransaction } from '../../database/index.js';
import { AppError } from '../../utils/response.js';
import * as dispatchRepo from './dispatch.repository.js';
import { prisma } from '../../database/index.js';

export async function listDispatches(query) {
  return dispatchRepo.listDispatches(query);
}

export async function getDispatch(id) {
  const dispatch = await dispatchRepo.getDispatchById(id);
  if (!dispatch) {
    throw new AppError('Material dispatch record not found', 404, 'DISPATCH_NOT_FOUND');
  }
  return dispatch;
}

export async function createDispatch(input, actor) {
  return withTransaction(async (trx) => {
    // 1. Verify Sales Order exists and is eligible for dispatch
    const order = await trx.sales_orders.findUnique({
      where: { id: input.sales_order_id },
      include: {
        customers: { select: { id: true, full_name: true } }
      }
    });

    if (!order) {
      throw new AppError('Sales order not found for dispatch', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'CANCELLED') {
      throw new AppError('Cannot dispatch material for a cancelled sales order', 400, 'ORDER_CANCELLED');
    }

    // 2. Verify Warehouse exists
    const warehouse = await trx.warehouses.findUnique({
      where: { id: input.warehouse_id }
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found for dispatch', 404, 'WAREHOUSE_NOT_FOUND');
    }

    // 3. Inspect items and check serialized requirements
    const productIds = input.items.map((i) => i.product_id);
    const products = await trx.products.findMany({
      where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let serializedCountRequired = 0;
    const serializedProductIds = new Set();
    for (const item of input.items) {
      const prod = productMap.get(item.product_id);
      if (!prod) {
        throw new AppError(`Product ID ${item.product_id} not found in catalog`, 400, 'PRODUCT_NOT_FOUND');
      }
      if (prod.is_serial_tracked) {
        serializedCountRequired += Number(item.quantity);
        serializedProductIds.add(prod.id);
      }
    }

    const providedSerials = (input.serial_numbers || []).map((s) => s.trim()).filter(Boolean);

    if (serializedCountRequired > 0 && providedSerials.length !== serializedCountRequired) {
      throw new AppError(
        `Total serialized items dispatched is ${serializedCountRequired}, but ${providedSerials.length} serial numbers were provided.`,
        400,
        'SERIAL_COUNT_MISMATCH'
      );
    }

    // 4. Validate provided serial numbers (with automatic SKU-to-Serial resolution)
    let matchedSerials = [];
    if (providedSerials.length > 0) {
      const exactMatches = await trx.serial_numbers.findMany({
        where: {
          serial_number: { in: providedSerials }
        }
      });

      const matchedSerialNumbers = new Set(exactMatches.map((s) => s.serial_number));
      const unmatchedInputs = providedSerials.filter((s) => !matchedSerialNumbers.has(s));

      const autoResolvedSerials = [];
      const claimedSerialIds = new Set(exactMatches.map((s) => s.id));

      if (unmatchedInputs.length > 0) {
        for (const inputStr of unmatchedInputs) {
          const product = await trx.products.findFirst({
            where: {
              OR: [
                { sku: { equals: inputStr, mode: 'insensitive' } },
                { model_name: { equals: inputStr, mode: 'insensitive' } }
              ]
            }
          });

          if (product && serializedProductIds.has(product.id)) {
            // Find an available or reserved serial for this order/warehouse
            const candidate = await trx.serial_numbers.findFirst({
              where: {
                product_id: product.id,
                warehouse_id: input.warehouse_id,
                status: { in: ['RESERVED', 'AVAILABLE'] },
                id: { notIn: Array.from(claimedSerialIds) }
              },
              orderBy: [
                { status: 'asc' }, // RESERVED first, then AVAILABLE
                { created_at: 'asc' }
              ]
            });

            if (candidate) {
              autoResolvedSerials.push(candidate);
              claimedSerialIds.add(candidate.id);
              continue;
            } else {
              throw new AppError(
                `Product SKU '${inputStr}' entered in dispatch manifest, but no available or reserved serial units remain in warehouse.`,
                400,
                'INSUFFICIENT_PRODUCT_SERIALS'
              );
            }
          }

          // Unmatched input is neither a valid serial nor an in-manifest SKU
          throw new AppError(
            `The following serial numbers or Product SKUs were not found in inventory: ${inputStr}`,
            400,
            'SERIALS_NOT_FOUND'
          );
        }
      }

      matchedSerials = [...exactMatches, ...autoResolvedSerials];

      // Check status of each serial: must be 'RESERVED' or 'AVAILABLE'
      for (const s of matchedSerials) {
        if (!['RESERVED', 'AVAILABLE'].includes(s.status)) {
          throw new AppError(
            `Serial number ${s.serial_number} is currently '${s.status}' and cannot be dispatched.`,
            400,
            'SERIAL_NOT_AVAILABLE_FOR_DISPATCH'
          );
        }
        if (!serializedProductIds.has(s.product_id)) {
          throw new AppError(
            `Serial number ${s.serial_number} does not match any serialized product in this dispatch.`,
            400,
            'SERIAL_PRODUCT_MISMATCH'
          );
        }
      }
    }

    // 5. Generate dispatch number and create header
    const dispatchNumber = await dispatchRepo.generateDispatchNumber(trx);
    const dispatch = await dispatchRepo.createDispatchRecord(
      {
        dispatch_number: dispatchNumber,
        sales_order_id: input.sales_order_id,
        warehouse_id: input.warehouse_id,
        driver_name: input.driver_name,
        driver_phone: input.driver_phone,
        vehicle_number: input.vehicle_number,
        dispatch_date: input.dispatch_date,
        delivery_target_date: input.delivery_target_date,
        delivery_notes: input.delivery_notes,
        created_by: actor?.id
      },
      trx
    );

    // 6. Create dispatch line items
    const lineItemsData = input.items.map((item) => ({
      dispatch_id: dispatch.id,
      product_id: item.product_id,
      quantity_dispatched: item.quantity || item.quantity_dispatched
    }));
    await dispatchRepo.createDispatchItems(lineItemsData, trx);

    // 7. Create dispatch serials and advance serial status
    if (matchedSerials.length > 0) {
      const dispatchSerialsData = matchedSerials.map((s) => ({
        dispatch_id: dispatch.id,
        serial_number_id: s.id,
        product_id: s.product_id
      }));
      await dispatchRepo.createDispatchSerials(dispatchSerialsData, trx);

      // Advance serial status to DISPATCHED
      const serialIds = matchedSerials.map((s) => s.id);
      await dispatchRepo.updateSerialStatus(serialIds, 'DISPATCHED', trx);

      // Record audit movement for serials
      const serialMovements = matchedSerials.map((s) => ({
        serial_id: s.id,
        from_status: s.status,
        to_status: 'DISPATCHED',
        from_warehouse_id: input.warehouse_id,
        reference_type: 'DISPATCH',
        reference_id: dispatch.id,
        actor_id: actor?.id,
        notes: `Dispatched on vehicle ${input.vehicle_number} for Order ${order.order_number}`
      }));
      await dispatchRepo.recordSerialMovements(serialMovements, trx);
    }

    // 8. Update sales order status to DISPATCHED
    await trx.sales_orders.update({
      where: { id: input.sales_order_id },
      data: {
        status: 'DISPATCHED',
        updated_at: new Date()
      }
    });

    return dispatchRepo.getDispatchById(dispatch.id, trx);
  });
}

export async function updateDispatchStatus(id, input, actor) {
  const existing = await dispatchRepo.getDispatchById(id);
  if (!existing) {
    throw new AppError('Dispatch record not found', 404, 'DISPATCH_NOT_FOUND');
  }

  const updateData = {
    status: input.status,
    delivery_notes: input.delivery_notes || existing.delivery_notes
  };

  if (input.status === 'DELIVERED') {
    updateData.delivered_at = input.delivered_at ? new Date(input.delivered_at) : new Date();
  }

  return dispatchRepo.updateDispatchStatus(id, updateData);
}
