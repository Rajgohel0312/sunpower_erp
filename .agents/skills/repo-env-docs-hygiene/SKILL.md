---
name: repo-env-docs-hygiene
description: Use when setting up the repo, environment variables, scripts, README, git hygiene, linting, or CI for SunPower ERP.
---

# Repo, env & docs hygiene

- Monorepo: `client/`, `server/`, `docs/`, ignored `storage/`. Root scripts to run API, gateway, client, migrations, seeds, tests.
- `.gitignore`: `.env*` (except `.env.example`), `storage/`, WhatsApp auth/session dir, `node_modules`, coverage, logs.
- Config module validates env with Zod at startup; fail fast on missing or weak secrets (min length, not default values).
- ESLint (+ security plugin), Prettier, Husky pre-commit (lint, tests changed), `npm audit` in CI.
- Conventional commits; small PRs per vertical slice.
- Keep `docs/decisions.md` (ADR-lite) for open items: tax/subsidy rules, valuation method, warranty starts, email provider, official WhatsApp API migration.
- README: prerequisites, env table, DB role creation, migrate/seed, running 3 processes, test commands, backup/restore.
- Structured JSON logs (pino) with request ID and redaction paths configured.
