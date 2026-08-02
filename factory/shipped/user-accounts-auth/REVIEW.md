# REVIEW — user-accounts-auth

Second (final) review pass, after the C1/C2/C3 fix pass (commits `836d33d`,
`92332b5`, `e513ba4`, `33ef838`) and the tester's re-verification addendum.

I did not take the builder's or the tester's word for the closures. I read
`src/lib/auth/safe-redirect.ts`, the `databaseHooks` block in
`src/lib/auth/options.ts`, the migration SQL and the schema diff myself; I
executed the shipped safe-redirect module against my own adversarial payload
list (including cases the tester did not try); and I verified the two
library-behaviour claims that the whole of C2 and C3 rest on directly in
`node_modules/better-auth@1.6.25` source, rather than inferring them from
observed HTTP responses.

## Verdict: APPROVED WITH NOTES

**Is this auth system safe to ship? Yes.** C1, C2 and C3 are genuinely closed,
by mechanisms that are correct for the right reasons rather than
coincidentally-passing tests. I would be comfortable putting my name on merging
this to `main`.

Two of the previously-recorded non-blocking follow-ups (F1 and F4) are
deployment-time risks rather than merge-time risks. They do not block this
merge, but they **must be closed before the first production deploy that serves
real users** — see "Follow-ups" below, where they are re-stated with that
sharper condition.

Independently re-run on my side: `npx tsc --noEmit` clean, `npm run lint`
clean, `npx vitest run` **87/87 passed across 9 files** (matches the tester's
count, reproduced first-hand).

---

## C1 — open redirect: CLOSED

`src/components/auth/sign-in-form.tsx:56` now calls `resolveSafeRedirect(next)`
and passes only its return value to `router.push`.

**The logic is sound, and I checked the reasoning rather than the test list.**
`isSafeRedirectPath` strips exactly the three characters WHATWG URL parsing
removes (tab, LF, CR), then requires the result to start with a single slash and
rejects a leading double slash or a leading slash-backslash. That is the correct
invariant: after tab/LF/CR removal, a value beginning with one slash and not
followed by a slash or a backslash cannot resolve to another origin, and every
other shape fails closed.

**I attacked it myself**, executing the real shipped module (Node type
stripping, no reimplementation, no mocking) against 25 payloads — the tester's
six plus cases chosen specifically to probe the gaps this re-review was asked
about:

- leading whitespace before the slash — rejected
- leading NUL and leading tab, i.e. characters a browser trims or strips
  *before* resolution — rejected
- triple slash, and interleaved tab/newline obfuscation — rejected
- every backslash variant, verified with character-code-constructed strings so
  there is no shell/JS escaping ambiguity: leading slash-backslash,
  slash-double-backslash, slash-backslash-slash all rejected; a mid-path
  backslash correctly still accepted
- unicode lookalike slashes U+2044 (fraction slash), U+FF0F (fullwidth
  solidus), plus U+2028 and U+0085 — correctly **accepted**, because none of
  them are path separators to a URL parser; these stay same-origin paths and
  rejecting them would be wrong
- percent-encoded slash and percent-encoded tab — correctly accepted
  (same-origin)
- extremely long inputs: a 200k-character path and a 100k-tab obfuscated
  payload — handled correctly and fast; both regexes are linear with no
  backtracking risk

No bypass found. The legitimate cases (`/account`, `/account?tab=profile`,
`/onboarding#step-2`, `/`) are preserved unchanged, so the fix is not
over-aggressive either.

**I also re-checked the blast radius, not just the function.** Grepping every
`searchParams` / `router.push` / `redirect(` / `callbackURL` / `redirectTo`
site in `src/`: `sign-in-form.tsx:56` is the only place in the entire app that
reads an attacker-suppliable redirect value.
`src/components/auth/forgot-password-form.tsx:34` hard-codes
`redirectTo: "/reset-password"`; `src/middleware.ts:44` and
`src/lib/auth/session.ts:61` only ever *write* `next`, from an internal
pathname; every other `router.push` takes a string literal. One guarded call
site is therefore complete coverage.

