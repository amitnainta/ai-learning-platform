# Auth Decision Record

Status: accepted for R1. Owner: solo maintainer. Complements
`docs/architecture/infrastructure.md` (hosting/DB/observability) and
`docs/runbooks/provisioning-checklist.md` (the manual steps this item adds).
Covers decisions #3-#8 and #10 from `factory/work/user-accounts-auth/PLAN.md`
— see that plan for the full task list and acceptance criteria.

## Accepted context

`FR-ACC-001/002/003` (register, log in/out, reset password), `FR-ACC-004/005/006`
(role/level profile), and `FR-ACC-007` (export/delete) all hang off the same
`User` model, session mechanism, and form conventions — this record captures
the auth/session/rate-limit/email decisions that make those requirements real,
plus how each maps onto the security NFRs that ride directly on auth
(NFR-SEC-001, -003, -005, -011).

## 1. Auth library — Better Auth

**Decision**: [`better-auth`](https://www.better-auth.com) with its Prisma
adapter, mounted at `src/app/api/auth/[...all]/route.ts`.

**Why**: first-class email+password, email verification, password reset,
database sessions, and rate limiting, as a framework-agnostic TypeScript
library with a native Next.js App Router integration. Critically, it does
**not** force a JWT session strategy for credential logins — see §2.

**Rejected**:

- **Auth.js / NextAuth v5** — its Credentials provider only supports JWT
  sessions. Stateless JWTs cannot be server-side invalidated on logout or
  password change, which is exactly what NFR-SEC-003 requires; the only
  workaround is a hand-built denylist table, at which point the library is
  doing less than it costs. It also has no built-in password reset or email
  verification for credentials, so both would be hand-rolled anyway.
- **Hand-rolled sessions** (`oslo`/`jose` + argon2 + bespoke tables, the
  post-Lucia pattern) — total control, but registration, verification, reset,
  session rotation, and rate limiting all become bespoke security code
  maintained by one person. The risk-per-line-of-code tradeoff is poor here.
- **Clerk / Auth0 / Supabase Auth** — fastest to stand up, but the user record
  lives in a third-party system that this platform's own `Progress`/`Rating`/
  `Certificate` foreign keys (future work items) would then have to mirror,
  adds a per-MAU cost curve to a free educational site, and turns FR-ACC-007
  export/deletion into a two-system problem.

## 2. Session strategy — database-backed sessions

**Decision**: sessions are rows in Postgres (`Session` model), referenced by
an httpOnly, `SameSite=Lax` cookie that is `secure` whenever `baseURL` is
`https://` (i.e. every deployed environment; not `http://localhost` in local
dev — see `src/lib/auth/options.ts`, no `advanced.useSecureCookies` override
is set, so Better Auth derives it from the baseURL's protocol).

- `expiresIn`: 14 days, `updateAge`: 1 day — a rolling inactivity expiry. A
  session untouched for 14 days is dead; an active one is silently extended
  at most once a day (not on every request), keeping the write volume down.
- Logout deletes the session row. Password change/reset delete **every**
  session row for that user (`revokeSessionsOnPasswordReset: true` plus an
  explicit `onPasswordReset` hook calling `revokeAllSessions()` —
  belt-and-suspenders in case the built-in option's behavior ever changes).
- This satisfies NFR-SEC-003 end to end, and honors the statelessness
  constraint in `docs/architecture/infrastructure.md` §7: session state lives
  in Postgres, never in serverless-instance memory.

**Rejected**: stateless JWT / signed-cookie sessions — cheaper to read (no DB
round trip), but "invalidated on logout or password change" is not honestly
implementable without a server-side denylist, which reintroduces the round
trip anyway while adding a second mechanism to reason about.

## 3. Password hashing — argon2id via `@node-rs/argon2`

**Decision**: `src/lib/auth/password.ts` wraps `@node-rs/argon2`, wired in as
Better Auth's custom `emailAndPassword.password.hash`/`.verify` (Better
Auth's own default is scrypt).

**Parameters** (OWASP-recommended, `src/lib/auth/password.ts`):

| Parameter     | Value     |
| ------------- | --------- |
| Algorithm     | argon2id  |
| `memoryCost`  | 19456 KiB |
| `timeCost`    | 2         |
| `parallelism` | 1         |

These land around 50-100ms per hash — well inside the NFR-PERF-004 500ms p95
budget for auth endpoints.

**Why not the default**: NFR-SEC-001 names bcrypt or argon2 explicitly.
Scrypt would arguably satisfy "a modern salted hash" but not the literal
requirement.

**Rejected**: `bcryptjs` (pure JS, no native dependency, but slower per unit
of resistance and capped at 72 bytes of input — the pre-agreed fallback if
the native module misbehaves, see below); `argon2` (the `node-argon2`
package, which node-gyp-builds from source — a worse Windows dev experience).

**Operational note**: `@node-rs/argon2` is a native module, declared in
`next.config.ts`'s `serverExternalPackages` so Next.js requires the
platform-specific `.node` binary at runtime instead of bundling it. It ships
prebuilt binaries for `linux-x64-gnu` (Vercel) and `win32-x64-msvc` (local
Windows dev). If it ever causes friction in a deploy or dev environment, swap
to `bcryptjs` behind the same `src/lib/auth/password.ts` interface — a
one-file change that still satisfies NFR-SEC-001, no plan amendment needed.

## 4. Rate limiting — Better Auth's built-in limiter, database storage

**Decision**: `rateLimit.storage: "database"` (a `RateLimit` table), keyed by
client IP resolved from `x-forwarded-for`, with per-path rules
(`src/lib/auth/options.ts`):

| Path                      | Limit            |
| ------------------------- | ---------------- |
| `/sign-in/email`          | 5 per 15 minutes |
| `/sign-up/email`          | 10 per hour      |
| `/request-password-reset` | 3 per hour       |
| `/reset-password`         | 5 per hour       |

**Why database storage**: the default in-memory limiter counts per
serverless instance, which is both ineffective (each cold start/instance
resets the counter) and a violation of the NFR-SCALE-001 statelessness
constraint. A shared `RateLimit` table gives one true counter regardless of
which instance handles a given request.

**Rejected**: Upstash Redis / `@upstash/ratelimit` — better write
characteristics under real load, but a new external account and cost for a
limiter that will see trivial volume at R1. Documented as the upgrade path if
the `RateLimit` table becomes a write hotspot.

**Test-only override**: rate limiting must be relaxed for the Playwright e2e
suite, or the login/registration specs trip the real limiter within a single
run. `src/lib/auth/options.ts` reads an explicit, narrowly-scoped
`E2E_DISABLE_RATE_LIMIT` environment variable (not a documented product env
var — deliberately absent from `.env.example`) that flips only
`rateLimit.enabled`; the rules and database storage stay wired up
unconditionally. It is set to `"true"` in exactly two places:
`playwright.config.ts`'s `webServer.env` and the `e2e` job's env in
`.github/workflows/ci.yml`. It is never set for a deployed environment.
Rate-limiting behavior itself (the 429s, the `RateLimit` table writes) is
verified manually per the PLAN.md test plan (AC6), not by e2e.

**Known R1 gap**: rate limiting is keyed by client IP only. Per-account
lockout (N failed attempts for a given email regardless of source IP) is the
natural follow-up and matters more once the platform has users worth
targeting; not built here because it introduces its own lockout-abuse vector
that needs its own design.

## 5. Transactional email — Resend, with a pluggable transport

**Decision**: `src/lib/mail/mailer.ts` exposes a single `sendMail()` call
behind three transports:

- **`resend`** — real delivery via the [Resend](https://resend.com) API,
  used when `RESEND_API_KEY` is set (or `MAIL_TRANSPORT=resend` is forced).
- **`console`** — the dev default: logs the recipient, subject, and the
  plain-text body (which includes the action link) to the terminal. Never
  logs `RESEND_API_KEY`.
- **`file`** — writes each message as JSON to a gitignored `.mail-outbox/`
  directory. Used by Playwright e2e (`e2e/helpers/mail.ts` reads the newest
  message for a given address and extracts the action link) so the full
  password-reset journey is testable without a real mail provider.

Transport resolution: an explicit `MAIL_TRANSPORT` env var wins; otherwise
`resend` when `RESEND_API_KEY` is present, else `console`. This means the
absence of a Resend key degrades gracefully (mail still "sends," just to the
terminal) rather than breaking `next build`/local dev — the same pattern the
scaffolding item established for the Sentry DSN.

**Why Resend**: a generous free tier, a simple API, and near-zero setup for a
solo maintainer.

**Rejected**: SendGrid/Mailgun (heavier account-onboarding friction);
SMTP via Nodemailer (still needs a provider's credentials, and is awkward on
serverless); Better Auth's built-in magic-link/OTP flows (would change the
FR-ACC-001/003 product surface, which the requirements state as email +
password specifically).

**Known R1 gap**: Resend's shared test sender only delivers to the account
owner's own inbox until a sending domain is verified. Password reset is
code-complete and e2e-tested via the file transport either way, but real
beta users can't receive a reset email until a domain is verified — see
`docs/runbooks/provisioning-checklist.md`.

## 6. Email verification does not gate sign-in

**Decision**: a verification email is sent on sign-up
(`emailVerification.sendOnSignUp: true`), and the `emailVerified` flag flips
when the link is followed, but `emailAndPassword.requireEmailVerification` is
`false` — a new user can complete onboarding and start learning immediately.

**Why**: no requirement asks for verification-gated login (FR-ACC-003 only
requires email verification **for password reset**, which Better Auth
enforces independently via its token-based reset flow). For a free
educational site, the activation funnel is the whole game — a mandatory
inbox round-trip between "signed up" and "first lesson" is one of the most
expensive drop-offs achievable by design. The unverified state is visible in
the UI as a dismissible banner on the dashboard (`VerifyEmailBanner`) with a
working resend action, so a later work item can gate anything that actually
needs a trustworthy address (certificate issuance, notification emails)
without a schema change.

## 7. Onboarding role/level selection is built here

**Decision**: the onboarding screen (`src/app/(app)/onboarding/page.tsx`,
`src/components/account/role-level-form.tsx`) presents the four role
archetypes plus "not sure yet" and the three proficiency levels, and the same
component is reused on `/account` for later changes.

**Why**: FR-ACC-004/005/006 require the profile to **capture** role and level
and to let the user change them, which is unimplementable without a
selection UI; building that UI incidentally satisfies FR-PLACE-001/002 (the
self-select placement journey — the diagnostic quiz, FR-PLACE-003/004/005, is
R2 and explicitly out of scope here). `RoleArchetype` and `ProficiencyLevel`
are plain Prisma enums owned by the account API routes
(`PATCH /api/account/profile`), not Better Auth `additionalFields` — Better
Auth never needs to understand them. Only `minimumAgeAcknowledgedAt` is a
Better Auth `additionalField`, because it must be written atomically at
sign-up (see §8) rather than in a follow-up call.

**Consequence recorded for the future**: the R2 placement work item inherits
this onboarding screen and must integrate the diagnostic quiz into it as an
alternative entry point, rather than building a parallel screen.

## 8. Minimum-age acknowledgment (NFR-SEC-011)

**Decision**: the sign-up form has a required checkbox ("I confirm I am 16
years of age or older") that cannot be skipped — `signUpSchema`
(`src/lib/validation/account.ts`) rejects the payload if it isn't `true`. On
successful submission, the client sends `minimumAgeAcknowledgedAt` (a
`Date`) alongside `name`/`email`/`password` to `authClient.signUp.email()`,
so it's written to the `User` row in the same create call as the account
itself — see `user.additionalFields.minimumAgeAcknowledgedAt` in
`src/lib/auth/options.ts`. `src/lib/auth/client.ts` uses Better Auth's
`inferAdditionalFields<typeof auth>()` client plugin so this field is
statically typed on the client, not passed as an untyped extra property.

**Implementation note**: `buildAuthOptions()` in `src/lib/auth/options.ts`
deliberately has no `: BetterAuthOptions` return-type annotation (it uses
`satisfies BetterAuthOptions` on the returned object instead). An explicit
annotation would widen the return value to the general interface and erase
the literal `user.additionalFields` shape that `inferAdditionalFields`
depends on to type the client call — `satisfies` keeps the type-check
without losing that literal type.

**16, not 13**: the requirements leave the exact regional threshold open
(COPPA is 13; GDPR-K lets member states set 13-16). This item defaults to "16
or older" as a single globally-safe threshold, phrased as a self-contained
checkbox that doesn't depend on a privacy-policy page existing yet. Revisit
if region-specific handling is wanted later — it's a copy change plus a
validation constant, not a schema change.

## 9. Account deletion — immediate hard delete, confirmation email after

**Decision**: the user types their exact account email into a confirm field
on `/account`; the confirm button stays disabled until it matches exactly
(no trimming, no case-insensitivity). On submit, `DELETE /api/account`
validates the match server-side, deletes the `User` row (cascading to
`Session`/`Account`/`Verification` via `onDelete: Cascade`), clears the
session cookie, and — best-effort, logged-not-thrown on failure so a mail
outage can never leave the account undeleted — sends an "your account has
been deleted" confirmation email to the captured address.

**Why**: the most literal, defensible reading of GDPR erasure (NFR-COMP-004)
and FR-ACC-007; no retained-data window to explain in a future privacy
policy; and at R1 no user-authored content would be orphaned by a hard
delete. The gate is the typed email only (not password re-entry), so it
behaves identically for future SSO accounts (FR-ACC-009, not yet built) and
doesn't assume the account has a password.

**Rejected**: soft delete + a 30-day grace window (needs a scheduled purge
job — no cron infrastructure exists yet — plus a deleted-state flag threaded
through every future query); email-confirmed two-step deletion (better
protection against a hijacked session, but adds a token flow and a drop-off
point for a destructive action the user already explicitly confirmed by
typing their address).

## NFR mapping summary

| NFR           | How this item satisfies it                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| NFR-SEC-001   | argon2id via `@node-rs/argon2`, OWASP parameters (§3)                                           |
| NFR-SEC-003   | database sessions, 14-day rolling expiry, revoked on logout/password change/reset (§2)          |
| NFR-SEC-005   | database-backed rate limiting on sign-in/sign-up/forgot/reset (§4)                              |
| NFR-SEC-011   | required, recorded minimum-age acknowledgment at sign-up (§8)                                   |
| NFR-SCALE-001 | no in-memory session or rate-limit state — both live in Postgres (§2, §4)                       |
| NFR-SCALE-002 | indexes on `email` (unique), `Session.userId`, `Session.expiresAt` (see `prisma/schema.prisma`) |
| NFR-COMP-004  | export (`GET /api/account/export`) and hard delete (`DELETE /api/account`) (§9)                 |
