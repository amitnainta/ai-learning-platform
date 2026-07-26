# PLAN — project-scaffolding-infra

_Work item slug: project-scaffolding-infra. Plan produced by factory-planner. Source: factory/work/project-scaffolding-infra/REQUEST.md._

## Summary

This work item stands up the greenfield scaffolding and infrastructure foundation for the AI Learning Platform. No application code exists yet — this is the R1 base that every later feature work item (accounts, paths, progress, ratings, etc.) sits on top of. It initializes the already-decided stack (Next.js App Router + React + TypeScript full-stack monolith, PostgreSQL via Prisma), wires up lint/format/test harnesses and a basic CI pipeline (lint + test + build), enforces HTTPS with security headers, and — critically — makes and documents the infrastructure decisions that were deliberately left open in the requirements package: hosting/CDN provider, managed Postgres provider, logging/monitoring/alerting toolchain, error tracking, and automated backup with a documented restore. The stack/language/framework/ORM decision is already fixed in CLAUDE.md and is treated as a given, not re-opened here. This item builds no product features; it establishes the platform they run on and unblocks all downstream R1 work.

## Requirement IDs satisfied

Primary (cited in REQUEST.md and the task context):

- NFR-PERF-001, -002, -003, -004, -006 — performance baseline plus documented approach (SSR/SSG + CDN + edge; DB indexing/caching strategy noted for feature work).
- NFR-SCALE-001 — stateless, horizontally scalable app tier behind a load balancer.
- NFR-SCALE-003 — static assets and original lesson media served via CDN, not the app origin.
- NFR-SCALE-004, -006 — cache strategy plus 10x headroom documented (design-level, no product code).
- NFR-AVAIL-001 — 99.5% uptime target documented plus uptime monitoring wired to a health endpoint.
- NFR-AVAIL-002 — automated recurring backups with a tested restore procedure.
- NFR-AVAIL-003 — documented disaster-recovery process with RTO/RPO targets.
- NFR-OBS-001 — logging, monitoring, and alerting for error rates, latency, availability.
- NFR-OBS-003 — errors captured/triaged via an error-tracking tool, not logs alone.
- NFR-SEC-002 — all traffic served over HTTPS/TLS; no unencrypted endpoints.

Secondary / partially seeded (foundation only; full satisfaction is a later work item, noted for traceability):

- NFR-SEC-009 — CI dependency vulnerability scan step (npm audit) is included because CI is being established here; the full recurring-scan policy is a follow-up.
- NFR-MAINT-004 — the Playwright e2e harness is stood up (with a smoke test), so later journeys can add coverage; the mandated core-journey tests come with those features.
- NFR-MAINT-005 — handoff/setup/deploy documentation (README + infrastructure doc + runbook).
- NFR-SCALE-002 — the Prisma datasource points at a Postgres that scales to the year-one target; the actual schema/indexes come with feature work.

## Scope

### In scope

- Repo/project structure for a single-root Next.js (App Router, TS, src/) monolith.
- Next.js app initialized with a minimal home page and root layout (placeholder — not the real product UI).
- Prisma installed with a stub schema (datasource + generator + one trivial model) and a serverless-safe Prisma client singleton; Postgres connection via DATABASE_URL.
- Environment configuration: .env.example, typed env validation, .gitignore.
- HTTPS enforcement plus security headers (HSTS etc.) at the app layer, complementing host-level TLS.
- An /api/health endpoint for uptime monitoring and CI/deploy smoke checks.
- ESLint + Prettier config and scripts.
- Vitest + React Testing Library harness with one sample unit/component test.
- Playwright harness with one sample e2e smoke test (home renders, health endpoint 200).
- Sentry (or equivalent) wiring for error tracking plus performance/latency telemetry.
- Basic CI (GitHub Actions): install, lint, unit test, build, dependency audit.
- Infrastructure decision record documenting the hosting/CDN, Postgres, storage, observability, and backup choices with justification, plus how NFR-SCALE-001/-003 map onto them.
- Backup + restore runbook and DR doc (RTO/RPO).
- Explicit checklist of manual, one-time human provisioning steps (account/DB/monitor creation) that must happen outside the repo.