Two cosmetic notes, neither a defect — see F10 and F11.

## C2 — server-side sign-up validation: CLOSED

The `databaseHooks.user.create.before` hook in `src/lib/auth/options.ts:147-181`
rejects a falsy `minimumAgeAcknowledgedAt`, stamps its own `new Date()` instead
of trusting the client's value, and re-validates `name` through the now-exported
`nameSchema`.

The re-review asked me to verify **structurally** — not from the tester's "no DB
row" observation, which could in principle have another explanation — that
throwing an `APIError` from a `before` hook actually prevents the write. It
does, and here is the mechanism.

In `node_modules/better-auth/dist/db/with-hooks.mjs`, `createWithHooks` runs
every registered `create.before` hook (lines 9-23) and only then calls
`adapter.create` (line 25). A throw inside the hook propagates out of
`createWithHooks` before any adapter call is made. The absence of a row is
therefore structural: there is no write-then-rollback, and no window in which a
partial row exists.

The same file settles the second thing the fix silently depends on: a hook's
return value is **merged**, not substituted —
`actualData = { ...actualData, ...result.data }` (lines 18-21). Returning only
`{ name, minimumAgeAcknowledgedAt }` therefore augments the row rather than
wiping `id`/`email`/timestamps. That is why the happy path still produces a
complete user, and it is worth having verified rather than assumed.

**Coverage of every entry point**, also checked in source rather than assumed:
`node_modules/better-auth/dist/db/internal-adapter.mjs` creates `user` rows in
exactly two places — `createUser` (line 79) and `createOAuthUser` (line 61) —
and both route through `createWithHooks(..., "user")`. The hook therefore covers
the credential path *and* any future OAuth path. For OAuth it would fail closed
with a 400 rather than silently admitting an unacknowledged account, which is
the right default, and the code comment already tells a future SSO work item to
revisit it. No admin plugin is installed. I also grepped `src/`, `prisma/` and
`e2e/` for a direct `prisma.user.create`/`upsert`: there are none, so no
application code bypasses the hook either.

One honest limitation, which I accept: the gate is a truthiness check, so any
truthy value satisfies it. That is semantically identical to a user ticking the
checkbox, and since the server discards the submitted value and stamps its own
timestamp, the guarantee C2 actually demanded — *every account carries a
server-recorded acknowledgment* — now holds unconditionally. That closes it.

The two new direct-API specs in `e2e/auth-registration.spec.ts` assert real HTTP
400s, real error codes, and a null DB lookup afterwards; the five new unit tests
call the real hook and assert a backdated client timestamp is replaced by one
inside the call window. Neither is tautological.

## C3 — Verification cascade: CLOSED

`prisma/migrations/20260728050247_verification_user_cascade/migration.sql` adds
a nullable `userId`, an index on it, and a genuine
`ON DELETE CASCADE ON UPDATE CASCADE` foreign key. That is a database-level
guarantee, which is strictly better than the app-level `deleteMany` cleanup I
offered as the cheaper option in the first review. The e2e spec proves the round
trip non-tautologically: it polls for a backfilled row to *exist* first (so it
cannot pass by the row never being created) and only then asserts zero after
deletion.

**On whether the `reset-password:` prefix is correct and complete** — the
question this re-review specifically posed. I enumerated every
`createVerificationValue` call site in better-auth 1.6.25 myself. The core
(non-plugin) ones are:

- `dist/api/routes/password.mjs:75` — `identifier: "reset-password:<token>"`,
  `value: user.user.id`. Exactly the shape the hook assumes, confirmed at the
  source line rather than inferred from behaviour.
- `dist/api/routes/update-user.mjs:313` — `delete-account-<token>`, written only
  when `user.deleteUser.sendDeleteAccountVerification` is configured. It is not,
  and such a row would be moot anyway since it immediately precedes a deletion.
- `dist/state.mjs:65` — OAuth `state` storage; `identifier` is the random state
  and `value` is a JSON blob, not a user id. Only reachable with a social
  provider configured (none is). A null `userId` is the *correct* outcome for
  those rows — they are not user-owned, so there is nothing to cascade.

