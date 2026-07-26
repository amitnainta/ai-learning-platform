# AI Learning Platform

A free, curated AI/ML learning platform: guided learning paths built from
curated third-party content, with placement, progress tracking, ratings, and
certificates. This repository is the R1 scaffolding/infrastructure foundation
— no product features exist yet; see `docs/requirements/` for the full
requirements package and `factory/work/` for in-flight work items.

## Stack

- **Framework**: Next.js (App Router), React, TypeScript — a full-stack
  monolith. Next.js serves both the frontend (SSR/SSG pages) and the backend
  (API routes / route handlers) from one deployable.
- **Database**: PostgreSQL via Prisma ORM.
- **Hosting**: Vercel. **Database**: Neon (serverless Postgres). **Blob
  storage**: Vercel Blob. **Error tracking**: Sentry. **Uptime monitoring**: an
  external monitor (Better Stack / UptimeRobot) polling `/api/health`.

  See `docs/architecture/infrastructure.md` for the full decision record and
  rationale behind each of these choices.

## Prerequisites

- Node.js >= 20 (see `engines` in `package.json`)
- npm (ships with Node)
- A Postgres database to develop against — either a local Postgres instance or
  a Neon project (see `docs/runbooks/provisioning-checklist.md` for creating
  one)

## Local setup

```bash
# 1. Install dependencies (this also runs `prisma generate` via postinstall)
npm ci

# 2. Configure environment variables
cp .env.example .env.local
# then edit .env.local and fill in real values:
#   DATABASE_URL   — pooled Postgres connection string
#   DIRECT_URL     — direct (unpooled) Postgres connection string, used by Prisma Migrate
#   SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN — optional locally; Sentry no-ops when unset
#   APP_URL        — defaults to http://localhost:3000

# 3. Apply the (stub) Prisma schema to your database
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

The app serves at http://localhost:3000. The current home page and layout are
placeholders (`src/app/page.tsx`, `src/app/layout.tsx`) proving the scaffold
renders; real product UI arrives with later feature work items.

`GET /api/health` returns `{ "status": "ok" }` — this is the target for the
external uptime monitor and for CI/deploy smoke checks.

## Commands

| Command                   | What it does                                                            |
| ------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`             | Start the Next.js dev server                                            |
| `npm run build`           | Production build (also type-checks)                                     |
| `npm run start`           | Start the production server (after `build`)                             |
| `npm run lint`            | ESLint (`eslint-config-next` + `typescript-eslint`)                     |
| `npm run format`          | Prettier — write formatting fixes                                       |
| `npm run format:check`    | Prettier — check only, no writes (used in CI indirectly via lint/build) |
| `npm run test`            | Unit/component tests (Vitest + React Testing Library)                   |
| `npm run test:watch`      | Vitest in watch mode                                                    |
| `npm run test:e2e`        | End-to-end smoke tests (Playwright) — builds and boots the app first    |
| `npm run prisma:generate` | Regenerate the Prisma client from `prisma/schema.prisma`                |
| `npm run prisma:migrate`  | Create/apply a dev migration (`prisma migrate dev`)                     |
| `npm run prisma:deploy`   | Apply pending migrations in a non-interactive/production context        |
| `npm run prisma:studio`   | Open Prisma Studio (a GUI for the database)                             |

## Environment variables

See `.env.example` for the full list with descriptions. `src/lib/env.ts`
validates these with `zod` the first time a caller actually needs them (e.g.
the Prisma client) and throws a clear, aggregated error listing everything
missing/invalid — so a misconfigured environment fails fast with an actionable
message rather than a cryptic error deep in a request.

## Testing

- **Unit/component** (`npm run test`): Vitest + React Testing Library, jsdom
  environment. Setup file: `src/test/setup.ts`. Sample:
  `src/app/__tests__/home.test.tsx`.
- **End-to-end** (`npm run test:e2e`): Playwright, one `chromium` project.
  `playwright.config.ts`'s `webServer` builds and starts the app automatically
  (`npm run build && npm run start`) before running tests, and reuses an
  already-running dev server locally if `reuseExistingServer` conditions are
  met. Sample: `e2e/smoke.spec.ts` (home page renders; `/api/health` returns
  200). Per NFR-MAINT-004, later feature work items add the mandated core
  user-journey e2e coverage (registration, placement, course completion,
  rating, certificate issuance) on top of this harness.

## CI

`.github/workflows/ci.yml` runs on every PR/push to `main`: install, lint, unit
test, build, and a production-dependency vulnerability audit
(`npm audit --omit=dev --audit-level=high`; see the inline comment in that
workflow for why it's scoped to production dependencies). A separate,
non-blocking job runs the Playwright e2e smoke test — kept optional at R1 to
keep the required-checks path fast; promote it to required once real e2e
journeys land with feature work.

## Deploy flow

1. Push to a feature branch and open a PR against `main` — Vercel creates an
   automatic preview deployment per PR (once the Vercel project is
   provisioned; see `docs/runbooks/provisioning-checklist.md`), and CI runs
   lint/test/build/audit.
2. On merge to `main`, Vercel deploys to production automatically.
3. Environment variables/secrets are configured once in the Vercel dashboard
   (Project Settings → Environment Variables) — not committed to the repo.
   `.env.example` documents every variable's shape with placeholder values
   only.
4. Database schema changes ship via `npx prisma migrate deploy` against the
   production `DATABASE_URL`/`DIRECT_URL` (wire this into the deploy pipeline
   once real migrations exist beyond the current stub model).

No deployment has happened yet — provisioning the actual Vercel/Neon/Sentry/
uptime-monitor accounts is tracked as an explicit manual checklist in
`docs/runbooks/provisioning-checklist.md` and has not been assumed done.

## Architecture and operations docs

- `docs/architecture/infrastructure.md` — the infrastructure decision record
  (hosting/CDN, database, blob storage, observability, HTTPS enforcement, and
  how each maps onto the relevant NFRs).
- `docs/architecture/disaster-recovery.md` — DR process, failure scenarios, and
  explicit RTO/RPO targets.
- `docs/runbooks/backup-and-restore.md` — backup schedule and the step-by-step
  restore procedure.
- `docs/runbooks/provisioning-checklist.md` — the manual, one-time human
  provisioning steps (accounts, secrets, monitors) that this repo's code does
  not and cannot perform on its own.
- `docs/requirements/` — the full requirements package this platform is built
  against.

## Project structure

```
src/
  app/                 # Next.js App Router routes
    api/health/        # GET /api/health — uptime monitor + CI smoke target
    __tests__/         # Vitest + RTL component tests
    layout.tsx          # Root layout (placeholder)
    page.tsx             # Home page (placeholder)
  lib/
    env.ts               # zod-validated environment accessor
    prisma.ts            # hot-reload/serverless-safe Prisma client singleton
  instrumentation.ts     # Next.js instrumentation hook — loads Sentry per runtime
  test/setup.ts          # Vitest + jest-dom setup
prisma/
  schema.prisma          # stub datasource + one trivial model (toolchain proof only)
e2e/
  smoke.spec.ts          # Playwright smoke test
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts     # per-runtime Sentry init (no-op without a DSN)
docs/
  architecture/           # decision records
  runbooks/               # operational procedures
  requirements/           # product requirements package
```
