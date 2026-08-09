# Runbook: Rating and Feedback Moderation

Satisfies the actionable half of FR-RATE-006 (flagging) and gives
FR-ADMIN-005 a working queue while its admin UI (R2, tied to
FR-ADMIN-002) doesn't exist yet. See `docs/architecture/ratings.md`
decision #5 for the full rationale — this runbook is the "what to actually
do" companion to that decision record.

## How a flag reaches the maintainer

Any signed-in user can report someone else's rating/feedback from the
public feedback list (`<FlagRatingButton>`), choosing a reason
(`INAPPROPRIATE`, `SPAM`, `OUTDATED_OR_INCORRECT`, `OTHER`) and an optional
note. This writes a `RatingFlag` row — durable and queryable — and **does
not** hide the rating. There is no automatic escalation, no email, and no
dashboard badge: a maintainer has to run the queue command to see it.

## The queue

```bash
npm run moderation:queue
```

Lists every rating with at least one unresolved flag, most-recently-flagged
first, grouped by rating (so three reports on the same rating show once,
with a flag count):

```
1 rating(s) with unresolved flags:

Rating cxyz... — course "AI Foundations for Builders" (ai-foundations-for-builders)
  stars: 2  hidden: no
  createdAt: 2026-08-01T12:00:00.000Z  updatedAt: 2026-08-01T12:00:00.000Z
  flags: 2  reasons: SPAM, OTHER
    note: This looks like a copy-pasted ad.
  feedback: Check out my course at definitely-not-spam.example...
```

Each entry has everything needed to decide: the flag count and reasons, any
notes, the target course/path, the rating's own text and `updatedAt` (so
you can tell if the text changed _after_ it was reported), and the rating
id you need for the next step.

## Acting on a flag

```bash
# Hide the rating — removes it from the public list and the aggregate,
# resolves every unresolved flag on it, and leaves a note for the record.
npx tsx scripts/moderation.ts hide <ratingId> --reason "Spam / unrelated link"

# Reverse a hide — the rating reappears in the public list and the aggregate.
npx tsx scripts/moderation.ts unhide <ratingId>

# Reviewed, no action needed — resolves the flags without hiding the rating.
npx tsx scripts/moderation.ts dismiss <ratingId>
```

Each command prints a one-line confirmation and exits non-zero (with a
clear message) on an unknown rating id or a missing required argument, so
it's safe to script or double-check in a shell history.

## What `hide` does and does not do

- **Does**: sets `Rating.hiddenAt`/`hiddenReason`; excludes the rating from
  `<RatingList>` (the public feedback list) and from the average/count
  shown on the course or path page (both filter `hiddenAt: null`); resolves
  every unresolved `RatingFlag` on that rating.
- **Does not**: delete the row. The star value and text are preserved. The
  author still sees their own rating in `GET /api/account/export` (with
  `hidden: true`), and the rating form shows them a plain note — "Your
  feedback is not currently shown publicly" — rather than pretending
  nothing happened.
- **Does not**: auto-hide based on flag count, ever. A single hide is
  always a deliberate maintainer action.

## The deliberate absence of auto-hide

No rating is ever hidden automatically, no matter how many flags it
accumulates. With no moderator on duty around the clock and no appeals
path, an auto-hide threshold is a censor button handed to whoever clicks
fastest, and a single bad-faith flag (or a small coordinated group) could
remove legitimate criticism of a course. The trade-off: a genuinely
abusive rating can sit visible until the maintainer next runs the queue.
Revisit this if the platform ever gains a moderator role and an appeals
process (FR-ADMIN-005's future UI) — at that point auto-hide-pending-review
becomes a defensible middle ground it isn't today.

## Escalation path when FR-ADMIN-005's UI lands

This CLI is an explicit stopgap, not the requirement. Everything it reads
and writes — the `RatingFlag` table, `resolvedAt`, `Rating.hiddenAt`/
`hiddenReason` — is exactly what a future review-queue screen needs; that
work only has to build a UI and wire it behind NFR-SEC-006's RBAC (not yet
implemented) once an admin role exists. Until then, this runbook **is** the
moderation process: check the queue periodically (there is no reminder
mechanism — treat it like the review-cadence check in
`docs/content/authoring-guide.md`), and act on what's there.
