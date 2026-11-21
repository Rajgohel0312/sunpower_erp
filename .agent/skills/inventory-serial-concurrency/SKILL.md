---
name: inventory-serial-concurrency
description: Use when implementing stock, reservations, goods receipt, serial numbers, warehouse transfers, dispatch or stock adjustments.
---

# Inventory, serials & concurrency

- Append-only **stock ledger** (receipt, reservation, release, dispatch, transfer, adjustment, return). Never UPDATE a quantity without a ledger row.
- Available = on_hand - reserved. Reserve inside a transaction with `SELECT ... FOR UPDATE` on the stock row (or advisory lock) so two users cannot reserve the last unit.
- Serialized products: each serial is a row with state (in_stock, reserved, dispatched, installed, returned, defective), warehouse, product, current order/customer. Unique per product.
- Dispatch scanning: reject duplicate scan, wrong product, wrong warehouse, wrong state, serial reserved for another order.
- Dispatch confirmation is one transaction: ledger rows + serial state + dispatch status + audit + outbox. Any failure rolls back everything.
- Adjustments require permission, reason, and audit; negative available stock is impossible via normal flows.
- Consistent lock ordering (sort by id) to avoid deadlocks; retry on `40001`/`40P01`.
- Valuation method (FIFO/weighted average) is an open decision: record the chosen one in `docs/decisions.md`.

## Must-have tests
Two concurrent reservations of last unit; same serial scanned twice; serial from another warehouse; failure after reservation rolls back.
