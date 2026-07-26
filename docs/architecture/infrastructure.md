# Infrastructure Decision Record

Status: accepted for R1 (beta). Owner: solo maintainer. Revisit triggers are called
out inline below.

## Accepted context (fixed, not re-opened here)

The stack, language, and ORM are already decided in the repo's `CLAUDE.md` and are
treated as a given:

- **Framework**: Next.js (App Router), React, TypeScript — full-stack monolith. A
  single Next.js deployable serves both the SSR/SSG frontend and the backend (API
  routes / route handlers). There is no separate backend service in R1.
- **Database / ORM**: PostgreSQL via Prisma.

This document covers the infrastructure decisions that were deliberately left open
in the requirements package: hosting/CDN, managed Postgres provider, object/blob
storage, observability (logging/monitoring/alerting/error-tracking), and backup /
disaster recovery. The bias, per the request context, is a solo-maintained, free
educational site: favor low-ops, low-cost, tight Next.js integration over
maximum flexibility.

## 1. Hosting, load balancing, and CDN — Vercel

**Decision**: Vercel is the hosting platform for the Next.js app.

**Why**: Vercel is the platform Next.js is built by/for — App Router features
(RSC, route handlers, ISR, image optimization) work with zero extra configuration.
Deploys are git-push-triggered, preview deployments come for free on every PR,
and there is a genuinely usable free (Hobby) tier for a pre-revenue educational
site.

**Rejected alternative**: a self-managed Node host (Railway/Render/Fly.io) fronted
by a separate CDN (e.g., Cloudflare) and a separate object store. This is more
capable in the limit (finer control over regions, no vendor lock-in) but adds
several more moving parts — a reverse proxy/LB, TLS cert renewal, a CDN
configuration surface, and a separate storage bucket — than a solo maintainer
should carry at R1. Revisit if/when Vercel's pricing or platform limits stop
fitting (see the open risk on Hobby vs. Pro tier in PLAN.md).

**How this maps to the NFRs**:

- **NFR-SCALE-001 (stateless app tier behind a load balancer)**: Vercel serverless
  functions (and Edge Functions) are the app tier. Each invocation is a fresh,
  isolated execution with no shared in-process memory across requests/instances,
  and Vercel's edge network fronts every request as the load balancer —
  auto-scaling the number of concurrent function instances with traffic. This is
  satisfied _by construction_ as long as the app itself does not introduce
  server-side session/in-memory state (see "Statelessness" below) — there is no
  load balancer to configure because Vercel's routing layer _is_ the load
  balancer.
- **NFR-SCALE-003 (static assets/media via CDN, not app origin)**: Next.js static
  assets (`/public`, build output, optimized images via `next/image`) are served
  from Vercel's global Edge Network by default — the app origin (the serverless
  function) is never hit for a static asset request. Original lesson media (see
  §3) is likewise served from Vercel Blob's CDN, not proxied through a function.
- **NFR-SCALE-004 (caching for slow-changing data)**: not implemented as product
  code in this work item (out of scope — no product data model exists yet), but
  the intended mechanism is documented here for feature work to follow: Next.js
  data-fetching cache (`fetch` cache / `revalidate`) or React `cache()` for
  slow-changing reads (path structures, aggregate ratings, published content),
  with time-based or on-demand (`revalidateTag`/`revalidatePath`) invalidation
  triggered by the mutation that changes the underlying data.
- **NFR-SCALE-006 (10x headroom via horizontal scaling, no rework)**: Vercel
  scales the number of serverless/edge function instances automatically in
  response to load; because the app tier is stateless (NFR-SCALE-001), adding
  capacity is purely a platform auto-scaling concern, not an architectural
  change.
- **NFR-PERF-001/-002/-006 (FCP < 2s, usable within 4s on 3G, dashboards < 2s)**:
  achieved through Next.js's default rendering strategy — static generation
  (SSG) for pages that don't need per-request data (marketing/landing pages),
  server-side rendering (SSR) with streaming for pages that do, and edge/CDN
  delivery of the resulting HTML and assets close to the user. The placeholder
  home page in this scaffold is the baseline measured against AC11 (see below).
