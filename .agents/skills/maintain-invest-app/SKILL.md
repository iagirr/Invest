---
name: maintain-invest-app
description: Maintain and extend this local portfolio tracker built with Next.js 16, React, TypeScript, SQLite, and Yahoo Finance. Use when changing dashboard UI, App Router pages, API routes under src/app/api, portfolio calculations in src/lib, SQLite schema and persistence, market refresh/export/backup flows, or any behavior tied to the initial snapshot plus future flows model.
---

# Maintain Invest App

## Start here

- Read `AGENTS.md`.
- Read the relevant guide in `node_modules/next/dist/docs/` before editing Next.js code. Treat framework assumptions from older Next versions as untrusted until checked.
- Read `README.md` to recover the product model and the intended user workflow.
- Inspect the affected modules before adding abstractions. Reuse local patterns first.

## Keep the repo shape

- Put pages and route handlers in `src/app` and `src/app/api`.
- Put reusable UI in `src/components`.
- Put portfolio calculations, persistence, market integration, and export logic in `src/lib`.
- Put operational CLI tasks in `scripts`.
- Reuse the Zod schemas in `src/lib/schemas.ts` for request validation instead of re-validating ad hoc inside routes.

## Preserve the domain model

- Treat the tracked instrument record as the initial portfolio snapshot, not as a full broker ledger.
- Treat contribution and withdrawal flows as real events recorded after that snapshot.
- Keep active and closed instruments coherent with `isActive`, `endDate`, and refresh behavior.
- Preserve the relationship between `basis_amount_eur`, `estimated_contributions_eur`, `inferred_units`, market value fields, and dashboard metrics when changing calculations.
- Keep market refresh explicit and user-triggered unless the user explicitly asks for automation.
- Keep backup and export behavior explicit operations, not side effects of unrelated requests.

## Read these files for common changes

- For dashboard or performance changes: `src/lib/portfolio.ts`, `src/components/dashboard-shell.tsx`, `src/components/dashboard-charts.tsx`, `src/app/page.tsx`.
- For API or payload changes: `src/lib/schemas.ts` and the corresponding route in `src/app/api/*/route.ts`.
- For database or persistence changes: `src/lib/db.ts`, then every caller touched by the schema change.
- For market refresh behavior: `src/lib/market.ts`, `src/app/api/refresh-market/route.ts`, `scripts/refresh-market.ts`.
- For export and backup behavior: `src/lib/export.ts`, `src/app/api/export/route.ts`, `src/app/api/backup/route.ts`, `scripts/backup-db.ts`.

## Work rules

- Prefer narrow edits that match the existing module boundaries.
- Do not invent a separate data layer when `src/lib/*` already owns the behavior.
- Keep input and output naming consistent with the existing English code identifiers and current API shapes.
- Respect local persistence assumptions: the app is personal, local-first, and backed by SQLite in `data/portfolio.db`.

## Validate before finishing

- Run `npm run lint` after code changes.
- If changing calculations or persistence, exercise the affected route, script, or UI flow and confirm the dashboard still computes coherently.
- If changing the database shape in `src/lib/db.ts`, verify bootstrap and migration behavior against an existing local database.
- If changing market code, verify both manual refresh and downstream dashboard updates.
