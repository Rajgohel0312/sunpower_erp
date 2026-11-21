---
name: frontend-security
description: Use for any frontend code that renders user content, handles tokens, uploads files, uses cookies, or configures CSP/CORS/Vite env.
---

# Frontend security

- No `dangerouslySetInnerHTML` with user/WhatsApp/customer content. If rich text is unavoidable, sanitize with DOMPurify and allowlist tags.
- WhatsApp messages, names, notes, filenames are untrusted: render as text, linkify safely (`rel="noopener noreferrer"`, only http/https/tel/mailto).
- Tokens: access token in memory only; refresh token is HttpOnly cookie. Never in localStorage/sessionStorage/URL/console.
- Send CSRF header on mutations; never disable credentials checks to "make CORS work".
- Vite env: only `VITE_*` public values; no secrets in the client bundle. Disable source maps in production builds or restrict them.
- CSP (set by server via Helmet, tested against the Vite build): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' (only if Tailwind needs it); img-src 'self' data: blob:; connect-src 'self' <api origin>; frame-ancestors 'none'; object-src 'none'`.
- Downloads and image previews use authenticated blob fetches, not public URLs.
- Validate files client-side for UX (type/size) but treat server validation as the real control.
- Avoid leaking PII in analytics, error reporters, or URLs. Mask sensitive fields (phone partially) where full value is unnecessary.
- Session expiry UX: clear in-memory state and redirect on refresh failure; clear caches on logout.
- Keep dependencies minimal and pinned; run `npm audit` in CI.
