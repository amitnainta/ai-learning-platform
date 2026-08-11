# AI Learning Platform

A free, curated AI/ML learning platform: guided learning paths built from
curated third-party content, with placement, progress tracking, ratings, and
certificates. See `docs/requirements/` for the full requirements package and
`factory/work/` for in-flight work items.

Account and auth (registration, login/logout, password reset, role/level
profile, data export/delete) is the first real product feature — see
`docs/architecture/auth.md` for the decision record. Learning paths, courses,
lessons, curated links, and the glossary are the second — see
`docs/architecture/content.md` and `docs/content/authoring-guide.md`. Progress
tracking (per-item completion status, resuming a path or course from where a
learner left off, and a real dashboard showing percent complete per path and
course) is the third — see `docs/architecture/progress.md`. A signed-in
learner sees their status on every item (not started / in progress /
complete), marks lessons and curated resources complete from the lesson page
or the item card, and gets a resume link back to the first unfinished item;
progress on a shared item is retained automatically when switching between
paths that both include it (FR-PATH-009).

Ratings and feedback are the fourth — see `docs/architecture/ratings.md`. A
signed-in learner who has **started** a course, or **completed** a path
(100%, per progress tracking), can leave a 1-5 star rating and optional
free-text feedback; every course and path page shows the average rating and
count (average, `count` — "Not yet rated" at zero), and each published
feedback entry is shown publicly with the author's display name, role, and
level. Any signed-in user can flag someone else's feedback with a reason;
flags never auto-hide anything — they're actioned by a maintainer via
`npm run moderation:queue` and `scripts/moderation.ts` (`hide`/`unhide`/
`dismiss`) — see `docs/runbooks/content-moderation.md`.

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
#   DATABASE_URL           — pooled Postgres connection string
#   DIRECT_URL             — direct (unpooled) Postgres connection string, used by Prisma Migrate
#   SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN — optional locally; Sentry no-ops when unset
#   APP_URL                — defaults to http://localhost:3030 (see ../ports.md
#                            for this machine's local port assignments)
#   BETTER_AUTH_SECRET     — required, min 32 chars; generate with `openssl rand -base64 32`
#   BETTER_AUTH_URL        — optional; defaults to APP_URL
#   RESEND_API_KEY         — optional locally; mail falls back to the console transport when unset
#   EMAIL_FROM             — optional; defaults to no-reply@localhost
#   MAIL_TRANSPORT         — optional override: "resend" | "console" | "file"

# 3. Apply the Prisma schema (auth + content tables) to your database
npx prisma migrate dev

# 4. Load the content pack (paths, courses, lessons, glossary) into your database
npm run content:check    # validates content/**, writes nothing
npm run content:import   # applies it — idempotent, safe to re-run

# 5. Start the dev server
npm run dev
```

The app serves at http://localhost:3030. `/` is a public landing page; `/paths`,
`/paths/[role]`, `/paths/[role]/[level]`, `/courses/[slug]`, `/lessons/[slug]`,
`/glossary`, and `/glossary/[slug]` are the public content surface (readable
with no session — FR-ACC-008; skipping step 4 above just means those pages
render with nothing in them, not an error); `/sign-up`, `/sign-in`,
`/forgot-password`, and `/reset-password` are the auth screens; `/dashboard`,
`/onboarding`, and `/account` require a session (enforced server-side by
`requireUser()`/`requireOnboardedUser()`, `src/lib/auth/session.ts` —
`src/middleware.ts` is only a cookie-presence UX fast path, not the real
gate). See `docs/architecture/auth.md` and `docs/architecture/content.md` for
the full decision records.

`GET /api/health` returns `{ "status": "ok" }` — this is the target for the
external uptime monitor and for CI/deploy smoke checks.

### Local mail (password reset, verification, account deletion)

Without `RESEND_API_KEY` set, transactional email uses the **console**
transport by default: the recipient, subject, and body (including the
action link) are logged to the terminal running `npm run dev`. Set
`MAIL_TRANSPORT=file` in `.env.local` to instead write each message as JSON
to a gitignored `.mail-outbox/` directory — this is what the Playwright e2e
suite uses to read a real password-reset link without a mail provider (see
`e2e/helpers/mail.ts`). See `src/lib/mail/mailer.ts` for the transport
selection logic and `docs/architecture/auth.md` §5.

## Commands

| Command                    | What it does                                                                      |
| -------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`              | Start the Next.js dev server                                                      |
| `npm run build`            | Production build (also type-checks)                                               |
| `npm run start`            | Start the production server (after `build`)                                       |
| `npm run lint`             | ESLint (`eslint-config-next` + `typescript-eslint`)                               |
| `npm run format`           | Prettier — write formatting fixes                                                 |
| `npm run format:check`     | Prettier — check only, no writes (used in CI indirectly via lint/build)           |
| `npm run test`             | Unit/component tests (Vitest + React Testing Library)                             |
| `npm run test:watch`       | Vitest in watch mode                                                              |
| `npm run test:e2e`         | End-to-end tests (Playwright) — builds and boots the app first                    |
| `npm run test:e2e:ui`      | End-to-end tests in Playwright's interactive UI mode                              |
| `npm run prisma:generate`  | Regenerate the Prisma client from `prisma/schema.prisma`                          |
| `npm run prisma:migrate`   | Create/apply a dev migration (`prisma migrate dev`)                               |
| `npm run prisma:deploy`    | Apply pending migrations in a non-interactive/production context                  |
| `npm run prisma:studio`    | Open Prisma Studio (a GUI for the database)                                       |
| `npm run content:check`    | Validate `content/**` against the pack schemas — writes nothing                   |
| `npm run content:import`   | Validate and import `content/**` into the database — idempotent                   |
| `npm run moderation:queue` | List unresolved rating/feedback flags (see `docs/runbooks/content-moderation.md`) |

