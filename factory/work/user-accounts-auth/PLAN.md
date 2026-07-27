# PLAN — user-accounts-auth

_Work item slug: user-accounts-auth. Plan produced by factory-planner. Source: factory/work/user-accounts-auth/REQUEST.md._

## Summary

This work item builds the account and authentication foundation that every other R1 product capability (progress tracking, ratings, certificates, path assignment) hangs off. It replaces the scaffolding stub Prisma model with the first real product data model (`User` plus the supporting auth tables), stands up email + password registration, login/logout, and email-based password reset, captures the role archetype and level on the user profile (with an onboarding step and an editable account page), and implements the privacy-rights surface: personal-data export and account deletion. It also lands the UI foundation the platform has been missing — Tailwind CSS v4 and a minimal site shell — because this is the first work item that ships real user-facing screens. Security NFRs that ride directly on auth (password hashing, session handling, rate limiting, input sanitization, minimum-age acknowledgment) are implemented here rather than deferred. No path/content/progress/rating tables are created: the schema stops at what accounts actually need, so later work items own their own entities.

## Requirement IDs satisfied

Primary:

- **FR-ACC-001** — register with email + password.
- **FR-ACC-002** — log in and log out.
- **FR-ACC-003** — reset a forgotten password via email verification.
- **FR-ACC-004** — profile captures a selected role archetype (Technical Builder, Engineering Leader, Executive/Non-Technical, Investor, "not sure yet").
- **FR-ACC-005** — profile captures a selected level (zero-knowledge / intermediate / advanced).
- **FR-ACC-006** — user can change role and/or level at any time after initial selection.
- **FR-ACC-007** — user can export their personal data and delete their account/data.
- **FR-PLACE-001** — new user is presented with the four role archetypes plus "not sure yet" during onboarding (satisfied incidentally by the FR-ACC-004 onboarding UI; see Decisions #9).
- **FR-PLACE-002** — user can self-select their level directly without taking a quiz (same; see Decisions #9).
- **NFR-SEC-001** — argon2id salted password hashing; plaintext never stored or logged.
- **NFR-SEC-003** — securely generated, database-backed session tokens with inactivity expiry, invalidated on logout and on password change/reset.
- **NFR-SEC-005** — rate limiting on sign-in, sign-up, forgot-password, and reset-password endpoints.
- **NFR-SEC-011** — minimum-age acknowledgment required at registration, recorded on the user record.

Partial / seeded (full satisfaction needs later work items; recorded for traceability):

- **FR-ACC-008** — the authenticated/unauthenticated split and route-protection mechanism land here (public pages browsable anonymously; `/dashboard`, `/onboarding`, `/account` require a session). The "cannot track progress, rate, or earn certificates" half is fully verifiable only once those features exist and reuse `requireUser()`.
- **NFR-SEC-007** — user-submitted content at this point is only display name and email: validated, normalized, and length-capped via Zod, and rendered through React default escaping (no `dangerouslySetInnerHTML`). Ratings and free-text sanitization come with the ratings work item.
- **NFR-SEC-004** — CSRF (same-site cookies + trusted-origin checks), broken-access-control (server-side `requireUser()` on every protected read/write), and injection (Prisma parameterized queries) defenses for the auth surface only; the pre-launch security test covering the whole app is a separate item.
- **NFR-COMP-004** — access and deletion rights are implemented (export + hard delete). Correction is partially covered (name, role, level are editable); email change is out of scope.
- **NFR-MAINT-004** — Playwright coverage for the registration and placement (self-select) journeys, plus login/logout and password reset. Course completion, rating, and certificate journeys land with those features.
- **NFR-PERF-004** — argon2 parameters are chosen to keep auth endpoints inside the 500ms p95 budget; actual measurement is a post-deploy check.
- **NFR-A11Y-002 / -004** — the auth and account forms are built responsive, keyboard-operable, with labeled inputs and `aria-live` error regions. The full WCAG 2.1 AA audit (NFR-A11Y-001) is a separate work item.
- **NFR-SCALE-002** — indexes on the account tables (unique email, unique session token, FK indexes, expiry index) sized for the 100k-user year-one target.

## Scope

### In scope

- Tailwind CSS v4 installed and wired (PostCSS plugin, `globals.css`, root layout import, Prettier class sorting).
- Prisma schema: replace the `HealthCheck` stub with `User`, `Session`, `Account`, `Verification`, `RateLimit`, plus `RoleArchetype` and `ProficiencyLevel` enums. First real migration.
- Better Auth server instance + client, mounted at `/api/auth/[...all]`, with argon2id hashing, database sessions, database-backed rate limiting, and email verification (non-blocking).
- Transactional email module with a Resend transport plus console and file transports for dev/test.
- Screens: sign-up, sign-in, forgot-password, reset-password, onboarding (role + level), dashboard placeholder, account settings (profile, data export, delete account).
- Route protection: optimistic cookie check in middleware plus authoritative server-side `requireUser()` helpers.
- Account API routes: `PATCH /api/account/profile`, `GET /api/account/export`, `DELETE /api/account`.
- Minimum-age acknowledgment checkbox at registration, persisted with a timestamp.
- Session invalidation on logout and on password change/reset.
- Minimal site header showing signed-out vs. signed-in state, and a home page that links into the auth flows.
- Unit tests (Vitest + RTL) and Playwright e2e for registration, login/logout, password reset, placement self-select, profile change, export, and deletion.
- CI: real Postgres service for the e2e job, migrations applied, e2e promoted to a blocking check.
- Docs: auth decision record, README updates, provisioning-checklist additions.

### Out of scope (explicitly)

- **The diagnostic placement quiz** — FR-PLACE-003/004/005 (quiz questions, scoring, recommendation, override flow), all tagged R2. Only the self-select path (FR-PLACE-001/002) is built. The `level` column is deliberately named to hold either a self-selected or a later quiz-assessed value, but nothing quiz-related is implemented.
- **SSO / third-party login** — FR-ACC-009 and NFR-SEC-008, tagged P2. The `Account` table shape can hold OAuth accounts, but no provider is configured.
- **Any path/content/progress/rating/certificate table or feature.** The schema stops at accounts. No `Path`, `Course`, `Lesson`, `Progress`, `Rating`, or `Certificate` models are created "for later" — later items own their own migrations.
- **Admin / RBAC** — NFR-SEC-006 is R2. No `role`/`isAdmin` column is added at R1.
- **Privacy policy and terms of service pages** (NFR-COMP-002) and cookie consent (NFR-COMP-003). Separate item. The age acknowledgment is written to be self-contained so it does not depend on a legal page existing.
- **Email address change, 2FA, account lockout after N failed attempts, breached-password (HIBP) checks, admin audit logging (NFR-SEC-010, R2).**
- **Full WCAG 2.1 AA audit (NFR-A11Y-001) and the plain-language style guide (NFR-A11Y-003).**
- **Re-deciding hosting / DB / observability** — fixed by project-scaffolding-infra.

### Note on size

This is close to the upper bound of what should be one work item, but it is not three features: FR-ACC-001/002/003 (auth), FR-ACC-004/005/006 (profile), and FR-ACC-007 (privacy rights) all depend on the same `User` model, the same session helpers, and the same form/validation conventions. Splitting them would mean shipping a `User` table with no way to sign in, or three plans that each rewrite `prisma/schema.prisma`. If the builder finds it too large in flight, the clean split points are: (A) tasks 1-30 (Tailwind + schema + auth core + onboarding), (B) tasks 31-34 (account APIs including export and delete), (C) tasks 35-53 (tests, CI, docs). Prefer finishing (A) then (B) in one branch over splitting the plan.

## Decisions made by this work item

Bias, carried from the scaffolding item: solo maintainer, free educational site, low-ops, tight Next.js/Vercel integration, and the standing constraint in `docs/architecture/infrastructure.md` that no session state may live in app-tier memory (NFR-SCALE-001).

1. **UI foundation = Tailwind CSS v4** _(confirmed by the human)_. This is the first real UI in the repo, so a styling approach has to be picked now. Tailwind v4 uses CSS-first configuration (`@import "tailwindcss"` plus a `@theme` block in `globals.css`, no `tailwind.config.js`), integrates through a single `@tailwindcss/postcss` plugin, and is the default styling choice in current Next.js scaffolding — meaning future contributors and code generators land on familiar ground. Utility classes keep responsive work (NFR-A11Y-002) inline with the markup rather than in a parallel stylesheet. Rejected: (b) plain CSS Modules — no design-token system, more hand-written media queries, slower to build a consistent look; (c) a component library (shadcn/ui, MUI) — premature, imports a design language and a dependency surface before there is a product design, and shadcn/ui can still be layered on top of Tailwind later without rework.
2. **Account deletion = immediate hard delete on typed confirmation, with a confirmation email sent afterwards** _(confirmed by the human)_. The user types their exact email address into a confirm field; on submit the `User` row is deleted, cascading to `Session`, `Account`, and `Verification` rows; the session cookie is cleared; a "your account has been deleted" email goes to the captured address. Rationale: it is the most literal, defensible reading of GDPR erasure (NFR-COMP-004) and of FR-ACC-007; there is no retained-data window to explain in a privacy policy; and at R1 no user-authored content would be orphaned by a hard delete. Rejected: (b) soft delete plus a 30-day grace window — needs a scheduled purge job (no cron infrastructure exists), a deleted-state flag threaded through every future query, and a privacy-policy explanation of retained data; (c) email-confirmed two-step deletion — better protection against a hijacked session, but adds a token flow and a drop-off point for a destructive action the user already explicitly confirmed by typing their address. Sub-choice: the gate is the typed email only, not password re-entry, so it behaves identically for the future SSO accounts of FR-ACC-009 and does not assume the account has a password.
3. **Auth library = Better Auth (`better-auth`), with a Prisma adapter.** It ships first-class email+password, email verification, password reset, database sessions, and rate limiting; it is framework-agnostic TypeScript with a Next.js App Router integration and a Prisma adapter that generates its own schema (which we then extend). Critically, it does **not** force a JWT session strategy for credential logins. Rejected: (a) **Auth.js / NextAuth v5** — its Credentials provider only supports JWT sessions, and stateless JWTs cannot be server-side invalidated on logout or password change, which is exactly what NFR-SEC-003 demands; the workaround is a hand-built denylist table, at which point the library is doing less than it costs. It also has no built-in password reset or email verification for credentials, so both would be hand-rolled anyway. (b) **Hand-rolled sessions** (`oslo`/`jose` + argon2 + our own tables, the post-Lucia pattern) — total control, but registration, verification, reset, session rotation, and rate limiting all become bespoke security code maintained by one person; the risk per line of code is poor value here. (c) **Clerk / Auth0 / Supabase Auth** — fastest to stand up, but it puts the user record in a third-party system that the platform own `Progress`/`Rating`/`Certificate` foreign keys must then mirror, adds a per-MAU cost curve to a free educational site, and turns FR-ACC-007 export and deletion into a two-system problem.
4. **Session strategy = database-backed sessions in Postgres, referenced by an httpOnly, secure, SameSite=Lax cookie.** This satisfies NFR-SEC-003 end to end: tokens are library-generated random values (not guessable); `expiresIn = 14 days` with `updateAge = 1 day` gives a rolling inactivity expiry (a session unused for 14 days is dead, an active one is silently extended at most daily); logout deletes the row; password change and password reset delete **all** of that user session rows. It also honours the statelessness constraint — session state lives in Postgres, never in a serverless instance memory. Rejected: stateless JWT / signed-cookie sessions — cheaper to read (no DB round trip), but "invalidated on logout or password change" is not honestly implementable without a server-side denylist, which reintroduces the round trip anyway.
5. **Password hashing = argon2id via `@node-rs/argon2`**, configured as the Better Auth custom `password.hash`/`password.verify`. NFR-SEC-001 names bcrypt or argon2 explicitly; the Better Auth default is scrypt, which would arguably satisfy "a modern salted hash" but not the literal requirement, so we override it. OWASP-recommended parameters (memoryCost 19456 KiB, timeCost 2, parallelism 1) land around 50-100ms per hash, leaving ample room under the NFR-PERF-004 500ms p95 budget. `@node-rs/argon2` ships prebuilt binaries for `linux-x64-gnu` (Vercel build and runtime) and `win32-x64-msvc` (local dev) and is declared in `serverExternalPackages` so Next.js does not try to bundle it. Rejected: `bcryptjs` (pure JS, no native dependency, but slower per unit of resistance and capped at 72 bytes of input); `argon2` (node-gyp build from source, a worse Windows dev experience). If the native module causes friction, `bcryptjs` behind the same `password.ts` interface is the pre-agreed fallback — a one-file change that still satisfies NFR-SEC-001.
6. **Rate limiting = the Better Auth built-in limiter with `storage: "database"`** (a `RateLimit` table), with custom per-path rules: sign-in 5 per 15 min, forgot-password 3 per hour, sign-up 10 per hour, reset-password 5 per hour, all keyed by client IP resolved from `x-forwarded-for`. Database storage rather than the default in-memory store, because in-memory counters are per-serverless-instance and therefore both ineffective and a violation of the statelessness constraint. Rejected: Upstash Redis / `@upstash/ratelimit` — better write characteristics, but a new external account and cost for a limiter that will see trivial volume at R1; documented as the upgrade path if the `RateLimit` table becomes a write hotspot.
7. **Transactional email = Resend**, behind a small `src/lib/mail/mailer.ts` abstraction with three transports: `resend` (when `RESEND_API_KEY` is set), `console` (dev default, logs the message and the action link), and `file` (writes JSON messages to a gitignored `.mail-outbox/`, used by Playwright so e2e can read a real reset link without a mail provider). Resend chosen for its generous free tier, simple API, and near-zero setup; the transport indirection means the absence of a key degrades gracefully rather than breaking `next build` — the same pattern the scaffolding item established for the Sentry DSN. Rejected: SendGrid/Mailgun (heavier onboarding and more account friction for a solo maintainer); SMTP via Nodemailer (needs some other provider credentials anyway and is awkward on serverless); the Better Auth magic-link/OTP flows (would change the FR-ACC-001/003 product surface, which the requirements state as email + password).
8. **Email verification exists but does not gate sign-in at R1** _(planner call, recorded per instruction)_. A verification email is sent on sign-up and the `emailVerified` flag flips when the link is followed, but `requireEmailVerification` is `false`, so a new user can complete onboarding and start learning immediately. Rationale: no requirement asks for verification-gated login (FR-ACC-003 only requires email verification **for password reset**), and for a free educational site the activation funnel is the whole game — a mandatory inbox round-trip between "signed up" and "first lesson" is the single most expensive drop-off we could design in. Verification is captured now so a later item can gate the things that actually need a trustworthy address (certificate issuance, notification emails) without a migration. The unverified state is visible in the UI as a dismissible banner with a resend link.
9. **Onboarding role/level selection UI is built here, not deferred to a placement work item** _(planner call, recorded per instruction)_. FR-ACC-004/005/006 require the profile to **capture** role and level and to let the user change them, which is unimplementable without a selection UI. Building that UI incidentally satisfies FR-PLACE-001 and FR-PLACE-002, which describe the same self-select interaction. The alternative is storing two nullable columns nobody can populate, or building a throwaway settings-only editor and then a second onboarding screen weeks later. The quiz-based half of placement (FR-PLACE-003/004/005, R2) stays firmly out of scope; when it lands it writes to the same `level` column and can reuse the same components. Consequence to be honest about: the future placement work item inherits an onboarding screen it did not write and must integrate the quiz into it as an alternative entry point.
10. **Client conventions.** Auth mutations (sign-up, sign-in, sign-out, forgot/reset password) go through the Better Auth client from client components; account mutations (profile, export, delete) go through our own route handlers under `/api/account/*`. Server components read the session via `getCurrentUser()`/`requireUser()` and read profile fields through Prisma directly. Rationale: one obvious place for each kind of call, and export needs a route handler regardless because it sets `Content-Disposition`. Role and level are Prisma enums owned by our routes and are deliberately **not** declared as Better Auth `additionalFields`, so the library never needs to understand them; only `minimumAgeAcknowledgedAt` is an additional field, because it must be written atomically at sign-up.

## Prisma schema design

`prisma/schema.prisma` currently holds the `HealthCheck` stub, whose own comment says it is "expected to be replaced or removed by the first real data-model work item". This is that item: the stub is removed. `/api/health` does not query it (deliberately dependency-free), so nothing breaks.

Shape to land. The Better Auth Prisma adapter dictates the auth table and field names, so the builder must run `npx @better-auth/cli generate` against the configured auth instance to emit them exactly, then hand-edit that output to add the product fields, enums, cascades, and indexes below — rather than trusting a hand-written approximation:

- **`User`** — Better Auth base fields (`id`, `name`, `email` unique, `emailVerified` boolean, `image`, `createdAt`, `updatedAt`) plus product fields: `roleArchetype RoleArchetype?`, `level ProficiencyLevel?`, `onboardingCompletedAt DateTime?`, `minimumAgeAcknowledgedAt DateTime?`. Role and level are nullable because a user exists between sign-up and onboarding. `minimumAgeAcknowledgedAt` is nullable at the database level (the adapter creates the row) but is required by the sign-up input schema and written at creation through an `additionalFields` entry — the nullability is a schema artifact, not a permitted state for new accounts. Indexes: `@@unique` on `email` (adapter default), `@@index([createdAt])`.
- **`Session`** — adapter fields (`id`, `token` unique, `userId`, `expiresAt`, `ipAddress`, `userAgent`, timestamps). Relation to `User` with `onDelete: Cascade`. Indexes: `@@index([userId])`, `@@index([expiresAt])` — supports both "revoke all sessions for this user" and expired-session cleanup at 100k-user scale (NFR-SCALE-002).
- **`Account`** — adapter fields, including the credential `password` column that holds the argon2id hash, and the OAuth token columns that stay null at R1 but mean FR-ACC-009 needs no migration. `@@unique([providerId, accountId])`, `@@index([userId])`, `onDelete: Cascade`.
- **`Verification`** — adapter fields (`identifier`, `value`, `expiresAt`, timestamps) backing email verification and password-reset tokens. `@@index([identifier])`.
- **`RateLimit`** — adapter fields for database-backed rate limiting (`key` unique, `count`, `lastRequest`).
- **Enums** — `RoleArchetype { TECHNICAL_BUILDER, ENGINEERING_LEADER, EXECUTIVE_NON_TECHNICAL, INVESTOR, NOT_SURE_YET }` and `ProficiencyLevel { ZERO_KNOWLEDGE, INTERMEDIATE, ADVANCED }`, matching the requirement wording exactly.

Explicitly **not** added: any path/course/lesson/progress/rating/certificate model, any `deletedAt` column (decision #2 is a hard delete), any admin/role column (NFR-SEC-006 is R2).

Migration: a single initial migration (`npx prisma migrate dev --name init_accounts`) that drops `HealthCheck` and creates the above. It must be committed — `prisma/migrations/` is not gitignored and does not yet exist, so this item establishes it, and CI and deploy run `prisma migrate deploy`.

## Tasks

Ordered so each is independently completable. Paths are relative to the project root `C:\Users\amitn\MyAIprojects\AI Learning Platform`.

### Foundation

1. - [x] `package.json`: add dependencies `better-auth`, `@node-rs/argon2`, `resend`, `tailwindcss` (v4), `@tailwindcss/postcss`; add devDependencies `prettier-plugin-tailwindcss`, `@testing-library/user-event`, `dotenv` (so the Playwright config and helpers can load `.env.local`). Add a `test:e2e:ui` script (`playwright test --ui`); leave existing scripts unchanged. Pin exact versions in the existing style — the file currently pins everything without ranges.
2. - [x] `postcss.config.mjs` (new): export `{ plugins: { "@tailwindcss/postcss": {} } }`.
3. - [x] `src/app/globals.css` (new): `@import "tailwindcss";` plus a `@theme` block defining base colour and typography tokens, and base styles including a visible `:focus-visible` ring (NFR-A11Y-004).
4. - [x] `.prettierrc`: add `"plugins": ["prettier-plugin-tailwindcss"]` for deterministic class ordering.
5. - [x] `.gitignore`: add `.mail-outbox/` (the test/dev email capture directory).
6. - [x] `.env.example`: add documented placeholders `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `MAIL_TRANSPORT`, with comments explaining that `RESEND_API_KEY` is optional locally (falls back to the console transport) and that `BETTER_AUTH_SECRET` is generated with `openssl rand -base64 32`. No real values.
7. - [x] `src/lib/env.ts`: extend `envSchema` with `BETTER_AUTH_SECRET` (required, min 32 chars, message pointing at the provisioning checklist), `BETTER_AUTH_URL` (optional URL, defaults to `APP_URL`), `RESEND_API_KEY` (optional), `EMAIL_FROM` (optional email, default `no-reply@localhost`), `MAIL_TRANSPORT` (optional enum `resend | console | file`). Keep the existing lazy `getEnv()` semantics and aggregated-error message.
8. - [x] `next.config.ts`: add `serverExternalPackages: ["@node-rs/argon2"]` so the native module is not bundled. Leave the security headers untouched.

### Data model

9. - [x] `prisma/schema.prisma`: delete the `HealthCheck` stub; add `User`, `Session`, `Account`, `Verification`, `RateLimit` (generated via `@better-auth/cli generate`, then hand-edited) plus the `RoleArchetype` and `ProficiencyLevel` enums, product fields, cascades, and indexes per the schema section above. Replace the stub header comment with a real one.
10. - [x] `prisma/migrations/**` (new): commit the initial migration produced by `npx prisma migrate dev --name init_accounts`.

### Auth core

11. - [x] `src/lib/auth/password.ts` (new): `hashPassword`/`verifyPassword` wrapping `@node-rs/argon2` with argon2id and the OWASP parameters from decision #5. Never logs the plaintext or the hash.
12. - [x] `src/lib/auth/options.ts` (new): export the plain Better Auth options object — Prisma adapter, `emailAndPassword` with `minPasswordLength: 12` and `maxPasswordLength: 128` and the custom `password.hash`/`password.verify`, `sendResetPassword`, `emailVerification.sendOnSignUp: true` with `requireEmailVerification: false`, `session.expiresIn`/`updateAge`, `advanced` cookie options (prefix, httpOnly, secure in production, SameSite=Lax) and `ipAddressHeaders: ["x-forwarded-for"]`, `trustedOrigins` derived from `APP_URL`, `rateLimit` with `storage: "database"` and the custom rules from decision #6, and `user.additionalFields.minimumAgeAcknowledgedAt`. Exported as a plain object specifically so it is unit-testable without instantiating Prisma.
13. - [x] `src/lib/auth/index.ts` (new): construct and export the `betterAuth(...)` server instance from those options, plus `revokeAllSessions(userId)` used after password change and reset.
14. - [x] `src/lib/auth/client.ts` (new): `createAuthClient` for client components (`signUp`, `signIn`, `signOut`, `forgetPassword`, `resetPassword`, `useSession`).
15. - [x] `src/app/api/auth/[...all]/route.ts` (new): mount the Better Auth handler for GET and POST.
16. - [x] `src/lib/auth/session.ts` (new): `getCurrentUser()` (session plus Prisma profile fields, or null), `requireUser()` (redirects to `/sign-in?next=...` when unauthenticated), `requireOnboardedUser()` (additionally redirects to `/onboarding` when `roleArchetype`/`level` are null). These are the authoritative access-control checks (FR-ACC-008).
17. - [x] `src/middleware.ts` (new): optimistic session-cookie presence check that redirects anonymous requests for `/dashboard`, `/onboarding`, `/account` to `/sign-in`, and authenticated requests for `/sign-in` and `/sign-up` to `/dashboard`. A comment must state that this is a UX fast path only and that `requireUser()` is the real gate, because middleware cannot run Prisma.
18. - [x] `src/lib/validation/account.ts` (new): Zod schemas — `signUpSchema` (name trimmed, length-capped, control characters stripped; email normalized to lowercase; password 12-128 with no composition rules, per NIST SP 800-63B; `minimumAgeAcknowledged` must be `true`), `signInSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `profileSchema` (role and level enums), `deleteAccountSchema` (typed email must match exactly).

### Email

19. - [x] `src/lib/mail/mailer.ts` (new): `sendMail({ to, subject, html, text })` dispatching to the `resend`, `console`, or `file` transport per decision #7; transport resolution is `MAIL_TRANSPORT` if set, else `resend` when `RESEND_API_KEY` is present, else `console`. Never logs the API key.
20. - [x] `src/lib/mail/templates.ts` (new): plain HTML and text templates for `verifyEmail`, `resetPassword` (with expiry wording), and `accountDeleted` (the after-the-fact confirmation from decision #2). Values are escaped; no user-controlled HTML is interpolated.

### UI

21. - [x] `src/app/layout.tsx`: import `globals.css`, keep the existing metadata, render a real `<SiteHeader />` shell plus a skip-to-content link.
22. - [x] `src/components/layout/site-header.tsx` (new): server component reading `getCurrentUser()`; shows Sign in / Sign up when anonymous and Dashboard / Account / Sign out when authenticated (visible evidence for FR-ACC-008 and FR-ACC-002).
23. - [x] `src/components/ui/form-field.tsx` (new): labeled input primitive with `htmlFor`/`id` wiring, `aria-describedby` error association, and an `aria-live="polite"` error slot (NFR-A11Y-004).
24. - [x] `src/components/auth/sign-up-form.tsx`, `sign-in-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` (new, client components): client-side Zod validation, Better Auth client calls, inline error rendering, disabled and pending states. The sign-up form includes the minimum-age acknowledgment checkbox (NFR-SEC-011) and cannot submit without it. The forgot-password form always renders the same "if an account exists, we sent a link" confirmation regardless of outcome, so there is no account enumeration.
25. - [x] `src/app/(auth)/sign-up/page.tsx`, `sign-in/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` (new): thin server-component pages with metadata that render the corresponding forms; `reset-password` reads the `token` query param and shows a clear error state for a missing or expired token.
26. - [x] `src/app/(app)/onboarding/page.tsx` plus `src/components/account/role-level-form.tsx` (new): present the four role archetypes plus "not sure yet" and the three levels with plain-language descriptions (FR-ACC-004/005, FR-PLACE-001/002); submit to `PATCH /api/account/profile`; set `onboardingCompletedAt` and redirect to `/dashboard`. The same component is reused on the account page for FR-ACC-006.
27. - [x] `src/app/(app)/dashboard/page.tsx` (new): authenticated placeholder greeting the user and showing their current role and level, plus the dismissible "verify your email" banner with a resend action. Explicitly a placeholder for the real dashboard work item.
28. - [x] `src/app/(app)/account/page.tsx` (new): profile section (reuses the role/level form, FR-ACC-006), a "Download my data" button, and the danger-zone delete section.
29. - [x] `src/components/account/delete-account-form.tsx` (new): the confirm button stays disabled until the typed value matches the account email exactly; on confirm it calls `DELETE /api/account` and redirects to a public "your account has been deleted" page.
30. - [x] `src/app/page.tsx`: replace the scaffolding placeholder with a real public landing page that states what the platform is, links to sign-up and sign-in, and makes the FR-ACC-008 browse-without-an-account story visible.

### Account APIs

31. - [x] `src/app/api/account/profile/route.ts` (new): `PATCH` — `requireUser()`, validate with `profileSchema`, update `roleArchetype`/`level`/`onboardingCompletedAt` via Prisma, return the updated profile (FR-ACC-004/005/006).
32. - [x] `src/app/api/account/export/route.ts` (new): `GET` — `requireUser()`, return the personal data of the requesting user as JSON with `Content-Disposition: attachment` and a dated filename. Includes profile fields, timestamps, verification state, and session metadata (created, last used, IP, user agent); **excludes** the password hash and all tokens (FR-ACC-007, NFR-COMP-004).
33. - [x] `src/app/api/account/route.ts` (new): `DELETE` — `requireUser()`, validate the typed confirmation against the session user email, capture name and email, `prisma.user.delete` (cascades sessions and accounts), clear the session cookie, then send the `accountDeleted` email. A failure to send that email must be logged, never allowed to fail or roll back the deletion (FR-ACC-007, decision #2).
34. - [x] `src/lib/auth/options.ts` (revisit): wire the password change and reset hooks to call `revokeAllSessions(userId)` so every other session dies on a password change or reset (NFR-SEC-003).

### Tests

35. - [x] `src/lib/validation/__tests__/account.test.ts` (new): password length bounds, email normalization, name sanitization and length cap, age acknowledgment required, role and level enums reject unknown values, delete confirmation exact match.
36. - [x] `src/lib/auth/__tests__/password.test.ts` (new, `@vitest-environment node`): the hash is not the plaintext, starts with `$argon2id$`, two hashes of the same password differ (salted), verify round-trips, verify rejects a wrong password.
37. - [x] `src/lib/auth/__tests__/options.test.ts` (new): assert the options object uses database session storage, sets `expiresIn`/`updateAge`, wires the custom argon2 hasher, has `requireEmailVerification === false`, has rate-limit storage `database` with rules for sign-in, sign-up, forget-password, and reset-password, and sets secure cookie flags.
38. - [x] `src/lib/mail/__tests__/mailer.test.ts` (new): transport selection logic, the file transport writes a readable message, the console transport does not throw when no key is set, templates include the action URL.
39. - [x] `src/components/auth/__tests__/sign-up-form.test.tsx` (new, RTL + user-event): submit is blocked without the age acknowledgment, the short-password error is announced, every input has an associated label.
40. - [x] `src/components/account/__tests__/delete-account-form.test.tsx` (new): the confirm button is disabled until the exact email is typed; a case or whitespace mismatch keeps it disabled.
41. - [x] `src/app/api/account/__tests__/export.test.ts` (new, node environment, Prisma mocked): the response body contains profile fields and no `password` or `token` key; `Content-Disposition` is an attachment.
42. - [x] `e2e/helpers/db.ts` and `e2e/helpers/mail.ts` (new): unique test-email generation, Prisma-based cleanup of test users (used by a global teardown), and a helper that reads the newest `.mail-outbox/` message for an address and extracts the action link.
43. - [x] `e2e/auth-registration.spec.ts` (new): register with email, password, and age acknowledgment, land on onboarding, select a role archetype and a level, land on the dashboard showing them (FR-ACC-001, FR-ACC-004/005, FR-PLACE-001/002, NFR-SEC-011; the NFR-MAINT-004 registration and placement journeys). Also asserts that sign-up is rejected without the age checkbox, and that a display name containing a script tag renders as literal text (NFR-SEC-007).
44. - [x] `e2e/auth-login-logout.spec.ts` (new): sign in with correct credentials to the dashboard; sign out and confirm the session cookie is gone and `/dashboard` redirects to `/sign-in`; a wrong password shows a generic error; anonymous access to `/dashboard`, `/onboarding`, and `/account` redirects (FR-ACC-002, FR-ACC-008, NFR-SEC-003).
45. - [x] `e2e/auth-password-reset.spec.ts` (new): request a reset for a real address, read the link from the file outbox, set a new password, confirm the old password fails, the new one works, and a pre-existing session is no longer valid (FR-ACC-003, NFR-SEC-003). Also asserts that requesting a reset for an unknown address shows the identical confirmation.
46. - [x] `e2e/account-profile.spec.ts` (new): change role and level from `/account` and confirm the change persists across sign-out and sign-in (FR-ACC-006).
47. - [x] `e2e/account-data.spec.ts` (new): download the export and assert the JSON contains the user email and no password field; then delete the account with the typed confirmation and assert that sign-in with those credentials now fails and a deletion email landed in the outbox (FR-ACC-007).
48. - [x] `e2e/smoke.spec.ts`: update the home-page assertion to match the new landing page copy.
49. - [x] `playwright.config.ts`: load `.env.local` via `dotenv`, pass `MAIL_TRANSPORT=file` and the rate-limit-relaxing flag to the `webServer` env, and register the global teardown that cleans up test users.

### CI and docs

50. - [x] `.github/workflows/ci.yml`: add `BETTER_AUTH_SECRET` (placeholder) and `MAIL_TRANSPORT: file` to both jobs env blocks; in the e2e job add a `postgres:16` service container, point `DATABASE_URL`/`DIRECT_URL` at it, run `npx prisma migrate deploy` before the tests, rename the job to reflect real journeys, and remove `continue-on-error` so e2e becomes blocking (NFR-MAINT-004).
51. - [x] `docs/architecture/auth.md` (new): decision record capturing decisions #3 through #8 with their rejected alternatives, the NFR-SEC-001/003/005 mapping, and the session, cookie, and rate-limit parameter values.
52. - [x] `docs/runbooks/provisioning-checklist.md`: append the new manual steps below, in the existing style with the fails-fast / degrades-gracefully note.
53. - [x] `README.md`: document the new env vars, how to run migrations, the console and file mail transports for local dev, and how to run e2e against a local Postgres.

## New manual provisioning steps (human-only)

- [ ] Generate a `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and add it to `.env.local`, to the Vercel env vars (all environments), and as a GitHub Actions secret if any workflow needs a real one. **Fails fast** via `getEnv()` if missing.
- [ ] Create a Resend account and copy an API key into `RESEND_API_KEY`. **Degrades gracefully**: without it, mail falls back to the console transport and nothing crashes, but password reset is unusable for real users.
- [ ] Verify a sending domain in Resend and set `EMAIL_FROM` to an address on it. Note the constraint: until a domain is verified, the Resend shared test sender only delivers to the account owner own address, so this step is effectively blocked on the still-open custom-domain question from the scaffolding plan (its risk #2). Beta workaround: verify a domain you already own, or accept owner-only delivery in staging.
- [ ] Add `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and (if it differs from `APP_URL`) `BETTER_AUTH_URL` to the Vercel project environment variables.
- [ ] Run `npx prisma migrate deploy` against the Neon database (or wire it into the Vercel build command) so the account tables exist in the deployed environment.
- [ ] After the first real deploy, send yourself a password-reset email end to end and confirm delivery (not spam-foldered). This is the only way to validate the Resend domain setup.
- [ ] Re-check GitHub branch protection: the required status-check list should now also include the e2e job, which this item promotes to blocking.

## Acceptance criteria

1. A visitor can register at `/sign-up` with name, email, and a 12+ character password, and cannot submit without ticking the minimum-age acknowledgment; the resulting `User` row has `minimumAgeAcknowledgedAt` set. _(FR-ACC-001, NFR-SEC-011)_
2. No password is ever stored or logged in plaintext: the `Account.password` column holds an `$argon2id$`-prefixed hash, two registrations with the same password produce different hashes, and no log line or error response contains a password. _(NFR-SEC-001)_
3. A registered user can sign in at `/sign-in` and sign out; a wrong password returns a generic failure that does not reveal whether the email exists. _(FR-ACC-002)_
4. Sessions are rows in `Session` referenced by an httpOnly, SameSite=Lax, secure-in-production cookie; the row is deleted on sign-out; a session expires after 14 days of inactivity and is extended at most once a day while active; a password change or reset deletes **all** sessions for that user. _(NFR-SEC-003)_
5. A user who has forgotten their password can request a reset at `/forgot-password`, receive an email containing a single-use, expiring link, set a new password, and sign in with it; the old password no longer works. Requesting a reset for an unknown address produces an identical confirmation screen. _(FR-ACC-003)_
6. Repeated sign-in attempts (more than 5 in 15 minutes), forgot-password requests (more than 3 per hour), sign-ups (more than 10 per hour), and reset attempts (more than 5 per hour) from the same client IP are rejected with HTTP 429, and the counters live in the `RateLimit` table, not in process memory. _(NFR-SEC-005, NFR-SCALE-001)_
7. Immediately after registration the user is taken to `/onboarding`, which presents exactly the four role archetypes plus "not sure yet" and the three levels; the selections persist to `User.roleArchetype` and `User.level` and the dashboard reflects them. _(FR-ACC-004, FR-ACC-005, FR-PLACE-001, FR-PLACE-002)_
8. A signed-in user can change role and/or level at any time from `/account`, and the change persists across sign-out and sign-in. _(FR-ACC-006)_
9. `GET /api/account/export` returns a downloadable JSON file containing the personal data of the requesting user and containing no password hash and no session or verification tokens. _(FR-ACC-007, NFR-COMP-004)_
10. Account deletion requires typing the exact account email; on confirmation the `User` row and all its `Session`, `Account`, and `Verification` rows are gone from the database immediately, the session cookie is cleared, sign-in with those credentials fails, and a confirmation email is sent to the former address. A failure to send that email does not leave the account undeleted. _(FR-ACC-007, decision #2)_
11. Anonymous visitors can load `/` and any other public route, but requests for `/dashboard`, `/onboarding`, and `/account` redirect to `/sign-in`; the redirect is enforced server-side by `requireUser()`, not only by middleware. _(FR-ACC-008)_
12. A verification email is sent on sign-up and following its link sets `emailVerified = true`, but an unverified user can still sign in and complete onboarding; the dashboard shows an unverified-email banner with a working resend action. _(decision #8)_
13. `prisma/schema.prisma` contains no `HealthCheck` model and no path, content, progress, rating, or certificate model; the committed initial migration applies cleanly to an empty database; `email` is unique and `Session.userId` and `Session.expiresAt` are indexed. _(scope discipline, NFR-SCALE-002)_
14. Tailwind v4 is active: `npm run build` succeeds, the auth and account pages are styled and usable at 375px, 768px, and 1280px widths, and `npm run format` sorts classes with no diff on a clean tree. _(decision #1, NFR-A11Y-002)_
15. Every input on every auth and account form has an associated `<label>`, every error is announced in an `aria-live` region, and each full flow (register, sign in, onboard, change profile, delete) is completable with keyboard alone with a visible focus indicator. _(NFR-A11Y-004)_
16. Display names round-trip safely: a name containing a script tag is stored as literal text and rendered escaped on the dashboard and in the export, with no script execution. _(NFR-SEC-007)_
17. `npm run lint`, `npm run test`, and `npm run test:e2e` all pass locally; CI runs lint, unit tests, build, and audit, and in a separate now-blocking job runs the Playwright suite against a real Postgres with migrations applied. _(NFR-MAINT-004)_
18. `docs/architecture/auth.md`, the README env and setup section, and the provisioning-checklist additions all exist and describe the shipped behaviour, including the graceful degradation when `RESEND_API_KEY` is unset. _(NFR-MAINT-005)_

## Test plan

| What                                                                                      | Type                                       | Maps to        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ | -------------- |
| Zod schemas: password bounds, email normalization, name cap, age-ack required, enum guard | Unit (Vitest) — `validation/account.test`  | AC1, AC7, AC16 |
| argon2id hash/verify: prefix, salt uniqueness, round-trip, wrong-password rejection        | Unit (Vitest, node env) — `password.test`  | AC2            |
| Auth options object: DB sessions, expiry/updateAge, custom hasher, cookie flags, RL rules  | Unit (Vitest) — `options.test`             | AC2, AC4, AC6  |
| Mail transport selection, templates contain the action link, no key logged                 | Unit (Vitest) — `mailer.test`              | AC5, AC18      |
| Sign-up form: age-ack gate, short-password error announced, labels present                 | Component (RTL + user-event)               | AC1, AC15      |
| Delete form: confirm disabled until the exact email is typed                               | Component (RTL + user-event)               | AC10, AC15     |
| Export payload excludes password and tokens; attachment header set                         | Unit (Vitest, node env, Prisma mocked)     | AC9            |
| Register, onboard (role + level), reach dashboard; rejected without age-ack                | E2E — `auth-registration.spec.ts`          | AC1, AC7, AC12 |
| Script-tag display name renders as literal text                                            | E2E — `auth-registration.spec.ts`          | AC16           |
| Sign in to dashboard; sign out clears cookie and `/dashboard` redirects; bad password       | E2E — `auth-login-logout.spec.ts`          | AC3, AC4       |
| Anonymous access to `/dashboard`, `/onboarding`, `/account` redirects to `/sign-in`        | E2E — `auth-login-logout.spec.ts`          | AC11           |
| Forgot, read link from file outbox, reset, old password fails, other sessions dead         | E2E — `auth-password-reset.spec.ts`        | AC5, AC4       |
| Unknown-address reset shows the identical confirmation                                     | E2E — `auth-password-reset.spec.ts`        | AC5            |
| Change role and level from `/account`; persists across re-login                            | E2E — `account-profile.spec.ts`            | AC8            |
| Export downloaded and inspected; delete with typed confirmation; re-login fails; email      | E2E — `account-data.spec.ts`               | AC9, AC10      |
| Migration applies cleanly to an empty DB; no stub or product-feature models                | CI (`prisma migrate deploy`) + code review | AC13           |
| Rate limiting returns 429 and rows land in `RateLimit`                                     | Manual (scripted burst against local dev)  | AC6            |
| Responsive check at 375/768/1280 and keyboard-only walkthrough of each flow                | Manual                                     | AC14, AC15     |
| Real password-reset email delivered via Resend (not spam-foldered)                         | Manual (after provisioning)                | AC5, AC18      |
| Auth endpoint p95 latency under 500ms on the deployed app                                  | Manual (post-deploy, Sentry performance)   | NFR-PERF-004   |

Notes: the e2e suite requires a live Postgres — locally the `.env.local` database of the developer with migrations applied, in CI the new `postgres:16` service container. Tests must generate unique emails per run and the global teardown removes them, so the suite is safe to re-run against a shared dev database. Rate limiting must be relaxed for the e2e environment through an explicit env-driven override in `options.ts`, or the login specs will trip it — the builder should add that override deliberately and assert the limiter separately (manual, AC6) rather than leaving it silently off in production.

## Risks / open questions

Answered by the human before planning (recorded here, not open):

1. **UI foundation** — Tailwind CSS v4, per recommendation 1a. See decision #1.
2. **FR-ACC-007 deletion semantics** — immediate hard delete on typed confirmation, with a confirmation email afterwards, per recommendation 2a. See decision #2.

Flagged for the human. These do not block the build, but confirm before ship:

3. **Minimum-age threshold (NFR-SEC-011).** The COPPA line is 13; GDPR-K lets member states set anywhere from 13 to 16. The plan defaults to "I confirm I am 16 or older" as the single globally safe threshold, phrased as a self-contained checkbox that does not depend on a privacy policy page existing. If you want 13+ with region handling, say so — it is a copy change plus a validation constant, cheap now and annoying later.
4. **Resend domain verification is blocked on the custom-domain question** left open by the scaffolding plan (its risk #2). Until a domain is verified, the Resend shared test sender only delivers to the account owner inbox, so password reset cannot be exercised by real beta users. The code works either way (the file and console transports keep dev and e2e green), but this gates the manual check for AC5.
5. **Data-residency follow-through.** The scaffolding plan assumed a US region. This item is where actual personal data (email, IP addresses in `Session`, user agent) starts landing in Postgres. If EU-resident users are in scope at beta, this is the last cheap moment to move the Neon region.
6. **Promoting the e2e job to blocking** roughly doubles PR feedback time (build, browser install, Postgres). NFR-MAINT-004 makes core-journey coverage non-negotiable, but if CI minutes become painful the mitigation is a nightly full run plus a blocking subset — say if you would rather start there.

Lower-stakes notes (no answer needed):

7. Rate limiting is keyed by client IP only at R1. Per-account lockout (N failed attempts for a given email regardless of source IP) is the natural follow-up and matters more once the platform has users worth targeting; it is deliberately not built here because it introduces a lockout-abuse vector that needs its own design.
8. No breached-password (HaveIBeenPwned k-anonymity) check at registration. NIST recommends it and it adds an outbound call on the sign-up path. Worth a follow-up item.
9. A hard delete leaves no audit trail of deletions at all. NFR-SEC-010 (admin action logging) is R2; when it lands, decide then whether a PII-free deletion record (hashed email plus timestamp) is compatible with the erasure promise made here.
10. Email address change is not implemented, so the correction right in NFR-COMP-004 is only partly covered (name, role, and level are editable). Flagged so it is a conscious gap rather than an oversight.
11. This item creates an obligation for the future R2 placement work item: the diagnostic quiz must integrate into the onboarding screen built here (decision #9) rather than adding a parallel one.
12. `@node-rs/argon2` is a native module. If it misbehaves on Vercel or in a Windows dev shell, swap to `bcryptjs` behind the same `src/lib/auth/password.ts` interface — pre-agreed, still satisfies NFR-SEC-001, no plan amendment needed.

## Builder notes

Recorded during the build pass covering tasks 35-53 (tests, e2e, CI, docs). All of the following were bugs/environment issues discovered while re-verifying the already-built tasks 1-34, fixed in the same pass because they blocked getting the toolchain green — not scope expansion beyond what the plan already committed to.

1. **`.npmrc` (`legacy-peer-deps=true`)** was created during an earlier session (tasks 1-34) with a comment pointing at this "Builder notes" section, which didn't exist yet. Documenting it now for completeness: `better-auth` declares optional peerDependencies on framework/ORM adapters this project doesn't use (SvelteKit, Vue, Solid, Drizzle, etc.); npm's strict peer resolver still walks those optional peers' own peer ranges and reports a false-positive `ERESOLVE` conflict. `legacy-peer-deps=true` sidesteps that specific false positive without changing which packages actually get installed for this project's real dependency tree.

2. **Sign-up wasn't actually persisting `minimumAgeAcknowledgedAt` (NFR-SEC-011, AC1) — fixed.** `sign-up-form.tsx` validated the age-acknowledgment checkbox client-side but never included `minimumAgeAcknowledgedAt` in the `authClient.signUp.email(...)` call, so the additional field was silently written as `null`. Fixed by passing `minimumAgeAcknowledgedAt: new Date()` once client-side validation passes. This required two follow-on fixes to make it type-safe: (a) `src/lib/auth/options.ts`'s `buildAuthOptions()` no longer has an explicit `: BetterAuthOptions` return-type annotation (it uses `satisfies BetterAuthOptions` on the returned object instead) — the annotation was widening the return type and erasing the literal `user.additionalFields` shape; (b) `src/lib/auth/client.ts` now passes `inferAdditionalFields<typeof auth>()` to `createAuthClient`'s `plugins` so the client call is statically typed. Covered by `e2e/auth-registration.spec.ts`, which asserts the DB row directly.

3. **Infinite redirect loop between a protected page and `/sign-in` for a stale (revoked-but-cookie-still-present) session — fixed.** `src/middleware.ts` previously redirected any request to `/sign-in`/`/sign-up` back to `/dashboard` purely because a session cookie was *present*, without validating it. Combined with `requireUser()`'s authoritative redirect to `/sign-in` when the session is actually invalid (e.g. after a password reset revokes all sessions, per decision #4/NFR-SEC-003), a browser holding a stale cookie would bounce forever: `/dashboard` → (invalid session) → `/sign-in` → (cookie present) → `/dashboard` → ... Found via `e2e/auth-password-reset.spec.ts`'s "prior session dies" assertion (`net::ERR_TOO_MANY_REDIRECTS`). Fixed by removing the presence-only "already authenticated" redirect from middleware entirely and moving it to `src/app/(auth)/sign-in/page.tsx` and `sign-up/page.tsx`, which call the real `getCurrentUser()` check and only redirect when a session actually validates. Middleware now only ever redirects in the safe direction (no cookie → protected path → `/sign-in`), which can't loop.

4. **`playwright.config.ts`'s `webServer` build was crashing when `NODE_ENV` resolved to `"test"`** (set by the Playwright runner and/or inherited from a CI job's `env:` block) — Next.js deliberately skips loading `.env.local` when `NODE_ENV=test`, which starved the production build of `DATABASE_URL`/`DIRECT_URL`/`BETTER_AUTH_SECRET` and crashed. Fixed by forcing `NODE_ENV: "production"` last in `webServer.env` (the command genuinely does run a production build + server), which also protects the new CI `e2e` job regardless of its own job-level `NODE_ENV: "test"`.

5. **`prettier@3.6.2` + `prettier-plugin-tailwindcss@0.8.1` crashes on every `.ts`/`.tsx` file** (`TypeError: e.charAt is not a function` inside prettier's bundled TypeScript parser, reproducible on files untouched by this work item, e.g. `next.config.ts`) — a real incompatibility between that exact pinned pair, confirmed by testing in isolation. `prettier-plugin-tailwindcss` has no newer published version to bump to (0.8.1 is latest); `prettier@3.7.0` and later resolve it. Bumped the pinned version to `prettier@3.9.6` (latest stable 3.x at time of fixing) in `package.json`/`package-lock.json`. `npm run format` was then re-run to apply the small number of formatting diffs the newer version's engine produces on 9 already-existing files.

6. **Local-machine-only, not committed anywhere:** this build session's dev machine has very little free RAM under normal load, which made `next build`'s default worker count (CPU count − 1, here ~15) and Playwright's default parallel workers OOM-crash or severely thrash during local validation. Worked around locally with `CIRCLE_NODE_TOTAL=<n>` (an env var Next.js's `experimental.cpus` default computation reads) and `playwright test --workers=<n>` on the command line only — neither is wired into `next.config.ts`, `playwright.config.ts`, or CI, since GitHub Actions runners don't share this machine's memory constraint and CI already pins `workers: 1` for Playwright.
