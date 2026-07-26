# REVIEW — project-scaffolding-infra (re-review, post fix-pass)

Reviewer: factory-reviewer (independent). Branch reviewed:
`feature/project-scaffolding-infra` @ `432b404`, 11 commits on top of `743fd91`
(7 original build commits + 4 fix-pass commits). Diff reviewed:
`git diff main...HEAD` (31 files) and, for this pass specifically,
`git diff 4545d7e..HEAD` (the fix pass).

Supersedes the prior CHANGES REQUESTED review of `4545d7e`.

## Verdict: **APPROVED WITH NOTES**

Both blocking findings are genuinely closed. I re-verified each one first-hand
from fresh builds and my own throwaway test — I did not accept the builder's or
tester's evidence. The fix pass is tightly scoped, introduces no product code,
re-litigates nothing, and every doc statement I re-read now matches the code.

Ready for `/factory-ship`, subject to the human completing the manual
provisioning checklist (which is correctly still unticked) and to the
follow-ups below being tracked rather than forgotten.

---

## B1 — Client-side Sentry: **CLOSED**, verified first-hand

The fix deletes `sentry.client.config.ts` and adds `src/instrumentation-client.ts`.

My own evidence — two fresh `rm -rf .next && npm run build` runs, Turbopack (the
build banner reads "Next.js 16.2.12 (Turbopack)"):

| Build                                      | `.next/static` files matching `sentry` | matching `ingest.sentry.io` | containing my exact fake DSN |
| ------------------------------------------ | -------------------------------------- | --------------------------- | ---------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` **unset**         | 1 (SDK code, disabled)                 | **0**                       | **0**                        |
| `NEXT_PUBLIC_SENTRY_DSN` set to a fake DSN | 1                                      | **1**                       | **1**                        |

The DSN-set run put the full literal string
`abc123def456abc123def456abc123de@o987654.ingest.sentry.io/1122334455` — a value
I generated for this review that appears nowhere in the repo — into
`.next/static/chunks/21cu-8mzs2-zv.js`. That is the same chunk referenced by a
`<script src="/_next/static/chunks/..." async>` tag in the prerendered
`.next/server/app/index.html`, so the code is not merely emitted, it is actually
loaded by the browser on the home page. Compare with the prior review, where the
identical grep on a DSN-set build returned **0**. Server-side remains wired
(2 matches under `.next/server`).

The convention choice is correct, checked against the installed SDK rather than
the builder's reasoning. `@sentry/nextjs@10.68.0`'s own source says so:

- `build/cjs/config/webpack.js:212-214` emits "DEPRECATION WARNING: It is
  recommended renaming your `sentry.client.config.ts` file, or moving its
  content to `instrumentation-client.ts`. When using Turbopack
  `sentry.client.config.ts` will no longer work."
- `build/cjs/client/index.js:38` — "It is recommended to call `Sentry.init()`
  once in `instrumentation-client.ts`."
- `build/cjs/config/webpack.js:343-355` (`getInstrumentationClientFile`)
  resolves exactly `src/instrumentation-client.{js,ts}`, then root.
- `captureRouterTransitionStart` is a real export
  (`build/cjs/client/index.js:109`), so the `onRouterTransitionStart` re-export
  in the new file is the correct App Router navigation hook, not cargo cult.

And Next.js itself aliases the file natively:
`node_modules/next/dist/build/create-compiler-aliases.js:164-167` maps
`private-next-instrumentation-client` to `<dir>/src/instrumentation-client`,
then `<dir>/instrumentation-client`, then an empty module. So no
`withSentryConfig()` wrapper is needed for client capture, exactly as claimed —
and I confirmed that empirically under Turbopack above rather than relying on
the webpack-side alias table alone.

AC8 is now met on both halves, for all three runtimes.

## B2 — `getEnv()` wiring and the false doc claims: **CLOSED**, verified first-hand

`src/lib/prisma.ts` now imports `getEnv` and calls it inside
`createPrismaClient()` before `new PrismaClient()`. `grep -rn "getEnv" src/`
shows a real call site at `src/lib/prisma.ts:27`, not just the definition.

A static read only proves a call exists, so I wrote my own throwaway Vitest file
(`src/lib/__reviewer_tmp.test.ts` — run, then deleted; `git status` is clean of
it) exercising the path a caller actually hits:

| Case                                                                | Result                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `getEnv()` with `DATABASE_URL`/`DIRECT_URL` deleted                  | throws, listing **both** vars: "Invalid input: expected string, received undefined"                     |
| `getEnv()` with both set to `"not a url"`                            | throws "DATABASE_URL must be a valid connection URL" / same for `DIRECT_URL`                            |
| `await import("./prisma")` with both vars deleted                    | **throws the aggregated `getEnv()` error**, not a Prisma error — the fail-fast genuinely fires at import |
| `getEnv()` with Neon-shaped pooled + direct URLs (`?pgbouncer=true`) | parses; `APP_URL` defaults to `http://localhost:3000`, `NODE_ENV` resolves                              |

