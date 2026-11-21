# SunPower ERP: always-on rules

Stack: React + Vite + JavaScript + Tailwind (client), Node + Express + JavaScript ES modules (server), PostgreSQL via Prisma ORM (`@prisma/client`). NO TypeScript, NO Docker for now.

1. Read the PRD (docs/SunPower_ERP_Full_PRD_LLD.docx) section for the module before coding; confirm table columns and API schemas first.
2. Build one vertical slice at a time, in PRD roadmap order. Prisma schema + migrations first.
3. Layering: route -> controller -> service -> repository -> Prisma client. Business rules only in services.
4. Web and WhatsApp call the same domain services. WhatsApp text is never authorization.
5. Backend enforces permissions (deny by default) plus ownership checks. Frontend guards are cosmetic.
6. Parameterized SQL only; identifiers/operators from allowlists; no raw SQL from input.
7. Validate every external input with Zod. Never return raw DB rows.
8. Money never as floats. Confirmed documents keep price/tax/BOM/warranty snapshots.
9. Multi-step changes use a transaction; important events use the outbox. Jobs must be idempotent.
10. Never store tokens in localStorage; never log secrets, tokens, OTPs or PII.
11. Every feature ships with success and failure tests. Do not mark done without them.
12. Never commit .env, storage/, or WhatsApp session files.
13. If a requirement is ambiguous or marked as an open decision in the PRD (tax, subsidy, valuation, warranty start), ask instead of guessing.
14. Git commits: Always ask for explicit user approval before executing any git commit.

---

## Ponytail: The Lazy Senior Dev Rule
"The best code is the code you never wrote."

- **The 7-Rung Decision Ladder** (Climb down, stop at the first that holds):
  1. **Need? (YAGNI)**: Skip premature abstractions and speculative code.
  2. **Exist?**: Reuse existing helpers, services, components, or patterns in this codebase.
  3. **Stdlib?**: Use JavaScript/Node built-in standard libraries.
  4. **Platform?**: Use native browser/DOM or platform features (e.g. `<input type="date">`).
  5. **Installed Dependency?**: Use already installed packages; avoid new dependencies.
  6. **One-Liner?**: Keep logic concise and readable.
  7. **Minimum Viable Code**: Write the absolute minimum code required to solve the task.
- **Lazy about the solution, never about reading**: Inspect callers and trace actual data flow first.
- **Hard Boundaries**: Input validation, data integrity/transactions, security, and accessibility are NEVER cut.
- **Tests**: Any branch, loop, parser, money arithmetic, or security check must leave a test behind.
- **Shortcut Tracking**: Mark deliberate simplifications with `// shortcut: <limit>, <when to revisit>`.
