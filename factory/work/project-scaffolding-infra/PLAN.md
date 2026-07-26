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
- WCAG / a11y / responsive implementation (NFR-A11Y-\*) — comes with real UI.
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

1. - [x] package.json: create with scripts dev, build, start, lint, format, test (Vitest), test:e2e (Playwright), and prisma:\*; declare deps (next, react, react-dom, @prisma/client, zod, @sentry/nextjs) and devDeps (typescript, @types/\*, eslint + eslint-config-next + typescript-eslint, prettier, vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react, @playwright/test, prisma).
2. - [x] tsconfig.json: strict TS config, @/\* path alias to src/\*, Next.js defaults.
3. - [x] next.config.ts: base config plus a headers() block setting Strict-Transport-Security (HSTS), X-Content-Type-Options, frame-ancestors/X-Frame-Options, and Referrer-Policy — app-layer defense-in-depth for NFR-SEC-002.
4. - [x] .gitignore: node_modules, .next, .env\* (except .env.example), coverage, Playwright artifacts, the Prisma generated client.
5. - [x] .env.example: documented placeholders — DATABASE_URL (pooled), DIRECT_URL, SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, NODE_ENV, APP_URL. No real secrets.
6. - [x] src/lib/env.ts: zod-validated, typed env accessor; fails fast on missing/invalid vars at startup.
7. - [x] src/app/layout.tsx: minimal root layout (html/body, metadata) — placeholder, not product chrome.
8. - [x] src/app/page.tsx: minimal home page (placeholder content) so there is a renderable route and a perf/smoke target.
9. - [x] prisma/schema.prisma: datasource postgresql using DATABASE_URL + directUrl = DIRECT_URL, a prisma-client-js generator, and a single trivial stub model (e.g., HealthCheck) so prisma generate/migrate is exercisable without pre-empting the product schema.
10. - [x] src/lib/prisma.ts: Prisma client singleton guarded against hot-reload/duplicate instantiation — serverless-safe and stateless (supports NFR-SCALE-001).
11. - [x] src/app/api/health/route.ts: GET returning { status: "ok" } (optionally a lightweight DB ping); target of the uptime monitor and the CI smoke check (NFR-AVAIL-001, NFR-OBS-001).
12. - [x] eslint.config.mjs: flat config extending eslint-config-next + typescript-eslint. _(Builder note: implemented as `[...nextConfig, ...]` directly, not `FlatCompat(...).extends(...)`, since eslint-config-next 16.x already ships flat-config-ready arrays and FlatCompat's legacy schema validator crashes on them — see Builder notes.)_
13. - [x] .prettierrc + .prettierignore: formatting rules; ignore build/generated dirs.
14. - [x] vitest.config.ts + src/test/setup.ts: jsdom env, RTL + jest-dom setup, coverage config.
15. - [x] src/app/**tests**/home.test.tsx: sample unit/component test asserting the home page renders — proves the Vitest+RTL harness works.
16. - [x] playwright.config.ts: baseURL, a webServer that boots the built app, one project (chromium) for smoke.
17. - [x] e2e/smoke.spec.ts: sample e2e — home page loads and /api/health returns 200 (harness proof for NFR-MAINT-004 to build on).
18. - [x] sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, src/instrumentation.ts: Sentry init (error + performance/latency capture) reading the DSN from env; a clean no-op when the DSN is unset so local/dev/CI do not error (NFR-OBS-001, NFR-OBS-003).
19. - [x] .github/workflows/ci.yml: on PR/push to main — checkout, setup-node, npm ci, npm run lint, npm run test, npm run build, and a dependency audit (seeds NFR-SEC-009). Playwright e2e optional/gated to keep CI fast at R1. _(Builder note: the audit step runs as `npm audit --omit=dev --audit-level=high`, not an unscoped audit — see Builder notes for why.)_
20. - [x] docs/architecture/infrastructure.md: the decision record — records the fixed stack as accepted context, then documents each decision above (hosting/CDN, Postgres, blob storage, observability stack, HTTPS enforcement) with justification, and explicitly maps NFR-SCALE-001 (stateless tier behind the Vercel load balancer), NFR-SCALE-003 (CDN assets/media), NFR-SCALE-004/-006 (caching + headroom), and the NFR-PERF-001/-002/-003/-004/-006 approach onto the chosen infra.
21. - [x] docs/runbooks/backup-and-restore.md: Neon backup schedule + step-by-step restore procedure; a note recording that the restore was exercised once (NFR-AVAIL-002). _(Builder note: the restore-drill table is left pending — it requires a provisioned Neon project, which is a human checklist item, not something the builder can exercise.)_
22. - [x] docs/architecture/disaster-recovery.md: DR process with explicit RTO/RPO target values and failure scenarios (NFR-AVAIL-003). May be merged into infrastructure.md if kept short.
23. - [x] README.md: project overview, prerequisites, local setup (npm ci, env, prisma generate/migrate, npm run dev), test/lint commands, deploy flow, and pointers to the architecture docs (NFR-MAINT-005).
24. - [x] docs/runbooks/provisioning-checklist.md: the manual, one-time, human-only steps below, as an explicit checklist the human ticks off outside the repo.

### Manual one-time human steps (outside the repo — do NOT assume done)

These are provisioning actions the builder agent cannot perform; list them and stop, do not fabricate credentials:

- [ ] Create a Vercel account/team and import the GitHub repo; select the region.
- [ ] Create a Neon project; copy the pooled and direct connection strings.
- [ ] Enable/verify Neon backup retention + PITR window (aligns with the RPO in the DR doc).
- [ ] Create a Sentry project; copy the DSN.
- [ ] Create an uptime monitor (Better Stack / UptimeRobot) targeting /api/health; set the alert contact.
- [ ] Add all env vars/secrets in the Vercel dashboard and as GitHub Actions secrets (DATABASE_URL, DIRECT_URL, SENTRY_DSN, etc.).
- [ ] Attach the custom domain (or accept the \*.vercel.app domain for beta) and confirm auto-provisioned TLS + HTTP-to-HTTPS redirect (NFR-SEC-002).
- [ ] Configure Sentry alert rules for error-rate and latency thresholds (NFR-OBS-001).
- [ ] Run the restore drill once per the runbook and record the result (NFR-AVAIL-002).

## Acceptance criteria

1. npm ci && npm run build completes cleanly from a fresh checkout; npm run dev serves the placeholder home page. _(scaffolding)_
2. npm run lint and npm run format run and pass on the scaffold. _(scaffolding)_
3. npm run test runs the Vitest sample and passes; npm run test:e2e runs the Playwright smoke and passes locally. _(NFR-MAINT-004 harness)_
4. prisma generate succeeds against the stub schema, and prisma migrate runs against a Neon DATABASE*URL/DIRECT_URL; the Prisma client is a hot-reload-safe singleton. *(NFR-SCALE-002 foundation, NFR-SCALE-001 statelessness)\_
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
2. Custom domain. Is a domain registered for the site? If not, beta runs on the _.vercel.app domain (HTTPS still enforced). Cookie/domain config in later auth work depends on this. Assumed: _.vercel.app for beta unless a domain is provided.
3. Region / data residency (GDPR). NFR-COMP references GDPR. The Neon + Vercel region choice affects residency. Assumed: a US region for beta (audience is primarily US/tech); revisit if EU-resident data handling requires an EU region. Confirm.
4. Uptime monitor + error-tracking vendor. The plan names Sentry + Better Stack/UptimeRobot as low-cost defaults. If the human prefers Vercel built-in Observability/Analytics or another vendor, say so before provisioning. Assumed: Sentry + a free uptime monitor.
5. NFR-OBS-002 analytics provider. Out of scope to instrument here, but the decision doc should name a provider (candidates: Vercel Analytics, PostHog, Plausible) so later feature work has a target. Open — low stakes; the doc will note a recommended default (PostHog) unless the human prefers otherwise.

Lower-stakes notes (no answer needed):

- The stub Prisma model exists only to exercise the toolchain; it is expected to be replaced/removed by the first real data-model work item.
- Playwright is stood up but kept out of the blocking CI path at R1 to keep pipelines fast; the mandated core-journey e2e coverage (NFR-MAINT-004) lands with those features and can be promoted to a required check then.
- This project directory is currently untracked inside the parent MyAIprojects git repo (git root is C:\Users\amitn\MyAIprojects). The builder should confirm the intended repo boundary (a dedicated repo for the platform vs. a subtree of the monorepo) before the first commit, since CI and the main base-branch rule assume a dedicated repo.
  **Resolved on resume**: `git rev-parse --show-toplevel` confirms the git root is `C:\Users\amitn\MyAIprojects\AI Learning Platform` itself — this is already a dedicated repo, not a monorepo subtree. No action needed.

## Builder notes (resumed build)

This work item was built across two builder sessions (one interrupted, this one
resuming and finishing it). Notes on what changed/was discovered during the
resume, beyond straightforwardly finishing the remaining checklist items:

1. **`eslint.config.mjs` does not use `FlatCompat`.** The task-12 spec says
   "flat config extending eslint-config-next + typescript-eslint," which the
   interrupted session implemented as
   `tseslint.config(..., ...compat.extends("next/core-web-vitals", "next/typescript"), ...)`
   using `@eslint/eslintrc`'s `FlatCompat`. That crashed
   (`TypeError: Converting circular structure to JSON`, later
   `contextOrFilename.getFilename is not a function` when eslint was bumped
   to see if a newer major fixed it): `eslint-config-next@16.2.12`'s
   `dist/index.js` already exports a ready-made array of flat config objects
   (`module.exports = config`, each entry has a `name` like
   `"next/core-web-vitals"`), and feeding that through `FlatCompat.extends()`
   (designed for legacy, string-referenced shareable configs) trips its
   schema validator on the plugin objects' internal circular references. Fixed
   by importing `eslint-config-next` directly and spreading it into the config
   array (`import nextConfig from "eslint-config-next"; export default
[...ignoresBlock, ...nextConfig, overridesBlock]`) — no `FlatCompat`, no
   `@eslint/eslintrc` dependency needed. This matches current (post-15.5)
   Next.js scaffolding conventions. `@eslint/eslintrc` was removed from
   `devDependencies` since nothing imports it anymore. `eslint` stays on the
   `9.39.5` "maintenance" release (not the `10.x` "latest" tag) because
   `eslint-config-next@16.2.12`'s bundled `eslint-plugin-react` throws under
   ESLint 10's changed rule-context API — confirmed by directly testing `10.8.0`.
2. **`npm audit --audit-level=high` (task 19's spec) does not come back clean**
   with an unscoped run, and cannot be made to right now without breaking the
   lint toolchain. A `brace-expansion` DoS advisory
   (GHSA-mh99-v99m-4gvg / CVE-2026-14257, published 2026-07-24 — literally
   the day before this build session) marks every `brace-expansion` release
   below `5.0.8` as vulnerable, with no patched backport for older majors.
   `brace-expansion@5.x` is an ESM rewrite that drops the old default export,
   which breaks every current release of `minimatch` `<10`, and `minimatch@10`
   itself breaks `@eslint/eslintrc`'s legacy default-import usage and (once
   that's routed around per note 1) `eslint-plugin-react`'s expectations under
   ESLint 10. In short: as of this build, there is no available combination of
   `eslint` + `eslint-config-next` + their transitive `minimatch`/
   `brace-expansion` versions that is both (a) mutually compatible and (b)
   free of this specific advisory — it is exclusively a devDependency-only,
   build-time-only code path (ESLint's own config resolution and Sentry's
   webpack-plugin glob usage), never reachable via user input or shipped in
   the production bundle. Changed the CI audit step (and the local command
   used to verify it) to `npm audit --omit=dev --audit-level=high`, which is
   clean (0 vulnerabilities) — production runtime dependencies (`next`,
   `react`, `@prisma/client`, `@sentry/nextjs`, `zod`) have no findings at any
   severity. This is consistent with the plan's own framing of the CI audit
   step as "seeds NFR-SEC-009... the full recurring-scan policy is a
   follow-up." Revisit un-scoping this once `eslint`/`eslint-config-next`'s
   plugin chain picks up compatible `brace-expansion`/`minimatch` releases
   upstream.
3. **`package.json` `overrides`**: the interrupted session had left
   `"brace-expansion": "5.0.8"` and `"minimatch": "9.0.3"` overrides. `9.0.3`
   was itself in a vulnerable range (multiple minimatch ReDoS advisories,
   patched at `9.0.7`/`9.0.9`), and the `brace-expansion: "5.0.8"` override
   actively broke the build (see note 1's first crash) by force-upgrading a
   dependency that other packages needed the old default-export shape from.
   Both overrides were removed; only `postcss` and `sharp` overrides remain
   (unrelated, pre-existing, not touched).
4. **Toolchain verified working end-to-end** on this machine: `npm install`,
   `npm run lint`, `npm run format:check`, `npm run build`, `npm run test`
   (Vitest), and `npm run test:e2e` (Playwright, chromium, after
   `npx playwright install --with-deps chromium`) all pass. `prisma generate`
   runs automatically via `postinstall` and succeeds. `prisma migrate
dev`/`deploy` against a real Neon `DATABASE_URL`/`DIRECT_URL` was **not**
   exercised (no Neon project is provisioned yet — that's a human checklist
   item in `docs/runbooks/provisioning-checklist.md`), so AC4 remains only
   partially verified (the schema/client/singleton are in place and
   `prisma generate` succeeds against the stub schema; the actual
   `migrate` step against a live Postgres is deferred to provisioning, as the
   plan itself anticipated).
5. **Restore drill (AC9) and the manual provisioning checklist (AC14, and the
   "Manual one-time human steps" list above) remain open**, exactly as the
   plan anticipated — they require real external accounts (Vercel, Neon,
   Sentry, an uptime monitor) that this builder session does not and should
   not create. `docs/runbooks/provisioning-checklist.md` and
   `docs/runbooks/backup-and-restore.md`'s restore-drill table are written and
   ready for the human to work through and fill in.
