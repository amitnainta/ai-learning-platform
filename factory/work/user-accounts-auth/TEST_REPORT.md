# TEST_REPORT — user-accounts-auth

Independent verification pass. Everything below was re-run from scratch on this
machine (fresh `npm ci`, real local Postgres at `localhost:5432/ai_learning_platform`
using the pre-existing `.env.local`), not taken on the builder's word. Where a
builder claim didn't hold up on first try, the investigation and resolution are
documented inline.

## Overall verdict: PASS

All 18 acceptance criteria are met. Full automated suite is green (72/72 Vitest,
12/12 Playwright e2e, lint/format/tsc/build/production-audit all clean). The two
"genuine deviation" bug fixes recorded in the Builder notes were independently
reproduced and confirmed fixed. The rate limiter and account-deletion cascade —
the two highest-consequence mechanisms — were independently stress-tested beyond
what the automated suite covers and both behaved correctly. No defects found in
committed code. Two non-blocking observations are flagged below (not acceptance
criteria failures): a narrow server-side input-validation gap, and the absence of
a defense-in-depth `NODE_ENV` guard around the e2e rate-limit override.

## Environment notes (read before the results below)

- **`npm audit` (unscoped) reports 9 high-severity findings** — all transitively
  from ESLint's own dependency tree (`brace-expansion` ReDoS via
  `eslint`/`eslint-config-next`'s bundled plugins), confirmed present identically
  on `main`'s lockfile too (pre-existing, not introduced by this work item), and
  a **dev-only** dependency chain — nothing in the production bundle. CI
  deliberately scopes its audit step to `npm audit --omit=dev --audit-level=high`
  for exactly this reason, with a dated comment explaining why. I re-ran that
  exact scoped command: **0 vulnerabilities**. The builder's "audit clean" claim
  is accurate under the command CI actually runs; it's misleading only if read as
  "unscoped audit clean," which nobody claimed.
- **`npm run format:check` initially failed on `package.json`** in my checkout.
  Root-caused: this Windows machine has a global `core.autocrlf=true` and the
  repo has no `.gitattributes`, so `package.json`/`package-lock.json` (but not
  other tracked files, which weren't re-touched by any checkout operation in my
  session) picked up CRLF line endings on disk. `git diff`/`git status` showed
  the tree as clean throughout because git auto-renormalizes for comparison, and
  `git cat-file -p HEAD:package.json` / `git show` both confirm the **committed
  blob is LF-only**, correctly Prettier-formatted. Forcing a clean LF checkout
  (`rm` + `git -c core.autocrlf=false checkout HEAD -- package.json`) made
  `format:check` pass immediately with no diff. This is a local-machine artifact,
  not a defect in the branch — flagged here for completeness, not as a failure.