So the mechanism the docs now describe is the mechanism that actually runs. No
call site imports `src/lib/prisma.ts` yet (the health route is deliberately
DB-independent), so this cannot break `next build`/CI — confirmed by the clean
builds above, and CI's placeholder `DATABASE_URL` would parse anyway.

All five previously-false statements re-read and now accurate:

| Location                                         | Now says                                                                                                                                                          | Correct?                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `docs/architecture/infrastructure.md` §2 (Neon)   | validation happens in `src/lib/prisma.ts` via `getEnv()` before `PrismaClient`                                                                                     | Yes                                             |
| `docs/architecture/infrastructure.md` §4 (Sentry) | server/edge via `instrumentation.ts`'s `register()`; client via `src/instrumentation-client.ts`, explicitly not `sentry.client.config.ts`, with the Turbopack reason | Yes — matches the SDK source quoted above       |
| `README.md` Environment variables                | `getEnv()` validates the three vars; `prisma.ts` calls it first                                                                                                    | Yes                                             |
| `README.md` project structure                    | lists `instrumentation-client.ts`; the deleted file is gone from the listing                                                                                       | Yes                                             |
| `docs/runbooks/provisioning-checklist.md` intro   | splits fail-fast (DB vars) from no-op (Sentry DSNs) and names the exact files                                                                                      | Yes                                             |

`src/lib/env.ts`'s own doc comment is also now true — it describes lazy
validation at the point of use, which is what happens.

## Scope of the fix pass — clean, no creep

`git diff 4545d7e..HEAD` touches exactly 10 files and nothing else:
`.prettierignore`, `README.md`, `docs/architecture/infrastructure.md`,
`docs/runbooks/provisioning-checklist.md`, `PLAN.md`, deleted
`sentry.client.config.ts`, new `src/instrumentation-client.ts`,
`src/instrumentation.ts`, `src/lib/prisma.ts`, `tsconfig.json`.

- **No product code.** `src/app/**`, `prisma/schema.prisma`, `next.config.ts`,
  `playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs` untouched.
- **Nothing settled was re-opened.** `package.json` (including the `overrides`),
  `.github/workflows/ci.yml` (including the `--omit=dev` audit scoping),
  `disaster-recovery.md` and `backup-and-restore.md` are byte-identical to
  `4545d7e`. The audit-scoping decision I previously assessed as defensible was
  left alone rather than quietly re-argued.
- `tsconfig.json`'s `include` correctly drops the deleted file (one line) and
  needs no entry for `src/instrumentation-client.ts` — `**/*.ts` already covers it.
- The three folded-in follow-ups landed as specified. **F1**: README documents
  `npx playwright install --with-deps chromium`. **F2**: the checklist gained a
  branch-protection item naming the real job (`Lint, test, build, audit`,
  matching `ci.yml:11` — I checked the string). **F5**: `.prettierignore` now
  excludes `factory/` and `docs/requirements/`, and the PLAN.md `DATABASE*URL`
  mangling is repaired.

## Regression check — independently re-run

