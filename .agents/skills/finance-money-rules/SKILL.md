---
name: finance-money-rules
description: Use when implementing quotations pricing, tax, invoices, payments, allocations, expenses, or project profitability.
---

# Finance & money

- Compute money in integer minor units (paise) or `NUMERIC` via a decimal library. **Never JS floats** for money or tax.
- One rounding policy (documented), applied per line then summed; tests for 1 kW to 5 kW packages with GST variants.
- Confirmed quotations/orders/invoices store snapshots of price, tax, discount and BOM. Editing a product never changes them.
- Distinguish **invoiced revenue**, **cash received**, **receivables** and **recognized revenue** in code, DB and UI labels.
- Payment: staff verifies it; a customer chat message is not proof. Record method, reference, verifier, time. Replayed payment notifications are idempotent (unique reference/idempotency key).
- Allocation cannot exceed the unapplied amount; lock the payment row during allocation.
- Invoice posting is irreversible except by credit note; audit every post/void.
- Project margin = revenue - direct costs (material from dispatch cost, labour, transport, other). Missing cost data must show an explicit "incomplete" flag, not zero.
- GST/subsidy/tax rules are configuration validated with the business accountant, not hard-coded.