### Out of scope (explicitly)

- Any product feature: accounts/auth logic, paths, content, progress, ratings, certificates, search, admin — all later work items.
- The real Prisma data model and migrations for product entities (only a stub datasource here).
- NFR-OBS-002 analytics event instrumentation (placement/activation/completion/return/certificate metrics) — the analytics provider is named in the decision doc, but wiring product events belongs with the features that emit them.
- Search-index technology decision (DB full-text vs. dedicated service) — left open per requirements section 5 until R1 search work.
- Full OWASP hardening beyond HTTPS (NFR-SEC-001/003/004/005/007) — later, feature-adjacent.
- WCAG / a11y / responsive implementation (NFR-A11Y-*) — comes with real UI.
- Re-opening or re-deciding the framework/language/ORM. Fixed in CLAUDE.md.
- Choosing exact numeric SLA targets beyond the directional ones in the requirements (kept directional per section 5).

## Decisions made by this work item

Bias per REQUEST context: solo-maintained, free educational site — favor low-ops, low-cost, tight Next.js integration.

1. Hosting / CDN / load balancing = Vercel. Native Next.js host; serverless functions are inherently stateless and auto-scaled behind Vercel managed edge infrastructure (satisfies the stateless-app-tier-behind-a-load-balancer of NFR-SCALE-001 and the 10x headroom of NFR-SCALE-006 with zero ops). Static assets and Next-optimized media are served from the Vercel global Edge CDN, not the app origin (NFR-SCALE-003). TLS certs are auto-provisioned and HTTP auto-redirects to HTTPS (NFR-SEC-002). Rejected alternative: self-managed Node host (Railway/Render/Fly) + separate Cloudflare CDN + object storage — more moving parts and ops burden than a solo maintainer should carry at R1.
2. Managed Postgres = Neon. Serverless Postgres with a generous free tier, autoscaling, and — key for NFR-AVAIL-002/-003 — automated backups plus point-in-time recovery. Connects to Prisma via a pooled DATABASE_URL (pgBouncer) for serverless plus a direct DIRECT_URL for migrations. Scales well past the year-one 100k-user / 5k-item target (NFR-SCALE-002). Chosen over Supabase (more product surface than needed) and over Vercel Postgres (which is Neon under the hood anyway), keeping the DB provider independent of the host.
3. Original lesson media / large static assets = Vercel Blob, served via CDN (NFR-SCALE-003). Simple and integrated; Cloudflare R2 is the documented fallback if egress/cost changes.
4. Logging + monitoring + alerting (NFR-OBS-001) = Vercel platform logs/metrics + Sentry + an external uptime monitor. Sentry covers error rates and latency/performance with configurable alert rules (also satisfies NFR-OBS-003 error tracking). An external uptime monitor (Better Stack or UptimeRobot free tier) polls /api/health for availability alerting and 99.5% uptime tracking (NFR-AVAIL-001).
5. Backup / restore (NFR-AVAIL-002/-003) = Neon automated daily backups + PITR, with a written restore runbook and stated RTO/RPO. The restore procedure is manually exercised once during this work item to satisfy tested restore procedures.
6. Statelessness mapping (NFR-SCALE-001): no in-memory session/server state — session/auth state lives in the DB or in signed cookies/JWT (a design constraint documented now so later auth work honors it). CDN-served assets are the Next.js default on Vercel.

## Tasks

Ordered so each is independently completable. Paths are relative to the project root C:\Users\amitn\MyAIprojects\AI Learning Platform.