- **NFR-PERF-003/-004 (search/filter < 1s; core API endpoints < 500ms p95)**:
  no product API exists yet in this work item. The approach documented for
  feature work: keep API route handlers thin (validate input, one or two
  indexed Postgres queries, no N+1s), rely on Vercel's edge-adjacent function
  regions to minimize network latency to the database, and apply NFR-SCALE-004
  caching to read-heavy endpoints. Search-index technology (DB full-text vs. a
  dedicated service) is explicitly left open per the requirements doc until the
  R1 search work item (NFR-SCALE-005).
- **NFR-SEC-002 (HTTPS/TLS only, no plaintext endpoint)**: Vercel auto-provisions
  and renews TLS certificates for every deployment (including `*.vercel.app` and
  any attached custom domain) and auto-redirects HTTP to HTTPS at the edge —
  there is no way to reach the app over plaintext HTTP. This work item adds
  app-layer security headers as defense-in-depth on top of that host-level
  enforcement (see §5).

## 2. Managed Postgres — Neon

**Decision**: Neon (serverless Postgres) is the database provider.

**Why**: a generous free tier, true autoscaling (compute suspends to zero when
idle, which matters for a free-tier, low-traffic beta), and — critically for
NFR-AVAIL-002/-003 — automated backups plus point-in-time recovery (PITR) out of
the box, with no separate backup infrastructure to build. Neon exposes two
connection strings that map cleanly onto Prisma's serverless deployment model:

- A **pooled** connection (via PgBouncer) — used by the app at request time
  (`DATABASE_URL`), since serverless functions open many short-lived connections
  and need pooling to avoid exhausting Postgres's connection limit.
- A **direct** (unpooled) connection — required by Prisma Migrate, which needs a
  session-level connection that a transaction pooler cannot provide
  (`DIRECT_URL`).

Both are wired into `prisma/schema.prisma`'s `datasource` block and validated at
runtime by `src/lib/env.ts`.

**Rejected alternatives**:

- **Supabase** — bundles more product surface (auth, storage, realtime,
  edge functions) than this project needs; the project already has its own
  Next.js-based auth/storage plan, so Supabase's extra surface is unused
  complexity.
- **Vercel Postgres** — is Neon under the hood, so choosing Neon directly keeps
  the database provider decoupled from the hosting provider (avoids doubling up
  on the same vendor for two different concerns, and keeps a migration path open
  if hosting ever changes without needing to also move the database).

**NFR-SCALE-002**: Neon's serverless Postgres scales well past the year-one
target (100k registered users, 5,000 content items) on autoscaling compute; the
actual schema and indexes that make that scaling real arrive with the product
data-model work items — this item only stands up the connection and the
toolchain (a single stub model, see `prisma/schema.prisma`).

## 3. Original lesson media / large static assets — Vercel Blob

**Decision**: Vercel Blob stores original lesson media and other large static
assets, served through Vercel's CDN (satisfying NFR-SCALE-003 for
user-uploaded/curated media specifically, as distinct from build-time static
assets which Next.js already serves via the CDN by default).

**Why**: first-party integration with the hosting platform (single dashboard,
single bill, SDK ships as an npm package), simple pre-signed-upload workflow,
and no separate cloud account to provision for a solo maintainer at R1.

**Documented fallback**: Cloudflare R2 (S3-compatible, typically cheaper egress)
is the fallback if Blob's cost or egress characteristics stop fitting as media
volume grows. Because access is behind a small storage-abstraction module (to be
introduced with the content-authoring feature work, out of scope here), swapping
providers later should not require touching call sites.

## 4. Observability — Vercel platform logs/metrics + Sentry + external uptime monitor

**Decision** (NFR-OBS-001, NFR-OBS-003, NFR-AVAIL-001):

- **Vercel platform logs and metrics** — built-in request logs and basic
  runtime metrics for every deployment, with no setup required. This is the
  first line of "logging" for NFR-OBS-001.