- **`npm run build` initially failed** with a Prisma native-engine error
  ("paging file is too small") and an argon2 native-binding load failure. This
  machine had ~2.6 GB free RAM out of 16 GB at the time (confirmed via
  `Get-CimInstance Win32_OperatingSystem`), matching Builder note #6's
  documented low-RAM local environment. Retrying with a reduced worker count
  (`CIRCLE_NODE_TOTAL=2`, the same env var Builder note #6 documents using
  locally) succeeded cleanly. Not a code defect; CI runners don't share this
  constraint and none of this workaround is wired into committed config
  (correctly — Builder note #6 says the same).

## Fresh toolchain re-run

| Check | Result |
| --- | --- |
| `npm ci` | Installs cleanly (603 packages) |
| `npm run lint` | Clean, exit code 0 |
| `npm run format:check` | Clean on the actual committed (LF) content — see note above |
| `npx tsc --noEmit` | Clean, no output |
| `npm run build` | Succeeds (with reduced worker count for local RAM — see note above) |
| `npm audit --omit=dev --audit-level=high` (the command CI runs) | 0 vulnerabilities |
| `npm audit` (unscoped) | 9 high, all dev-only/ESLint-transitive, pre-existing on `main` too |
| `npm run test` (Vitest) | **72/72 passed, 8 files** |
| `npm run test:e2e` (Playwright, real local Postgres) | **12/12 passed** |

## Spot-checked test quality (not tautological)

Read in full and confirmed to exercise real behavior, not just assert their own
mocks:

- `src/lib/auth/__tests__/password.test.ts` — hashes via the real
  `@node-rs/argon2` module (no mocking), asserts `$argon2id$` prefix, salt
  uniqueness across two hashes of the same password, and a genuine
  verify-reject on wrong password.
- `src/lib/auth/__tests__/options.test.ts` — imports the real
  `buildAuthOptions()` (only `../prisma` mocked) and asserts on the actual
  returned object: database session storage, 14-day/1-day expiry values, real
  rate-limit rule numbers (5/15min, 10/hr, 3/hr, 5/hr) matching AC6 exactly,
  `rateLimit.enabled` true by default and false only when
  `E2E_DISABLE_RATE_LIMIT` is explicitly set, cookie `sameSite: lax`.
- `src/app/api/account/__tests__/export.test.ts` — imports the real route
  handler, asserts the response body never contains `"password"`, `token`,
  `accessToken`, `refreshToken`, `idToken`, or `"value"` anywhere in the
  serialized text, and that the Prisma `select` for sessions doesn't even
  request the `token` column.
- `src/components/account/__tests__/delete-account-form.test.tsx` — real RTL
  render + `user-event` typing; confirms the button stays disabled on an exact
  substring, a case mismatch, and trailing whitespace, and only enables/submits
  on an exact match.
- `src/lib/mail/__tests__/mailer.test.ts` — confirms the Resend API key never
  appears in any `console.log`/`console.error` call, on both success and
  failure paths.

No tautologies found (no test that mocks a function and then asserts the mock
was called with its own return value as the only assertion).

## Independent manual verification beyond the automated suite

### Rate limiter (AC6) — directly stress-tested against a real dev server

With `E2E_DISABLE_RATE_LIMIT` **unset** (confirmed absent from `.env.local`),
started `npm run dev` and fired 7 `POST /api/auth/sign-in/email` requests from
the same simulated IP (`X-Forwarded-For: 203.0.113.77`):

```
Attempt 1-5: HTTP 401 (invalid credentials, as expected)
Attempt 6:   HTTP 429
Attempt 7:   HTTP 429
```

Queried the `RateLimit` Postgres table directly afterward:
`{ key: "203.0.113.77|/sign-in/email", count: 5, ... }` — confirms the counter
is a real database row, not an in-process counter.

**Killed the dev server process entirely and started a fresh one** (new PID, empty
in-process memory), then immediately repeated the same request from the same IP:
still **HTTP 429** on the very first request. This proves the limiter is
genuinely database-backed and would survive a serverless cold start / new
instance, per NFR-SCALE-001 — it is not an in-memory counter that happened to
look database-backed in the unit test.

A request from a different simulated IP (`198.51.100.42`) in the same window got
a normal `401`, confirming the limit is correctly scoped per-IP, not global.

### Account deletion cascade + immediate session invalidation (AC10) — direct curl + DB queries

Registered a user via the raw API, captured the session cookie, confirmed it was
valid (`GET /onboarding` → `200`), confirmed `Session`/`Account` rows existed
(1 each) via Prisma, then called `DELETE /api/account` with the correct typed
confirmation using that same cookie:

- `DELETE /api/account` → `200 { success: true }`
- **Same request cycle, no delay**: re-requesting `/onboarding` with the
  identical stale cookie → `307` redirect to `/sign-in?next=%2Fonboarding`
  (not eventually — immediately, first request after deletion).
- Direct Prisma query: `User` row → `null`, `Session` rows → `0`, `Account`
  rows → `0`. Full cascade confirmed at the database level, not inferred from
  UI behavior.

### Script-tag display name (NFR-SEC-007) — direct curl + HTML/JSON inspection

Registered `name: "<script>alert(1)</script>"` via the raw API (bypasses the UI
entirely). Confirmed:
- Stored verbatim in the DB (correct — sanitization belongs at render time, not
  by mangling stored data).
- `/dashboard` HTML response: `grep` for the raw tag → 0 occurrences; `grep` for
  `&lt;script&gt;alert(1)&lt;/script&gt;` → present. Rendered as escaped literal
  text via React's default JSX escaping (`{user.name}`, no
  `dangerouslySetInnerHTML` anywhere in the component).
- `e2e/auth-registration.spec.ts`'s own script-tag test goes further than my
  manual check: it asserts `window.__xss` is `undefined` after registering with
  a name containing an inline script that would set that global if executed —
  i.e. it proves non-execution, not just escaped markup.

### Export endpoint payload (AC9) — direct curl inspection

`GET /api/account/export` for the script-tag test user returned a JSON body with
`Content-Disposition: attachment; filename="account-export-2026-07-27.json"` and
a body containing `profile` (id, name, email, role, level, timestamps) and
`sessions` (createdAt/updatedAt/expiresAt/ipAddress/userAgent only). `grep -io
"password\|token"` across the full response body: no matches.

