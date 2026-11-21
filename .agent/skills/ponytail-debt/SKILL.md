---
name: ponytail-debt
description: >-
  Scan the codebase for `shortcut:` / `ponytail:` comments and compile a technical debt ledger so deferred items are tracked and not forgotten.
license: MIT
---

# Ponytail Debt Ledger

Harvest and track intentional pragmatic shortcuts taken during development, preventing "later" from becoming "never".

---

## How It Works

1. **Scan Target**:
   - Searches repository files (excluding `node_modules`, `.git`, build outputs) for comments matching:
     - `// shortcut: ...` or `/* shortcut: ... */`
     - `# shortcut: ...`
     - `// ponytail: ...` or `/* ponytail: ... */`
2. **Parse Entries**:
   - Extracts:
     - **File & Line**: Exact path and line number.
     - **Constraint / Limit**: What boundary was simplified (e.g. `in-memory cache capped at 1000 items`, `no pagination on lead notes`).
     - **Revisit Trigger**: When this shortcut must be revisited (e.g. `when users exceed 500`, `before multi-tenant launch`).
3. **Generate Debt Ledger**:
   - Compiles a structured markdown table.
   - Categorizes entries by module / area (Auth, Inventory, Billing, Quotations, Background Jobs).
   - Flags any shortcut whose threshold or trigger condition has been met.
