# REVIEW — user-accounts-auth

Independent review stage. I read `PLAN.md` and `TEST_REPORT.md` in full, then
reviewed the actual diff (`git diff main...HEAD`, 7 commits, 73 files) rather
than the plan's description of it. Where a claim was load-bearing I checked it
against the shipped code and, where the behaviour is library-owned, against
`node_modules/better-auth`'s actual implementation.

## Verdict: CHANGES REQUESTED

This is a strong, well-documented build — better than most auth work I would
expect from a single pass. The architecture decisions are sound, the session
model genuinely satisfies NFR-SEC-003, the rate limiter is genuinely
database-backed (the tester's process-restart proof is the right experiment and
I confirmed the mechanism in the library source), the deletion cascade for
`Session`/`Account` is real, and the docs are substantive rather than
ceremonial.

But three things must change before this ships, one of which is a concrete
security defect that neither the builder nor the tester caught, and one of
which is a factual error repeated in the GDPR-erasure decision record. All
three are small fixes; none require rethinking the design.

**Is it safe to ship as-is? No — not as-is.** With C1 and C2 fixed I would be
comfortable shipping this to production under my own name, with the F-items
tracked. C3 is a correctness-of-record fix, cheap either way.

---

## Must fix before ship (blocking)

### C1. Open redirect in the sign-in `next` parameter — `src/components/auth/sign-in-form.tsx:55`

```ts
router.push(next && next.startsWith("/") ? next : "/dashboard");
```