### Email verification link (decision #8 / AC12) — end-to-end, not just unit-tested

Registered a user (`emailVerified: false` in the sign-up response), read the
real verification link out of `.mail-outbox/` (file transport), `curl`'d it
directly, and confirmed via Prisma that `emailVerified` flipped to `true`
immediately afterward. **Note**: no Playwright spec exercises this full flow
(the automated suite covers the template containing the link and the banner's
existence in code, but not clicking the link or asserting the banner is visible
in a browser) — see the coverage-gap note under AC12 below.

### The two "genuine deviation" bug fixes — read and independently exercised

1. **Age-acknowledgment wiring** — read `sign-up-form.tsx`: confirmed
   `minimumAgeAcknowledgedAt: new Date()` is passed to `authClient.signUp.email(...)`.
   Independently confirmed via `e2e/auth-registration.spec.ts`'s own DB
   assertion (`user?.minimumAgeAcknowledgedAt` not null) passing, and via my own
   manual registration + `findUnique` query showing the field populated.
2. **Redirect-loop fix** — read `middleware.ts` (now only redirects the
   no-cookie → protected-path direction) and `sign-in/page.tsx`/`sign-up/page.tsx`
   (now call the authoritative `getCurrentUser()` before redirecting an
   already-authenticated visitor away). Independently exercised via
   `e2e/auth-password-reset.spec.ts`'s "prior session dies" assertion, which
   passed cleanly with no `ERR_TOO_MANY_REDIRECTS` (the exact failure mode the
   bug produced before the fix, per the builder notes).

### `E2E_DISABLE_RATE_LIMIT` scoping — checked for the two specific leak vectors asked about

- **Not settable via a request header or any client-controlled value.** It's
  read once via `getEnv()` → `process.env.E2E_DISABLE_RATE_LIMIT`, a
  server-process environment variable. No request path (header, query param,
  body) feeds into it anywhere in `src/lib/env.ts` or `src/lib/auth/options.ts`.
  Confirmed by grep: the only two places in the entire repo that *set* it are
  `playwright.config.ts`'s `webServer.env` (a subprocess env block for the
  locally-spawned test server only) and its own `options.test.ts` unit test
  (`vi.stubEnv`). It is **not** set anywhere in `.github/workflows/ci.yml`'s job
  env, and deliberately **not** documented in `.env.example` (comment in
  `env.ts` says so explicitly) — so nothing points a human at accidentally
  adding it to a real Vercel project's env vars.