| Command                                              | Result                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run lint`                                       | exit 0, clean                                                         |
| `npm run format:check`                               | "All matched files use Prettier code style!"                          |
| `npm run test` (Vitest)                              | 1 file / 1 test passed                                                |
| `npm run test:e2e` (Playwright chromium)             | 2/2 passed                                                            |
| `npm run build`, DSN unset and DSN set, fresh `.next` | exit 0 both; identical route table (`/` static, `/api/health` dynamic) |
| `npm audit --omit=dev --audit-level=high`            | 0 vulnerabilities                                                     |
| `git status --porcelain`                             | only the expected untracked factory artifacts                         |

Spot-check of the non-blocking material from the original review: still true.
Audit scoping unchanged and still defensible; stack fidelity intact
(`infrastructure.md` still records the fixed stack as accepted context rather
than re-deciding it); DR/backup docs still substantive with real RTO/RPO numbers
and the restore-drill table still honestly marked pending; all nine manual
provisioning items still unchecked.

## Test quality — the previous criticism is answered

My prior objection was that AC8 was marked PASS on evidence that exercised only
the disabled branch. TEST_REPORT.md now tests both branches, and its DSN-set
evidence is the right kind (a byte-for-byte grep of the shipped client bundle).
I reproduced the result with a **different** fake DSN of my own, so it is not an
artifact of their setup. Their B2 throwaway-test approach matches mine and
reached the same conclusions. Their claim that the fix-pass diff touches exactly
10 files is accurate — I verified it against the diff.

---

## Follow-ups (non-blocking, should be tracked)

Carried forward, still open and still non-blocking: **F3** (make the
`--omit=dev` audit scoping a tracked item with an owner, and add a second,
non-blocking unscoped `npm audit` step so dev findings stay visible); **F4**
(undocumented `postcss`/`sharp` `overrides` in `package.json` — builder note 3's
"pre-existing" characterization is still inaccurate, since this branch creates
the file); **F6** (`playwright.config.ts`'s "CI builds first" comment is wrong;
CI pins Node 20 while the toolchain was verified on Node 24).

New from this pass:

- **F7 — no source-map upload, so production Sentry stack traces will be
  minified.** This was a secondary consequence of B1 in the original review and
  the chosen fix does not address it: `withSentryConfig()` is what installs the
  source-map upload / release-association plugin, and `next.config.ts` still
  does not use it. Nothing in the docs falsely claims otherwise — I grepped
  `docs/`, `README.md`, `.env.example` and `.github/` for `source map`,
  `SENTRY_AUTH` and `withSentryConfig`, and the only hits are the accurate
  `infrastructure.md` explanation — so this is an honest gap, not a false claim.
  It needs a `SENTRY_AUTH_TOKEN`, which is a provisioning-time secret; the
  natural home is a new provisioning-checklist item plus adding the
  `withSentryConfig()` wrapper at that point. `instrumentation-client.ts` and
  `withSentryConfig()` coexist fine, so adding the wrapper later will not
  re-break B1.

- **F8 — the Sentry client SDK now ships to the browser even when the DSN is
  unset.** Measured on one machine, DSN unset both times: `.next/static/chunks`
  totals **851,653 bytes with** `src/instrumentation-client.ts` present versus
  **627,120 bytes with it temporarily removed** — about **+225 KB raw (+36%)**,
  concentrated in one 452 KB chunk. This is the normal cost of client-side
  Sentry, and the chunk is loaded `async` (not render-blocking), so AC11's
  Lighthouse FCP target is very unlikely to be affected. But it is a real change
  introduced by the B1 fix that nobody measured, and it means "no-op when the
  DSN is unset" is a *runtime* no-op, not a bundle-size one. Worth a glance when
  the manual Lighthouse check (AC11) is actually run, and a reason to consider
  lazy-loading Sentry if the perf budget ever tightens. The docs do not
  overclaim here — they say "never error and never attempt a network call,"
  which is exactly what I observed (0 `ingest.sentry.io` strings when unset).

- **F9 — `README.md:67` says `format:check` is "used in CI indirectly via
  lint/build". It is not.** `.github/workflows/ci.yml` has no formatting step
  and `eslint.config.mjs` has no Prettier integration, so nothing in CI enforces
  formatting. Same class of inaccuracy as B2, but far lower stakes (the
  consequence is formatting drift, not a missing safety mechanism), and it
  predates the fix pass. Cheapest fix is to add an `npm run format:check` step
  to the `build-and-test` job, which also makes the sentence true.

---

## Bottom line

`/factory-ship` is appropriate. The two blocking items are closed on evidence I
produced myself: the exact DSN string I invented is present in the Turbopack
client bundle and in a chunk the home page actually loads, and importing
`src/lib/prisma.ts` with the DB env vars deleted throws `getEnv()`'s aggregated
error. The docs now describe the code that exists. The fix pass changed nothing
outside its declared blast radius.

The remaining gaps in this work item are the ones the plan always said would be
manual — Neon/Vercel/Sentry/uptime-monitor provisioning, the restore drill, the
live HTTPS redirect check, the Lighthouse baseline, and GitHub branch protection
— and they are all correctly enumerated and unticked rather than assumed done.
