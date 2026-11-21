---
name: erp-architecture
description: Use when creating or changing any server module, route, controller, service, repository or policy in SunPower ERP. Enforces the modular-monolith layering and the rule that web and WhatsApp share the same domain services.
---

# ERP architecture (modular monolith)

## Layering (never skip a layer)
routes -> controller -> service -> repository -> query builder -> PostgreSQL
- **Routes**: declare endpoint + middleware (auth, permission, validate, rate-limit). No logic.
- **Controller**: translate HTTP to a service call. No business rules, no SQL.
- **Service**: business rules, state transitions, transaction boundaries. Never imports `req`/`res`.
- **Repository**: only place that talks to the query builder. Returns DTO-safe objects, never raw rows with internal fields.
- **Policy** (`x.policy.js`): ownership/assignment checks (customer owns resource, technician assigned to job).
- **Validation** (`x.validation.js`): Zod schemas for every external input.

## Module layout
`server/src/modules/<name>/{name.routes,name.controller,name.service,name.repository,name.validation,name.policy,name.test}.js`

## Hard rules
1. Every business mutation goes through a domain service. The web controller and the WhatsApp handler call the SAME function (e.g. `serviceTicketService.createTicket(input, actor)`), with `actor = {type, id, channel}`.
2. Baileys gateway never writes to ERP tables; it posts normalized events to an authenticated internal endpoint.
3. Modules talk to each other via service functions, not by reading each other's tables.
4. Multi-step state changes run inside one transaction in the service layer.
5. ES modules only, async/await, centralized error handler, camelCase / PascalCase / UPPER_SNAKE_CASE.
6. Build vertical slices (backend behavior working -> then screen). Follow the PRD roadmap phases in order.

## Before finishing a task
- Does a controller contain a rule? Move it to the service.
- Is there duplicated logic between web and WhatsApp paths? Merge.
- Did you add a test for the success path AND the failure path?
