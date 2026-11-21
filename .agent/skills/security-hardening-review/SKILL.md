---
name: security-hardening-review
description: Use before merging features or at phase exit: runs a structured security review against the SunPower ERP threat list and OWASP Top 10.
---

# Security hardening & review checklist

Run this on every PR touching auth, money, files, inventory, WhatsApp or SQL.

1. **Access control**: every route has permission + policy; IDOR test exists.
2. **Injection**: no concatenated SQL; sort/filter allowlists; no `eval`/`child_process` with user input; NoSQL-style operator injection in JSON bodies rejected by Zod.
3. **Auth**: tokens, cookies, CSRF, rate limits, reset flow as per `auth-session-security`.
4. **Sensitive data**: logs redacted (passwords, tokens, OTP, full documents); PII minimized in responses.
5. **Headers/CORS**: Helmet, explicit CORS origins (no `*` with credentials), HTTPS and HSTS outside localhost, `trust proxy` set correctly.
6. **Uploads**: per `secure-file-storage`.
7. **Rate limits & DoS**: body size limits, pagination caps, regex-safe search, timeouts, request concurrency on exports.
8. **Secrets**: `.env` ignored, `.env.example` safe, WhatsApp session dir ignored, startup fails fast on missing/weak secrets.
9. **Dependencies**: `npm audit`, lockfile committed, no abandoned packages, review Baileys updates.
10. **Business abuse**: replayed webhooks/payments, double submit, negative quantities/amounts, status skipping, mass assignment.
11. **Audit**: sensitive actions produce audit rows.
12. **Backups**: documented, tested restore of DB + storage + WhatsApp session policy.

Output a short report: finding, severity, file/line, fix. Block merge on any critical/high.
