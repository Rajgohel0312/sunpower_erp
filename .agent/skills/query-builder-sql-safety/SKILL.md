---
name: query-builder-sql-safety
description: Use when writing or modifying the custom PostgreSQL query builder, migration runner, or any code that builds SQL. No ORM and no Prisma are allowed in this project.
---

# Custom query builder & SQL safety

## Non-negotiables
- Values are ALWAYS parameters (`$1, $2 ...`) via `pg`. Never string-concatenate a value.
- Identifiers (table, column, sort field, operator, direction) come from strict **allowlists** defined per repository. Unknown -> reject with a validation error.
- No user-supplied raw SQL, ever. No `raw()` escape hatch exposed to controllers.
- Quote identifiers through one helper; reject anything not matching `^[a-z_][a-z0-9_]*$`.
- Database errors are mapped to generic API errors; never leak SQL, constraint names or stack traces.

## Required capabilities
select / insert / update / delete, where groups (AND/OR), IN, LIKE (escape `%` `_`), null checks, joins (allowlisted), order, limit/offset + keyset pagination, count, returning, upsert, `FOR UPDATE` / `SKIP LOCKED`, transactions with rollback on any throw, soft-delete awareness.

## Structure
`database/query-builder/`: `builder` (fluent API) -> `compiler` (pure function: AST -> `{text, values}`) -> `executor` (pool/client). Keep the compiler pure so it is trivially unit-testable.

## Transaction helper
`withTransaction(async (trx) => {...})`: BEGIN, run, COMMIT; on error ROLLBACK and rethrow; always release the client in `finally`. Repositories accept an optional `trx`.

## Tests to write first (before any business module)
- Injection payloads in value, column, sort, operator and LIKE inputs (`'; DROP TABLE users;--`, `1 OR 1=1`, unicode quotes).
- Placeholder numbering with nested groups and IN lists; empty IN list behaviour.
- Rollback on failure mid-transaction; connection released.
- Row-lock behaviour with two concurrent transactions (DB integration test).

## DB roles
Runtime role = least privilege (no DDL, no superuser, no DELETE on audit tables). Migrations use a separate credential.