Everything else is plugin-only (email-otp, magic-link, phone-number, two-factor,
oidc-provider, mcp, one-time-token, siwe) and no plugins are installed. I also
confirmed the builder's load-bearing claim that email verification and
change-email use `createEmailVerificationToken` (a signed token —
`update-user.mjs:491,505`) and never write to this table at all.

I additionally checked a failure mode nobody tested, because the hook returns
`undefined` for non-matching identifiers and that branch is currently
unreachable in this app: `with-hooks.mjs:18` guards with
`typeof result === "object" && "data" in result`, so an `undefined` return is
safely ignored. It will not break the first time a future flow does hit it.

**The mechanism is fragile in a way worth recording** — see F12. It is a
string-prefix allowlist coupled to library-internal identifier formats, and it
fails *silently*: if 2FA, email-OTP, phone-number, magic-link or
`sendDeleteAccountVerification` is ever enabled, those rows will be written with
`userId = null` and orphan again on deletion, with no test going red. Those
features are out of scope per PLAN.md, so this does not block — but it is a trap
laid for the next work item, and the suggested hardening in F12 is cheap.

Two smaller notes: any `Verification` rows written before this migration keep
`userId = null` and would still orphan (moot — this app has never been
deployed), and the new FK introduces a nanosecond-wide race where a
`/request-password-reset` insert could fail if the target user is deleted
between the lookup and the insert. Both are negligible; recorded for honesty,
not for action.

---

## Scope and regressions in the fix pass — clean

`git diff 79b845d..HEAD` is 15 files. Excluding factory artifacts (PLAN.md
builder notes 7-9, REVIEW.md, TEST_REPORT.md), every change maps to C1, C2 or C3
or their tests: `safe-redirect.ts` plus its test, one line in
`sign-in-form.tsx`, the `databaseHooks`/`verification` blocks in `options.ts`
plus their tests, the `nameSchema` export, the schema/migration pair, and three
new specs plus one e2e helper. No product feature was touched, no
previously-settled decision was reopened, no dependency was added or bumped, and
no test was weakened or deleted.

The only change outside that set is `.gitignore` gaining `*.tsbuildinfo` —
housekeeping for an untracked build artifact, not scope creep worth objecting
to.

Nothing previously verified regressed: tsc, lint and 87/87 unit tests are green
on my own run, and the tester independently re-ran the full 15/15 Playwright
suite including the pre-existing rate-limiter, Session/Account cascade and
password-reset session-revocation checks.

The documentation inconsistency I raised as part of C3 is resolved by the fix
rather than by editing the docs down: `docs/architecture/auth.md:257` and
`e2e/helpers/db.ts:32` claim a Session/Account/Verification cascade, and that
claim is now true.

---

## Follow-ups (none blocking this merge)

Restated from the first review with a current status, plus four new minor items
from this pass. **F1 and F4 are the two I would not let reach real users**; the
rest are genuinely fine to track separately post-ship.

- **F1 — the `x-forwarded-for` trust model is still unverified for the deployed
  environment.** Unchanged by the fix pass and still the highest-value item.
  Two failure modes: a client-supplied header trusted verbatim (the NFR-SEC-005
  limiter becomes bypassable by rotating the header), or a multi-hop header
  resolving to the literal key `no-trusted-ip`, which collapses "5 sign-ins per
  15 min per IP" into one global bucket anyone can use to lock out the whole
  platform. **Condition: close before the first production deploy with real
  users** — confirm the resolved rate-limit key on the deployed host and set
  `trustedProxies` if needed. Add it to
  `docs/runbooks/provisioning-checklist.md`.
- **F4 — the console mail transport logs live password-reset links, and
  production silently falls back to it** when `RESEND_API_KEY` is unset.
  Unchanged. **Condition: close before the first production deploy** — either
  refuse the `console` transport when the resolved `APP_URL` is not localhost,
  or redact the URL in that transport. The graceful-degradation choice is right
  for dev and wrong for prod.
