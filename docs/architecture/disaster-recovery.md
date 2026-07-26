# Disaster Recovery

Satisfies NFR-AVAIL-003 (a documented DR process with explicit RTO/RPO
targets). Complements `docs/runbooks/backup-and-restore.md` (the step-by-step
restore mechanics) and `docs/architecture/infrastructure.md` (why each provider
was chosen).

## Targets

| Metric                             | Target                                                                                | Rationale                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RPO** (Recovery Point Objective) | **≤ 5 minutes** of data loss for the database                                         | Neon's PITR is continuous (WAL-based, not snapshot-interval-based), so the achievable RPO is bounded by replication/WAL-flush lag rather than a fixed backup interval — a few minutes is realistic. |
| **RTO** (Recovery Time Objective)  | **≤ 4 hours** for a full-service outage; **≤ 30 minutes** for a database-only restore | Directional target consistent with the 99.5% monthly uptime budget (~3.6 hours/month) in NFR-AVAIL-001 — a single incident should not, by itself, consume the whole monthly error budget.           |

These are directional targets for a solo-maintained beta, not contractual SLAs.
They should be revisited (tightened) post-MVP as traffic and stakes grow, per
the requirements doc's own framing of NFR-AVAIL targets as "reviewed for
tightening post-MVP."

**Constraint**: the RPO target is only as good as Neon's actual configured
retention/PITR window (see `docs/runbooks/backup-and-restore.md`). Verifying
that the provisioned Neon plan's retention window supports this RPO is an
explicit manual checklist item in `docs/runbooks/provisioning-checklist.md`.

## Failure scenarios and response

### 1. Database corruption or bad data (application-caused)

_Example_: a buggy migration or bulk-update script corrupts or deletes data.\_

- **Detection**: Sentry error spike, manual user report, or a scheduled data
  sanity check (future work).
- **Response**: follow `docs/runbooks/backup-and-restore.md` Option A or B to
  restore to a point-in-time immediately before the bad write.
- **Expected RTO**: minutes (Neon's PITR restore is fast; the dominant cost is
  detection + decision time, not the restore operation itself).

### 2. Neon regional/provider outage

_Example: Neon's region or the underlying cloud provider has an outage._

- **Detection**: `/api/health` starts failing (if health check includes DB
  connectivity — currently the health check is DB-independent by design, see
  the comment in `src/app/api/health/route.ts`; a separate DB-connectivity
  signal is a follow-up), external uptime monitor alert, or Neon's own status
  page.
- **Response**: this is outside the app's control to route around at R1 (no
  multi-region DB failover is provisioned — that is explicitly beyond a
  solo-maintainer beta's scope). Monitor Neon's status page and wait for
  provider recovery; if the outage is prolonged, Neon's branching/PITR data
  remains intact once the underlying region recovers (data durability is
  provider-guaranteed independent of a regional compute outage).
- **Expected RTO**: dependent on the provider's own outage duration; not fully
  within this project's control. This is a known, accepted limitation for R1 —
  revisit (e.g., cross-region read replica) if/when uptime requirements
  tighten beyond what a single-region managed Postgres can provide.

### 3. Vercel/hosting outage

_Example: Vercel's platform or the region serving this app has an outage._

- **Detection**: external uptime monitor alert (this is exactly why the
  monitor is external to Vercel — Vercel cannot be relied on to alert on its
  own outage).
- **Response**: same as scenario 2 — no multi-host failover is provisioned at
  R1 (deliberate low-ops tradeoff, see `docs/architecture/infrastructure.md`
  §1). Monitor Vercel's status page; the app resumes automatically once the
  platform recovers, since there is no persistent app-tier state to
  reconstruct (NFR-SCALE-001 statelessness means there is nothing to "recover"
  in the app tier itself beyond redeploying, which Vercel does automatically
  on the next push/rebuild if needed).
- **Expected RTO**: dependent on the provider's own outage duration.

### 4. Accidental/malicious data deletion by a compromised credential

_Example: a leaked API key or database credential is used to delete data._

- **Detection**: Sentry error spike from downstream failures, anomalous
  Neon/Vercel activity logs, or user reports.
- **Response**: rotate the compromised credential immediately (Vercel env
  vars + Neon connection strings, per
  `docs/runbooks/provisioning-checklist.md`), then restore per
  `docs/runbooks/backup-and-restore.md` to a point-in-time before the
  deletion.
- **Expected RTO**: ≤ 4 hours total (credential rotation + restore + verification), assuming the incident is detected promptly.

### 5. Full loss of the Vercel or GitHub account/access

_Example: account lockout, or the maintainer loses access._

- **Detection**: N/A (this is a business-continuity scenario, not a technical
  monitoring scenario).
- **Response**: out of scope for this document's technical DR process; this is
  a people/process risk (e.g., recovery contacts, credential escrow) that the
  human should track separately. Noted here only so it isn't silently assumed
  away.

## What is explicitly out of scope for R1 DR

- Multi-region database failover / active-active hosting — not justified at
  beta scale and traffic; would materially increase cost and operational
  complexity for a solo maintainer (see infrastructure.md's stated bias).
- Automated failover orchestration/runbook automation (e.g., a script that
  detects an outage and triggers a restore) — the process here is manual by
  design at this scale; revisit if on-call/automation becomes justified by
  real incident volume.

## Review cadence

Re-review this document's RTO/RPO targets and failure-scenario list whenever
scale, traffic, or provider choices materially change (e.g., adding a second
Vercel region, upgrading the Neon plan's retention window, or after any real
incident that this document did not anticipate).
