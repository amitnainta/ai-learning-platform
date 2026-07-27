# Provisioning Checklist (manual, one-time, human-only)

These are account/credential/monitor provisioning actions that a builder agent
cannot and must not perform (no fabricated credentials, no account creation on
the human's behalf). None of these are assumed complete by the code in this
repo — every environment variable they produce degrades gracefully to a
documented no-op or fails fast with a clear error when absent: `DATABASE_URL`/
`DIRECT_URL` fail fast via `src/lib/env.ts`'s `getEnv()`, called from
`src/lib/prisma.ts` before the Prisma client is constructed; `SENTRY_DSN`/
`NEXT_PUBLIC_SENTRY_DSN` no-op via `sentry.server.config.ts`,
`sentry.edge.config.ts`, and `src/instrumentation-client.ts`.

Check each off only after actually performing it outside this repo.

- [ ] Create a Vercel account/team and import the GitHub repo; select the
      deployment region.
- [ ] Create a Neon project; copy the pooled connection string
      (`DATABASE_URL`) and the direct connection string (`DIRECT_URL`) from the
      Neon dashboard's Connection Details.
- [ ] Enable/verify Neon's backup retention + PITR window (in the Neon
      dashboard, Project Settings). Confirm the window is long enough to
      support the RPO target in `docs/architecture/disaster-recovery.md`; if
      the available plan's window is shorter, either upgrade the plan or
      revise the RPO target down and note the change.
- [ ] Create a Sentry project (platform: Next.js); copy the DSN.
- [ ] Create an uptime monitor (Better Stack or UptimeRobot free tier)
      targeting the deployed `/api/health` URL; set an alert contact
      (email/SMS/etc.) that will actually be checked.
- [ ] Add all environment variables/secrets in the Vercel dashboard (Project
      Settings → Environment Variables) **and** as GitHub Actions secrets if
      any workflow needs them beyond the CI placeholder values already in
      `.github/workflows/ci.yml`:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `APP_URL` (the real deployed URL, once known)
- [ ] Attach a custom domain (or accept the `*.vercel.app` domain for beta) in
      Vercel; confirm auto-provisioned TLS and that HTTP requests redirect to
      HTTPS (`curl -I http://<domain>` should return a redirect to `https://`).
- [ ] Configure Sentry alert rules for error-rate and latency thresholds
      (Sentry project → Alerts) so NFR-OBS-001's "alerting" requirement is
      actually wired to a human, not just data sitting in a dashboard.
- [ ] Run the restore drill once, per
      `docs/runbooks/backup-and-restore.md`, and record the result in that
      document's restore-drill table (date, method, result).
- [ ] Configure GitHub branch protection on `main` (Settings → Branches →
      branch protection rules): require the `Lint, test, build, audit` status
      check from `.github/workflows/ci.yml` to pass before merging, and
      disallow direct pushes to `main`. Without this, a red CI run does not
      actually block a merge — the workflow only reports status, it does not
      enforce anything on its own.

### Added by user-accounts-auth

- [ ] Generate a `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and add it
      to `.env.local`, to the Vercel project environment variables (all
      environments), and as a GitHub Actions secret if any workflow needs a
      real one (the CI workflow itself only ever uses a placeholder — see
      `.github/workflows/ci.yml`). **Fails fast** via `src/lib/env.ts`'s
      `getEnv()` if missing or under 32 characters.
- [ ] Create a Resend account and copy an API key into `RESEND_API_KEY`
      (Vercel env vars). **Degrades gracefully**: without it, transactional
      mail (verification, password reset, account-deletion confirmation)
      falls back to the console transport and nothing crashes, but password
      reset is unusable for real users until this is done.
- [ ] Verify a sending domain in Resend and set `EMAIL_FROM` to an address on
      it. Note the constraint: until a domain is verified, the Resend shared
      test sender only delivers to the Resend account owner's own address —
      this is effectively blocked on the still-open custom-domain question
      from the scaffolding item (see `docs/architecture/infrastructure.md`
      §1 and its open risk). Beta workaround: verify a domain you already
      own, or accept owner-only delivery in staging.
- [ ] Add `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and (if it
      differs from `APP_URL`) `BETTER_AUTH_URL` to the Vercel project
      environment variables, alongside the `DATABASE_URL`/`DIRECT_URL`/
      `SENTRY_DSN`/etc. already listed above.
- [ ] Run `npx prisma migrate deploy` against the real Neon database (or wire
      it into the Vercel build command) so the account/session/auth tables
      in `prisma/migrations/` actually exist in the deployed environment.
      Without this, every request that touches `src/lib/prisma.ts` fails at
      the database, not at `getEnv()` — there is no code-level guard for "the
      schema is provisioned," only for "the connection strings are
      well-formed."
- [ ] After the first real deploy, send yourself a password-reset email end
      to end and confirm delivery (not spam-foldered). This is the only way
      to validate the Resend domain setup actually works for a real inbox.
- [ ] Re-check GitHub branch protection (the item above): the required
      status-check list should now also include the `e2e` job from
      `.github/workflows/ci.yml`, which this item promotes from an optional,
      `continue-on-error` smoke test to a blocking check.

## Why these stay manual

Each of these requires either a real external account, a real payment/free-tier
signup, or a credential that only the account owner should hold. Fabricating
placeholder values for any of these (beyond the documented placeholders already
in `.env.example`) would create a false impression that the environment is
provisioned when it is not, and could leak into a commit. If you are picking up
this checklist as the human operator: work top-to-bottom, since several later
items (alerts, the restore drill, the HTTPS check) depend on earlier ones
(Neon/Vercel/Sentry projects existing) being done first.
