# PLAN — ratings-and-feedback

_Work item slug: ratings-and-feedback. Plan produced by factory-planner. Source: factory/work/ratings-and-feedback/REQUEST.md._

## Summary

This work item adds ratings and feedback — the fourth foundational feature, sitting on top of `user-accounts-auth` (the `User` model and `requireUser()`/`getCurrentUser()`), `learning-paths-content` (the `Course`/`Path` ids this attaches to), and `progress-tracking` (the `Progress` table and `computePathProgress()`, which this item's eligibility gate reads directly). It adds two new tables (`Rating`, keyed one-per-user-per-course and one-per-user-per-path; `RatingFlag`, one-per-user-per-rating), one enum, two API routes (`POST`/`DELETE /api/ratings` and `POST /api/ratings/flags`), an accessible star-rating control and free-text feedback form, a public feedback list, and aggregate average/count displays woven into the existing course and path pages. Aggregates are **computed at read time** by a single `groupBy` per page — the same read-time precedent `learning-paths-content` set for duration and `progress-tracking` set for percentages, re-justified here against this feature's genuinely different cost profile (decision #6). FR-RATE-008's gate is implemented as two fixed, code-level policies — a course can be rated once *started*, a path only once *completed* (100% by `computePathProgress`) — enforced server-side by one shared module that both the UI and the API call, so what the form shows and what the endpoint accepts can never disagree. This item is also where **NFR-SEC-007** is finally discharged: free-text feedback is the first genuinely open-ended user-generated content field in the app, and it gets a real, explicit sanitization/normalization/escaping design (decision #7), not an inherited assumption. Flagging is recorded in a durable, queryable `RatingFlag` table plus a small read/act CLI, so FR-ADMIN-005's future queue UI is a rendering job with no schema rework. No certificate, search, or admin-UI surface is created.

## Requirement IDs satisfied

Primary:

- **FR-RATE-001** (Must, R1) — a signed-in, eligible user can rate a course 1-5 stars from the course page and from the path page's course sections.
- **FR-RATE-002** (Must, R1) — the same form carries an optional free-text feedback field for a course.
- **FR-RATE-003** (Must, R1) — a signed-in user who has **completed** a path (100% per `computePathProgress`, decision #2) can rate it 1-5 stars from the path page.
- **FR-RATE-004** (Must, R1) — the path feedback field is prompted specifically for fit-for-role/level ("Did this path fit your role and level?"), and each published feedback entry displays its author's role archetype and level so that framing is visible to the next reader.
- **FR-RATE-005** (Must, R1) — average rating (one decimal) and rating count render on every course page and every path page, and on each course card within a path page; "Not yet rated" renders when the count is zero.
- **FR-RATE-006** (Should, R1) — any signed-in user can flag someone else's rating/comment with a reason; the flag is a durable `RatingFlag` row (decision #5), surfaced to the maintainer by `npm run moderation:queue`.
- **FR-RATE-008** (Should, R1) — every rating write is rejected server-side (403) unless the user meets the target's eligibility policy; the UI renders the reason instead of the form when they don't.

Also satisfied or advanced by this item:

- **NFR-SEC-007** (Must, R1) — *this item's to discharge* (deferred here explicitly by both `learning-paths-content` and `user-accounts-auth`). Free-text is trimmed, length-capped, control-character-stripped (newlines preserved) and newline-normalized before storage, and rendered as plain escaped JSX text — never through `<Markdown>`, never via `dangerouslySetInnerHTML` (decision #7).
- **NFR-SEC-004** (Must, R1) — broken access control: the author of a rating is always the session user (`requireUser()`); the body never carries a userId; targets are addressed by slug and resolved against published content; eligibility is re-checked server-side on every write; a user can only edit or delete their own rating; flagging your own rating is rejected.
- **NFR-PERF-004** (Must, R1) — "rating submission" is named in this requirement's 500 ms p95 budget: the write is one eligibility read plus one indexed upsert.
- **NFR-SCALE-002** (Must, R1) — index set chosen for the 100k-user / 5k-item year-one target, with the aggregate `groupBy` as the query the indexes are actually sized for, and the feedback list bounded to 20 rows per render (decision #6, "Prisma schema design").
- **NFR-SCALE-004** (Should, R1) — this requirement names "aggregate ratings" explicitly as cacheable slow-changing data. This item does **not** build a cache; it records why read-time is right at R1 and states precisely what the first optimization is and who owns it (decision #6).
- **NFR-A11Y-002 / -004** (Must, R1) — the star control is a native radio group in a `<fieldset>` with a `<legend>` (arrow-key operable, focus-visible, announced), the numeric value is always present as text so nothing depends on colour or glyph shape alone, the textarea is labelled with an associated live character counter, and every state change is announced in an `aria-live` region.
- **NFR-COMP-004 / FR-ACC-007** — ratings and flags are personal data: both go into `GET /api/account/export`, and both cascade on account deletion.
- **NFR-MAINT-004** — Playwright coverage for the "rating" journey the requirement names by name: rate a course, leave feedback, see the aggregate change, be refused by the FR-RATE-008 gate, rate a completed path, and flag a rating.
- **FR-ACC-008** (Should, R1) — the "cannot rate" half becomes real and testable: anonymous visitors read ratings and aggregates but get a sign-in prompt instead of a form, and no write endpoint accepts them.
- **FR-ADMIN-005** (Should, R1) — *partially*. The durable, queryable moderation record and a maintainer-operable queue exist (`RatingFlag` + `npm run moderation:queue` + `hide`/`unhide`/`dismiss`); the **admin UI** half stays with FR-ADMIN-002 (R2), per REQUEST.md. Recorded as partial, not claimed as done.

## Scope

### In scope

- One additive Prisma migration: `RatingFlagReason` enum, `Rating` model, `RatingFlag` model, plus virtual back-relations on `User`, `Course`, and `Path` (no DDL against those tables), plus two hand-written `CHECK` constraints (decision #1).
- `src/lib/validation/text.ts` — the shared, security-relevant text-normalization helper, extracted from `account.ts` (no behaviour change there) and extended with a newline-preserving mode.
- `src/lib/validation/rating.ts` — Zod schemas for rating submission, removal, and flagging.
- `src/lib/ratings/` — `aggregate.ts` (pure, database-free), `eligibility.ts` (the single FR-RATE-008 source of truth), `queries.ts` (read layer), `mutations.ts` (write layer).
- `POST /api/ratings` (create-or-update), `DELETE /api/ratings` (remove mine), `POST /api/ratings/flags`.
- Rating UI: `<StarRatingInput>`, `<StarRatingDisplay>`, `<RatingForm>`, `<RatingList>`, `<FlagRatingButton>`, `<RatingSection>`, plus a `<TextAreaField>` primitive alongside the existing `<FormField>`.
- Ratings woven into `/courses/[slug]` and `/paths/[role]/[level]`; `<CourseSummary>` gains an optional aggregate prop.
- `GET /api/account/export` extended with `ratings` and `ratingFlags`.
- `scripts/moderation.ts` + `npm run moderation:queue` — the minimum actionable moderation loop with no UI (decision #5).
- Unit/component tests (Vitest + RTL) and three Playwright specs (course rating + feedback + aggregate + XSS, path gate + completed-path rating, flagging), plus an extension to the existing account-data spec.
- Docs: `docs/architecture/ratings.md` decision record, `docs/runbooks/content-moderation.md`, README and cross-reference updates.

### Out of scope (explicitly)

- **FR-RATE-007** (auto-surfacing low-rated/flagged content into a curator review queue) — Should, **R2**. Named out of scope in REQUEST.md and correctly ordered behind R1 per CLAUDE.md's build-order rule. This item deliberately leaves it the two data axes it needs with no backfill: the aggregate query (average per course/path) and `RatingFlag.reason`, whose `OUTDATED_OR_INCORRECT` value is FR-RATE-007's "flagged as outdated/incorrect" wording made queryable. No threshold, no job, no queue-population logic here.
- **FR-ADMIN-005's admin UI** — the curator-facing review queue *screen*. Tied to FR-ADMIN-002 (R2). The CLI in this item is explicitly a stopgap, not the requirement.
- **FR-ADMIN-006** (ratings analytics view) — R2.
- **FR-SEARCH-\*** — the other remaining R1-Must item, tracked separately. Nothing here sorts or filters content by rating, and no aggregate badge is added to `/paths`, `/paths/[role]`, or any future search-result list (Risks #9).
- **FR-CERT-\*** — R2. Nothing here reads or writes `Progress.completedAt` beyond the eligibility read.
- **Rating replies, threads, votes, "was this helpful", or reviewer profiles** — no requirement asks for them.
- **Denormalized/cached aggregate columns, materialized views, or a cache layer** — decision #6, with the trigger that would change the answer recorded in Risks #5. NFR-SCALE-004's caching strategy remains owned by the FR-SEARCH item, where `learning-paths-content` Risks #4 and `progress-tracking` decision #5 both left it.
- **A dedicated rate limiter for the rating endpoints** — decision #8 explains the bounded blast radius.
- **Auto-hiding a rating on N flags** — decision #5 explains why a flag records rather than censors at R1.
- **Re-deciding the stack, auth, styling, content model, or progress model** — fixed by the four shipped items.

### Note on size

Mid-sized, comparable to `progress-tracking`, and one coherent unit: the table without the API stores nothing, the API without the gate violates FR-RATE-008, the gate without the UI is invisible, and FR-RATE-005's aggregate is the thing that makes any of it worth writing. If the builder needs a split point in flight, the clean seam is **(A)** tasks 1-12 (schema, migration, validation, lib modules, API, export) and **(B)** tasks 13-45 (UI, moderation CLI, tests, docs) — but prefer finishing both on one branch.

## Verification of the shipped items' attachment-point commitments

`learning-paths-content` decision #6 and `docs/architecture/content.md` section 6 commit in writing that "ratings key on `Course.id`/`Path.id`" and that those ids are stable across re-imports. `progress-tracking` Risks #5 commits that "FR-RATE-008's 'has started / has completed' gate is the existence of a `Progress` row / `status = COMPLETE`, needing no new column". Both checked against the real code, not taken on trust:

1. **`Course.id` and `Path.id` really are stable across imports.** `src/lib/content/import.ts` only ever calls `course.create` / `course.update` / an `update` flipping `status` to `RETIRED` (lines ~378-399) and `path.create` / `path.update` / retire-`update` (lines ~415-440); the module's own header comment states "Never deletes a `ContentItem`, `Course`, or `Path`", and `src/lib/content/plan-import.ts` emits only `create | update | unchanged | retire | unretire` — there is no `course.delete`/`path.delete` anywhere. **The claim holds**, so `Rating.courseId`/`Rating.pathId` are safe foreign keys and this migration is purely additive.
2. **What *does* rotate is `PathCourse.id`/`CourseItem.id`** (`rewriteCourseOrdering()`/`rewritePathOrdering()` `deleteMany` and recreate them on every content edit, lines ~464 and ~493). This is the same finding `progress-tracking` recorded, and it is the reason a rating must never key on a join row — a "rating for this course *within this path*" keyed on `PathCourse.id` would be orphaned by a routine ordering edit. Ratings key on `Course.id`/`Path.id` only.
3. **The FR-RATE-008 gate needs no new column.** `Progress` already carries exactly what both policies need: row existence = "started", `status = COMPLETE` = completed, and `computePathProgress()` (`src/lib/progress/percent.ts`) already de-duplicates shared items and returns 100 only when every currently-published item is complete. This item calls those, and adds nothing to `Progress`.
4. **No existing table needs a column.** `User` gains `ratings Rating[]` and `ratingFlags RatingFlag[]`; `Course` gains `ratings Rating[]`; `Path` gains `ratings Rating[]`; `Rating` gains `flags RatingFlag[]`. All virtual — the foreign-key columns live on the two new tables.

**One caveat that carries over, stated plainly:** the stable identity is the author-controlled **slug**. Renaming a published course or path slug retires the old row and creates a new one with a new cuid, which now strands its **ratings** as well as its progress. `docs/content/authoring-guide.md` already states "never rename a published slug" (progress-tracking task 37); task 45 extends that note to mention ratings, so the rule's stated consequence stays complete. No code change.

## Decisions made by this work item

Bias carried from the four shipped items: solo maintainer, free educational site, low-ops, no new external services, no denormalization without a demonstrated need.

### 1. One `Rating` table with two nullable target foreign keys, not two tables and not a polymorphic string id

`Rating` carries `courseId String?` and `pathId String?`, exactly one of which is non-null, enforced by a hand-written `CHECK` constraint in the migration (below), with `@@unique([userId, courseId])` and `@@unique([userId, pathId])` giving "one rating per user per course" and "one per user per path" simultaneously — Postgres treats NULLs as distinct in a unique index, so a user's many path ratings (all with `courseId IS NULL`) never collide, and vice versa. Prisma's generated compound-unique selectors (`userId_courseId`, `userId_pathId`) make the write a single `upsert` per target type with no read-then-write race.

Why one table: the two *cross-cutting* consumers this item is explicitly building for both span target types. FR-ADMIN-005's moderation queue is "flagged ratings/comments" regardless of what they rate, and FR-RATE-007's "content whose average rating drops below a threshold" is a query over courses *and* paths. With two tables both become a UNION in every future query, and `RatingFlag` would need either two nullable FKs of its own or its own polymorphism — pushing the exact problem down one level. One table also means one validation schema, one API route, one form component, and one aggregate function rather than two of each.

Rejected: **separate `CourseRating` and `PathRating` tables** — cleaner non-nullable columns and no CHECK constraint, at the cost of doubling every downstream query and component and making the moderation record polymorphic instead. Rejected: **`targetType` enum + `targetId String` with no foreign key** — the tidiest-looking polymorphism and the worst one here: it discards referential integrity and the cascade behaviour every other table in this schema relies on, and it would let a rating point at a nonexistent id forever. Rejected: **a redundant `targetType` column alongside the two FKs** — derivable from which column is non-null, so it is a second source of truth that can disagree with the first; the CHECK constraint plus a `ratingTargetOf(row)` helper expresses the same thing without a drift surface.

**Note on the CHECK constraint, which is a deliberate deviation.** `learning-paths-content` decision #1 chose Zod over a database check constraint for the `ORIGINAL`/`CURATED` XOR. That was the right call there (a multi-field discriminated union validated at import time, in one importer, by one code path). This is different: the XOR here is a two-column invariant on a table written by a *user-facing* endpoint, and a violation would not fail loudly — it would silently double-count a row in one aggregate and drop it from another. Two lines of SQL in the migration (exactly one target non-null; stars between 1 and 5) buy a guarantee no application bug can void. Prisma does not model CHECK constraints and will neither drop nor recreate them, so this is safe; it must be recorded in the schema header comment because it is invisible in `schema.prisma` (Risks #7).

### 2. "Completed a path" means `computePathProgress(...).percent === 100`; a course needs only "started" — two fixed policies, not a runtime setting

FR-RATE-008 says ratings are accepted only from users who have "started (or, configurably, completed)" the item. This item resolves the "configurably" as **two fixed, per-target-type policies expressed in code**, in one module (`src/lib/ratings/eligibility.ts`), called by both the page and the route:

| Target | Policy | Concretely |
| --- | --- | --- |
| Course (FR-RATE-001/002) | **STARTED** | at least one `Progress` row exists for the user against any currently-published item in that course |
| Path (FR-RATE-003/004) | **COMPLETED** | `computePathProgress(courses, progressMap).percent === 100` — every currently-published item in the path is `COMPLETE` for that user |

The asymmetry is the requirements' own: FR-RATE-001/002 say "an individual course" with no qualifier, while FR-RATE-003/004 both say "a **completed** path". It is also the right product answer. Requiring completion to rate a course would suppress the single most useful piece of feedback a platform can get — "I bailed on this course, here is why" — whereas a path rating is a judgement about a whole curriculum's fit for a role and level (FR-RATE-004's actual wording), which nobody can make halfway through.

`computePathProgress` is reused verbatim rather than reimplemented, which inherits three properties for free: the denominator is only *currently published* items (a retired item cannot block eligibility), items shared between two courses of the same path are counted once, and 100 means 100 — the module already refuses to round up (`percent.ts`, `countsFor`). "Empty path/course" (zero items) yields 0% and no eligibility, which is correct: there is nothing to have an opinion about.

Rejected: **an env var or database setting making the policy configurable at runtime** — "configurably" in the requirement is about the product decision, not about shipping a knob; a knob nothing turns is untested configuration surface, and with no admin UI (FR-ADMIN-002, R2) there is nowhere to turn it from. The constants are exported and named, so changing the policy is a one-line, test-covered edit. Rejected: **gating both on "started"** — contradicts FR-RATE-003/004's explicit "completed". Rejected: **gating both on "completed"** — would mean nobody can report that a course was too hard to finish, which is exactly the signal FR-RATE-007 will later want to act on.

**Eligibility is evaluated at write time only.** If a path later gains an item, a learner who rated it at 100% keeps their rating (and it keeps counting) even though they are momentarily below 100% again. The alternative — invalidating ratings when content changes — would delete honest feedback because a curator added a link. Recorded in Risks #6.

### 3. A rating is editable and removable by its author; there is no soft delete

One row per (user, target) means the natural write is an upsert: submitting again **replaces** the user's stars and feedback and bumps `updatedAt`. The form reflects this — it prefills with the existing rating and reads "Update your rating" — so a learner is never confused about whether they are adding a second review. `DELETE /api/ratings` removes the row entirely, and the aggregate drops accordingly.

Rationale for allowing both: (i) an opinion formed halfway through a path legitimately changes by the end of it, and an immutable rating would make the aggregate *less* accurate, not more; (ii) FR-ACC-007/NFR-COMP-004 already promise the user access to and deletion of their personal data, and a rating published under their display name is unambiguously theirs — being able to delete the whole account but not one sentence you regret is an incoherent promise; (iii) editing alone is not a withdrawal, because the star value would survive an emptied feedback field.

Rejected: **immutable ratings** — the usual anti-manipulation argument (people gaming an average) does not apply to a free educational platform with no ranking, no marketplace, and a one-rating-per-user constraint; the cost would be support requests with no mechanism behind them. Rejected: **soft delete (a `deletedAt` tombstone)** — it adds a condition to every aggregate, list, and eligibility query forever, for an audit trail nobody reads; the only consumer that could want history is FR-ADMIN-005, and a moderation queue whose offending content has been deleted by its own author has already got the outcome it wanted.

Consequences, stated rather than discovered later: deleting a rating cascades away its `RatingFlag` rows, so a flagged rating that its author deletes vanishes from the moderation queue — correct, because the thing being moderated is gone. Editing a rating does **not** clear its flags: the flag row survives with its own `createdAt`, and the moderation CLI prints the rating's `updatedAt` alongside it so a maintainer can see the text changed after the report.

### 4. Free-text feedback is publicly visible, attributed by display name plus role and level

This is a decision the requirements imply rather than state, so it is made explicitly. **FR-RATE-006 only makes sense if users can see each other's comments** — nobody flags a comment they cannot read. So feedback renders publicly, on the course page and the path page, to signed-in and anonymous visitors alike (FR-ACC-008 makes public content anonymously readable).

Each entry shows: the author's **display name** (never their email), their **role archetype and level**, the star value, the date, and the text. Role and level are shown because FR-RATE-004 defines path feedback as being about "fit for their role/level" — a review saying "too shallow" means something different from an Advanced Technical Builder than from a Zero-Knowledge Executive, and without that context the requirement's own framing is invisible to the reader. The rating form states plainly, above the submit button, that the name, role, and level will be shown publicly with the feedback, so it is informed at the point of submission.

The star **value** is separable from the text: a rating with no feedback counts in the aggregate but does not appear in the list (an empty list entry is noise). The list renders the 20 most recent entries with feedback, with a "showing 20 of N" line — bounded render at the NFR-SCALE-002 target; full pagination is out of scope and trivially additive.

Rejected: **private feedback, visible only to curators** — smaller privacy and moderation surface, and it would let this item skip decision #5 entirely, but it makes FR-RATE-006 meaningless and throws away the main reason a learner reads ratings at all. Rejected: **anonymous or pseudonymous display** — it removes the role/level context FR-RATE-004 is built on, and anonymity reliably makes moderation load worse rather than better.

**Flagged for the human (Risks #1):** this publishes a user's display name, role, and level next to their words. NFR-COMP-002's privacy policy and terms must say so before launch. The privacy-policy *copy* is not this item's to write, but this item creates the obligation and records it.

### 5. Flagging is a separate `RatingFlag` table that records rather than censors, plus a CLI so it is not a dead end

`RatingFlag` is its own table — `ratingId`, `userId`, `reason RatingFlagReason`, `note String?`, `resolvedAt DateTime?`, `createdAt` — with `@@unique([ratingId, userId])`.

Why a table rather than `flaggedAt`/`flagReason` columns on `Rating` (the alternative REQUEST.md names): columns can only hold **one** flag. Three users reporting the same comment is the single strongest signal a moderation queue has, and columns would either overwrite it or silently drop the second and third reports; the `@@unique([ratingId, userId])` pair simultaneously preserves that count and stops one person from inflating it. A table also means FR-ADMIN-005 can add resolution metadata without touching the ratings table, and `reason` is a queryable enum rather than free text — `RatingFlagReason { INAPPROPRIATE, SPAM, OUTDATED_OR_INCORRECT, OTHER }`, where `OUTDATED_OR_INCORRECT` is deliberately named after **FR-RATE-007's own wording** ("feedback text is flagged as outdated/incorrect") so that R2 item has an axis to query on day one instead of a text-mining problem.

**A flag does not hide anything.** No auto-hide at N reports: with no moderator on duty and no appeals path, an auto-hide is a censor button handed to whoever clicks fastest, and a single bad-faith flag could remove legitimate criticism of a course. The rating stays visible; the report is recorded.

That leaves the honest problem: with no moderation UI, who acts? Answer: `scripts/moderation.ts`, run by the maintainer, following the `scripts/import-content.ts` precedent exactly (a `tsx` script, deliberately not an API route — an authenticated moderation endpoint is a mini admin UI, which NFR-SEC-006's RBAC does not yet exist to protect).

- `npm run moderation:queue` — lists unresolved flags grouped by rating: flag count, reasons, notes, the rating's text and `updatedAt`, the target course/path slug, and the rating id.
- `npx tsx scripts/moderation.ts hide <ratingId> --reason "..."` — sets `Rating.hiddenAt`/`hiddenReason` and resolves that rating's flags. A hidden rating is excluded from the public list **and from the aggregate**, appears in its author's own export, and shows the author a plain note on the form ("Your feedback is not currently shown publicly") rather than pretending nothing happened.
- `unhide <ratingId>` and `dismiss <ratingId>` (resolve the flags, leave the rating visible) complete the loop so the queue is drainable.

`hiddenAt` is therefore a column that is genuinely written and genuinely read by this item — not a "for later" column, which the shipped items have consistently refused to add. Rejected: **shipping `RatingFlag` with no way to act on it** — that is the "fire-and-forget action" REQUEST.md explicitly asked to avoid, one `psql` session away from being the real process anyway; better to write the 60 lines and document them. Rejected: **auto-hide at 3 distinct flags** — see above; revisit when there is a moderator and an appeals path, i.e. with FR-ADMIN-005's UI.

### 6. Aggregate average and count are computed at read time — and this is the case where that was actually re-examined

`learning-paths-content` note #8 (duration summed at read time) and `progress-tracking` decision #5 (percentages computed at read time) set the precedent, and REQUEST.md rightly asks whether it still holds here, because the cost profile is different: a progress percentage is computed over one learner's ~50 rows, whereas an average is computed over *every* rating a course has ever received. Re-derived rather than inherited:

**The read.** One `prisma.rating.groupBy({ by: ["courseId"], where: { courseId: { in: [...] }, hiddenAt: null }, _avg: { stars: true }, _count: { _all: true } })` per page — one query for *all* courses on a path page, one for the path itself. Not one query per course. Backed by `@@index([courseId])`/`@@index([pathId])`, this is an index range scan plus an aggregate over the matching rows. At the NFR-SCALE-002 target the pathological case is one very popular course rated by a large share of 100k users; even at 100,000 rows that aggregate is single-digit-to-low-tens of milliseconds in Postgres, on a page that is already `force-dynamic` and already issues several content queries. The realistic case is two to four orders of magnitude smaller, because only *started* users can rate and only a fraction of them do.

**The write side is what actually settles it.** A denormalized `ratingSum`/`ratingCount` on `Course`/`Path` has four independent drift sources here, not one: creating, editing, deleting, and hiding a rating. The fourth and worst is invisible: **account deletion**. `prisma.user.delete` removes a user's ratings through a database-level cascade with **no application code involved** — that is `progress-tracking` decision #9 and its shipped AC9, and the e2e teardown depends on it. A denormalized counter would silently drift on every account deletion unless the cascade were replaced by application-level recompute, i.e. denormalizing ratings would require *weakening an already-shipped, already-tested guarantee* on the account-deletion path. That is a concrete cost this codebase would pay, not a hypothetical one, and it is decisive.

So: read time, and this **is** re-examined rather than copied. What is different from the progress case is recorded honestly: **if any aggregate ever earns denormalization or caching, this is the first place it will**, because unlike a per-user percentage the numbers here are identical for every visitor and change rarely — which is precisely the "frequently accessed, slow-changing data" NFR-SCALE-004 names, and NFR-SCALE-004's example list literally says "aggregate ratings". The first move if it ever gets slow is therefore **caching** (a `use cache`/tag-based entry invalidated on rating write), not a denormalized column, because caching does not reintroduce the cascade-drift problem — a stale cache self-heals, a drifted counter does not. That work belongs to the item that owns NFR-SCALE-004's caching strategy (the FR-SEARCH item), unchanged. The trigger to escalate is in Risks #5.

Pure formatting (rounding to one decimal, the "Not yet rated" case, the "N ratings" pluralization) lives in `src/lib/ratings/aggregate.ts` with no Prisma import, unit-testable without a database — the same split as `percent.ts` and `plan-import.ts`.

### 7. NFR-SEC-007: normalize on the way in, escape on the way out, and never render user text as Markdown

Free-text feedback is the first genuinely open-ended user-generated field in the app; both prior content items deferred this requirement here on purpose. The design, made explicit rather than inherited:

**On the way in** (`src/lib/validation/rating.ts`, following `account.ts`'s conventions exactly):

- `.trim()`, then a hard length cap of **2,000 characters** for feedback and **500** for a flag note. Long enough for a genuinely useful paragraph or three about role/level fit; short enough to bound storage, render cost, and the blast radius of anything pathological. The cap is enforced *after* normalization so padding tricks cannot smuggle length past it.
- **Control characters are stripped, but newlines are preserved.** This is the one place `account.ts`'s existing helper cannot be reused as-is: `stripControlCharacters` filters every code point <= 31, which includes newline (10) and carriage return (13) — correct for a display name, wrong for multi-paragraph feedback. So the helper moves to `src/lib/validation/text.ts` with an `allowNewlines` option (default `false`, so `nameSchema`'s behaviour is bit-for-bit unchanged and its existing tests must still pass untouched), and the feedback schema uses the newline-preserving mode plus CRLF normalization and a collapse of three-or-more consecutive newlines to two. One shared, tested implementation of a security-relevant function beats two copies.
- Empty-after-normalization feedback is stored as `null`, not an empty string, so "rated without commenting" is one state rather than two.
- `stars` is `z.number().int().min(1).max(5)` — a rating is an integer 1-5 at the schema layer, at the API layer, and (decision #1) at the database layer.

**On the way out**: feedback renders as **plain text in JSX** — the value interpolated inside an element with `whitespace-pre-line`, so React's default escaping handles every hostile character and the preserved newlines still produce paragraphs. Two things it is explicitly **not**: it is never passed through `dangerouslySetInnerHTML` (nothing in this codebase ever has), and it is never passed through `<Markdown>`. That second one is the non-obvious call and worth stating: `react-markdown` is *safe* (it builds an element tree and leaves raw HTML inert — `learning-paths-content` decision #3), so this is not an XSS argument. It is a spam and product argument — Markdown would let any user publish clickable links and images inside a course page, which is a link-spam vector on a public education site and an invitation nobody asked for. Author-controlled lesson bodies get Markdown; user-submitted text gets plain text. URLs typed into feedback stay inert text.

This gives NFR-SEC-007 both halves it asks for: "sanitized before storage" (the normalized value is what is written, so a hostile payload never sits in the database in its original form) and "escaped before rendering" (React, structurally, with no sanitizer configuration to get wrong). Verified by a unit test on the schema, a component test asserting a script payload renders as literal text with no element created, and an e2e assertion on a real page render (mirroring the display-name precedent from `user-accounts-auth`, AC16).

### 8. No new rate limiter for the rating endpoints, with a tighter blast radius than the progress endpoint had

`progress-tracking` decision #8 declined a limiter for `POST /api/progress` on the grounds that the write is self-scoped, idempotent, and bounded above by one row per (user, published item). The same reasoning applies here **more** strongly, because three independent constraints bound the surface: `requireUser()` (authenticated only), the unique constraints (one rating per user per target, one flag per user per rating — so repeated submissions overwrite rather than accumulate), and the FR-RATE-008 eligibility gate (a drive-by account cannot write anything at all until it has actually engaged with the content). Row growth is bounded by users x (courses + paths), and text growth by that x 2,000 characters.

What is genuinely new is *free text stored and publicly rendered*, so abuse looks different: not volume, but content. That is what decision #5's flag record and CLI address, which is the proportionate control. Recorded as Risks #3 with the trigger that would change the answer (a spam wave, or the moment the platform gains any unauthenticated write path).

### 9. Ratings are personal data: exported and cascaded, like progress

`Rating.userId` and `RatingFlag.userId` are both `onDelete: Cascade`, so the existing account-deletion route removes them with no new code and the e2e teardown keeps working unchanged. `GET /api/account/export` gains a `ratings` array (target type, target slug and title, stars, feedback, hidden state, timestamps) and a `ratingFlags` array (which ratings you reported, the reason and note, when) — the export carries **slugs and titles, never cuids**, per the precedent that the file has to be meaningful to a human reading it. The one exception is the rating id in `ratingFlags`, which is the only identifier a flagged rating has; it is included so the export is self-consistent, and it is the same id already exposed to the client by the flag control.

Consequence recorded rather than discovered: a *reporter* deleting their account also deletes their flags, so a report can vanish while the reported rating survives. The alternative (`userId String?` + `onDelete: SetNull`, keeping an anonymized flag) is better for moderation durability and worse for schema consistency — every other user-owned row in this schema cascades — and the loss is small, because the surviving rating can be re-flagged by anyone. Cascade, deliberately; alternative recorded here so the next person knows it was weighed.

## Prisma schema design

Appended to `prisma/schema.prisma` after the progress-tracking block, with a header comment in the file's established style — which must state that this item adds two hand-written `CHECK` constraints that are invisible in this file (decision #1, Risks #7).

New enum:

```prisma
enum RatingFlagReason {
  INAPPROPRIATE
  SPAM
  OUTDATED_OR_INCORRECT
  OTHER
}
```

`OUTDATED_OR_INCORRECT` is named after FR-RATE-007's wording so that R2 item has a queryable axis with no backfill (decision #5).

New models:

```prisma
model Rating {
  id       String  @id @default(cuid())
  userId   String
  courseId String?
  pathId   String?

  stars    Int
  feedback String?

  // Moderation (decision #5). Written only by scripts/moderation.ts; read
  // by every public aggregate and list query, which filter `hiddenAt: null`.
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
  // Set by scripts/moderation.ts `hide`/`dismiss` so the queue is drainable.
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

Field notes:

- `stars Int` rather than a 1-5 enum — it has to be averaged, and averaging an enum means mapping it back to numbers everywhere. The range is enforced at three layers (Zod, the API, and a database CHECK).
- `feedback String?` — null means "rated without commenting" (decision #7); an empty string is never stored.
- No `targetType` column (decision #1), no denormalized aggregate column on `Course`/`Path` (decision #6), no `flagCount` on `Rating` (the CLI's `groupBy` is enough and a counter would drift), no `deletedAt` (decision #3).

Index rationale, sized for NFR-SCALE-002's 100,000 users / 5,000 items:

- `@@unique([userId, courseId])` / `@@unique([userId, pathId])` — the natural keys and the one-per-user guarantee; each is also the index that makes the upsert a single indexed statement. Their leftmost `userId` prefix additionally serves "all of this user's ratings", which is the only query the export and the form prefill need, so **no separate `@@index([userId])` is added** — recorded so a future reader knows that was a choice.
- `@@index([courseId])` / `@@index([pathId])` — the indexes FR-RATE-005's aggregate `groupBy` and the feedback list actually run on, and the ones Postgres needs anyway on the referencing side of a foreign key (it does not create them automatically) so a course/path cascade check is not a sequential scan.
- `@@index([ratingId])` on `RatingFlag` — the flag-count/queue join, and the same FK-referencing-side argument.
- `@@index([resolvedAt])` — the moderation queue's only filter (`resolvedAt: null`); a tiny table, but it is the query the CLI exists to run and FR-ADMIN-005 will run it more.
- **Considered and deliberately omitted: a covering `@@index([courseId, stars])` and a partial index on `hiddenAt IS NULL`.** Either would let the aggregate run index-only, but a partial index is not expressible in `schema.prisma` (it would be another hand-written migration edit), and neither is justified before an `EXPLAIN` says so at a row count this project does not have. Recorded as the first thing to try if Risks #5's trigger ever fires — before any denormalization.

Hand-written additions to the generated migration (decision #1) — the only reason `migration.sql` is edited by hand:

```sql
ALTER TABLE "rating" ADD CONSTRAINT "rating_exactly_one_target"
  CHECK (("courseId" IS NOT NULL) <> ("pathId" IS NOT NULL));
ALTER TABLE "rating" ADD CONSTRAINT "rating_stars_range"
  CHECK ("stars" BETWEEN 1 AND 5);
```

Back-relations added to existing models (**virtual — they generate no DDL against `user`, `course`, or `path`**):

- `User`: `ratings Rating[]`, `ratingFlags RatingFlag[]`
- `Course`: `ratings Rating[]`
- `Path`: `ratings Rating[]`

Migration: one migration, `npx prisma migrate dev --name add_ratings_and_feedback`, then the two `ALTER TABLE ... ADD CONSTRAINT` lines appended by hand and the migration re-applied to a clean database to prove it runs end to end. The final `migration.sql` must contain only `CREATE TYPE "RatingFlagReason"`, `CREATE TABLE "rating"`, `CREATE TABLE "rating_flag"`, their index statements, the `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statements for the two new tables, and the two CHECK constraints above. It must contain **no** `DROP`, and no `ALTER TABLE` against `user`, `session`, `account`, `verification`, `rateLimit`, `role_profile`, `path`, `course`, `path_course`, `course_item`, `content_item`, `content_item_version`, `topic`, `glossary_term`, or `progress`. Task 2 verifies this by reading the file.

Explicitly **not** added: any `Certificate`, `Bookmark`, `Streak`, or search-index model; any aggregate/rating column on `Course`, `Path`, or `User`; any column on `Progress`; any RBAC/admin column.

## Tasks

Ordered so each is independently completable. Paths are relative to the project root `C:\Users\amitn\MyAIprojects\AI Learning Platform`.

### Schema and data model

1. - [x] `prisma/schema.prisma`: append the `RatingFlagReason` enum and the `Rating` and `RatingFlag` models exactly as specified in "Prisma schema design", preceded by a header comment block matching the file's existing style — stating that this is the ratings-and-feedback work item, that exactly one of `courseId`/`pathId` is non-null and this is enforced by a hand-written CHECK constraint **not visible in this file** (decision #1), that aggregates are computed at read time with no denormalized column (decision #6), that `hiddenAt` is written only by `scripts/moderation.ts`, and that no certificate/bookmark model is added. Add the `ratings`/`ratingFlags` back-relations to `User`, and `ratings Rating[]` to `Course` and to `Path`.
2. - [x] `prisma/migrations/**` (new): generate with `npx prisma migrate dev --name add_ratings_and_feedback`, then append the two `CHECK` constraints from "Prisma schema design" to the generated `migration.sql`, and re-run against a clean database to confirm it applies. Read the final file and confirm it matches the allow-list — no `DROP`, no `ALTER` against any pre-existing table.

### Validation and library modules

3. - [x] `src/lib/validation/text.ts` (new): move `stripControlCharacters` here from `account.ts` verbatim and add an `allowNewlines` option (default `false`) that spares code points 10 and 13; add `normalizeMultilineText(value)` which applies the newline-preserving strip, converts CRLF and lone CR to LF, trims, and collapses runs of three-or-more newlines to two. Keep the existing code-point-filter implementation (no raw control bytes in the source) and its comment.
4. - [x] `src/lib/validation/account.ts`: import `stripControlCharacters` from `./text` instead of defining it locally. **No behaviour change** — `nameSchema` must still strip newlines, and `src/lib/validation/__tests__/account.test.ts` must pass untouched.
5. - [x] `src/lib/validation/rating.ts` (new): `ratingTargetSchema` (`targetType: z.enum(["course","path"])`, `targetSlug` — trimmed, 1-200 chars, the same slug regex as `progress.ts`); `ratingSubmissionSchema` = target + `stars: z.number().int().min(1).max(5)` + `feedback` (optional, `normalizeMultilineText` transform, max 2000 after normalization, empty becomes `null`); `ratingRemovalSchema` = target only; `ratingFlagSchema` = `ratingId` (cuid-shaped, capped) + `reason: z.enum([...RatingFlagReason])` + optional `note` (normalized, max 500). Export the inferred types and the two length constants. Follows `account.ts`/`progress.ts` conventions (trim, cap, explicit messages).
6. - [x] `src/lib/ratings/aggregate.ts` (new): pure, no Prisma import. `RatingAggregate = { average: number | null; count: number }`; `roundAverage(avg)` (one decimal, half-up); `formatAggregate(agg)` returning `{ text, ariaText }` — "Not yet rated" at count 0, otherwise "4.3 out of 5 - 12 ratings" and "Average rating 4.3 out of 5, from 12 ratings"; `EMPTY_AGGREGATE`. Unit-testable without a database, mirroring `percent.ts`.
7. - [x] `src/lib/ratings/eligibility.ts` (new): the single FR-RATE-008 source of truth (decision #2). Export `COURSE_RATING_POLICY = "STARTED"` and `PATH_RATING_POLICY = "COMPLETED"` as named constants; `RatingEligibility = { eligible: true } | { eligible: false; reason: "NOT_SIGNED_IN" | "COURSE_NOT_STARTED" | "PATH_NOT_COMPLETE" | "NO_ITEMS" }`; `getCourseRatingEligibility(userId, courseId)` (one `prisma.progress.count` scoped through the course's published items) and `getPathRatingEligibility(userId, pathId)` (load the published path shape, build the progress map via the existing `getProgressMapForUser`, call `computePathProgress` from `@/lib/progress/percent`, require `percent === 100`). Also export `RATING_ELIGIBILITY_MESSAGES` — the user-facing copy per reason — so page and form render identical wording.
8. - [x] `src/lib/ratings/queries.ts` (new): the only place routes read ratings from, mirroring `src/lib/content/queries.ts`/`src/lib/progress/queries.ts` and wrapped in React `cache()`. `resolvePublishedCourseBySlug(slug)` / `resolvePublishedPathBySlug(slug)` (published-only, returning id/slug/title); `getCourseRatingAggregates(courseIds)` and `getPathRatingAggregates(pathIds)` — **one `groupBy` each** for the whole list, filtered `hiddenAt: null`, returning a `Map`; `listVisibleRatings({ courseId | pathId })` — non-hidden rows with non-null feedback, `take: 20`, newest first, selecting the author's `name`, `roleArchetype`, `level` and nothing else, plus a total-with-feedback count for the "showing 20 of N" line; `getMyRating(userId, target)`. No function may issue a query per course or per rating.
9. - [x] `src/lib/ratings/mutations.ts` (new): `upsertRating({ userId, target, stars, feedback }, client = prisma)` dispatching to the `userId_courseId` or `userId_pathId` compound unique; `deleteRating({ userId, target })` (scoped by userId — a missing row is a 404, never someone else's row); `flagRating({ ratingId, userId, reason, note })` as an upsert on `ratingId_userId` so a re-flag updates rather than throwing. Each takes an explicit `PrismaClient` defaulting to the singleton, matching `src/lib/progress/mutations.ts`, so it is unit-testable against a mock.

### API

10. - [x] `src/app/api/ratings/route.ts` (new): `POST` — `requireUser()`, parse JSON (400 "Invalid JSON body", matching the existing routes verbatim), `ratingSubmissionSchema.safeParse` (400 with the first issue message), resolve the target slug against published content (404 "Course not found" / "Path not found"), check eligibility and return **403** with the matching `RATING_ELIGIBILITY_MESSAGES` copy when ineligible (FR-RATE-008, NFR-SEC-004), then `upsertRating` and return `{ success: true, rating: {...}, aggregate: {...} }` with the freshly recomputed aggregate so the client can update without a second request. `DELETE` — same auth/parse/resolve chain with `ratingRemovalSchema`, deletes only the session user's row, returns `{ success: true, aggregate }`; a missing row is 404. (DELETE-with-a-JSON-body follows the existing `DELETE /api/account` convention.) No other method exported.
11. - [x] `src/app/api/ratings/flags/route.ts` (new): `POST` — `requireUser()`, `ratingFlagSchema`, load the rating (404 if absent or hidden), **400 if the rating belongs to the requesting user** (decision #5: you cannot flag your own), then `flagRating`, returning `{ success: true }`. Deliberately reveals nothing about the rating beyond existence.
12. - [x] `src/app/api/account/export/route.ts`: add two parallel queries — the user's ratings (with course and path slug/title selected) and their rating flags — and add `ratings` (`targetType`, `targetSlug`, `targetTitle`, `stars`, `feedback`, `hidden`, `createdAt`, `updatedAt`) and `ratingFlags` (`ratingId`, `reason`, `note`, `createdAt`, `resolved`) arrays to `exportPayload` (decision #9). Update the route's header comment.

### Components

13. - [x] `src/components/ui/textarea-field.tsx` (new): a `<textarea>` sibling of the existing `<FormField>` — explicit `<label htmlFor>`, `aria-describedby` wiring for hint + error + character counter, error text in an `aria-live="polite"` region, and an optional `maxLength`/`value`-driven counter rendered as "123 / 2000 characters" with `aria-live="polite"` and `aria-atomic`. Same styling tokens as `FormField`.
14. - [x] `src/components/ratings/star-rating-input.tsx` (new, client): the FR-RATE-001/003 control, accessible by construction — a `<fieldset>` with a `<legend>` ("Your rating") containing five `<input type="radio">` inputs with visually-hidden labels "1 star" through "5 stars", styled as stars via `:checked`/`:focus-visible` on the adjacent label. Native radios give arrow-key navigation, roving focus, and screen-reader group semantics for free. The selected value is also rendered as visible text ("4 out of 5") so nothing depends on glyph or colour. Controlled via `value`/`onChange` props.
15. - [x] `src/components/ratings/star-rating-display.tsx` (new, server): FR-RATE-005's read-only display. Takes a `RatingAggregate`, renders decorative `aria-hidden` star glyphs plus the visible text from `formatAggregate`, with the `ariaText` as the wrapper's accessible name. Renders the "Not yet rated" variant at count 0. Also used at a smaller size on course cards and for a single rating's stars in the list.
16. - [x] `src/components/ratings/rating-form.tsx` (new, client): FR-RATE-001/002/003/004. `<StarRatingInput>` + `<TextAreaField>` (course prompt: "What did you think of this course?"; path prompt: "Did this path fit your role and level?" — FR-RATE-004), a line stating that the submitted name, role, and level are shown publicly (decision #4), submit, and — when a rating already exists — prefilled values, an "Update your rating" label, and a "Remove my rating" button that calls `DELETE`. POSTs to `/api/ratings`, disables while pending, shows an inline error on failure, announces success/failure in an `aria-live="polite"` region, and calls `router.refresh()` so the server-rendered aggregate and list update. Shows the "your feedback is not currently shown publicly" note when the user's own rating is hidden. Follows `src/components/progress/progress-control.tsx` and `src/components/account/delete-account-form.tsx` conventions.
17. - [x] `src/components/ratings/flag-rating-button.tsx` (new, client): FR-RATE-006. A "Report" button whose accessible name includes the author's display name (so a list of them is not a row of identical buttons), toggling an inline form with a reason radio group (the four `RatingFlagReason` values with plain-language labels) and an optional note; POSTs `/api/ratings/flags`; on success collapses to "Reported — thank you" announced in an `aria-live` region and stays disabled. Moves focus into the form on open and back to the trigger on cancel.
18. - [x] `src/components/ratings/rating-list.tsx` (new, server): the public feedback list (decision #4). Each entry: author display name, role archetype + level (via the existing label maps in `src/lib/content/taxonomy.ts`), the date, `<StarRatingDisplay>` for that entry's stars, and the feedback rendered as **plain text in a `whitespace-pre-line` element — never `<Markdown>`, never `dangerouslySetInnerHTML`** (decision #7). Renders `<FlagRatingButton>` only for a signed-in viewer who is not the author. Renders the "showing 20 of N" line when truncated, and nothing at all when there is no feedback yet.
19. - [x] `src/components/ratings/rating-section.tsx` (new, server): composes the whole surface for one target so the course page and the path page cannot diverge (same rationale as `<CourseSummary>`) — heading, `<StarRatingDisplay>` aggregate, then either `<RatingForm>` (eligible), the matching `RATING_ELIGIBILITY_MESSAGES` copy (signed in, not eligible), or a sign-in link carrying `?next=` (anonymous, FR-ACC-008) — then `<RatingList>`.

### Routes

20. - [x] `src/app/courses/[slug]/page.tsx`: FR-RATE-001/002/005. Load the course aggregate, the viewer's own rating, eligibility, and the visible rating list alongside the queries already there; render `<StarRatingDisplay>` next to the existing item-count/duration line and `<RatingSection>` below the item list. Anonymous rendering is unchanged apart from the aggregate and the sign-in prompt.
21. - [x] `src/app/paths/[role]/[level]/page.tsx`: FR-RATE-003/004/005. Render the path's `<StarRatingDisplay>` near the title, pass per-course aggregates (one `getCourseRatingAggregates` call for all of the path's courses — never one per course) into each `<CourseSummary>`, and render `<RatingSection>` for the path at the bottom of the page. Reuse the `user` and progress map already fetched; add no second `getCurrentUser()` call.
22. - [x] `src/components/content/course-summary.tsx`: add an optional `rating?: RatingAggregate` prop rendering a compact `<StarRatingDisplay>` under the item-count line. Every existing call site keeps working unchanged when it is omitted.

### Moderation (decision #5)

23. - [ ] `scripts/moderation.ts` (new): a `tsx` script following `scripts/import-content.ts`'s structure. `list` (default) prints unresolved flags grouped by rating — flag count, reasons, notes, target type/slug, the rating's stars and text, its `createdAt`/`updatedAt`, and the rating id — via a fixed number of queries; `hide <ratingId> --reason "..."` sets `hiddenAt`/`hiddenReason` and resolves that rating's flags; `unhide <ratingId>` clears them; `dismiss <ratingId>` resolves the flags without hiding. Prints a clear summary and exits non-zero on an unknown id or a missing argument.
24. - [ ] `package.json`: add `"moderation:queue": "tsx scripts/moderation.ts list"`. No new dependency — `tsx` and `@prisma/client` are already present.

### Tests — unit and component

25. - [ ] `src/lib/validation/__tests__/text.test.ts` (new): `stripControlCharacters` removes a null byte and an escape sequence and, by default, a newline; with `allowNewlines` it keeps LF and CR while still removing other control characters; `normalizeMultilineText` converts CRLF to LF, collapses four blank lines to one blank line, trims, and returns an empty string for whitespace-only input.
26. - [ ] `src/lib/validation/__tests__/rating.test.ts` (new): stars of 0, 6, 3.5, and the string "4" are all rejected; a valid submission parses; feedback longer than 2000 characters **after** normalization is rejected; feedback containing a script payload parses through **unchanged as literal text** (documenting that escaping is a render-time concern, not a strip-tags-at-input concern); whitespace-only feedback becomes `null`; an unknown `targetType`, a malformed slug, and an unknown flag reason are each rejected; a flag note over 500 characters is rejected.
27. - [ ] `src/lib/ratings/__tests__/aggregate.test.ts` (new): `roundAverage` rounds 4.25 to 4.3 and 4.0 to 4; a null average with count 0 formats as "Not yet rated"; count 1 pluralizes as "1 rating"; the `ariaText` names the average and the count.
28. - [ ] `src/lib/ratings/__tests__/eligibility.test.ts` (new, mocked Prisma + hand-built fixtures): a user with no progress in a course is `COURSE_NOT_STARTED`; one `IN_PROGRESS` row makes them eligible (the policy is STARTED, not COMPLETED); a path at 80% is `PATH_NOT_COMPLETE`; a path where every published item is `COMPLETE` is eligible; a path whose only incomplete item is **retired** is eligible (the live-denominator property inherited from `computePathProgress`); an empty course/path is `NO_ITEMS`, never eligible; every `reason` has an entry in `RATING_ELIGIBILITY_MESSAGES`.
29. - [ ] `src/lib/ratings/__tests__/queries.test.ts` (new, mocked/counting Prisma): `getCourseRatingAggregates` for eight course ids issues **exactly one** `groupBy` (asserted by call count) and filters `hiddenAt: null`; `listVisibleRatings` applies `take: 20`, orders newest first, excludes hidden and feedback-less rows, and selects no email field; `resolvePublishedCourseBySlug` filters `status: "PUBLISHED"` and returns null for an unknown slug.
30. - [ ] `src/lib/ratings/__tests__/mutations.test.ts` (new, mocked Prisma): a course submission upserts on `userId_courseId` with `pathId` absent, and a path submission on `userId_pathId`; a repeat submission updates stars and feedback rather than creating a second row; `deleteRating` scopes its `where` by the session `userId`; `flagRating` upserts on `ratingId_userId` so a second flag by the same user does not create a duplicate.
31. - [ ] `src/app/api/__tests__/ratings.test.ts` (new, node vitest environment, following `progress.test.ts`'s mocking style): malformed JSON returns 400 with the standard message; invalid stars returns 400; an unknown/unpublished slug returns 404 and calls no mutation; **an ineligible user gets 403 with the eligibility copy and no mutation** (FR-RATE-008, NFR-SEC-004); a valid course and a valid path submission each dispatch with the **session** user's id (never one from the body) and return the aggregate; `DELETE` scopes to the session user and 404s on a missing row.
32. - [ ] `src/app/api/__tests__/rating-flags.test.ts` (new, node env): a flag on someone else's rating succeeds; flagging **your own** rating returns 400 and writes nothing; an unknown or hidden rating id returns 404; an invalid reason returns 400; the flag is always attributed to the session user.
33. - [ ] `src/components/ratings/__tests__/star-rating.test.tsx` (new, RTL + user-event): `<StarRatingInput>` exposes a radio group with an accessible group name and five radios named "1 star" to "5 stars"; arrow keys move the selection and `onChange` fires with the numeric value; the selected value appears as visible text. `<StarRatingDisplay>` renders the average and count as text (not colour or glyphs alone) and the "Not yet rated" variant at count 0.
34. - [ ] `src/components/ratings/__tests__/rating-form.test.tsx` (new, RTL + user-event): submitting posts `/api/ratings` with the chosen stars and feedback (fetch mocked); the character counter updates and submission over the cap is blocked with an inline error; an existing rating prefills and the button reads "Update your rating"; "Remove my rating" issues a `DELETE`; a failed request shows an inline error and announces it in the live region; the control is disabled while pending; the public-visibility notice is present.
35. - [ ] `src/components/ratings/__tests__/rating-list.test.tsx` (new, RTL): an entry renders name, role, level, date, stars, and feedback text; **feedback containing a `<script>` payload and an `<img onerror=...>` payload renders as literal visible text with no matching element in the DOM** (NFR-SEC-007); newlines in feedback survive as separate visible lines; the flag button renders for a signed-in non-author, does not render for the author, and does not render for an anonymous viewer; hidden ratings are absent; the "showing 20 of N" line appears only when truncated.

### Tests — e2e (Playwright)

36. - [ ] `e2e/helpers/db.ts`: add `findRatingsForEmail(email)` (ratings joined to course/path slug) and `findRatingFlagsForEmail(email)`, plus a comment confirming `cleanupTestUsers()` needs no change because both new tables cascade from `User` — and that teardown must still never touch content rows.
37. - [ ] `e2e/helpers/progress.ts` (new): `completeContentItems(request, slugs)` — posts `{ action: "complete" }` to `/api/progress` for each slug, so rating specs can reach an eligible state without re-driving the completion UI (the same rationale as `registerAndOnboard`). Export `TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS`, the five seeded item slugs of that path (`what-is-artificial-intelligence`, `google-ai-crash-course`, `elements-of-ai-course`, `how-machine-learning-works`, `visual-intro-to-machine-learning`), so the "completed path" fixture is stated once.
38. - [ ] `e2e/rating-course.spec.ts` (new): FR-RATE-001/002/005, NFR-SEC-007. Register and onboard as Technical Builder / Zero Knowledge; assert `/courses/ai-foundations-for-builders` shows "Not yet rated" and, before starting, the FR-RATE-008 message instead of a form; complete one item in that course; reload and assert the form is now present; submit 4 stars with feedback containing a `<script>` payload; assert the aggregate now reads 4 out of 5 with 1 rating, that the feedback appears **as literal text** with no dialog and no injected element, and that the author's name/role/level are shown; edit to 5 stars and assert the aggregate updates; remove the rating and assert the page returns to "Not yet rated"; assert an anonymous visitor sees the aggregate and a sign-in prompt but no form.
39. - [ ] `e2e/rating-path.spec.ts` (new): FR-RATE-003/004/008. With a fresh user on the Technical Builder / Zero Knowledge path, assert the path rating area shows the "complete this path first" message and no form; assert a direct `POST /api/ratings` for that path returns **403** and writes no row (checked via `findRatingsForEmail`); complete all five items via the helper; reload and assert the form appears with the role/level fit prompt; submit 5 stars plus feedback; assert the path page's aggregate updates and the entry is listed; assert the per-course aggregate on the path page reflects a course rating submitted in the same test.
40. - [ ] `e2e/rating-flag.spec.ts` (new): FR-RATE-006. User A becomes eligible and leaves feedback on a course; user B (a separate browser context) sees it and reports it with reason "Inappropriate" plus a note; assert the UI confirms the report and the control is disabled; assert via `findRatingFlagsForEmail` that exactly one `RatingFlag` row exists with the right reason and rating; assert the rating is **still visible** (decision #5: flags record, they do not censor); assert user A sees no report control on their own rating; assert a second report by user B does not create a second row.
41. - [ ] `e2e/account-data.spec.ts`: extend — after leaving a rating with feedback and flagging another user's rating, the downloaded export JSON contains a `ratings` entry with the target slug, stars, and feedback text and a `ratingFlags` entry with the reason, and still contains no password, token, or other user's email.

### Docs

42. - [ ] `docs/architecture/ratings.md` (new): decision record in the style of `docs/architecture/progress.md` — decisions #1-#9 with their rejected alternatives, the schema and index rationale (including the omitted indexes and the two CHECK constraints that are invisible in `schema.prisma`), the FR/NFR mapping table, the verification of `learning-paths-content` decision #6, and an explicit statement of what FR-RATE-007 and FR-ADMIN-005 inherit (the aggregate query, `RatingFlag.reason` including `OUTDATED_OR_INCORRECT`, `resolvedAt`, and `Rating.hiddenAt`) and what they must still build.
43. - [ ] `docs/runbooks/content-moderation.md` (new): how a flag reaches the maintainer and what to do about it — `npm run moderation:queue`, the `hide`/`unhide`/`dismiss` verbs, what hiding does and does not do (excluded from the public list and the aggregate; still in the author's export), the deliberate absence of auto-hide, and the escalation path when FR-ADMIN-005's UI lands.
44. - [ ] `docs/architecture/progress.md`, `docs/architecture/content.md`: add one-line cross-references noting that the FR-RATE-008 gate promised by progress-tracking Risks #5, and the `Course.id`/`Path.id` attachment point promised by content decision #6, were both honoured — pointing at `docs/architecture/ratings.md`.
45. - [ ] `docs/content/authoring-guide.md`, `README.md`: extend the existing "never rename a published slug" rule to state that a rename now strands **ratings** as well as progress; add a short ratings/feedback section to the README's feature list and a line about `npm run moderation:queue`.

## New manual provisioning steps (human-only)

**None.** This item introduces no new environment variable, no new external service, no new account, and no new build or deploy step. It adds one Prisma migration (covered by the existing `npm run prisma:deploy` step), two API routes inside the existing Next.js app, and one `tsx` script that runs against the existing `DATABASE_URL` exactly as `npm run content:import` already does. Confirmed rather than assumed: the read-time aggregate decision (#6) is part of why — a denormalized alternative would have required a one-off backfill run against production. The one thing that is *not* an engineering step but is a launch obligation is the privacy-policy/terms copy created by decision #4 — see Risks #1.

## Acceptance criteria

1. A signed-in user who has started a course can submit a 1-5 star rating and optional free-text feedback for it from the course page; a user who has not started it sees an explanatory message and no form; an anonymous visitor sees the aggregate and a sign-in link. _(FR-RATE-001, FR-RATE-002, FR-RATE-008, FR-ACC-008)_
2. A signed-in user who has completed a path — every currently-published item `COMPLETE`, per `computePathProgress(...).percent === 100` — can rate it 1-5 stars and leave feedback prompted for role/level fit; below 100% the form is replaced by the reason, and a direct `POST /api/ratings` for that path returns **403** and writes nothing. _(FR-RATE-003, FR-RATE-004, FR-RATE-008, NFR-SEC-004, decision #2)_
3. Every course page and every path page displays the average rating to one decimal and the rating count, computed at read time from non-hidden ratings, showing "Not yet rated" at zero; each course card on a path page shows the same aggregate; the aggregate visibly changes after a rating is submitted, edited, and removed. _(FR-RATE-005, decision #6)_
4. A user has at most one rating per course and one per path, enforced by database unique constraints; re-submitting updates the existing row rather than creating a second; the author can remove their rating entirely, and the aggregate follows. _(decisions #1 and #3)_
5. Free-text feedback is trimmed, control-character-stripped with newlines preserved, newline-normalized, capped at 2,000 characters before storage, and rendered as plain escaped text — never through `<Markdown>` and never via `dangerouslySetInnerHTML`. A payload containing `<script>` and `<img onerror>` is stored as typed and renders as literal visible text with no element created and no script executed, on a real page. `nameSchema`'s existing behaviour is unchanged by the shared-helper extraction. _(NFR-SEC-007, decision #7)_
6. Any signed-in user can flag another user's rating with a reason and optional note; the flag is a `RatingFlag` row unique per (rating, user); flagging your own rating is refused; a flag never hides the rating; and `npm run moderation:queue` lists unresolved flags with enough context to act, with `hide`/`unhide`/`dismiss` working end to end. A hidden rating disappears from the public list **and** from the aggregate while remaining in its author's export. _(FR-RATE-006, FR-ADMIN-005 partial, decision #5)_
7. Every rating and flag write goes through `requireUser()`, is attributed to the session user with no user identifier accepted from the request body, addresses its target by slug resolved against published content, and re-checks eligibility server-side; a user cannot edit or delete another user's rating. _(NFR-SEC-004)_
8. `prisma/schema.prisma` gains exactly one enum and two models; the generated migration contains no `DROP` and no `ALTER TABLE` against any pre-existing table, applies cleanly on top of the auth, content, and progress migrations, and carries the two `CHECK` constraints (exactly-one-target, stars 1-5). `Rating` carries `@@unique([userId, courseId])`, `@@unique([userId, pathId])`, `@@index([courseId])`, `@@index([pathId])`; `RatingFlag` carries `@@unique([ratingId, userId])`, `@@index([ratingId])`, `@@index([resolvedAt])`. _(NFR-SCALE-002, decision #1)_
9. Aggregates for every course on a path page are produced by a single `groupBy` — asserted automatically — never one query per course, and the feedback list is bounded to 20 entries per render; rating submission is one eligibility read plus one indexed upsert. _(NFR-PERF-004, NFR-SCALE-002, decision #6)_
10. Deleting an account removes that user's ratings and flags via database-level cascade with no application code involved, and `GET /api/account/export` includes `ratings` and `ratingFlags` arrays carrying target slugs and titles — and still contains no password hash, no session or verification token, and no other user's email. _(FR-ACC-007, NFR-COMP-004, decision #9)_
11. The star control is a labelled radio group operable with keyboard alone (tab in, arrow keys to choose, visible focus ring), the selected value is available as text and not by glyph or colour alone, the feedback textarea has an associated label and a live character counter, every submission result is announced in an `aria-live` region, and the rating surfaces remain usable at 375px, 768px, and 1280px. _(NFR-A11Y-002, NFR-A11Y-004)_
12. Each published feedback entry displays its author's display name, role archetype, and level, and the submission form states before submission that those will be shown publicly. _(FR-RATE-004, decision #4)_
13. `prisma/schema.prisma` contains no `Certificate`, `Bookmark`, or search-index model, no denormalized rating aggregate column on `Course`/`Path`/`User`, no `flagCount`, and no `deletedAt`; nothing in the app sorts or filters content by rating. _(scope discipline, FR-RATE-007/FR-SEARCH deferred)_
14. `docs/architecture/ratings.md` records the nine decisions with their rejected alternatives and states what FR-RATE-007 and FR-ADMIN-005 inherit; `docs/runbooks/content-moderation.md` documents the queue workflow; the authoring guide's slug-rename rule mentions ratings. _(NFR-MAINT-005)_
15. `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`, and `npm run test:e2e` all pass locally, and both CI jobs stay green — including `build-and-test`, which builds against a placeholder `DATABASE_URL` and must not attempt to prerender any rating-bearing route. _(NFR-MAINT-004)_

## Test plan

| What | Type | Maps to |
| --- | --- | --- |
| `stripControlCharacters` with/without `allowNewlines`; `normalizeMultilineText` CRLF, blank-line collapse, whitespace-only | Unit (Vitest) — `validation/text.test` | AC5 |
| Existing `nameSchema` behaviour after the helper extraction | Unit (Vitest) — existing `validation/account.test`, unmodified | AC5 |
| Rating schemas: star bounds and integer-ness, 2000-char cap after normalization, script payload preserved as literal text, whitespace-only becomes null, bad target/slug/reason, 500-char note cap | Unit (Vitest) — `validation/rating.test` | AC1, AC5 |
| `roundAverage`, "Not yet rated", pluralization, `ariaText` | Unit (Vitest) — `ratings/aggregate.test` | AC3, AC11 |
| Eligibility: course STARTED vs path COMPLETED, 80% path refused, retired-item path allowed, empty target refused, message-map completeness | Unit (Vitest, mocked Prisma) — `ratings/eligibility.test` | AC1, AC2 |
| One `groupBy` for eight courses; `hiddenAt: null` filter; `take: 20`; published-only slug resolution; no email selected | Unit (Vitest, counting Prisma) — `ratings/queries.test` | AC3, AC6, AC9 |
| Upsert targets the right compound unique; repeat submission updates; delete scoped by userId; flag upsert is idempotent | Unit (Vitest, mocked Prisma) — `ratings/mutations.test` | AC4, AC6, AC7 |
| `POST`/`DELETE /api/ratings`: 400 bad JSON, 400 bad stars, 404 unknown slug, **403 ineligible with no write**, session-scoped dispatch, aggregate in the response | Unit (Vitest, node env) — `api/ratings.test` | AC1, AC2, AC7 |
| `POST /api/ratings/flags`: success, 400 self-flag, 404 unknown/hidden rating, 400 bad reason, session attribution | Unit (Vitest, node env) — `api/rating-flags.test` | AC6, AC7 |
| `<StarRatingInput>` radio-group semantics, arrow keys, visible numeric value; `<StarRatingDisplay>` text and empty state | Component (RTL + user-event) — `star-rating.test` | AC11, AC3 |
| `<RatingForm>` submit, counter, cap block, prefill/update, remove, failure revert, pending state, live region, public-visibility notice | Component (RTL + user-event) — `rating-form.test` | AC1, AC4, AC11, AC12 |
| `<RatingList>` XSS payload renders as literal text with no element; newlines preserved; flag button visibility rules; hidden excluded; truncation line | Component (RTL) — `rating-list.test` | AC5, AC6, AC12 |
| Rate a course end to end: gate before starting, submit with an XSS payload, aggregate updates, edit, remove, anonymous view | E2E — `rating-course.spec.ts` | AC1, AC3, AC5 |
| Path gate refuses below 100% (UI **and** a direct 403 from the API with no row written), then rating a completed path with role/level feedback; per-course aggregate on the path page | E2E — `rating-path.spec.ts` | AC2, AC3, AC7 |
| Flagging another user's rating: row created, rating still visible, no self-flag control, re-flag creates no second row | E2E — `rating-flag.spec.ts` | AC6 |
| Export contains ratings and flags and still leaks no secret or other user's email | E2E — `account-data.spec.ts` | AC10 |
| Account deletion removes ratings and flags via cascade | E2E (existing delete spec + `findRatingsForEmail`) | AC10 |
| Migration applies over the auth + content + progress schema, alters no pre-existing table, and both CHECK constraints reject a bad row | CI (`prisma migrate deploy`) + reading `migration.sql` + a manual `psql` insert attempt | AC8 |
| `moderation:queue` lists a flag; `hide` removes the rating from the public list and the aggregate; `unhide`/`dismiss` restore/drain | Manual (before ship, against a local database seeded by the e2e run) | AC6 |
| Keyboard-only walkthrough of rating + flagging; 375/768/1280 responsive check; screen-reader pass over the star group | Manual (before ship) | AC11 |
| Course-page and path-page wall-clock load with ~500 seeded ratings on one course | Manual (before ship, dev tools / Vercel timing) | AC9 |

Notes: the e2e suite already imports the content pack in `e2e/global-setup.ts` and cleans up only test-domain users in `e2e/global-teardown.ts`; neither needs a change, because both new tables cascade from `User` (task 36 records this). Unit tests never touch a database — `aggregate.ts` is pure by design, and the eligibility/query/mutation modules take an injectable client, which is the whole reason they are split from the route handlers. The moderation CLI is manually verified rather than e2e-tested: it is an operator tool with no HTTP surface, and its *effects* (a hidden rating excluded from the list and the aggregate) are covered by the component and query tests.

## Risks / open questions

Answered by the human before build (recorded here, not open):

1. **Feedback visibility** — confirmed public and attributed (display name, role, level), per this plan's decision #4. This creates a privacy-policy obligation (NFR-COMP-002) that this item cannot itself discharge: the privacy policy/terms must eventually state that ratings, feedback text, display name, role archetype, and level are publicly visible. The submission form states this at the point of entry as the honest minimum; the policy page copy remains a separate, non-engineering deliverable, tracked as a known gap (consistent with prior items' privacy-policy-page deferrals).
2. **Moderation CLI** — confirmed included (tasks 23, 24, 43, `scripts/moderation.ts`, `hiddenAt`/`hiddenReason` columns), so FR-RATE-006 flagging has an actual action loop rather than sitting inert until the R2 admin UI exists.

Flagged for the human. These do not block the build, but confirm before ship:

3. **No rate limiter on the rating endpoints (decision #8), and no auto-hide on flags (decision #5).** The bounded blast radius (authenticated + one row per user per target + the eligibility gate) makes this a reasonable R1 posture, but the *content* risk is not volume-bounded: one determined person with an account can put one abusive paragraph on every course they have started. The controls are the flag record and the CLI. Trigger to revisit: any real spam incident, or any unauthenticated write path appearing.

Answered by this plan rather than left open (REQUEST.md's four flagged questions):

4. **(a) "Completed a path"** = `computePathProgress(...).percent === 100` over currently-published items, reusing `src/lib/progress/percent.ts` unchanged (decision #2). **(b) Edit and delete** are both allowed for the author; there is no soft delete (decision #3). **(c) Flagging** is a `RatingFlag` table with a reason enum, `@@unique([ratingId, userId])`, and `resolvedAt`, plus `Rating.hiddenAt` and a CLI — durable, queryable, and drainable, with FR-ADMIN-005 needing only a UI on top (decision #5). **(d) Aggregates** are computed at read time by one `groupBy` per page, re-justified against this specific case, with the decisive argument being that denormalization would require weakening the shipped database-level account-deletion cascade; caching (not denormalization) is named as the first escalation, and it stays owned by the NFR-SCALE-004/FR-SEARCH item (decision #6).

Lower-stakes notes (no answer needed):

5. **The escalation trigger for aggregates.** If a course-page or path-page p95 ever exceeds the NFR-PERF-001 two-second budget with the aggregate `groupBy` visible in the trace, the order of moves is: (i) add the covering/partial index recorded as omitted in "Prisma schema design"; (ii) cache the aggregate per target with invalidation on rating write (NFR-SCALE-004); (iii) only then consider a stored counter, and only with an explicit plan for the account-deletion cascade. Written down so the next person does not start at (iii).
6. **Eligibility is checked at write time only** (decision #2). A learner who rates a path at 100% keeps the rating when the path later gains an item and their percentage drops. This is the same live-denominator property `progress-tracking` Risks #6 recorded, and the alternative (invalidating ratings on content change) would delete honest feedback because a curator added a link.
7. **The two CHECK constraints are invisible in `schema.prisma`.** Prisma neither models nor drops them, so they persist, but anyone squashing or regenerating migrations must carry them forward by hand. Recorded in the schema header comment (task 1), in the migration (task 2), and in `docs/architecture/ratings.md` (task 42) so it is stated in three places.
8. **A rating id (cuid) is exposed to the client** by the flag control — a deliberate departure from the slug-only addressing `progress-tracking` decision #3 established. A rating has no slug and no natural key a third party could use, the id is not a secret, and the flag route validates existence and ownership independently. Noted so the departure reads as considered.
9. **Aggregates are not shown on `/paths`, `/paths/[role]`, or anywhere else a course or path is merely listed** — FR-RATE-005 says "on each course and path", which the course page, the path page, and the path page's course cards satisfy. Adding a badge to the index pages is one extra `getPathRatingAggregates` call and would be genuinely useful for choosing a path; it is deliberately left to the FR-SEARCH item, which is already touching those listing surfaces.
10. **What this item hands to later items**, so it is not a surprise: FR-RATE-007 gets the aggregate query, `RatingFlag.reason` (including `OUTDATED_OR_INCORRECT`, named after its own wording), and `resolvedAt`, and needs only a threshold and a surface. FR-ADMIN-005 gets the whole queue as data plus a working CLI, and needs only a UI and RBAC (NFR-SEC-006). FR-ADMIN-006's ratings analytics gets `@@index([courseId])`/`@@index([pathId])` for free. FR-CERT is untouched.
11. **`NOT_SURE_YET` users and users on `ENGINEERING_LEADER`/`INVESTOR` (no R1 path)** can still rate any course they have started by browsing directly — course eligibility depends on progress, not on the user's current path. Correct, but worth knowing when reading the rating list: an author's displayed role may have nothing to do with the path the course sits in.
12. **The full WCAG 2.1 AA audit (NFR-A11Y-001) remains a separate item.** This item builds two new interactive patterns (a star radio group and a disclosure-style report form) to NFR-A11Y-002/-004 and tests them, but it does not claim the site-wide audit.
