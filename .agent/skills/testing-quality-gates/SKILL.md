---
name: testing-quality-gates
description: Use when writing tests or deciding if a feature is done: unit, DB integration, API, security, WhatsApp adapter and E2E per the PRD test strategy.
---

# Testing & quality gates

- Unit (Jest): query compiler, validators, money math, state-transition tables, warranty date logic.
- DB integration (Jest + dedicated test Postgres, migrations applied from empty): repositories, constraints, transactions, row locks.
- API (Supertest): auth, RBAC matrix, workflows, error shapes.
- WhatsApp adapter: mock provider; duplicate inbound, retry, out-of-order status.
- File security & injection suites as in the PRD section 17.1 (12 mandatory negative scenarios - implement all).
- E2E (Playwright): lead -> survey -> quotation -> order -> dispatch -> install -> warranty; ticket lifecycle; role-based UI visibility.
- A feature is **done** only if: success + failure tests pass, migration applies from empty and previous release, audit rows exist for sensitive actions, no new lint/audit criticals, docs updated.
- Concurrency tests use real parallel connections, not mocks.
- Deterministic seeds and factories; no shared mutable test state; tests clean up.