- **Sentry** — the dedicated error-tracking tool (NFR-OBS-003: errors are
  captured and triaged via a tool, not logs alone) _and_ the
  performance/latency capture mechanism (NFR-OBS-001's "monitoring... for error
  rates, latency"). Wired via `@sentry/nextjs` with three runtime-specific init
  files (`sentry.client.config.ts`, `sentry.server.config.ts`,
  `sentry.edge.config.ts`) loaded through `src/instrumentation.ts`, each reading
  its DSN from an environment variable (`NEXT_PUBLIC_SENTRY_DSN` client-side,
  `SENTRY_DSN` server/edge-side) and initializing with `enabled: false` when
  that DSN is absent — so local dev, CI, and any not-yet-provisioned
  environment never error and never attempt a network call. `tracesSampleRate`
  is set to `1.0` for now (100% of a low-traffic beta's requests) and should be
  tuned down once real production traffic arrives.
- **External uptime monitor** (Better Stack or UptimeRobot free tier) — polls
  `GET /api/health` from outside Vercel's own infrastructure and alerts on
  outage, which is what actually satisfies "availability" monitoring/alerting
  (a platform can't reliably self-report its own total outage). This is what
  the 99.5% uptime target (NFR-AVAIL-001) is tracked and alerted against.
  Provisioning this monitor is a manual step — see
  `docs/runbooks/provisioning-checklist.md`.

**Rejected/deferred alternative**: Vercel's own built-in Observability/Analytics
product could replace some of this, but Sentry's error-tracking-first design
(grouping, triage workflow, alert rules keyed on error rate/latency thresholds)
is a better fit for NFR-OBS-003's explicit requirement for a _dedicated
error-tracking tool_, and an external uptime monitor is needed regardless
because a host cannot be relied on to alert on its own total outage.

**NFR-OBS-002 (analytics events — placement/activation/completion/return/
certificate metrics)**: out of scope for this work item (no product events exist
yet), but a provider is named here so later feature work has a fixed target:
**PostHog** (self-hostable if privacy/cost needs change later, has a usable free
tier, and covers funnels/retention out of the box — a good fit for the specific
metrics NFR-OBS-002 lists). This is a recommended default, not a final decision;
flagged as a low-stakes open question in PLAN.md if the human prefers Vercel
Analytics or Plausible instead.

## 5. HTTPS enforcement

TLS termination and HTTP→HTTPS redirection happen at the Vercel edge
(host-level, automatic, not configurable-away). `next.config.ts`'s `headers()`
block adds app-layer defense-in-depth on top of that:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` —
  instructs browsers to _never_ attempt plaintext HTTP to this origin again,
  even if a future misconfiguration allowed it.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a
  `Content-Security-Policy: frame-ancestors 'none'`, and
  `Referrer-Policy: strict-origin-when-cross-origin` — general hardening headers
  applied to every response, independent of HTTPS specifically.

This satisfies NFR-SEC-002 for R1; full OWASP hardening beyond HTTPS
(NFR-SEC-001/003/004/005/007) is explicitly out of scope here and lands with
feature-adjacent work.

## 6. Backup, restore, and disaster recovery

Covered in detail in the dedicated runbooks (kept separate, per the plan, since
they are operational procedures rather than architecture decisions):

- `docs/runbooks/backup-and-restore.md` — Neon's automated backup schedule, PITR
  window, and the step-by-step restore procedure (NFR-AVAIL-002).
- `docs/architecture/disaster-recovery.md` — the DR process, failure scenarios,
  and explicit RTO/RPO targets (NFR-AVAIL-003).

## 7. Statelessness mapping (design constraint for all later feature work)

**NFR-SCALE-001** requires the app tier to be stateless. Concretely, for every
later work item (starting with accounts/auth):

- No server-side in-memory session store. Session/auth state lives either in
  the database (e.g., a `Session` table looked up per request) or in a signed,
  stateless cookie/JWT that the server can validate without a lookup.
- No per-instance in-memory caches that would produce different behavior
  depending on which serverless instance handled a request (any cache must be
  either external — e.g., a shared cache/DB — or safely per-request/idempotent).
- `src/lib/prisma.ts`'s Prisma client singleton is safe under this constraint:
  it holds a _connection pool_, not application/session state, and each
  serverless cold start gets its own isolated instance (see the comment in that
  file for the hot-reload-vs-serverless reasoning).

This is a documented constraint now so later auth/session work honors it from
the start rather than retrofitting statelessness after the fact.

## 8. Performance baseline (AC11)

The placeholder home page (`src/app/page.tsx`) is a static route (see the
`○ (Static)` marker in `next build` output) with no client-side JavaScript
beyond Next.js's own runtime, so it is expected to comfortably clear an FCP
under 2 seconds (NFR-PERF-001) even on a throttled connection — this is the
scaffold-level baseline; the manual Lighthouse check (test plan, AC11) confirms
it once deployed.