## Environment variables

See `.env.example` for the full list with descriptions. `src/lib/env.ts`'s
`getEnv()` validates `DATABASE_URL`/`DIRECT_URL`/`APP_URL` with `zod` and
throws a clear, aggregated error listing everything missing/invalid.
`src/lib/prisma.ts` calls `getEnv()` before constructing the Prisma client
singleton, so a misconfigured environment fails fast with an actionable
message the first time anything imports that module, rather than surfacing
later as a cryptic Prisma connection error.

## Testing

- **Unit/component** (`npm run test`): Vitest + React Testing Library, jsdom
  environment (Node environment for a few DB/native-module-adjacent files via
  a `// @vitest-environment node` docblock — e.g.
  `src/lib/auth/__tests__/password.test.ts`). Setup file: `src/test/setup.ts`.
  Covers validation schemas, argon2 password hashing, the Better Auth options
  object, the mail transport, and the sign-up/delete-account forms, plus (for
  the content system) the pack Zod schemas, frontmatter parsing, the loader's
  cross-file validation (fixture packs under
  `src/lib/content/__tests__/fixtures/`), content hashing, the pure
  create/update/unchanged/retire import planner, and the Markdown/glossary/
  item-card/lesson-video/path-switcher components — none of these touch a
  database. Progress tracking adds `src/lib/progress/percent.ts`'s pure
  course/path percentage and resume-target computation (a 50-item/8-course
  fixture proves the NFR-PERF-006 shape), mocked-Prisma tests for the
  mutation and dashboard-query modules (the latter asserting a _fixed_ Prisma
  call count), the `POST /api/progress` route, and the
  ProgressBar/ProgressStatusBadge/ProgressControl/ResumeCard components —
  also none of these touch a database.

