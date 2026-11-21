---
name: auth-session-security
description: Use when implementing login, logout, token refresh, password reset, password change, user activation, or any session/cookie handling.
---

# Authentication & sessions

- Passwords: bcrypt, cost benchmarked on the target machine (target ~250 ms), min length + breached/common password check. Never log or return hashes.
- Access token: short-lived JWT (5-15 min), minimal claims (`sub`, `jti`, roles version). Never trust role/customerId from the client.
- Refresh token: random 256-bit, stored **hashed** in DB, rotated on every use, reuse detection revokes the whole family, revoked on logout / password change / reset / deactivation.
- Browser storage: refresh token in `HttpOnly; Secure; SameSite=Strict|Lax` cookie scoped to the refresh path. Access token kept in memory only. **Nothing sensitive in localStorage/sessionStorage.**
- CSRF: because a cookie is used, require a CSRF token or custom header + strict Origin check on all cookie-authenticated mutations.
- Rate limits: login, forgot-password, reset, refresh; plus per-account lockout/backoff with generic errors.
- Reset flow: crypto-random token, stored hashed, single use, ~15-30 min expiry, same response whether or not the email exists, invalidates all sessions after reset.
- Disabled users cannot authenticate, and existing tokens stop working (check `is_active` on refresh and on sensitive calls).
- Record login history (time, IP, user agent, success/failure) for security events.
- Customer portal accounts are a separate principal type with their own scope.
- Internal service identity for the Baileys gateway: separate secret/token, not a user session, minimal permissions, rotate-able.

## Tests
Expired/forged/`alg:none` token, refresh reuse, deactivated user, brute-force limit, enumeration via timing/response, CSRF without header.
