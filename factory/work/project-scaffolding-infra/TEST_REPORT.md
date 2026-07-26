# TEST_REPORT — project-scaffolding-infra

Tester: factory-tester (independent re-verification pass, post-fix). Branch
verified: `feature/project-scaffolding-infra` @ `432b404`, 11 commits on top
of the initial commit (7 from the original build + 4 fix-pass commits:
`bebd730` fix B1/B2, `cff7bb9` doc corrections, `ceaaa94` F5 `.prettierignore`,
`432b404` PLAN.md builder notes). This supersedes the prior TEST_REPORT.md,
whose AC8 evidence REVIEW.md correctly identified as under-verified (it only
exercised the DSN-unset no-op path). All commands below were re-run from
scratch on `C:\Users\amitn\MyAIprojects\AI Learning Platform`, Node v24.12.0 /
npm 11.6.2 — nothing here is copy-pasted from the builder's or a prior
report's output.

## Summary verdict

**PASS overall.** Both REVIEW.md blocking findings (B1 — client Sentry dead
code, B2 — `getEnv()`/docs claiming wiring that didn't exist) are now
genuinely fixed and independently re-verified with fresh evidence, not just
re-read from the builder's report. AC8 — the criterion that slipped through
the previous pass — now has real evidence for **both** the DSN-unset no-op
path and the DSN-set active path, including a byte-for-byte grep match of the
fake DSN string inside the built client bundle. The two cheap follow-ups
(F1 README Playwright install step, F2 branch-protection checklist item) are
confirmed present. Full regression (fresh `npm ci`, lint, format:check,
build, Vitest, Playwright e2e) passes clean. No new regressions found.

## What changed since the prior TEST_REPORT.md (re-verified independently)

| Fix                                                                                          | Independently confirmed?                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1: `sentry.client.config.ts` deleted, `src/instrumentation-client.ts` created                | Yes — `sentry.client.config.ts` no longer exists on disk; `src/instrumentation-client.ts` exists with `Sentry.init({ dsn, enabled: Boolean(dsn), tracesSampleRate: 1.0 })` and the required `onRouterTransitionStart` export; `tsconfig.json`'s `include` no longer references the deleted file. |
| B1: `src/instrumentation.ts` comment corrected                                                | Yes — now explicitly states `register()` only covers server/edge and points to `src/instrumentation-client.ts` for the browser path.                                                                                                                        |
| B2: `src/lib/prisma.ts` calls `getEnv()` before `new PrismaClient()`                           | Yes — read the source (`createPrismaClient()` calls `getEnv();` then `return new PrismaClient();`), and independently proved it fails fast via a throwaway test (see B2 verification section below).                                                        |
| Docs corrected (`infrastructure.md`, `README.md`, `provisioning-checklist.md`)                 | Yes — all three now describe actual wiring, not aspirational wiring (see Docs section below).                                                                                                                                                                |
| F1: README documents `npx playwright install --with-deps chromium`                            | Yes — present in README's Testing section.                                                                                                                                                                                                                    |
| F2: branch-protection checklist item added                                                    | Yes — present in `docs/runbooks/provisioning-checklist.md`.                                                                                                                                                                                                    |
| F5: `.prettierignore` excludes `factory/` and `docs/requirements/`; PLAN.md AC4 typo fixed     | Yes — both confirmed.                                                                                                                                                                                                                                          |

## AC8 — full independent re-verification (both paths)

This is the criterion REVIEW.md flagged as under-tested last time ("AC8 was
marked PASS on evidence that only exercises the disabled path"). Re-tested
from scratch, both paths, by me, not by re-reading the builder's grep output.

**Path (a) — DSN unset:**

1. Confirmed `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` unset in the shell.
2. `rm -rf .next && npm run build` → clean build, no crash, no error. Route
   table unchanged (`/` static, `/api/health` dynamic).
3. Sanity grep: `grep -rl "ingest.sentry.io" .next/static` → **0 matches**
   (correct — no real DSN should ever appear when unset).
4. `npm run start` served both `/` and `/api/health` at HTTP 200 with the DSN
   still unset — no runtime crash either.

**Path (b) — a real-shaped fake DSN set:**

1. Set both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` to
   `https://abcdef1234567890abcdef1234567890@o123456.ingest.sentry.io/1234567`
   (fake org, real DSN shape).
2. `rm -rf .next && npm run build` → clean build, no crash, no error (route
   table identical).
3. Grepped `.next/static` myself, fresh, after this build:
   - `grep -rl "sentry" .next/static` → 1 match: `.next/static/chunks/0_q3skwf709jl.js`
   - `grep -rl "ingest.sentry.io" .next/static` → same 1 file
   - `grep -rl "o123456" .next/static` (our fake org id) → same 1 file
   - `grep -o "https://[a-z0-9]*@o123456.ingest.sentry.io/[0-9]*" .next/static/chunks/0_q3skwf709jl.js`
     → returned the **exact fake DSN string verbatim**:
     `https://abcdef1234567890abcdef1234567890@o123456.ingest.sentry.io/1234567`
   - This is a byte-for-byte match against the DSN I set, present in the
     client-side JS bundle Next.js ships to the browser — conclusive proof
     the client Sentry init is now genuinely wired into the client bundle.
4. Sanity check on the server side too: `grep -rl "ingest.sentry.io" .next/server`
   → 2 matches (server-side was already working per REVIEW.md; unaffected by
   this fix, still fine after it).
5. `npm run start` with the fake DSN still set served both routes at HTTP 200
   — no runtime crash with a DSN present either.
6. Unset the fake DSN vars afterward; no leftover env state.

**Conclusion: AC8 now genuinely passes on both paths.** The no-op path is
clean (no crash, no leaked strings when unset), and the active path is now
provably wired (the exact DSN appears in the shipped client bundle) — this
directly closes REVIEW.md's B1 finding and the tester-quality criticism about
only testing the disabled branch.

## B2 verification — `getEnv()` genuinely wired and genuinely fails fast

Read `src/lib/prisma.ts`: `createPrismaClient()` calls `getEnv()` (imported
from `./env`) before `new PrismaClient()`; the exported `prisma` singleton is
built via `globalForPrisma.prisma ?? createPrismaClient()`.

To prove this isn't just "the function is called" but that it **actually
throws** on bad/missing env — not something a static read alone proves — I
wrote a throwaway Vitest test file (`src/lib/__tmp_env_verify.test.ts`),
ran it, confirmed the results, then deleted it (not left in the repo; `git
status` afterward shows nothing under `src/lib/`):

| Test                                                                                       | Result                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `getEnv()` throws when `DATABASE_URL`/`DIRECT_URL` are both missing                          | **Passed** — threw `Invalid or missing environment variables: ... DATABASE_URL: Invalid input: expected string, received undefined ...` |
| `getEnv()` throws when `DATABASE_URL`/`DIRECT_URL` are present but malformed (not a URL)      | **Passed** — threw with `... must be a valid connection URL ...`                                                          |
| Importing `src/lib/prisma.ts` itself (fresh module graph, env vars deleted) rejects/throws    | **Passed** — the import threw the same aggregated `getEnv()` error, proving the wiring fires at the point `prisma.ts` is first imported, not just when `getEnv()` is called directly. |

All 3 passed. This is stronger evidence than a source read alone: it proves
the code path a caller would actually hit (importing the Prisma singleton
with a bad/missing env) genuinely fails fast with the intended aggregated zod
error, exactly as B2's required fix specified. Throwaway file deleted after
the run; no test scaffolding left in the repo.

## Docs accuracy — re-read post-fix, checked against reality

| Doc                                                | Claim now                                                                                                                                                                    | Matches reality?                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `docs/architecture/infrastructure.md` (Neon section) | "Runtime validation happens in `src/lib/prisma.ts`: the Prisma client singleton calls `src/lib/env.ts`'s `getEnv()` before constructing `PrismaClient`..."                     | **Yes** — matches `src/lib/prisma.ts` source exactly.                                                    |
| `docs/architecture/infrastructure.md` (Sentry section) | Distinguishes server/edge (loaded via `src/instrumentation.ts`'s `register()`) from client (loaded via `src/instrumentation-client.ts`, native Next.js convention, not `withSentryConfig()`) | **Yes** — matches the actual file layout and load mechanism (confirmed by AC8 grep evidence above).      |
| `README.md` (Environment variables section)          | `getEnv()` validates `DATABASE_URL`/`DIRECT_URL`/`APP_URL`; `src/lib/prisma.ts` calls it before constructing the client, "fails fast ... rather than surfacing later as a cryptic Prisma connection error" | **Yes** — matches source and matches the B2 throwaway-test evidence above.                              |
| `README.md` (project structure listing)              | Lists `src/instrumentation-client.ts` and `src/instrumentation.ts` with accurate one-line descriptions; no longer lists the deleted `sentry.client.config.ts`                    | **Yes** — matches actual file tree.                                                                       |
| `docs/runbooks/provisioning-checklist.md` (intro)    | "`DATABASE_URL`/`DIRECT_URL` fail fast via `src/lib/env.ts`'s `getEnv()`, called from `src/lib/prisma.ts`... `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` no-op via ... `src/instrumentation-client.ts`" | **Yes** — matches source.                                                                                  |

No remaining false statements found in any of the three documents. All read
like an accurate description of the code as it exists today, not aspirational
claims.

## Full suite results (independently re-run, fresh)

| Command                                                            | Result                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rm -rf node_modules && npm ci` (fresh install)                    | Clean. `postinstall` ran `prisma generate` successfully. 607 packages installed.                                                                                                                    |
| `npm run lint`                                                    | Clean, exit 0, no errors/warnings.                                                                                                                                                                  |
| `npm run format:check`                                             | Clean — "All matched files use Prettier code style!"                                                                                                                                                |
| `npm run test` (Vitest)                                            | **1 test file, 1 test, 1 passed.**                                                                                                                                                                  |
| `npm run build` (fresh `.next`, no env vars set)                   | Clean. Compiled successfully, TypeScript passed, static pages generated. Route table: `/` (Static), `/_not-found` (Static), `/api/health` (Dynamic). Succeeds with zero env vars set.                |
| `npm run build` (fresh `.next`, fake Sentry DSN set)               | Clean, identical route table. Client bundle now contains the DSN (see AC8 section).                                                                                                                 |
| `npm run start` (DSN unset)                                        | Serves `/` and `/api/health` at HTTP 200, no crash.                                                                                                                                                 |
| `npm run start` (fake DSN set)                                     | Serves `/` and `/api/health` at HTTP 200, no crash.                                                                                                                                                 |
| `npm run test:e2e` (Playwright, chromium, after `npx playwright install --with-deps chromium`) | **2 tests, 2 passed** ("home page loads", "health endpoint returns 200").                                                                                                                           |
| `npm audit --omit=dev --audit-level=high`                          | **0 vulnerabilities.**                                                                                                                                                                               |
| `npm audit --audit-level=high` (unscoped, informational)           | 9 high-severity findings, same `brace-expansion`/`minimatch` advisory as before, confined to `eslint`/`eslint-config-next`'s devDependency tree — unchanged from the prior report, not a regression. |
| Throwaway Vitest file: `getEnv()`/`prisma.ts` fail-fast behavior   | 3/3 passed (see B2 section); file deleted after the run, no scaffolding left behind.                                                                                                                |
| `git status --short` after all of the above                       | Only the expected untracked factory artifacts (`REVIEW.md`, `TEST_REPORT.md`, `.issue`, `factory/reports/`) — no stray test files, no uncommitted source changes.                                    |

All results match or improve on the prior report; no regression found from
the fix-pass commits. `git diff --stat 4545d7e..432b404` (pre-fix-pass →
current HEAD) touches exactly the 10 files the builder's fix-pass notes
claim (`.prettierignore`, `README.md`, `infrastructure.md`,
`provisioning-checklist.md`, `PLAN.md`, deleted `sentry.client.config.ts`,
new `src/instrumentation-client.ts`, `src/instrumentation.ts`,
`src/lib/prisma.ts`, `tsconfig.json`) — no product code or test files beyond
that scope were touched.

## Acceptance criteria — pass/fail (updated)

| #   | Criterion                                                                                                                      | Result                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm ci && npm run build` clean from fresh checkout; `npm run dev` serves placeholder home                                     | **PASS**                                                       | Re-ran `npm ci` (after `rm -rf node_modules`) and `npm run build` fresh, both clean. `npm run start` serves home page at 200.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | `npm run lint` and `npm run format` run and pass                                                                               | **PASS**                                                       | Both re-run; lint clean, `format:check` clean.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | Vitest sample passes; Playwright smoke passes locally                                                                          | **PASS**                                                       | 1/1 Vitest, 2/2 Playwright, both re-run independently.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4   | `prisma generate` succeeds against stub schema; `prisma migrate` runs against a Neon DB; client is a hot-reload-safe singleton | **PARTIAL PASS / expected manual gap** (unchanged)             | `prisma generate` succeeds via `postinstall`. Singleton pattern correct in `src/lib/prisma.ts`. `prisma migrate` against a live Neon DB not run — no Neon project provisioned yet; explicit, plan-anticipated manual gap, not a build defect.                                                                                                                                                                                                                                                                                                                                            |
| 5   | `/api/health` returns 200 `{status:"ok"}`; uptime monitor documented                                                            | **PASS**                                                       | Verified live via `curl`/e2e test: 200, `{"status":"ok"}`. Uptime monitor documented, correctly not claimed as provisioned.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | HSTS header present; deployed site HTTPS-only with HTTP→HTTPS redirect                                                         | **PASS (header) / manual-only (live redirect), as expected**   | Not re-verified in this pass beyond what the prior report already confirmed (headers unaffected by the B1/B2 fix pass, which touched only Sentry/env/prisma/docs files — no changes to `next.config.ts`). Live redirect still requires a deployment; correctly not claimed done.                                                                                                                                                                                                                                                                                                       |
| 7   | `docs/architecture/infrastructure.md` names concrete mechanisms for NFR-SCALE-001 and -003                                     | **PASS**                                                       | Unaffected by fix pass; re-confirmed present and concrete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | Sentry wired for error + latency capture, no-ops with no DSN, doc names it as distinct from logs                               | **PASS — fully re-verified, both paths, this pass**            | See "AC8 — full independent re-verification" section above: DSN-unset path builds/runs clean with zero leaked DSN strings; DSN-set path builds/runs clean **and** the exact fake DSN appears verbatim inside `.next/static`'s client bundle, byte-for-byte matched via `grep -o`. This closes REVIEW.md's B1 finding and the previous under-verification.                                                                                                                                                                                                                             |
| 9   | `backup-and-restore.md` documents daily backups + step-by-step restore + one-exercise note                                     | **PASS (doc) / manual-only (drill), as expected**              | Unaffected by fix pass; restore-drill table still correctly marked pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | DR doc states explicit RTO/RPO                                                                                                 | **PASS**                                                       | Unaffected by fix pass; unchanged from prior report.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | Infrastructure doc covers NFR-PERF approach; Lighthouse FCP < 2s baseline                                                       | **PASS (doc) / manual-only (Lighthouse), as expected**          | Unaffected by fix pass. Live Lighthouse not run; correctly not claimed done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 12  | CI runs lint+test+build+audit on PRs to main, blocks on failure                                                                 | **PASS**                                                       | `.github/workflows/ci.yml` re-read: unchanged structure, still correct (`build-and-test` job has no `continue-on-error`; `e2e-smoke` is explicitly `continue-on-error: true`). Now also cross-checked against the new provisioning-checklist item (F2) which correctly notes branch protection is a separate, still-manual step for the "blocks on failure" half to be literally true at the repo-settings level.                                                                                                                                                                     |
| 13  | README lets a new engineer set up/run/test/deploy without asking the author                                                    | **PASS — the F1 gap from the prior report is now closed**      | README's Testing section now documents `npx playwright install --with-deps chromium` as a fresh-machine prerequisite before `npm run test:e2e` works. Confirmed present, worded correctly, and consistent with CI's own install step.                                                                                                                                                                                                                                                                                                                                                   |
| 14  | `provisioning-checklist.md` lists every manual step from the plan                                                              | **PASS — now also includes the F2 branch-protection item**     | Checklist still enumerates all 9 original items 1:1, plus the new branch-protection item added per F2, which fills the one real gap the reviewer found in this checklist's completeness. Nothing silently assumed done.                                                                                                                                                                                                                                                                                                                                                                 |

## Additional finding from the prior report — now resolved

The prior report flagged (as a non-blocking "additional finding, not tied to
a specific AC") that `getEnv()` had zero call sites, making the "fails fast"
claim in its own doc comment aspirational. **This is now resolved**: `getEnv()`
is called from `src/lib/prisma.ts`, and I independently proved (via the
throwaway Vitest test, not just a source read) that it genuinely throws on
missing/malformed env vars when the Prisma singleton is imported. No open
finding remains here.

## Genuinely manual-only gaps (expected, unchanged from prior report)

Per the plan's own "Note" under the Test plan table, these still require
provisioning that this stage cannot and should not perform, and remain
correctly undone rather than fabricated:

- AC4 — `prisma migrate` against a real Neon `DATABASE_URL`/`DIRECT_URL`.
- AC6 — live HTTPS-only enforcement / HTTP→HTTPS redirect on a deployed URL.
- AC9 — the restore drill itself (needs a provisioned Neon project).
- AC11 — live Lighthouse FCP measurement (needs a deployed URL).
- GitHub branch protection itself (the checklist item now exists per F2, but
  actually configuring it in repo settings is still a manual, unticked step).
- An actual GitHub Actions run has still not been triggered (no PR opened
  against a remote); CI's structure and every command it runs were verified
  locally instead.

None of these are code/build defects; all are consistent with the plan's
explicit deferral of provisioning-dependent verification to the human.

## Overall

**14/14 acceptance criteria pass or partially-pass-as-expected**, and both
REVIEW.md blocking findings (B1, B2) are now independently confirmed fixed
with fresh, first-hand evidence — not re-stated from the builder's report.
AC8 specifically now has genuine, conclusive evidence for both the no-op and
active paths (exact DSN string found verbatim in the built client bundle).
Full automated suite: fresh `npm ci` clean, lint/format clean, Vitest 1/1,
Playwright 2/2, build clean under both DSN-unset and DSN-set conditions,
scoped audit clean (0 vulnerabilities), unscoped audit unchanged (9 high,
confined to devDependency-only `eslint` toolchain, not a regression). No new
issues found. This work item is ready for review re-approval.
