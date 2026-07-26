# Provisioning Checklist (manual, one-time, human-only)

These are account/credential/monitor provisioning actions that a builder agent
cannot and must not perform (no fabricated credentials, no account creation on
the human's behalf). None of these are assumed complete by the code in this
repo — every environment variable they produce degrades gracefully to a
documented no-op or fails fast with a clear error when absent (see
`src/lib/env.ts`, `sentry.*.config.ts`).

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

## Why these stay manual

Each of these requires either a real external account, a real payment/free-tier
signup, or a credential that only the account owner should hold. Fabricating
placeholder values for any of these (beyond the documented placeholders already
in `.env.example`) would create a false impression that the environment is
provisioned when it is not, and could leak into a commit. If you are picking up
this checklist as the human operator: work top-to-bottom, since several later
items (alerts, the restore drill, the HTTPS check) depend on earlier ones
(Neon/Vercel/Sentry projects existing) being done first.