- **End-to-end** (`npm run test:e2e`): Playwright, one `chromium` project,
  against a **real local Postgres** (the account/auth journeys create,
  authenticate, and delete real rows — there's no mocking at this layer).
  1. Point `DATABASE_URL`/`DIRECT_URL` in `.env.local` at a local Postgres
     instance (or a scratch Neon branch) and run `npx prisma migrate dev` so
     the schema exists.
  2. Install the browser binary once per machine:
     `npx playwright install --with-deps chromium` (CI's `e2e` job does this
     automatically every run — it is not a global one-time install, so run it
     again locally if Playwright reports a missing browser after an update).
  3. `npm run test:e2e`. `playwright.config.ts` loads `.env.local` via
     `dotenv`, then builds and starts the app (`npm run build && npm run start`)
     with `MAIL_TRANSPORT=file` and an e2e-only rate-limit override
     (`E2E_DISABLE_RATE_LIMIT=true` — see `docs/architecture/auth.md` §4;
     never set in a deployed environment) forced into the server's env, and
     reuses an already-running dev server locally if `reuseExistingServer`
     conditions are met.

  Specs: `e2e/smoke.spec.ts` (harness proof), `e2e/auth-registration.spec.ts`,
  `e2e/auth-login-logout.spec.ts`, `e2e/auth-password-reset.spec.ts`,
  `e2e/account-profile.spec.ts`, `e2e/account-data.spec.ts` — covering
  registration + placement self-select, login/logout + route protection,
  password reset (via a real emailed link read from `.mail-outbox/`), profile
  changes, and data export/deletion (NFR-MAINT-004's mandated core journeys,
  for the auth/account surface). `e2e/helpers/db.ts` generates unique
  `@e2e.test` emails per test run and a `globalTeardown` (registered in
  `playwright.config.ts`) removes every user it created afterward, so the
  suite is safe to re-run against a shared dev database — it only ever
  touches rows it created itself.

  Content journeys: `e2e/content-paths.spec.ts`, `e2e/content-lesson.spec.ts`,
  `e2e/content-glossary.spec.ts`, `e2e/content-path-switch.spec.ts` — anonymous
  browsing of the path/course/lesson/glossary hierarchy, curated-link
  attribution, and a signed-in role/level switch. `e2e/global-setup.ts`
  (registered as `globalSetup`) imports `content/**` before the suite runs,
  so these specs are self-seeding — no manual `content:import` step needed
  before `npm run test:e2e`. It's idempotent, so it's a no-op against an
  already-seeded shared dev database. The global teardown stays user-scoped
  only — it never deletes content rows.

  Progress journeys: `e2e/progress-complete.spec.ts` (not-started -> auto-
  in-progress -> complete -> persisted -> reopened, for both an original
  lesson and a curated item, plus the anonymous no-controls/no-write case),
  `e2e/progress-resume.spec.ts` (resume advances item by item then course by
  course, ending in the path-complete state), and
  `e2e/progress-dashboard.spec.ts` (exact dashboard percentages, plus
  FR-PATH-009: a shared item stays complete across a role/level switch and
  the previously-followed path is retained on the dashboard).
  `e2e/helpers/db.ts`'s `findProgressForEmail()` asserts on rows the UI
  doesn't expose; `cleanupTestUsers()` needs no change since
  `Progress.userId` cascades.

## CI

`.github/workflows/ci.yml` runs on every PR/push to `main`:

- **`build-and-test`** — install, lint, unit test, build, and a
  production-dependency vulnerability audit
  (`npm audit --omit=dev --audit-level=high`; see the inline comment in that
  workflow for why it's scoped to production dependencies). Uses placeholder
  `DATABASE_URL`/`DIRECT_URL`/`BETTER_AUTH_SECRET` values — no live database
  is needed for lint/unit-test/build.
- **`e2e`** — a blocking job (per NFR-MAINT-004) that spins up a `postgres:16`
  service container, runs `npx prisma migrate deploy` against it, then runs
  the full Playwright suite described above with `MAIL_TRANSPORT=file`.

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
   production `DATABASE_URL`/`DIRECT_URL` — this is currently a manual step
   (see `docs/runbooks/provisioning-checklist.md`); wiring it into the Vercel
   build command is a documented follow-up.

No deployment has happened yet — provisioning the actual Vercel/Neon/Sentry/
uptime-monitor accounts is tracked as an explicit manual checklist in
`docs/runbooks/provisioning-checklist.md` and has not been assumed done.

## Architecture and operations docs

- `docs/architecture/infrastructure.md` — the infrastructure decision record
  (hosting/CDN, database, blob storage, observability, HTTPS enforcement, and
  how each maps onto the relevant NFRs).
- `docs/architecture/auth.md` — the auth decision record (Better Auth,
  database sessions, argon2id, rate limiting, transactional email, email
  verification, onboarding, minimum-age acknowledgment, account deletion) and
  its NFR-SEC-001/003/005 mapping.
- `docs/architecture/content.md` — the content decision record (the
  file-pack + importer architecture, retire-not-delete, the Markdown
  rendering pipeline, video, the Path/Course/ContentItem hierarchy, the
  progress/rating attachment points the next work items inherit, review
  cadence, version history, dynamic rendering, and the sample-content
  notice) and its NFR mapping.
- `docs/architecture/progress.md` — the progress-tracking decision record
  (the `Progress` model, the observed-vs-asserted completion rule, the
  client-beacon auto-"in progress" mechanism, read-time percentages and
  resume-target selection, and the FR-PATH-009 retention verification) and
  its FR/NFR mapping.
- `docs/architecture/ratings.md` — the ratings-and-feedback decision record
  (the `Rating`/`RatingFlag` model and its hand-written CHECK constraints,
  the FR-RATE-008 eligibility gate shared by the UI and the API, read-time
  aggregates, the NFR-SEC-007 sanitize-in/escape-out design, and the
  moderation CLI) and its FR/NFR mapping.
- `docs/runbooks/content-moderation.md` — how a flagged rating reaches the
  maintainer and what `npm run moderation:queue` / `scripts/moderation.ts`
  can do about it.
- `docs/content/authoring-guide.md` — how to add/edit/retire content and get
  it live, field by field, including the `glossary:` link convention, the
  plain-language rules for zero-knowledge lessons, and the "never rename a
  published item's slug" rule progress tracking and ratings both depend on.
- `docs/content/taxonomy.md` — the human-readable tagging taxonomy (roles,
  levels, topics, formats, source types); must match `content/taxonomy.yaml`.
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
  app/
    (auth)/              # sign-up, sign-in, forgot-password, reset-password pages
    (app)/                # dashboard, onboarding, account (require a session)
    account-deleted/      # public post-deletion confirmation page
    paths/                # /paths, /paths/[role], /paths/[role]/[level] — public
    courses/[slug]/        # a single course page — public
    lessons/[slug]/         # an original lesson page — public
    glossary/               # /glossary, /glossary/[slug] — public
    api/
      auth/[...all]/       # Better Auth handler (GET/POST)
      account/             # PATCH profile, GET export, DELETE account
      progress/             # POST /api/progress — view/complete/reopen
      health/              # GET /api/health — uptime monitor + CI smoke target
    layout.tsx              # root layout — SiteHeader, skip-to-content link
    page.tsx                 # public landing page
    globals.css               # Tailwind v4 entry + design tokens
  components/
    auth/                # sign-up/sign-in/forgot/reset forms
    account/             # role-level form, delete-account form, verify-email banner
    content/             # Markdown renderer, glossary link, external link, tag list,
                          # sample-content badge, item card, lesson video, path switcher, course summary
    progress/             # ProgressBar, ProgressStatusBadge, ProgressControl, ViewTracker,
                           # CuratedOpenTracker, ResumeCard
    layout/site-header.tsx
    ui/form-field.tsx     # labeled input primitive (NFR-A11Y-004)
  lib/
    auth/                # password hashing, Better Auth options/instance/client, session helpers
    content/             # taxonomy/route constants, frontmatter/loader/hash/plan-import/import, queries
    progress/             # status vocabulary, pure percent/resume computation, mutations, queries
    mail/                 # mailer transport + templates
    validation/account.ts  # Zod schemas for every auth/account form and route
    validation/content.ts   # Zod schemas for every content-pack file
    validation/progress.ts   # Zod schema for POST /api/progress
    env.ts                  # zod-validated environment accessor
    prisma.ts                # hot-reload/serverless-safe Prisma client singleton
  middleware.ts            # optimistic cookie-presence route protection (UX fast path only)
  instrumentation.ts       # Next.js instrumentation hook — loads Sentry server/edge init
  instrumentation-client.ts # Next.js client-bundle hook — loads Sentry client init
  test/setup.ts             # Vitest + jest-dom setup
prisma/
  schema.prisma           # auth + Path/Course/ContentItem/Topic/GlossaryTerm + Progress tables
  migrations/              # committed migration history
content/                  # the content pack — see docs/content/authoring-guide.md
  taxonomy.yaml, roles/, paths/, courses/, items/, glossary/
scripts/
  import-content.ts        # CLI: npm run content:import / content:check
e2e/
  helpers/                # db.ts (test users, cleanup, findProgressForEmail), mail.ts (outbox reader), register.ts
  global-setup.ts          # imports content/** before the suite (idempotent)
  global-teardown.ts       # removes e2e-created users after the run (content-safe)
  smoke.spec.ts, auth-*.spec.ts, account-*.spec.ts, content-*.spec.ts, progress-*.spec.ts
sentry.server.config.ts
sentry.edge.config.ts     # per-runtime Sentry init (no-op without a DSN)
docs/
  architecture/           # decision records
  content/                # authoring guide + taxonomy reference
  runbooks/               # operational procedures
  requirements/           # product requirements package
```