1. - [ ] package.json: create with scripts dev, build, start, lint, format, test (Vitest), test:e2e (Playwright), and prisma:_; declare deps (next, react, react-dom, @prisma/client, zod, @sentry/nextjs) and devDeps (typescript, @types/_, eslint + eslint-config-next + typescript-eslint, prettier, vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react, @playwright/test, prisma).
2. - [ ] tsconfig.json: strict TS config, @/* path alias to src/*, Next.js defaults.
3. - [ ] next.config.ts: base config plus a headers() block setting Strict-Transport-Security (HSTS), X-Content-Type-Options, frame-ancestors/X-Frame-Options, and Referrer-Policy — app-layer defense-in-depth for NFR-SEC-002.
4. - [ ] .gitignore: node_modules, .next, .env* (except .env.example), coverage, Playwright artifacts, the Prisma generated client.
5. - [ ] .env.example: documented placeholders — DATABASE_URL (pooled), DIRECT_URL, SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, NODE_ENV, APP_URL. No real secrets.
6. - [ ] src/lib/env.ts: zod-validated, typed env accessor; fails fast on missing/invalid vars at startup.
7. - [ ] src/app/layout.tsx: minimal root layout (html/body, metadata) — placeholder, not product chrome.
8. - [ ] src/app/page.tsx: minimal home page (placeholder content) so there is a renderable route and a perf/smoke target.
9. - [ ] prisma/schema.prisma: datasource postgresql using DATABASE_URL + directUrl = DIRECT_URL, a prisma-client-js generator, and a single trivial stub model (e.g., HealthCheck) so prisma generate/migrate is exercisable without pre-empting the product schema.
10. - [ ] src/lib/prisma.ts: Prisma client singleton guarded against hot-reload/duplicate instantiation — serverless-safe and stateless (supports NFR-SCALE-001).
11. - [ ] src/app/api/health/route.ts: GET returning { status: "ok" } (optionally a lightweight DB ping); target of the uptime monitor and the CI smoke check (NFR-AVAIL-001, NFR-OBS-001).
12. - [ ] eslint.config.mjs: flat config extending eslint-config-next + typescript-eslint.
13. - [ ] .prettierrc + .prettierignore: formatting rules; ignore build/generated dirs.
14. - [ ] vitest.config.ts + src/test/setup.ts: jsdom env, RTL + jest-dom setup, coverage config.
15. - [ ] src/app/**tests**/home.test.tsx: sample unit/component test asserting the home page renders — proves the Vitest+RTL harness works.
16. - [ ] playwright.config.ts: baseURL, a webServer that boots the built app, one project (chromium) for smoke.
17. - [ ] e2e/smoke.spec.ts: sample e2e — home page loads and /api/health returns 200 (harness proof for NFR-MAINT-004 to build on).
18. - [ ] sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, src/instrumentation.ts: Sentry init (error + performance/latency capture) reading the DSN from env; a clean no-op when the DSN is unset so local/dev/CI do not error (NFR-OBS-001, NFR-OBS-003).
19. - [ ] .github/workflows/ci.yml: on PR/push to main — checkout, setup-node, npm ci, npm run lint, npm run test, npm run build, and npm audit --audit-level=high (seeds NFR-SEC-009). Playwright e2e optional/gated to keep CI fast at R1.
20. - [ ] docs/architecture/infrastructure.md: the decision record — records the fixed stack as accepted context, then documents each decision above (hosting/CDN, Postgres, blob storage, observability stack, HTTPS enforcement) with justification, and explicitly maps NFR-SCALE-001 (stateless tier behind the Vercel load balancer), NFR-SCALE-003 (CDN assets/media), NFR-SCALE-004/-006 (caching + headroom), and the NFR-PERF-001/-002/-003/-004/-006 approach onto the chosen infra.
21. - [ ] docs/runbooks/backup-and-restore.md: Neon backup schedule + step-by-step restore procedure; a note recording that the restore was exercised once (NFR-AVAIL-002).
22. - [ ] docs/architecture/disaster-recovery.md: DR process with explicit RTO/RPO target values and failure scenarios (NFR-AVAIL-003). May be merged into infrastructure.md if kept short.
23. - [ ] README.md: project overview, prerequisites, local setup (npm ci, env, prisma generate/migrate, npm run dev), test/lint commands, deploy flow, and pointers to the architecture docs (NFR-MAINT-005).
24. - [ ] docs/runbooks/provisioning-checklist.md: the manual, one-time, human-only steps below, as an explicit checklist the human ticks off outside the repo.

