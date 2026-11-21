---
name: api-design-validation
description: Use when creating or changing REST endpoints, request/response shapes, validation schemas, pagination, filtering, sorting or error handling.
---

# API design & validation

- Base `/api/v1`. Resource-oriented plural nouns. Consistent envelope: `{ data, meta }` for success, `{ error: { code, message, details, requestId } }` for failure.
- Zod at EVERY boundary (body, query, params, headers, WhatsApp-normalized events). Strip unknown keys. Normalize phone (E.164) and email (lowercase/trim).
- Server-side pagination, filtering and sorting only through allowlisted fields. Always sanitize repository `page` and `limit` to safe integers (`Math.max(1, parseInt(page, 10))`, `Math.min(100, parseInt(limit, 10))`). Standard response envelope: `{ data: [...], meta: { pagination: { page, limit, total, totalPages } } }`.
- Fast search & indexing: Use `server/src/utils/trie.js` (Trie) for $O(L)$ in-memory prefix search and autocomplete suggestions alongside B-Tree / GIN DB indexes on searchable columns (`lead_number`, `survey_number`, `phone_e164`, `sku`). Refer to `list-page-search-pagination` skill.
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict/state error, 422 business rule, 429 rate limit, 500 generic.
- Stable error codes (e.g. `STOCK_INSUFFICIENT`, `SERIAL_ALREADY_DISPATCHED`, `INVALID_STAGE_TRANSITION`). Never leak internals.
- Idempotency: `Idempotency-Key` header for payment recording, order confirmation, lead conversion, webhooks/inbound messages.
- Every request gets a request ID (generated or propagated) and appears in logs and error responses.
- State machines (lead stage, survey status, quotation, order, ticket) live in the service as explicit transition tables; invalid transitions return 409/422 and are audited.
- Never return raw DB rows; map to response DTOs (omit password hashes, token hashes, internal flags).
- Large lists/exports: async job + status endpoint.
