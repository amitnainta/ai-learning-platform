# Runbook: Backup and Restore (Neon Postgres)

Satisfies NFR-AVAIL-002 (automated recurring backups with a tested restore
procedure). See `docs/architecture/disaster-recovery.md` for the broader DR
process and RTO/RPO targets, and `docs/architecture/infrastructure.md` §2 for
why Neon was chosen.

## Backup schedule (automated, provider-managed)

Neon's managed Postgres provides two complementary backup mechanisms; neither
requires any code or cron job in this repository:

1. **Point-in-time recovery (PITR)** — Neon continuously retains a history of
   writes (WAL) for a configurable retention window. Within that window, the
   project can be restored to _any_ point in time, not just a daily snapshot
   boundary. This is the primary recovery mechanism for "we need last Tuesday
   at 14:03" style requests.
2. **Scheduled/automated backups** — Neon branches and its restore tooling are
   built on top of the same PITR history, so "daily backups" in practice means
   "the full PITR window, continuously," rather than a single nightly dump.

**Retention window**: set to the longest window available on the Neon plan in
use (verify in the Neon dashboard under the project's Settings → Backup/
Restore or Branches). Retention directly bounds the RPO in
`docs/architecture/disaster-recovery.md` — if the plan's retention window is
shorter than the stated RPO, the RPO target must be revised down (or the plan
upgraded), and this is one of the explicit manual provisioning checklist items
(`docs/runbooks/provisioning-checklist.md`) the human must verify.

## Restore procedure

Neon supports two restore mechanisms; use whichever fits the situation.

### Option A — Instant restore (same project, roll back in place)

Use when: bad data was written (e.g., a bad migration, an accidental bulk
delete) and the goal is to roll the _existing_ database back to a prior point
in time.

1. In the Neon console, open the project → **Branches** (or **Backup/Restore**,
   depending on console version).
2. Choose **Restore** on the branch backing the production database.
3. Select a target timestamp within the retention window (as close as possible
   to just before the incident).
4. Confirm the restore. Neon performs this as a branch operation — it does not
   require a full logical dump/reload, so it is fast (typically seconds to a
   few minutes, not hours).
5. Verify application behavior against the restored data (see "Verification"
   below) before considering the incident closed.

### Option B — Point-in-time branch restore (safer, non-destructive)

Use when: you want to inspect/verify the pre-incident state _before_
committing to overwriting production, or you need to recover specific rows
without rolling back everything else.

1. In the Neon console, create a **new branch** from the production branch, set
   to a specific timestamp before the incident (Neon branches support
   "branch from a point in time").
2. Point a temporary `DATABASE_URL`/`DIRECT_URL` (e.g., in a local `.env.local`
   or a scratch Vercel preview environment) at the new branch's connection
   strings.
3. Inspect the data with `npx prisma studio` or direct `psql` queries; extract
   or verify whatever is needed.
4. Either:
   - Selectively copy the needed rows back into production (`INSERT ... SELECT`
     across the two connections, or an export/import), or
   - Promote the branch to replace production if a full rollback is warranted
     (equivalent to Option A but reviewed first).
5. Delete the temporary branch once done, to avoid leaving stale
   credentials/data around.

### Verification (after either option)

1. `GET /api/health` returns `200 { "status": "ok" }`.
2. `npx prisma studio` (or a quick `psql` query) against the restored database
   confirms the expected row counts / most-recent-record timestamps for the
   core tables that exist at the time.
3. Smoke-test the app's primary read paths manually (once product data models
   exist, this expands to the core journeys named in NFR-MAINT-004: placement,
   course completion, etc. — at scaffold stage there is no product data to
   verify beyond the stub `HealthCheck` model).
4. Record the incident, the restore point chosen, and the verification result
   in this repo's incident notes (or wherever the team tracks operational
   incidents once that exists).

## Restore drill record

NFR-AVAIL-002 requires the restore procedure to be _tested_, not just written
down. This restore drill is a manual, one-time step tracked in
`docs/runbooks/provisioning-checklist.md` and must be performed once a Neon
project actually exists (it cannot be exercised before provisioning). Record
the result here once done:

| Date                                                                                                            | Performed by | Method (A/B) | Result | Notes |
| --------------------------------------------------------------------------------------------------------------- | ------------ | ------------ | ------ | ----- |
| _pending — to be filled in after Neon provisioning and the first restore drill (see provisioning-checklist.md)_ |              |              |        |       |

Do not mark NFR-AVAIL-002 as fully satisfied until this table has a real,
dated entry recording a successful restore.
