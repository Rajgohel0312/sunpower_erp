---
name: secure-file-storage
description: Use when handling uploads, downloads, generated PDFs, survey/installation photos, customer documents or anything stored on the local filesystem.
---

# Local file storage (private)

- Store under `/storage` **outside** any static/public directory; folder is git-ignored.
- Opaque server-generated names (UUID + safe extension). Original filename is metadata only (sanitized on display).
- Validate: extension allowlist, MIME allowlist, **magic-byte signature check**, per-file and per-request size limits, max files per request. Reject executables/scripts/SVG-with-script/HTML.
- Never build paths from user input. Resolve and assert the final path stays inside the storage root (`path.resolve` + prefix check); reject `..`, `/`, `\`, null bytes.
- Metadata table: id, owner entity, uploader, mime, size, sha256, storage key, created_at.
- Every download goes through an authenticated endpoint that runs the entity policy first. Set `Content-Disposition`, `X-Content-Type-Options: nosniff`, correct `Content-Type`.
- Strip EXIF GPS from customer-facing images unless needed for evidence; keep evidence originals access-controlled.
- Rate-limit uploads. Plan for malware scanning before production.
- Write storage behind an interface (`put/get/delete/stream`) so cloud storage can replace it later without touching modules.

## Tests
Spoofed MIME, double extension, `../../etc/passwd` filename, oversize, cross-customer download, download after permission removal.
