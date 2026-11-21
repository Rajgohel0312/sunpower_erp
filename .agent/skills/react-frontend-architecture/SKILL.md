---
name: react-frontend-architecture
description: Use when building or changing React/Vite/Tailwind code in the client: features, routing, state, forms, tables, API client, dashboards, technician mobile views.
---

# Frontend architecture (React + Vite + JS + Tailwind)

## Structure
`client/src/{app,components,layouts,features/<module>,services,hooks,utils,routes}`. One folder per feature with its own `api.js`, components, hooks, schemas, pages. Shared UI primitives in `components/ui`.

## Rules
- React Router with protected layouts; route guards = UX only.
- One API client (`services/apiClient.js`): base URL from env, attaches in-memory access token, sends `credentials: 'include'`, adds request ID, single-flight token refresh on 401, normalizes errors to the API error shape, handles 429/network errors.
- Server state via a data-fetching cache library (TanStack Query is a good fit; confirm with the owner) with query-key conventions per feature; client state stays local/small (context or Zustand only if needed).
- Forms: React Hook Form + Zod (mirror backend schemas; backend is authoritative). Field-level server errors displayed.
- Tables: server pagination, filtering, sorting, URL-synced filters, column visibility, CSV export via async job.
- Every screen explicitly renders loading, empty, error and success states. Error boundary per route.
- Permissions: `usePermission('module.resource.action')` hides actions; never the only guard.
- Confirm dialogs for dispatch, stock adjustment, payment verification, approvals, irreversible transitions.
- Technician views: mobile-first, large tap targets, offline-tolerant drafts for evidence uploads (no sensitive data in persistent storage).
- Code-split per feature (`React.lazy`); keep bundle budget.
- Accessibility: semantic HTML, labels, focus management in modals, keyboard navigation, WCAG AA contrast.
- Pair with the `frontend-design` skill for visual quality and with `frontend-security` below.
