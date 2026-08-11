# Ratings Decision Record

Status: accepted for R1. Owner: solo maintainer. Complements
`docs/architecture/auth.md` (the `User` model and `requireUser()` this item
builds on), `docs/architecture/content.md` (the `Course`/`Path` ids this
item's `Rating` table references — see that document's section 6, "Progress
and rating attachment points", for the commitment this item honours), and
`docs/architecture/progress.md` (the `Progress` table and
`computePathProgress()` this item's eligibility gate reads directly, and
Risks #5 there, which promised the gate would need no new column). Covers
decisions #1-#9 from `factory/work/ratings-and-feedback/PLAN.md` — see that
plan for the full task list, acceptance criteria, and test plan.

## Accepted context

`FR-RATE-001/002/003/004/005/006/008` all hang off two new tables — `Rating`
(one per user per course, one per user per path) and `RatingFlag` (one per
user per rating) — plus a `RatingFlagReason` enum. No `Certificate`,
`Bookmark`, `Streak`, or search-index model is created; this item only adds
what ratings and flags themselves need, plus a small moderation CLI.

## 1. One `Rating` table with two nullable target foreign keys, not two tables

`Rating` carries `courseId String?` and `pathId String?`, exactly one
non-null, enforced by a hand-written database `CHECK` constraint (below —
Prisma does not model CHECK constraints, so it is invisible in
`schema.prisma` and must be carried forward by hand if migrations are ever
squashed). `@@unique([userId, courseId])` and `@@unique([userId, pathId])`
give "one rating per user per course" and "one per user per path"
simultaneously — Postgres treats NULLs as distinct in a unique index, so a
user's many path ratings never collide with their course ratings.

Why one table rather than `CourseRating`/`PathRating`: the two
cross-cutting consumers this item is built for — FR-ADMIN-005's moderation
queue and FR-RATE-007's "average rating dropped below a threshold" query —
both span target types. Two tables would make both a `UNION` and make
`RatingFlag` polymorphic instead. Rejected: `targetType` enum + `targetId`
with no foreign key — discards referential integrity and the cascade
behaviour every other table in this schema relies on. Rejected: a redundant
`targetType` column alongside the two FKs — derivable from which column is
non-null, so it would be a second source of truth that can disagree with
the first.

`learning-paths-content` decision #1 chose Zod over a database check
constraint for a different XOR (the `ORIGINAL`/`CURATED` discriminated
union, validated at import time by one code path). This is different: the
XOR here is on a table written by a **user-facing endpoint**, and a
violation would silently double-count a row in one aggregate and drop it
from another — a database CHECK buys a guarantee no application bug can
void.

## 2. "Completed a path" means `computePathProgress(...).percent === 100`; a course needs only "started"

Two fixed, named policies in one module (`src/lib/ratings/eligibility.ts`),
called by both the page and the API route so the UI and the write endpoint
can never disagree:

| Target | Policy                             | Concretely                                                                                                             |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Course | `COURSE_RATING_POLICY = "STARTED"` | at least one `Progress` row exists for the user against a currently-published item in the course                       |
| Path   | `PATH_RATING_POLICY = "COMPLETED"` | `computePathProgress(courses, progressMap).percent === 100` — every currently-published item in the path is `COMPLETE` |

The asymmetry is the requirements' own: FR-RATE-001/002 say "an individual
course" with no qualifier; FR-RATE-003/004 both say "a **completed** path".
It is also the right product answer — requiring completion to rate a course
would suppress "I bailed on this course, here is why", the single most
useful piece of feedback a platform can get, while a path rating is a
judgement about a whole curriculum nobody can make halfway through.

`computePathProgress` (`src/lib/progress/percent.ts`) is reused verbatim,
inheriting three properties for free: the denominator is only currently
published items (a retired item cannot block eligibility — the "live
denominator" property), items shared between two courses of one path are
counted once, and 100 means 100. **Eligibility is evaluated at write time
only** (Risks #6): a learner who rated a path at 100% keeps the rating if
the path later gains an item and their percentage drops. The alternative —
invalidating ratings on content change — would delete honest feedback
because a curator added a link.

Rejected: an env var or database setting making the policy configurable at
runtime — "configurably" in FR-RATE-008 is a product decision, not a knob
nothing would ever turn (there is no admin UI to turn it from). Rejected:
gating both on "started" (contradicts FR-RATE-003/004's "completed").
Rejected: gating both on "completed" (would silence anyone who bailed on a
course).

## 3. A rating is editable and removable by its author; there is no soft delete

One row per (user, target) means submitting again **replaces** the stars and
feedback via an upsert on the target-specific compound unique
(`userId_courseId` / `userId_pathId`) and bumps `updatedAt`.
`DELETE /api/ratings` removes the row entirely, scoped by `userId`, and the
aggregate drops accordingly.

Rationale: an opinion formed halfway through a path legitimately changes by
the end of it; FR-ACC-007/NFR-COMP-004 already promise access to and
deletion of personal data, and a rating published under a display name is
unambiguously the author's. Rejected: immutable ratings — the usual
anti-manipulation argument doesn't apply to a free educational platform with
no ranking and a one-rating-per-user constraint. Rejected: soft delete (a
`deletedAt` tombstone) — adds a condition to every aggregate/list/eligibility
query forever for an audit trail nobody reads.

Deleting a rating cascades away its `RatingFlag` rows (correct — the thing
being moderated is gone). Editing a rating does **not** clear its flags: the
flag survives with its own `createdAt`, and the moderation CLI prints the
rating's `updatedAt` alongside it so a maintainer can see the text changed
after the report.

## 4. Free-text feedback is publicly visible, attributed by display name plus role and level

FR-RATE-006 only makes sense if users can see each other's comments —
nobody flags a comment they cannot read. So feedback renders publicly on
the course page and the path page, to signed-in and anonymous visitors
alike (FR-ACC-008). Each entry shows the author's **display name** (never
email), **role archetype and level**, the star value, the date, and the
text — role/level are shown because FR-RATE-004 defines path feedback as
being about "fit for role/level", and a review saying "too shallow" means
something different from a Zero-Knowledge Executive than from an Advanced
Technical Builder. The submission form states, above the submit button,
that name/role/level will be shown publicly.

The star **value** is separable from the text: a rating with no feedback
counts in the aggregate but doesn't appear in the list. The list renders
the 20 most recent entries with feedback, with a "showing 20 of N" line.

Rejected: private feedback visible only to curators — makes FR-RATE-006
meaningless. Rejected: anonymous/pseudonymous display — removes the
role/level context FR-RATE-004 is built on.

**Flagged for the human (Risks #1, confirmed before build):** this publishes
a display name, role, and level next to a user's words. NFR-COMP-002's
privacy policy/terms must eventually say so; the privacy-policy copy is not
this item's to write, but this item creates the obligation.

## 5. Flagging is a separate `RatingFlag` table that records rather than censors, plus a CLI

`RatingFlag` — `ratingId`, `userId`, `reason RatingFlagReason`, `note
String?`, `resolvedAt DateTime?`, `createdAt` — with
`@@unique([ratingId, userId])`. A table rather than `flaggedAt`/`flagReason`
columns on `Rating`: columns can only hold **one** flag, and three users
reporting the same comment is the strongest signal a moderation queue has.
`reason` is a queryable enum — `INAPPROPRIATE`, `SPAM`,
`OUTDATED_OR_INCORRECT`, `OTHER` — where `OUTDATED_OR_INCORRECT` is named
after **FR-RATE-007's own wording** so that future R2 item has an axis to
query on day one.

**A flag does not hide anything.** No auto-hide at N reports — with no
moderator on duty and no appeals path, an auto-hide is a censor button
handed to whoever clicks fastest. The rating stays visible; the report is
recorded. The honest problem this leaves — with no moderation UI, who acts —
is answered by `scripts/moderation.ts` (`npm run moderation:queue` for
`list`; `hide <ratingId> --reason "..."`, `unhide <ratingId>`, `dismiss
<ratingId>` invoked directly), following the `scripts/import-content.ts`
precedent: a `tsx` script, deliberately not an API route, because an
authenticated moderation endpoint would be a mini admin UI that
NFR-SEC-006's RBAC does not yet exist to protect. `hide` sets
`Rating.hiddenAt`/`hiddenReason` and resolves that rating's unresolved
flags in the same call; a hidden rating is excluded from the public list
**and the aggregate**, still appears in its author's own export, and the
form shows the author a plain note ("Your feedback is not currently shown
publicly").

Rejected: shipping `RatingFlag` with no way to act on it — the
"fire-and-forget action" the request explicitly asked to avoid. Rejected:
auto-hide at a fixed flag count — revisit when there is a moderator and an
appeals path (FR-ADMIN-005's UI).

## 6. Aggregate average and count are computed at read time — re-examined, not just inherited

`learning-paths-content` (duration) and `progress-tracking` decision #5
(percentages) set the read-time precedent; this item re-derives it rather
than copying it, because the cost profile is genuinely different — an
average is computed over _every_ rating a course has ever received, not one
learner's ~50 rows.

**The read**: one `prisma.rating.groupBy({ by: ["courseId"], where: {
courseId: { in: [...] }, hiddenAt: null }, _avg: { stars: true }, _count: {
_all: true } })` per page — one query for every course on a path page, one
for the path itself; never one query per course
(`src/lib/ratings/queries.ts`). Backed by `@@index([courseId])`/
`@@index([pathId])`, this is an index range scan plus an aggregate over the
matching rows — single-digit-to-low-tens of milliseconds even at the
NFR-SCALE-002 target's pathological case, and the realistic case is
smaller because only _started_ users can rate.

**The write side is what actually settles it.** A denormalized
`ratingSum`/`ratingCount` on `Course`/`Path` has four independent drift
sources here (create, edit, delete, hide), and the worst is invisible:
**account deletion**. `prisma.user.delete` removes a user's ratings through
a database-level cascade with **no application code involved**
(`progress-tracking` decision #9, its shipped AC9, and the e2e teardown all
depend on this). A denormalized counter would silently drift on every
account deletion unless that cascade were replaced by an application-level
recompute — i.e. denormalizing ratings would require _weakening an
already-shipped, already-tested guarantee_. That is decisive.

What is genuinely different from the progress case, recorded honestly: if
any aggregate ever earns denormalization or caching, this is the first
place it will, because unlike a per-user percentage these numbers are
identical for every visitor and change rarely — precisely
NFR-SCALE-004's "frequently accessed, slow-changing data", whose example
list literally says "aggregate ratings". The first move if it ever gets
slow is **caching** (a `use cache`/tag-based entry invalidated on rating
write), not a denormalized column, because a stale cache self-heals and a
drifted counter does not. That work belongs to the item that owns
NFR-SCALE-004's caching strategy (the FR-SEARCH item), unchanged.

Pure formatting (rounding to one decimal, "Not yet rated", pluralization)
lives in `src/lib/ratings/aggregate.ts` with no Prisma import,
unit-testable without a database — the same split as `percent.ts`.

**Escalation trigger (Risks #5):** if a course-page or path-page p95 ever
exceeds the NFR-PERF-001 two-second budget with the aggregate `groupBy`
visible in the trace, the order of moves is (i) add the covering/partial
index recorded as omitted below, (ii) cache the aggregate per target with
invalidation on rating write, (iii) only then consider a stored counter,
with an explicit plan for the account-deletion cascade. Written down so the
next person doesn't start at (iii).

## 7. NFR-SEC-007: normalize on the way in, escape on the way out, never render as Markdown

Free-text feedback is the first genuinely open-ended user-generated field in
the app; both prior content items deferred this requirement here on
purpose.

**On the way in** (`src/lib/validation/rating.ts`, following `account.ts`'s
conventions):

- `.trim()`, then a hard length cap — **2,000 characters** for feedback,
  **500** for a flag note — enforced _after_ normalization so padding
  tricks can't smuggle length past it.
- **Control characters are stripped, but newlines are preserved.** This is
  the one place `account.ts`'s existing `stripControlCharacters` couldn't be
  reused as-is: it filters every code point <= 31, including newline (10)
  and carriage return (13) — correct for a display name, wrong for
  multi-paragraph feedback. The helper moved to `src/lib/validation/text.ts`
  with an `allowNewlines` option (default `false`, so `nameSchema`'s
  behaviour is bit-for-bit unchanged), plus `normalizeMultilineText()` —
  CRLF/CR normalization and a collapse of three-or-more consecutive
  newlines to two.
- Empty-after-normalization feedback is stored as `null`, not `""`, so
  "rated without commenting" is one state.
- `stars` is `z.number().int().min(1).max(5)` — enforced at the schema, the
  API, and (decision #1) the database layer.

**On the way out**: feedback renders as **plain text in JSX**, interpolated
inside an element with `whitespace-pre-line` (`<RatingList>`), so React's
default escaping handles every hostile character and the preserved
newlines still produce paragraphs. It is never passed through
`dangerouslySetInnerHTML` (nothing in this codebase ever has), and — the
non-obvious call — never through `<Markdown>` either. `react-markdown` is
_safe_ (`learning-paths-content` decision #3 — it builds an element tree
and leaves raw HTML inert), so this isn't an XSS argument; it's a spam and
product argument. Markdown would let any user publish clickable links and
images inside a course page, a link-spam vector nobody asked for.
Author-controlled lesson bodies get Markdown; user-submitted text gets
plain text.

Verified by a unit test on the schema (a script payload parses through
unchanged as literal text — escaping is a render-time concern), a
component test asserting a script payload and an `<img onerror>` payload
render as literal text with no matching element created
(`rating-list.test.tsx`), and an e2e assertion on a real page render with a
`page.on("dialog")` guard that fails the test if the payload ever executes
(`rating-course.spec.ts`).

## 8. No new rate limiter for the rating endpoints

`progress-tracking` decision #8 declined a limiter for `POST /api/progress`
because the write is self-scoped, idempotent, and bounded above by one row
per (user, published item). The same reasoning applies more strongly here,
because three independent constraints bound the surface: `requireUser()`,
the unique constraints (repeated submissions overwrite rather than
accumulate), and the FR-RATE-008 eligibility gate (a drive-by account
cannot write anything until it has actually engaged with the content). Row
growth is bounded by users x (courses + paths).

What is genuinely new is _free text stored and publicly rendered_, so abuse
looks like content, not volume — that's what decision #5's flag record and
CLI address. Recorded as Risks #3, with the trigger to revisit being a real
spam incident or any unauthenticated write path appearing.

## 9. Ratings are personal data: exported and cascaded, like progress

`Rating.userId` and `RatingFlag.userId` are both `onDelete: Cascade`, so
the existing account-deletion route removes them with no new code and the
e2e teardown keeps working unchanged. `GET /api/account/export` gains a
`ratings` array (target type, target slug and title, stars, feedback,
hidden state, timestamps) and a `ratingFlags` array (which ratings you
reported, the reason and note, when, resolved state) — slugs and titles,
never cuids, except the rating id inside `ratingFlags` (the only identifier
a flagged rating has, and already exposed to the client by the flag
control — Risks #8, a deliberate departure from the slug-only addressing
`progress-tracking` decision #3 established).

Consequence recorded rather than discovered: a _reporter_ deleting their
account also deletes their flags, so a report can vanish while the reported
rating survives. The alternative (`userId String?` + `onDelete: SetNull`)
is better for moderation durability and worse for schema consistency —
every other user-owned row in this schema cascades — and the loss is small,
because the surviving rating can be re-flagged by anyone.

## Prisma schema

```prisma
enum RatingFlagReason {
  INAPPROPRIATE
  SPAM
  OUTDATED_OR_INCORRECT
  OTHER
}

model Rating {
  id       String  @id @default(cuid())
  userId   String
  courseId String?
  pathId   String?

  stars    Int
  feedback String?

  hiddenAt     DateTime?
  hiddenReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course? @relation(fields: [courseId], references: [id], onDelete: Cascade)
  path   Path?   @relation(fields: [pathId], references: [id], onDelete: Cascade)

  flags RatingFlag[]

  @@unique([userId, courseId])
  @@unique([userId, pathId])
  @@index([courseId])
  @@index([pathId])
  @@map("rating")
}

model RatingFlag {
  id       String           @id @default(cuid())
  ratingId String
  userId   String
  reason   RatingFlagReason
  note     String?
  resolvedAt DateTime?

  createdAt DateTime @default(now())

  rating Rating @relation(fields: [ratingId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([ratingId, userId])
  @@index([ratingId])
  @@index([resolvedAt])
  @@map("rating_flag")
}
```

**Two hand-written `CHECK` constraints, invisible in the file above, appended
by hand to `prisma/migrations/20260808180524_add_ratings_and_feedback/migration.sql`**
(decision #1, Risks #7 — recorded here as the third of three places this is
stated, alongside the schema header comment and the migration file itself):

```sql
ALTER TABLE "rating" ADD CONSTRAINT "rating_exactly_one_target"
  CHECK (("courseId" IS NOT NULL) <> ("pathId" IS NOT NULL));
ALTER TABLE "rating" ADD CONSTRAINT "rating_stars_range"
  CHECK ("stars" BETWEEN 1 AND 5);
```

Verified end to end during the build: applied to a disposable database via
`prisma migrate deploy` (the full migration history, including this
hand-edited file, applies cleanly with no error), then confirmed both
constraints actually reject a bad row via direct `INSERT` attempts (a
both-null-target row and a `stars = 6` row each failed with the expected
Postgres `check_violation` error) before the constraints were also applied
to the shared local dev database (which had already run the pre-edit
migration once via `prisma migrate dev`).

Index rationale, sized for `NFR-SCALE-002`'s 100,000 users / 5,000 items:

- `@@unique([userId, courseId])` / `@@unique([userId, pathId])` — the
  natural keys, the one-per-user guarantee, and the index that makes the
  upsert a single indexed statement. Their leftmost `userId` prefix also
  serves "all of this user's ratings" (the export and the form prefill), so
  **no separate `@@index([userId])` is added** — recorded so a future
  reader knows that was a choice.
- `@@index([courseId])` / `@@index([pathId])` — the indexes the aggregate
  `groupBy` and the feedback list actually run on, and the ones Postgres
  needs on the referencing side of a foreign key (it does not create them
  automatically).
- `@@index([ratingId])` on `RatingFlag` — the flag-count/queue join, and
  the same FK-referencing-side argument.
- `@@index([resolvedAt])` — the moderation queue's only filter
  (`resolvedAt: null`).
- **Considered and deliberately omitted: a covering `@@index([courseId,
stars])` and a partial index on `hiddenAt IS NULL`.** Either would let the
  aggregate run index-only, but a partial index isn't expressible in
  `schema.prisma`, and neither is justified before an `EXPLAIN` says so at a
  row count this project doesn't have — the first thing to try if decision
  #6's escalation trigger ever fires, before any denormalization.

## Verification of the shipped items' attachment-point commitments

`learning-paths-content` decision #6 and `docs/architecture/content.md`
section 6 commit that "ratings key on `Course.id`/`Path.id`" and that those
ids are stable across re-imports; `progress-tracking` Risks #5 commits that
"FR-RATE-008's gate is the existence of a `Progress` row / `status =
COMPLETE`, needing no new column". Both checked against the real code, not
taken on trust, during the build:

1. `src/lib/content/import.ts` only ever calls `course.create`/`.update`/a
   retire-`update`, never `.delete` — the module's own header comment
   states it, and `plan-import.ts` emits only
   `create | update | unchanged | retire | unretire`. **The claim holds.**
2. What _does_ rotate is `PathCourse.id`/`CourseItem.id` (rewritten
   wholesale on every content edit) — the same finding `progress-tracking`
   recorded, and the reason `Rating` never keys on a join row.
3. `Progress` already carries exactly what both eligibility policies need:
   row existence = started, `status = COMPLETE` = completed, and
   `computePathProgress()` already de-duplicates shared items and refuses to
   round up to 100. This item calls those and adds nothing to `Progress`.
4. `User` gains `ratings Rating[]`/`ratingFlags RatingFlag[]`; `Course` and
   `Path` each gain `ratings Rating[]`. All virtual — no DDL against those
   tables.

**The same caveat that carried over from `progress-tracking` carries over
again:** renaming a published course or path slug retires the old row and
creates a new one with a new cuid, stranding its ratings the same way it
strands progress. `docs/content/authoring-guide.md`'s "never rename a
published slug" rule now mentions ratings explicitly.

## What FR-RATE-007 and FR-ADMIN-005 inherit

Recorded here so those future R2 items don't have to re-derive it:

- **FR-RATE-007** (auto-surfacing low-rated/flagged content) gets the
  aggregate `groupBy` query (average per course/path) and
  `RatingFlag.reason`, whose `OUTDATED_OR_INCORRECT` value is its own
  "flagged as outdated/incorrect" wording made queryable. It still needs a
  threshold, a job, and queue-population logic — none of that exists here.
- **FR-ADMIN-005** (the curator-facing review queue) gets the whole queue
  as durable, queryable data (`RatingFlag` + `resolvedAt`) and a working
  CLI (`hide`/`unhide`/`dismiss`) that already implements the actions a
  future screen would call. It still needs a UI and RBAC (NFR-SEC-006) —
  the CLI is an explicit stopgap, not the requirement.
- **FR-ADMIN-006** (ratings analytics) gets `@@index([courseId])`/
  `@@index([pathId])` for free.
- **FR-CERT** is untouched — nothing here reads or writes
  `Progress.completedAt` beyond the eligibility read.

## FR/NFR mapping summary

| Requirement                   | How this item satisfies it                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `FR-RATE-001` / `002`         | `<RatingForm>` on the course page, gated by `getCourseRatingEligibility` (§2)                                                        |
| `FR-RATE-003` / `004`         | `<RatingForm>` on the path page, gated by `getPathRatingEligibility`, role/level-fit prompt (§2, §4)                                 |
| `FR-RATE-005`                 | `getCourseRatingAggregates`/`getPathRatingAggregates`, one `groupBy` per page (§6)                                                   |
| `FR-RATE-006`                 | `RatingFlag` table + `scripts/moderation.ts` (§5)                                                                                    |
| `FR-RATE-008`                 | `src/lib/ratings/eligibility.ts`, shared by the page and the API route (§2)                                                          |
| `NFR-SEC-004`                 | `requireUser()` on every write; targets resolved by slug against published content; author/session scoping on edit, delete, and flag |
| `NFR-SEC-007`                 | `src/lib/validation/text.ts` + `rating.ts`; plain-text render (§7)                                                                   |
| `NFR-PERF-004`                | One eligibility read plus one indexed upsert                                                                                         |
| `NFR-SCALE-002`               | Index set above; feedback list capped at 20                                                                                          |
| `NFR-SCALE-004`               | Read-time aggregate now; caching named as the first move if it's ever needed (§6)                                                    |
| `NFR-A11Y-002` / `-004`       | `<StarRatingInput>` is a native radio `<fieldset>`; live regions on the form and flag control                                        |
| `NFR-COMP-004` / `FR-ACC-007` | `ratings`/`ratingFlags` in the account export; cascade on deletion (§9)                                                              |
| `FR-ACC-008`                  | Anonymous visitors read ratings/aggregates; no write endpoint accepts them                                                           |
| `FR-ADMIN-005`                | Partial — durable record + CLI; admin UI stays with FR-ADMIN-002                                                                     |
| `NFR-MAINT-004`               | `e2e/rating-course.spec.ts`, `rating-path.spec.ts`, `rating-flag.spec.ts`, extended `account-data.spec.ts`                           |
