---
name: rbac-authorization
description: Use when adding or changing any protected endpoint, permission, role, ownership rule, or customer/technician data access. Prevents IDOR and privilege escalation.
---

# Authorization (RBAC + resource policies)

- Permission format `module.resource.action` (e.g. `inventory.dispatch.create`). Actions: create, read, update, delete, approve, export + module-specific.
- **Deny by default.** A route without an explicit permission middleware must fail a lint/test.
- Two checks on every request: (1) permission middleware, (2) resource policy in the service (ownership / assignment / status).
- Technician: only jobs assigned to them. Sales Executive: assigned leads/customers. Customer: only own resources. Accountant/Director: finance via explicit permission.
- Never accept `userId`, `customerId`, `employeeId`, `role` from body/URL as identity. Derive from the authenticated principal; use IDs from URLs only after policy check.
- File downloads and exports are authorized per object, independently.
- High-risk actions (approve quotation, verify payment, stock adjustment, dispatch confirm, warranty override, permission change) require explicit permission AND write an audit record with reason.
- Return 404 (not 403) for objects a user must not know exist when appropriate.
- Frontend hides actions via the permissions list but it is cosmetic only.

## Test matrix (auto-generate)
For each endpoint: no token, wrong role, right role wrong owner, deactivated user, valid. Include an explicit IDOR test (swap customer ID in URL).