- **F5 — the cookie `secure` flag is implicit and untested.** Unchanged. Set
  `useSecureCookies` explicitly from the `APP_URL` protocol, or assert in
  `getEnv()` that a non-localhost `APP_URL` is https.
- **F3 — three files still claim `E2E_DISABLE_RATE_LIMIT` is set in
  `.github/workflows/ci.yml`.** Re-checked this pass and still false:
  `docs/architecture/auth.md:135-137`, `src/lib/auth/options.ts:48-49` and
  `src/lib/env.ts:55-56` all say it; the CI e2e job env block does not set it —
  only `playwright.config.ts:59` does. Harmless, one-line doc fix.
- **F7 — `requireUser()` inside route handlers 307s instead of returning 401
  JSON**, so `delete-account-form.tsx` can observe `response.ok === true` after
  a deletion that did not happen. Unchanged. Low impact, still worth fixing.
- **F8 — AC12 (verification link plus dashboard banner) still has no
  browser-level coverage.** Unchanged. Low cost given `e2e/helpers/mail.ts`
  already exists.
- **F9 — `src/app/(app)/account/page.tsx:18` still renders "(FR-ACC-006)" to
  the end user.** Unchanged. Trivial copy fix.
- **F2 and F6** (no environment guard on `E2E_DISABLE_RATE_LIMIT`; the
  library-level sign-in timing oracle) stand as recorded — informational, no
  action needed now.
- **F10 (new, cosmetic) — the embedded-scheme check in `safe-redirect.ts` is
  dead code.** Because the function has already required a leading slash,
  `normalized.search(/[/?#]/)` is always 0 and the inspected prefix is always
  the empty string, so the colon test can never fire. The comment does describe
  it as belt-and-braces, but it reads as though it contributes. Keep it or drop
  it — just do not let a future refactor rely on it.
- **F11 (new, cosmetic) — `resolveSafeRedirect` judges the normalized value but
  returns the raw one.** Not exploitable (re-inserting tab/LF/CR into an
  already-same-origin path cannot make it off-origin, and the browser strips
  them again), but returning the normalized value would remove an asymmetry a
  future reader has to reason about.
- **F12 (new) — the `Verification.userId` backfill is a silent-failure
  allowlist.** Hardening for whichever work item next enables an
  email-OTP/2FA/magic-link/delete-account-verification flow: assert that after
  an account deletion there are zero `Verification` rows whose `value` equals
  the deleted user id. That catches new row-creating flows regardless of their
  identifier prefix, which the current prefix check cannot.
- **F13 (new, trivial) — two stale details.** The header comment in
  `src/app/api/account/route.ts:11-12` still says the delete "cascades
  Session/Account rows" (it now also cascades Verification), and `nameSchema`
  applies `.min(1)`/`.max(100)` *before* `stripControlCharacters`, so a name
  consisting only of control characters validates and stores as an empty
  string. Both pre-date the fix pass; neither is a security issue.

## Acceptance criteria

**18 of 18 met.** AC1 is now met as a server-side control, not only as a UI
journey (C2). AC10 is now met in full including its `Verification` clause (C3).
Everything else re-checked in the first pass against the diff still holds and
was not touched by the fix commits.

---

## Appendix: first review pass (superseded)

Kept verbatim for the record. Its verdict (CHANGES REQUESTED) and its C1/C2/C3
findings are **superseded** by the pass above; the F-item detail below remains
the fuller description of the follow-ups summarised here.

### (original REVIEW.md body)

Independent review stage. I read `PLAN.md` and `TEST_REPORT.md` in full, then
reviewed the actual diff (`git diff main...HEAD`, 7 commits, 73 files) rather
than the plan's description of it. Where a claim was load-bearing I checked it
against the shipped code and, where the behaviour is library-owned, against
`node_modules/better-auth`'s actual implementation.

#### Verdict (SUPERSEDED by the final verdict at the top of this file): CHANGES REQUESTED

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

### Must fix before ship (blocking) — all three are now CLOSED; see the final verdict at the top of this file

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