### Manual one-time human steps (outside the repo — do NOT assume done)

These are provisioning actions the builder agent cannot perform; list them and stop, do not fabricate credentials:

- [ ] Create a Vercel account/team and import the GitHub repo; select the region.
- [ ] Create a Neon project; copy the pooled and direct connection strings.
- [ ] Enable/verify Neon backup retention + PITR window (aligns with the RPO in the DR doc).
- [ ] Create a Sentry project; copy the DSN.
- [ ] Create an uptime monitor (Better Stack / UptimeRobot) targeting /api/health; set the alert contact.
- [ ] Add all env vars/secrets in the Vercel dashboard and as GitHub Actions secrets (DATABASE_URL, DIRECT_URL, SENTRY_DSN, etc.).
- [ ] Attach the custom domain (or accept the *.vercel.app domain for beta) and confirm auto-provisioned TLS + HTTP-to-HTTPS redirect (NFR-SEC-002).
- [ ] Configure Sentry alert rules for error-rate and latency thresholds (NFR-OBS-001).
- [ ] Run the restore drill once per the runbook and record the result (NFR-AVAIL-002).

## Acceptance criteria

1. npm ci && npm run build completes cleanly from a fresh checkout; npm run dev serves the placeholder home page. _(scaffolding)_
2. npm run lint and npm run format run and pass on the scaffold. _(scaffolding)_
3. npm run test runs the Vitest sample and passes; npm run test:e2e runs the Playwright smoke and passes locally. _(NFR-MAINT-004 harness)_
4. prisma generate succeeds against the stub schema, and prisma migrate runs against a Neon DATABASE_URL/DIRECT_URL; the Prisma client is a hot-reload-safe singleton. _(NFR-SCALE-002 foundation, NFR-SCALE-001 statelessness)_
5. /api/health returns HTTP 200 { status: "ok" }; an external uptime monitor is documented as polling it. _(NFR-AVAIL-001, NFR-OBS-001)_
6. Responses carry an HSTS header; the deployed site serves only over HTTPS with HTTP redirecting to HTTPS and no plaintext endpoint. _(NFR-SEC-002)_
7. docs/architecture/infrastructure.md exists and, for each of NFR-SCALE-001 and NFR-SCALE-003, names the concrete mechanism (Vercel stateless serverless behind an edge load balancer; Edge CDN + Vercel Blob for assets/media) — not a placeholder. _(NFR-SCALE-001, -003)_
8. Sentry is wired for error + latency capture and degrades to a no-op when the DSN is unset; the doc names it as the error-tracking tool distinct from logs. _(NFR-OBS-001, NFR-OBS-003)_
9. docs/runbooks/backup-and-restore.md documents automated daily backups and a step-by-step restore, with a note that the restore was exercised once. _(NFR-AVAIL-002)_
10. A DR doc states explicit RTO and RPO target values. _(NFR-AVAIL-003)_
11. docs/architecture/infrastructure.md documents the intended approach to NFR-PERF-001/-002/-003/-004/-006 (SSR/SSG + CDN + edge; caching + indexing to come with features), and the placeholder home page achieves a Lighthouse FCP under 2s as a baseline. _(NFR-PERF-001/-002/-006; -003/-004 documented approach)_
12. CI runs lint + unit test + build + dependency audit on PRs to main and blocks on failure. _(CI foundation; seeds NFR-SEC-009)_
13. README.md lets a new engineer set up, run, test, and deploy without asking the author. _(NFR-MAINT-005)_
14. docs/runbooks/provisioning-checklist.md lists every manual account/DB/monitor/secret step; none of these are silently assumed complete. _(process)_