`startsWith("/")` admits protocol-relative URLs. `/sign-in?next=//evil.example`
passes the guard, and `//evil.example` resolves against the current origin to
`https://evil.example` — an off-site navigation immediately after a successful
credential submission. That is the textbook shape of an open redirect used to
amplify credential phishing, and it lives on the one page where it matters most.
(A leading `/\` should be rejected too — some browsers normalise the backslash.)

The `next` value written by `src/middleware.ts` and `requireUser()` is always a
safe pathname, so this is only reachable via an attacker-crafted URL — which is
exactly the delivery mechanism for this class of bug.

**Fix**: reject anything that is not a single-slash-prefixed path (e.g. also
require `!next.startsWith("//")` and no leading `/\`), or resolve against
`window.location.origin` and compare origins. Add a unit test for
`//evil.example`, a backslash variant, and `https://evil.example`.

Not covered by any existing test — `e2e/auth-login-logout.spec.ts` exercises the
happy path only.

### C2. Sign-up is not validated server-side at all — including the minimum-age acknowledgment (NFR-SEC-011)

The tester flagged the 100-char name cap as a client-only gap and rated it
non-blocking. I agree with the finding and disagree with the rating, because the
same root cause has a second consequence the tester did not surface:
**`minimumAgeAcknowledgedAt` is also enforced only in the browser.**

`src/components/auth/sign-up-form.tsx:50` is what supplies the timestamp, after
client-side `signUpSchema` validation. It is declared as a Better Auth
`user.additionalFields` entry with `input: true` (`src/lib/auth/options.ts:106-114`),
so a direct `POST /api/auth/sign-up/email` can omit it entirely — producing a
`User` row with `minimumAgeAcknowledgedAt: null`, i.e. an account with no age
acknowledgment on record — or supply an arbitrary/backdated value. There is no
Better Auth `before` hook and no server-side re-validation anywhere on the
sign-up path (contrast `PATCH /api/account/profile` and `DELETE /api/account`,
which both correctly re-run their Zod schema server-side).

This contradicts three explicit claims:

- PLAN.md requirement list: "**NFR-SEC-011** — minimum-age acknowledgment
  required at registration, recorded on the user record."
- PLAN.md NFR-SEC-007 note: name is "validated, normalized, and length-capped
  via Zod" — true only for UI traffic.
- `docs/architecture/auth.md` §8: "a required checkbox ... that cannot be skipped".

I accept the counter-argument that a self-attestation checkbox is trivially
defeated by simply ticking it, so server-side enforcement adds little protection
against a lying minor. That is not the point: the value of NFR-SEC-011 is the
*record* ("we hold an acknowledgment for every account"), and a nullable column
that is genuinely null for API-created accounts destroys that record. It is also
a compliance control the platform will be asked to evidence.

**Fix**: one Better Auth `before` hook on `/sign-up/email` that runs
`signUpSchema` server-side (name trim + control-strip + 100-char cap, email
normalisation) and stamps `minimumAgeAcknowledgedAt` server-side rather than
trusting the client value. That single hook closes both halves. Add a test that
calls the endpoint directly with a 300-char name and with no acknowledgment
field.

### C3. `Verification` rows are **not** deleted on account deletion — four documents say they are

`prisma/schema.prisma:110-120` gives `Verification` no `userId` relation, and
`prisma/migrations/20260726191014_init_accounts/migration.sql` confirms only two
foreign keys exist (`session_userId_fkey`, `account_userId_fkey`). So
`prisma.user.delete()` in `src/app/api/account/route.ts:45` cascades `Session`
and `Account` and leaves `Verification` untouched. Nothing else in the codebase
cleans them up, and there is no scheduled purge.

Four places assert the opposite:

- PLAN.md decision #2 — "cascading to `Session`, `Account`, and `Verification` rows"
- PLAN.md AC10 — "all its `Session`, `Account`, and `Verification` rows are gone"
- `docs/architecture/auth.md` §9 — "cascading to `Session`/`Account`/`Verification` via `onDelete: Cascade`"
- `e2e/helpers/db.ts:31-33` — same claim in the cleanup helper docstring

The tester marked AC10 **PASS** on evidence that checked `User`, `Session` and
`Account` row counts only; the `Verification` clause was never verified. Neither
does `e2e/account-data.spec.ts`.

**Actual blast radius is small** — I checked what Better Auth stores: email
verification tokens are stateless JWTs and never hit this table at all, and
password-reset rows are `identifier = "reset-password:<token>"`,
`value = <userId>`. So the residue is a random token plus a now-dangling user id,
not an email address, and a reset attempt against a deleted user fails anyway.
This is a records/accuracy defect, not a PII leak.

It is blocking because it sits inside a GDPR-erasure decision record that a
future reader (or auditor) will take at face value. **Fix either way, roughly
five minutes**: add `await prisma.verification.deleteMany({ where: { value: user.id } })`
to the delete route and assert it, **or** correct all four statements to say
exactly what happens and why the residue is harmless. Do not leave the docs
asserting a cascade that does not exist.

---

## Fine as tracked follow-ups (non-blocking)

### F1. `x-forwarded-for` trust model is unverified for the deployed environment (highest-value follow-up)

`advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]` with no
`trustedProxies`. Reading `@better-auth/core/src/utils/ip.ts` and
`better-auth/dist/api/rate-limiter/index.mjs`, that configuration has two
failure modes worth knowing about before real traffic:

1. **A single-value header is trusted verbatim.** If the hosting layer does not
   overwrite a client-supplied `X-Forwarded-For`, the entire NFR-SEC-005 limiter
   is bypassable by rotating the header. (The tester own manual test — spoofing
   `X-Forwarded-For: 203.0.113.77` against a local server and getting per-IP
   scoping — is a demonstration of exactly this trust.)
2. **A multi-hop header resolves to nothing, and the fallback is a single global
   bucket.** `getIPFromHeader` returns `null` for a comma-separated chain when
   `trustedProxies` is unset; the limiter then keys on the literal string
   `no-trusted-ip`. That collapses "5 sign-ins per 15 min per IP" into "5
   sign-ins per 15 min for the entire platform" — an unauthenticated global
   lockout DoS, triggerable by anyone, if the platform appends rather than
   replaces the header.

Neither is a defect in this diff; both are configuration assumptions that are
correct on some hosts and catastrophic on others, and nothing in the repo records
which one Vercel does. **Add to `docs/runbooks/provisioning-checklist.md`**: after
the first real deploy, confirm the resolved rate-limit key is a real client IP
and not `no-trusted-ip`, and that a spoofed header does not change it. Set
`trustedProxies` if it does.

### F2. `E2E_DISABLE_RATE_LIMIT` has no environment guard — and the obvious guard would break e2e

I agree with the tester that this is non-blocking: it is server-env-only,
absent from `.env.example`, and unreachable from any request input (I re-verified
the read path through `src/lib/env.ts` and `src/lib/auth/options.ts`). Defence in
depth is still worth having, but note a trap the tester did not: a
`NODE_ENV !== "production"` compound check **would break the e2e suite**, because
`playwright.config.ts:51` deliberately forces `NODE_ENV: "production"` for the
webServer. Any guard has to key on something else — e.g. require the resolved
`APP_URL` host to be `localhost`/`127.0.0.1`, or gate on `process.env.CI`.

### F3. Three files claim `E2E_DISABLE_RATE_LIMIT` is set in `.github/workflows/ci.yml`. It is not.

`docs/architecture/auth.md` §4 ("set to `true` in exactly two places ... and the
`e2e` job env in `.github/workflows/ci.yml`"), `src/lib/auth/options.ts:47-48`,
and `src/lib/env.ts:54-56` all say this. The CI e2e job env block
(`.github/workflows/ci.yml:90-101`) does not set it — it is set only by
`playwright.config.ts`'s `webServer.env`, which the CI job then invokes.
Harmless today, but it is precisely the kind of comment a future reviewer would
trust instead of re-grepping.

### F4. The console mail transport logs password-reset links, and production silently falls back to it

`resolveMailTransport()` returns `console` whenever `RESEND_API_KEY` is absent
and `MAIL_TRANSPORT` is unset — in every environment, including production. The
console transport (`src/lib/mail/mailer.ts:63-67`) logs the full plaintext body,
which contains the live password-reset and email-verification URLs. A production
deploy that misses the (documented, but manual and "degrades gracefully")
`RESEND_API_KEY` step would stream single-use reset tokens into the platform log
sink, readable by anyone with log access. The graceful-degradation choice is
right for local dev; it is wrong for production. Suggest refusing `console` when
the resolved `APP_URL` is not localhost (throw at transport-resolution time), or
redacting the URL in the console transport.

The tester mail test correctly proves the *API key* never reaches the logs; it
does not cover the message body, which is the more sensitive payload here.

### F5. Cookie `secure` flag is implicit and untested

No `advanced.useSecureCookies` is set; Better Auth derives `secure` from the
`baseURL` protocol. I verified in `better-auth/dist/cookies/index.mjs` that
`defaultCookieAttributes` merges over (rather than replaces) the
`httpOnly: true` / `secure` / `path` defaults, so the shipped behaviour is
correct, and `options.test.ts:107-124` documents the reasoning honestly. But
"secure in production" — which PLAN task 12 asked for explicitly and AC4
asserts — is a consequence of `APP_URL` starting with `https://` and nothing
tests or enforces it. An `http://` `APP_URL` in a deployed environment would
silently produce non-secure session cookies. Cheap hardening: set
`useSecureCookies` explicitly from the `APP_URL` protocol, or assert in
`getEnv()` that a non-localhost `APP_URL` is https.

### F6. Sign-in timing side channel (library-level)

`better-auth/dist/api/routes/sign-in.mjs` performs a dummy
`password.hash(password)` when the credential *account* is missing, but returns
immediately when the *user* is not found — so "unknown email" is measurably
faster than "known email, wrong password" by roughly one argon2 hash (~50-100ms
at the configured parameters). That is a usable enumeration oracle. It is
library-owned, partially mitigated by the 5-per-15-min IP limit, and the UI
error strings are correctly generic (`GENERIC_SIGN_IN_ERROR`,
`CONFIRMATION_MESSAGE`) — so this is a note, not a defect in this diff. Worth
tracking alongside the per-account-lockout follow-up already recorded in
PLAN.md note #7.

### F7. `requireUser()` inside route handlers produces a misleading success path

`requireUser()` calls `redirect()`, which in a route handler becomes a 307. The
browser `fetch` follows it to `/sign-in` (HTML, 200), so
`delete-account-form.tsx:35` sees `response.ok === true` and routes the user to
`/account-deleted` even though nothing was deleted. Only reachable when the
session went invalid between page render and submit, so low impact — but the
account routes should return 401 JSON rather than redirect.

### F8. AC12 has no browser-level coverage

Already flagged by the tester and I agree: no Playwright spec clicks the
verification link or asserts the dashboard banner renders. The manual curl check
was real, but the committed suite does not protect this behaviour. Low-cost
addition given `e2e/helpers/mail.ts` already exists.

### F9. Requirement IDs are leaking into user-facing copy

`src/app/(app)/account/page.tsx:18` renders "Change your role or level any time
(FR-ACC-006)." to the end user. Traceability belongs in comments and the plan,
not on the product surface.

---

## The four builder deviations — independently checked

**(a) Age-acknowledgment wiring.** Legitimate fix, and the diagnosis was
correct: without `minimumAgeAcknowledgedAt` in the `signUp.email(...)` call the
field was silently null. `e2e/auth-registration.spec.ts:33-34` asserts the DB row
directly, which is the right level. The associated type-safety changes (dropping
the `: BetterAuthOptions` annotation in favour of `satisfies`, adding
`inferAdditionalFields`) are correct and well-explained. **But see C2** — this
fix made the UI path work; it did not make the control server-side, and the
builder notes and `auth.md` §8 read as though it did.

**(b) Redirect-loop fix.** Genuine bug, correct fix, right diagnosis. Moving the
"already authenticated" redirect out of `src/middleware.ts` (which can only see
cookie *presence*) into the sign-in/sign-up pages using the authoritative
`getCurrentUser()` is exactly right: middleware now only ever redirects in the
direction that cannot loop, and the reasoning is documented in
`src/middleware.ts:4-28` where the next maintainer will find it. This is the best
change in the diff.

**(c) `NODE_ENV=production` in the e2e webServer.** Legitimate and necessary —
Next.js does skip `.env.local` under `NODE_ENV=test`, and the command genuinely
runs a production build. I looked specifically for side effects:

- *Error verbosity*: yes, it changes. React error messages are minified and the
  dev overlay is off. For e2e this is a feature (the suite exercises what users
  see), but a spec failure gives less diagnostic detail than a dev-mode run.
- *Other production-only code paths*: I grepped every `NODE_ENV` reference in the
  repo. The only application-code branch is `src/lib/prisma.ts:33` (global client
  caching, dev-only) — harmless. `next.config.ts` has no env branch; Sentry is
  not wired into `next.config.ts` at all. No hidden production behaviour is
  switched on.
- *One thing it does NOT enable*: secure cookies. Better Auth derives `secure`
  from the baseURL protocol, not `NODE_ENV`, and the e2e baseURL is
  `http://localhost:3000` — which is why the suite works over HTTP. Correct
  outcome, but it means the e2e run never exercises a `secure` cookie. See F5.
- *The trap*: because `NODE_ENV` is forced to `production` here, `NODE_ENV` is
  useless as the guard for `E2E_DISABLE_RATE_LIMIT`. See F2.

Nothing masked. Correct call.

**(d) prettier 3.6.2 to 3.9.6.** Legitimate. Dev-only, still exact-pinned in the
project established style, and the stated cause (a parser crash in the
3.6.2 + `prettier-plugin-tailwindcss@0.8.1` pair, reproducible on files this item
never touched) is a plausible and specific claim rather than a vague "upgrade
fixes it". The resulting reformat of 9 pre-existing files is noise but not scope
creep. Accepted.

**Bonus — `.npmrc` (`legacy-peer-deps=true`)**, documented in builder note #1
rather than the task list. The justification (better-auth optional peer adapters
producing a false-positive `ERESOLVE`) is real and correctly explained in the
file own comment. Worth naming explicitly, though, because it is a repo-wide
loosening of npm dependency-resolution safety that outlives this work item:
every future install now skips strict peer checks. Acceptable, but it should be
revisited (and ideally narrowed or removed) when better-auth peer declarations
improve. Not blocking.

---

## Scope discipline — clean

Checked directly against the PLAN.md out-of-scope list:

- **No path/content/progress/rating/certificate models.** `prisma/schema.prisma`
  contains exactly `User`, `Session`, `Account`, `Verification`, `RateLimit` and
  the two enums. No speculative "for later" tables, no `deletedAt`, no
  `role`/`isAdmin` column. `HealthCheck` is gone as planned.
- **No diagnostic quiz (FR-PLACE-003/004/005).** Nothing quiz-related exists;
  only the self-select path is built, and `auth.md` §7 records the obligation the
  R2 placement item inherits.
- **No SSO (FR-ACC-009).** No provider configured. The `Account` table carries
  the OAuth columns so no migration is needed later — schema shape, not feature
  scope.
- **Scaffolding decisions not re-litigated.** `docs/architecture/infrastructure.md`
  is untouched; `next.config.ts` gains only `serverExternalPackages` and leaves
  the security headers alone; no hosting/DB/observability choice is revisited.
- **Files outside the task list** are all directly implied by tasks
  (`account-deleted/page.tsx` by task 29, `sign-out-button.tsx` by task 22,
  `constants.ts`/`revoke-sessions.ts` as justified circular-dependency splits,
  `e2e/helpers/register.ts` as test scaffolding). No scope creep.

## Test quality — good, with the gaps named above

The tester assessment that the suite is non-tautological matches mine.
`password.test.ts` uses the real argon2 module; `export.test.ts` asserts on the
serialized response text and on the Prisma `select` shape; the XSS spec proves
non-execution via a `window.__xss` probe rather than just checking for escaped
markup; the delete-form component test covers substring, case, and whitespace
near-misses. `e2e/helpers/db.ts` scoping cleanup to an `@e2e.test` domain is the
right safety property for a shared database.

Uncovered, in descending order of importance: the open redirect (C1), server-side
sign-up validation (C2), `Verification` cleanup (C3), the verification-link
journey (F8), and the `secure` cookie flag (F5).

## Security review summary

Checked and **clean**: no secrets in the diff (CI uses an explicitly-labelled
placeholder; test passwords are obvious dummies); no IDOR — every account route
derives the subject from `requireUser()` and never from request input; no raw SQL
anywhere (Prisma parameterized throughout); no `dangerouslySetInnerHTML`; the
export endpoint `select` never requests a token or password column; the deletion
confirmation is re-validated server-side; account-enumeration surfaces are
correctly generic in both the sign-in and forgot-password flows; CSRF posture is
reasonable (SameSite=Lax plus Better Auth own `formCsrfMiddleware` and
`trustedOrigins`, and the `/api/account/*` routes are JSON-body non-GET requests
that Lax cookies will not accompany cross-site); `console.error` in the delete
route logs an error object, not credentials.

Findings are C1, C2, C3 above and F1, F4, F5, F6 as follow-ups.

## Docs

`docs/architecture/auth.md` (286 lines) is substantive, not ceremonial: real
rejected alternatives with reasons, the actual argon2 and rate-limit parameter
values, the NFR mapping table, and honestly-labelled "Known R1 gap" sections. The
provisioning-checklist additions are specific and correctly unchecked, and the
Resend-domain item correctly names its dependency on the still-open
custom-domain question. README changes match shipped behaviour. Two corrections
needed: the `E2E_DISABLE_RATE_LIMIT` location claim (F3) and the `Verification`
cascade claim (C3). Recommend also adding the `x-forwarded-for` verification step
(F1).

## Acceptance criteria

16 of 18 fully met. AC1 is met as a UI journey but not as a control (C2). AC10 is
met except for its `Verification` clause (C3). Everything else I re-checked
against the diff rather than the test report holds up, including AC4 (session
model and revocation), AC6 (database-backed limiter), AC9 (export excludes
secrets), AC11 (server-side `requireUser()` as the real gate), AC13 (schema
discipline), and AC18 (docs).
