---
name: whatsapp-baileys-gateway
description: Use when working on WhatsApp/Baileys: gateway process, inbound/outbound messages, conversation state, inbox, automations, retries or delivery status.
---

# WhatsApp (Baileys) integration

- Separate Node process from the API. Gateway owns: socket, QR, session creds, reconnect, provider message normalization. It owns NO business logic.
- Baileys is unofficial: keep it behind an adapter interface (`WhatsAppProvider.send/onMessage/status`) so the official WhatsApp Business Cloud API can replace it. Document ban/instability risk in the README.
- Inbound: gateway -> authenticated internal endpoint (service identity) -> dedupe on `(provider, external_message_id)` -> match customer/lead by normalized phone -> call domain services. Duplicate delivery = no-op.
- Outbound: business event -> outbox -> job -> gateway send -> record states (queued, sent, delivered, read, failed) with retry/backoff and dead-letter visibility.
- **A WhatsApp message is never authorization.** The sender phone identifies a conversation, not a permission. Payment claims, "approve", and similar commands must be verified through the web/ERP flow.
- Conversation state machine stored in DB (menu, collecting ticket details, awaiting human, closed) with timeouts and a human-handover flag.
- Customer data returned over WhatsApp is minimal and only after identity matching; never send other customers' data, never send secrets/OTPs in logs.
- Respect opt-out and quiet hours for automated messages. Rate-limit inbound hooks.
- Session credentials (auth state folder) are secrets: git-ignored, restricted permissions, never logged.
- ERP must keep working when WhatsApp is down; failures only delay messages.
- Web inbox: conversation list, assignment, reply, templates, session status/QR, logs, automation toggles; all gated by `whatsapp.*` permissions.
