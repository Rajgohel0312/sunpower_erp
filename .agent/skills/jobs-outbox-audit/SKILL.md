---
name: jobs-outbox-audit
description: Use when adding background jobs, scheduled reminders, notifications, PDF/report generation, domain events, or audit logging.
---

# Jobs, outbox & audit

- Outbox pattern: write business change + `outbox_events` row in ONE transaction; a worker publishes/creates jobs. Never send a message inside the request transaction.
- Jobs are **at-least-once**: every handler must be idempotent (check state before acting, use dedupe keys).
- Start with a PostgreSQL-backed queue (`FOR UPDATE SKIP LOCKED`, attempts, run_at, last_error) if Redis isn't set up; keep an interface so BullMQ+Redis can replace it.
- Retries with exponential backoff, max attempts, dead-letter status visible in the admin UI.
- Typical jobs: WhatsApp outbound, survey reminder, quotation follow-up, warranty expiry reminder, invoice due reminder, PDF generation, large exports.
- Re-check conditions at run time (survey still scheduled? invoice still unpaid? customer opted out?).
- Audit log fields: actor (type/id), action, entity type/id, request ID, timestamp, safe before/after diff, reason. Append-only for the app DB role. Redact secrets/PII.
- Audit these always: stock adjustment, dispatch confirmation, quotation approval, payment verification, invoice posting, warranty override, permission/role change, user deactivation.