## Test plan

| What                                                                | Type                                              | Maps to        |
| ------------------------------------------------------------------- | ------------------------------------------------- | -------------- |
| Home page renders                                                   | Unit/component (Vitest + RTL) — home.test.tsx     | AC1, AC3       |
| Home loads + /api/health returns 200                                | E2E (Playwright) — smoke.spec.ts                  | AC3, AC5       |
| npm ci && build && lint && format clean                             | CI + manual                                       | AC1, AC2, AC12 |
| prisma generate / migrate against Neon                              | Manual (needs provisioned DB)                     | AC4            |
| HSTS header present + HTTPS-only + HTTP-to-HTTPS redirect on deploy | Manual (curl -I against the deployed URL)         | AC6            |
| Uptime monitor fires on /api/health outage                          | Manual (one-time verification after provisioning) | AC5            |
| Sentry receives a deliberately thrown test error                    | Manual (one-time smoke after DSN set)             | AC8            |
| Restore drill from a Neon backup                                    | Manual (one-time; recorded in runbook)            | AC9            |
| Lighthouse FCP under 2s on placeholder home                         | Manual (Lighthouse/PageSpeed)                     | AC11           |
| CI blocks a PR that fails lint/test/build/audit                     | CI (observed on a trial PR)                       | AC12           |

Note: several criteria (AC4, the AC5 monitor, AC6, AC8, AC9) are only fully verifiable after the manual provisioning steps; the builder implements the code/config and the human completes provisioning, then those manual checks are run before ship.

## Risks / open questions

Flagged for the human (do not block planning, but confirm before or at ship):

1. Vercel Hobby vs Pro tier. The Vercel Hobby (free) tier is licensed for non-commercial use. A free educational site with no monetization is plausibly non-commercial, but the ToS is ambiguous. Recommendation: start on Hobby for beta; budget for Vercel Pro (about 20 USD/month) if/when a custom domain and real traffic arrive. Confirm budget tolerance. Assumed: free tiers acceptable for beta.
2. Custom domain. Is a domain registered for the site? If not, beta runs on the *.vercel.app domain (HTTPS still enforced). Cookie/domain config in later auth work depends on this. Assumed: *.vercel.app for beta unless a domain is provided.
3. Region / data residency (GDPR). NFR-COMP references GDPR. The Neon + Vercel region choice affects residency. Assumed: a US region for beta (audience is primarily US/tech); revisit if EU-resident data handling requires an EU region. Confirm.
4. Uptime monitor + error-tracking vendor. The plan names Sentry + Better Stack/UptimeRobot as low-cost defaults. If the human prefers Vercel built-in Observability/Analytics or another vendor, say so before provisioning. Assumed: Sentry + a free uptime monitor.
5. NFR-OBS-002 analytics provider. Out of scope to instrument here, but the decision doc should name a provider (candidates: Vercel Analytics, PostHog, Plausible) so later feature work has a target. Open — low stakes; the doc will note a recommended default (PostHog) unless the human prefers otherwise.

Lower-stakes notes (no answer needed):

- The stub Prisma model exists only to exercise the toolchain; it is expected to be replaced/removed by the first real data-model work item.
- Playwright is stood up but kept out of the blocking CI path at R1 to keep pipelines fast; the mandated core-journey e2e coverage (NFR-MAINT-004) lands with those features and can be promoted to a required check then.
- This project directory is currently untracked inside the parent MyAIprojects git repo (git root is C:\Users\amitn\MyAIprojects). The builder should confirm the intended repo boundary (a dedicated repo for the platform vs. a subtree of the monorepo) before the first commit, since CI and the main base-branch rule assume a dedicated repo.
