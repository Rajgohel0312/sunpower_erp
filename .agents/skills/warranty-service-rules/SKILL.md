---
name: warranty-service-rules
description: Use when implementing warranty registration, policy snapshots, claims, service tickets, repair/replacement or serial lookups.
---

# Warranty & service

- Warranty is registered against an exact **serial number** and stores a **snapshot** of the policy used (duration, start trigger, terms).
- Start date comes from a configurable trigger (installation sign-off by default). Expiry computed server-side, timezone-explicit.
- Claim validation: serial exists, belongs to this customer, warranty active (or authorized override with reason + audit), no duplicate open claim.
- Replacement: new serial linked to old serial, old marked defective/returned, inventory movement recorded, warranty carried or reissued per policy.
- Ticket lifecycle: New -> Assigned -> In Progress -> Waiting Parts/Customer -> Resolved -> Closed (+ reopen rule). Every ticket has a ticket number, SLA timestamps and history.
- Tickets created via web or WhatsApp use the same `createTicket` service.
- Serial lookup resolves customer, order, installation, warranty and open tickets in one query path; protect with permissions.
