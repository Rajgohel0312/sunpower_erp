---
name: postgres-schema-migrations
description: Use when designing tables, constraints, indexes or writing SQL migrations for SunPower ERP, including the inventory ledger, financial tables and snapshots.
---

# PostgreSQL schema & migrations

## Conventions
- `snake_case`, plural table names, `id` UUID (or bigint identity, decide once and stay consistent), `created_at`, `updated_at`, `created_by`, `updated_by`, optional `deleted_at`.
- Money: `NUMERIC(14,2)` (never float). Quantities: `NUMERIC(14,3)` where fractional units exist.
- Enums: prefer `CHECK` constraints or lookup tables over free text for statuses.
- Every FK has an index. Add partial unique indexes for "one active row" rules.

## Constraints that carry business rules
- Unique: customer phone (normalized E.164) warning index, serial number per product, document numbers (quotation, order, invoice, ticket).
- `CHECK (available >= 0)` semantics enforced through the ledger + locks, not app-only checks.
- Payment allocation: `SUM(allocations) <= payment.amount` enforced in a transaction with row lock.
- Idempotency: unique `(provider, external_message_id)` for WhatsApp, unique idempotency key for payments/webhooks.

## Patterns
- **Inventory ledger**: append-only `stock_movements`; balances are derived or maintained transactionally. Reservations are separate rows.
- **Snapshots**: quotation/order store copied price, tax, BOM lines and warranty policy as JSONB or snapshot tables. Never join live product price into a confirmed document.
- **Versioning**: BOM templates, quotations and approved surveys are versioned; approved = immutable (revision creates a new row).
- **Audit**: append-only `audit_logs`; app role has INSERT/SELECT only.
- **Outbox**: `outbox_events` written in the same transaction as the business change.

## Migrations
- Numbered, forward-only SQL files + a small runner that records applied versions with checksums.
- Each migration runs in a transaction; must work from an empty DB and from the previous release.
- Never edit an applied migration. Seeds are separate from migrations and idempotent.
- Review every new table for: PK, FKs, indexes, NOT NULL, CHECKs, audit columns, and an owner/assignment column if customers or technicians access it.