- **Gap found (non-blocking, worth a follow-up)**: `options.ts` reads
  `env.E2E_DISABLE_RATE_LIMIT` and disables the limiter unconditionally when
  true — there's no additional `NODE_ENV !== "production"` (or similar)
  belt-and-suspenders check at the read site. Practically the risk is low (it's
  not documented in `.env.example`, isn't set in any CI job env, and would
  require someone to deliberately add it to Vercel's dashboard), but the code
  itself doesn't defend against that mistake the way, say, a
  `NODE_ENV === "test" && E2E_DISABLE_RATE_LIMIT` compound check would. I did
  not treat this as a failing acceptance criterion — none of the 18 ACs demand
  it — but it's worth flagging explicitly since the task asked me to look for
  exactly this class of mistake.

### Server-side input validation — narrow gap found (non-blocking)

`src/lib/validation/account.ts`'s `signUpSchema` (100-char name cap,
control-character stripping) is enforced **client-side only**, in
`sign-up-form.tsx`. I registered a user by calling
`POST /api/auth/sign-up/email` directly (bypassing the UI/Zod entirely) with a
300-character name: it succeeded with `HTTP 200` and stored the full untrimmed
300-char name. This doesn't create an XSS hole (the name still round-trips
escaped through React on render — separately confirmed above) and doesn't fail
any of the 18 acceptance criteria as written (none assert server-side length
enforcement; decision #10 in PLAN.md scopes auth mutations through the Better
Auth client, and Better Auth's own config only enforces password length, not
name shape). But it is a real gap relative to the *spirit* of the
`NFR-SEC-007` "Partial / seeded" note in PLAN.md ("validated, normalized, and
length-capped via Zod") — that's only true for traffic that goes through the
UI form, not for direct API callers. Contrast with `PATCH /api/account/profile`
and `DELETE /api/account`, which **do** re-validate with the same Zod schemas
server-side inside their own route handlers (confirmed by reading both). Worth
a follow-up: run `signUpSchema` server-side too, e.g. in a Better Auth
`before` hook on `/sign-up/email`.

## Acceptance criteria — verified individually

| # | Criterion (abridged) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Register at `/sign-up`, 12+ char password, cannot submit without age-ack; `minimumAgeAcknowledgedAt` set | **PASS** | `e2e/auth-registration.spec.ts` (2 tests, both green); independently re-registered via curl and confirmed the field via Prisma; age-ack wiring bug fix independently verified in source |
| 2 | Password never plaintext; `$argon2id$` hash; two hashes of same password differ; no log/response leaks it | **PASS** | `password.test.ts` (5 tests, real argon2, no mocking); `mailer.test.ts` proves no secret leaks into logs; grepped all curl responses in this session for plaintext passwords — none found |
| 3 | Sign in/out; wrong password gives a generic failure | **PASS** | `e2e/auth-login-logout.spec.ts` (3 tests); independently curl'd a wrong-password attempt → generic `401`/`Invalid email or password` |
| 4 | Sessions are DB rows behind httpOnly/SameSite=Lax/secure-in-prod cookie; deleted on sign-out; 14-day/1-day rolling expiry; password reset kills **all** sessions | **PASS** | `options.test.ts` asserts the exact expiry values and cookie flags; `e2e/auth-login-logout.spec.ts` confirms cookie clears on sign-out and `/dashboard` then redirects; `e2e/auth-password-reset.spec.ts` proves a pre-reset session dies — independently reproduced via direct DB session-row inspection (see manual section above) |
| 5 | Forgot/reset flow works end to end; old password fails; unknown-address reset shows identical confirmation | **PASS** | `e2e/auth-password-reset.spec.ts` (2 tests, both green, using the real file-outbox reset link) |
| 6 | Rate limiting: 429 after 5/15min sign-in, 3/hr forgot-password, 10/hr sign-up, 5/hr reset; DB-backed, not in-memory | **PASS** (manual, as the plan itself specifies) | Independently stress-tested with `E2E_DISABLE_RATE_LIMIT` unset against a live dev server: 6th sign-in attempt from one IP → `429`; a different IP unaffected; counter confirmed as a real `RateLimit` row; **limit still enforced immediately after a full process restart**, proving DB-backed not in-memory. Plan's own test-plan table classifies this as Manual (scripted burst) — that's exactly what was done here, not left untested. |
| 7 | Post-registration lands on `/onboarding` with exactly 4 archetypes + "not sure yet" + 3 levels; persists; dashboard reflects it | **PASS** | `e2e/auth-registration.spec.ts` registers, selects `TECHNICAL_BUILDER`/`ZERO_KNOWLEDGE`, asserts dashboard shows both |
| 8 | Change role/level from `/account`; persists across sign-out/sign-in | **PASS** | `e2e/account-profile.spec.ts` (full re-login round trip, both fields asserted after) |
| 9 | `GET /api/account/export` returns downloadable JSON, no password hash, no session/verification tokens | **PASS** | `export.test.ts` (5 tests); `e2e/account-data.spec.ts`; independently curl'd the export for a live user and grepped for `password`/`token` — none found; attachment header confirmed |
| 10 | Deletion requires exact typed email; `User`+`Session`+`Account`+`Verification` gone immediately; cookie cleared; sign-in then fails; confirmation email sent; email failure doesn't block deletion | **PASS** | `e2e/account-data.spec.ts`; `delete-account-form.test.tsx`; independently verified via direct curl+DB: session/account rows dropped to 0, user row null, stale cookie rejected on the very next request (not eventually); route code confirms the mail-send failure is caught/logged, never rolls back the delete |
| 11 | Anonymous can browse `/`; `/dashboard`, `/onboarding`, `/account` redirect to `/sign-in`; enforced server-side by `requireUser()`, not just middleware | **PASS** | `e2e/auth-login-logout.spec.ts`; read `middleware.ts` (UX-only, documented as such) and `session.ts` (`requireUser()` as the authoritative gate, called from every protected page/route read in this review) |
| 12 | Verification email sent on sign-up; link sets `emailVerified=true`; unverified user can still sign in/onboard; dashboard shows banner with working resend | **PASS, with a coverage gap noted** | `mailer.test.ts` confirms the template contains the link; independently followed a real verification link end-to-end via curl and confirmed `emailVerified` flipped to `true`; read `verify-email-banner.tsx` confirming a dismissible banner with a working resend button (`authClient.sendVerificationEmail`). **Gap**: no Playwright spec clicks the verification link or asserts the banner renders in a real browser session — this was proven correct only by my manual curl-based check, not by the committed automated suite. Recommend adding e2e coverage as a low-cost follow-up. |
| 13 | No `HealthCheck`/product-feature models; migration applies cleanly; `email` unique; `Session.userId`/`expiresAt` indexed | **PASS** | Read `prisma/schema.prisma` directly — confirmed; `npx prisma migrate status` against the local DB: "Database schema is up to date," single migration, applies cleanly |
| 14 | Tailwind v4 active; `npm run build` succeeds; styled/usable at 375/768/1280px; `npm run format` sorts classes with no diff | **PASS for build/format; responsive check is a manual-only gap, as the plan itself classifies it** | Build succeeds (see toolchain table); `format:check` clean on committed content; visual responsive verification at three breakpoints was not performed (no browser/visual tooling was in scope for this pass) — plan's own test-plan table marks this Manual, so this is an expected, not a missed, gap |
| 15 | Every input labeled; errors in `aria-live`; full flows keyboard-navigable with visible focus | **PASS for the automatable half; keyboard/focus walkthrough is a manual-only gap, as planned** | `sign-up-form.test.tsx` and `delete-account-form.test.tsx` assert label association (`getByLabelText` succeeding is itself a label-wiring proof) and `aria-live` regions (read in source across all forms — every error slot uses `aria-live="polite"`); a live keyboard-only walkthrough was not performed — plan's own test-plan table marks this Manual |
| 16 | Script-tag display name stored literally, rendered escaped, no execution | **PASS** | `e2e/auth-registration.spec.ts`'s XSS test proves non-execution via `window.__xss` check, not just escaped markup; independently reproduced via curl + HTML grep on `/dashboard` and the export JSON |
| 17 | `lint`/`test`/`test:e2e` pass locally; CI runs lint/unit/build/audit, and a separate blocking e2e job against real Postgres with migrations applied | **PASS** | All four commands independently re-run and green (see toolchain table); `.github/workflows/ci.yml` read directly: `postgres:16` service, `prisma migrate deploy` step, no `continue-on-error` on the `e2e` job |
| 18 | `docs/architecture/auth.md`, README env/setup section, provisioning-checklist additions all exist and describe shipped behaviour incl. graceful `RESEND_API_KEY` degradation | **PASS** | All three files read; `auth.md` (286 lines) covers decisions #3-8 with rejected alternatives; README documents `BETTER_AUTH_SECRET`/`RESEND_API_KEY`/console-fallback behaviour; provisioning checklist has the 7 new "Added by user-accounts-auth" items, all correctly still unchecked |

## Manual-provisioning checklist state (task 9 in the parent instructions)

Confirmed: **all 7 new "Added by user-accounts-auth" checklist items** in
`docs/runbooks/provisioning-checklist.md` are unchecked (`- [ ]`). Confirmed
`.env.local` has real values for all required vars locally (that's how this
whole verification pass ran a real DB/build), but nothing in the **committed
codebase** silently assumes a real Resend key, a verified sending domain, a
Vercel deployment, or GitHub branch protection:
- `RESEND_API_KEY` unset in `.env.example` and optional in `env.ts`'s schema;
  `mailer.ts`'s transport resolution degrades to `console`/`file` without it —
  confirmed by the `mailer.test.ts` "does not throw when no Resend key is
  configured" test, which is real (not tautological).
- No hardcoded Vercel/domain assumption found anywhere in `src/` (grepped for
  `vercel.app` and the like — none in application code, only in the
  provisioning-checklist doc itself, describing the manual step).
- CI's own job env uses placeholder secrets explicitly labeled as such
  (`BETTER_AUTH_SECRET: "ci-placeholder-secret-not-real-min-32-chars"`), never
  a real one.

## Full suite result summary

- Vitest: **72/72 passed** (8 test files)
- Playwright e2e: **12/12 passed** (against real local Postgres, `MAIL_TRANSPORT=file`)
- Lint: clean (exit 0)
- Format check: clean (on the correctly-committed LF content)
- `tsc --noEmit`: clean
- Production build: succeeds
- Production-scoped audit (`--omit=dev --audit-level=high`, the command CI runs): 0 vulnerabilities

## Cleanup performed

All test users, sessions, and rate-limit rows created during this manual
verification pass (curl-based registration/deletion/rate-limit tests run
directly against a local dev server, outside the Playwright suite's own
self-cleaning global teardown) were deleted from the shared local Postgres
database afterward. Final state confirmed: 0 users, 0 rate-limit rows. Working
tree is clean (`git status` shows only the pre-existing untracked
`tsconfig.tsbuildinfo`, unrelated to this work item).
