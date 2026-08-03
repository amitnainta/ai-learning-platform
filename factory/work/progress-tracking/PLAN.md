# PLAN — progress-tracking

_Work item slug: progress-tracking. Plan produced by factory-planner. Source: factory/work/progress-tracking/REQUEST.md._

## Summary

This work item adds per-user progress tracking — the third foundational feature, sitting on top of `user-accounts-auth` (the `User` model and the `requireUser()`/`getCurrentUser()` session helpers) and `learning-paths-content` (the `Path` -> `Course` -> `ContentItem` model and the public browse routes). It adds one new table (`Progress`, keyed `(userId, contentItemId)`), one enum, one API route (`POST /api/progress`), a small set of progress components, and progress affordances woven into the four existing content surfaces: the lesson page gets a "mark complete" action and automatic first-view tracking, the curated item card gets an explicit completion control (curated items have no detail page — content decision #10), the path and course pages gain percentage bars and per-item status, and the dashboard placeholder is replaced with a real progress view showing percent complete per active path and per course plus a "resume" entry point back into the first unfinished item. Percentages and resume targets are **computed at read time** from the ordered path structure plus the user's progress rows — nothing is denormalized, following the same read-time precedent `learning-paths-content` set for course/path duration. Because progress keys on the shared, stable `ContentItem.id`, FR-PATH-009's "retain progress on overlapping items when switching paths" needs no mechanism at all; this item proves it with a test rather than building for it. No `Rating`, `Certificate`, `Streak`, or `Badge` table is created.

## Requirement IDs satisfied

Primary:

- **FR-PROG-001** (Must, R1) — completion status per content item per user, in all three states: `IN_PROGRESS` and `COMPLETE` are persisted `Progress` rows; "not started" is the absence of a row, mapped to the display vocabulary at read time (decision #2).
- **FR-PROG-002** (Must, R1) — resume a path or course from where the learner left off: the first non-complete item in authored path/course order, surfaced as a `<ResumeCard>` on the dashboard, the path page, and the course page.
- **FR-PROG-003** (Must, R1) — a dashboard showing percent complete for each active path and each of its courses, replacing the current role/level placeholder.

Also satisfied or completed by this item:

- **FR-PATH-009** (Should, R1) — the *retention* half, which `learning-paths-content` could only guarantee structurally, becomes observable and tested: completing the shared item `what-is-artificial-intelligence` in `/paths/technical-builder/zero-knowledge` leaves it complete in `/paths/executive-non-technical/zero-knowledge`, and the previously-active path stays on the dashboard with its retained percentage (decision #7).
- **NFR-PERF-004** (Must, R1) — "progress update" is named explicitly in this requirement's 500 ms p95 budget; `POST /api/progress` is a single indexed upsert behind one session check.
- **NFR-PERF-006** (Should, R1) — dashboard/progress views load within 2 s for users with up to 50 in-progress items: the dashboard's data comes from a fixed, small number of indexed queries independent of how many items the user has touched (decision #5, AC7).
- **NFR-SCALE-002** (Must, R1) — the index set is chosen for the 100k-user / 5k-item year-one target, and "not started" is deliberately not materialised so the table stays proportional to real engagement rather than to users x items (decision #2, "Prisma schema design").
- **NFR-SEC-004** (broken access control) — every progress read and write is scoped to the session user server-side via `requireUser()`; the API accepts a content-item *slug* and resolves it against published content, so a client cannot write a row against an arbitrary id.
- **NFR-COMP-004 / FR-ACC-007** — progress is personal data, so `GET /api/account/export` gains a `progress` section, and `Progress` cascades on user deletion.
- **NFR-A11Y-002 / -004** — the progress bar is a real `role="progressbar"` with `aria-valuenow`/`aria-valuetext`, every control is a keyboard-operable button with a visible focus ring, and status changes are announced in an `aria-live` region.
- **NFR-MAINT-004** — Playwright coverage for marking content complete, resuming a path, and the dashboard's percentages. This is the "course completion" journey the requirement names, minus the certificate half (R2, FR-CERT).

## Scope

### In scope

- One additive Prisma migration: the `ProgressStatus` enum and the `Progress` model, plus the two virtual back-relation fields on `User` and `ContentItem` (which generate no DDL against those tables).
- `POST /api/progress` — the single write endpoint, with a `view` / `complete` / `reopen` action vocabulary (decision #3).
- A pure, database-free progress computation module (`percent.ts`): course percentage, path percentage, and resume-target selection.
- A progress query module (`queries.ts`) that loads a user's progress rows and assembles the dashboard's active-path view.
- Progress UI: `<ProgressBar>`, `<ProgressStatusBadge>`, `<ProgressControl>`, `<ViewTracker>`, `<CuratedOpenTracker>`, `<ResumeCard>`.
- Progress woven into `/lessons/[slug]`, `/courses/[slug]`, `/paths/[role]/[level]`, and `/dashboard`; `<ContentItemCard>` gains an optional progress prop and a stable anchor id.
- `GET /api/account/export` extended with the user's progress rows.
- Unit/component tests (Vitest + RTL) and three Playwright specs (mark complete, resume, dashboard percentages + FR-PATH-009 retention).
- Docs: `docs/architecture/progress.md` decision record, plus the "never rename a published slug" rule added to the content authoring guide (Risks #1).

### Out of scope (explicitly)

- **FR-PROG-004** (streaks / badges / engagement indicators) — Should, **P2**. Named as out of scope in REQUEST.md and correctly ordered behind R1 Musts per CLAUDE.md's build-order rule. `Progress.lastViewedAt` gives that item the per-day activity signal it will need without any backfill, but nothing computes or displays a streak here.
- **FR-RATE (all)** — no `Rating` model, no stars, no free-text feedback. FR-RATE-008 gates ratings on having started/completed an item, which is exactly what this item makes queryable; that gate is the rating item's to build.
- **FR-CERT (all)** — R2. `Progress.completedAt` is stored (it is free to write now and a backfill later would be impossible to do accurately), but nothing reads it, and no certificate is issued when a course or path reaches 100%.
- **FR-ADMIN-006** (per-path/per-course completion analytics for curators) — R2. `@@index([contentItemId])` makes that query cheap when it lands; no admin surface is built.
- **FR-PATH-010** (user-assembled custom paths) — P2. Progress keys on the content item, not on any path membership, so a future `UserPath` inherits progress for free; nothing here anticipates it further.
- **Denormalized progress summaries, materialized views, or a cache layer** — decision #5. NFR-SCALE-004's caching strategy remains where `learning-paths-content` left it (Risks #4 of that plan), owned by the FR-SEARCH item.
- **A dedicated rate limiter for the progress endpoint** — decision #8 explains why the existing posture is sufficient and what the bounded blast radius is.
- **Re-deciding the stack, auth library, styling, content model, or the file-pack content pipeline** — fixed by the three shipped items.

### Note on size

This is a mid-sized item, materially smaller than `learning-paths-content`. It is one coherent unit: the table without the API writes nothing, the API without the UI is unreachable, and the dashboard is the requirement (FR-PROG-003) that makes the other two visible. If the builder needs a split point in flight, the clean seam is **(A)** tasks 1-9 (schema, migration, lib modules, API, export) and **(B)** tasks 10-37 (UI, tests, docs) — but prefer finishing both on one branch.

## Verification of the `learning-paths-content` "purely additive" claim

That plan's decision #6 and `docs/architecture/content.md` section 6 commit that progress keys on `(userId, contentItemId)` against `String @id @default(cuid())` ids that are "stable across re-imports". Checked against the real code, not taken on trust:

1. **`ContentItem.id` really is stable across imports.** `src/lib/content/import.ts` `applyContentItems()` only ever calls `contentItem.create` (new slug), `contentItem.update` (changed), or an `update` flipping `status`/`retiredAt` — there is no `contentItem.delete`/`deleteMany` anywhere in the module, and `src/lib/content/plan-import.ts` `planContentItems()` emits `retire`, never a delete, for a slug that leaves the pack. Re-importing an unchanged pack is a genuine no-op (`action: "unchanged"` short-circuits before any write). **The claim holds.**
2. **Keying on `contentItemId` rather than on a join row is not just convenient, it is necessary.** `rewriteCourseOrdering()` and `rewritePathOrdering()` in the same file do `courseItem.deleteMany({ where: { courseId } })` / `pathCourse.deleteMany({ where: { pathId } })` and recreate the rows on every course/path *update*. So `CourseItem.id` and `PathCourse.id` **do** rotate on any ordering or metadata edit. A `Progress` row pointing at a `CourseItem` would be orphaned by a routine content edit. Keying on `ContentItem.id` avoids this entirely — and this is the concrete reason decision #6 was right, worth recording because it is not obvious from the schema alone.
3. **The overlap the retention clause depends on genuinely exists in the seed pack.** `what-is-artificial-intelligence` (an `ORIGINAL` item) is referenced by `content/courses/ai-foundations-for-builders.yaml` (in `technical-builder-zero-knowledge`) and by `content/courses/ai-literacy-for-leaders.yaml` (in `executive-non-technical-zero-knowledge`); `responsible-ai-principles` is shared between `advanced-llm-systems` and `ai-governance-and-risk`. One row, two paths. FR-PATH-009's retention is therefore demonstrable against real seeded data, not only assertable in prose.
4. **No existing table needs a column.** `User` and `ContentItem` each gain a `progress Progress[]` back-relation field, which Prisma resolves virtually — the foreign-key columns live on the new `progress` table. The generated SQL is `CREATE TYPE` + `CREATE TABLE` + indexes + two `ALTER TABLE progress ADD CONSTRAINT ... FOREIGN KEY`. Nothing on `user`, `content_item`, or any other existing table is altered or dropped.

**One thing that does not hold up, stated plainly:** the stable identity is the **author-controlled `slug`**, not the file or the title. If a curator renames a published item's slug in `content/`, the importer sees "one slug gone, one slug new" and does exactly what decision #2 tells it to: it retires the old row (preserving its id, and therefore the progress rows pointing at it) and creates a *new* row with a *new* cuid. The learner's progress is not deleted, but it is stranded on a retired item and their percentages silently drop. `docs/architecture/content.md` does not currently say this. This item does not fix it in code (a rename-detection mechanism belongs to the content importer, not here) but does two things about it: adds an explicit "never rename a published slug" rule to `docs/content/authoring-guide.md` (task 37) and records it as Risks #1 for the human, with a recommended follow-up. This is the only respect in which "purely additive" needed a caveat.

## Decisions made by this work item

Bias carried from the three shipped items: solo maintainer, free educational site, low-ops, no new external services, no denormalization without a demonstrated need.

### 1. "In progress" is observed; "complete" is always asserted by the learner — and never inferred

Operationally, per content shape. The axis that matters is `SourceType`, not `ContentFormat`, because it is what determines whether the platform can observe anything:

| Item kind | becomes IN_PROGRESS when… | becomes COMPLETE when… |
| --- | --- | --- |
| `ORIGINAL` lesson (`/lessons/<slug>`) | the lesson page is actually opened in the browser by a signed-in user (`<ViewTracker>` fires one `view` POST on mount) | the learner clicks **Mark complete** at the end of the lesson |
| `CURATED` item (card only, no detail page) | the learner clicks through to the external resource (`<CuratedOpenTracker>` fires a `view` POST on the outbound click, `keepalive: true`, without blocking navigation) | the learner ticks **Mark complete** on the item card |

**Nothing auto-completes.** Rejected: auto-completing short items after a dwell timer or on scroll-to-bottom — any threshold is a guess, and a false "complete" is not cosmetic: it becomes FR-CERT-001/002 certificate eligibility and FR-RATE-008 rating eligibility in later items. A certificate must mean the learner said they finished, not that a page rendered. Rejected: requiring an explicit "start" click as well — it is friction for zero information; opening the lesson is already an unambiguous signal, and the requirement's "in progress" state has to come from somewhere.

For curated items the platform genuinely cannot observe whether the learner read the linked page, so explicit completion is the only honest option — this is the constraint `learning-paths-content` decision #10 recorded in advance ("per-item controls for curated items must live on the card, not on a detail page"), and it is honoured exactly.

**Completion is reversible.** `<ProgressControl>` on a completed item offers **Mark as not complete**, which sets the row back to `IN_PROGRESS` (not to "not started" — the learner demonstrably viewed it) and clears `completedAt`. Mis-clicks happen, and an irreversible flag that later drives certificates is a bad thing to make a learner support-ticket their way out of.

### 2. Three states, two persisted: "not started" is the absence of a row

The Prisma enum is `ProgressStatus { IN_PROGRESS, COMPLETE }`. There is no `NOT_STARTED` value and no row for an untouched item; the read layer (`src/lib/progress/status.ts`) maps `undefined` to the display value `NOT_STARTED`, which is the three-state vocabulary FR-PROG-001 asks for.

Rationale is NFR-SCALE-002, and it is not a micro-optimization: materialising "not started" for the year-one target of 100,000 users x 5,000 content items is 500,000,000 rows that carry no information, and it would additionally require the content importer to fan out a row-per-user on every new content item — turning a content edit into a write against the largest table in the database. With absence-as-not-started the table is proportional to actual engagement (a 50-item learner has 50 rows) and the importer stays completely uninvolved with user data.

Rejected: **a three-value enum with `NOT_STARTED` never written** — a dead enum value is a trap for the next person, who will reasonably assume rows exist in that state and write a query that silently misses everyone. Rejected: **a nullable `completedAt` alone with no status column** (status inferred from `completedAt == null`) — compact, but it cannot distinguish "viewed, not finished" from "never touched" once you also want `lastViewedAt`, and it makes every query a null-check rather than a readable filter.

### 3. One write endpoint, an action vocabulary, addressed by slug

`POST /api/progress`, body `{ contentItemSlug: string, action: "view" | "complete" | "reopen" }`, validated by `src/lib/validation/progress.ts` and guarded by `requireUser()`.

- `view` — upsert: create at `IN_PROGRESS` if absent; if present, bump `lastViewedAt` **only**. It must never downgrade a `COMPLETE` row, which is precisely why the vocabulary is actions rather than a target status (`PUT { status: "IN_PROGRESS" }` would be ambiguous about that).
- `complete` — upsert to `COMPLETE`, stamping `completedAt` only if it is not already set, so re-clicking cannot move the completion date a future certificate will cite.
- `reopen` — `COMPLETE` -> `IN_PROGRESS`, clearing `completedAt`.

Addressed by **slug, not id**: every UI surface already carries slugs (`src/lib/content/routes.ts`), the route resolves the slug against `status: "PUBLISHED"` content and returns 404 otherwise, so a client cannot create a progress row against a draft, retired, or nonexistent item, and no cuid is exposed to the client. Response shape follows the existing convention in `src/app/api/account/profile/route.ts`: `{ success: true, progress: {...} }` / `{ success: false, error: "..." }` with 400/404 status codes.

Rejected: **a Next.js server action** — the codebase's established pattern for client-driven writes is a fetch to a route handler behind Zod (`sign-up-form.tsx`, `path-switcher.tsx`, `delete-account-form.tsx`); introducing a second convention for one feature buys nothing. Rejected: **`PUT /api/progress/[slug]`** — RESTfully tidier, but pushes the "view must not downgrade complete" rule into the client's choice of body, which is where it will eventually be got wrong.

### 4. Automatic "in progress" is recorded by a client beacon on mount, never by a write during server render

`<ViewTracker>` is a tiny client component that renders nothing and POSTs `{ action: "view" }` once in an effect. The obvious alternative — calling the upsert directly inside the `/lessons/[slug]` server component — is **wrong here for a specific, checkable reason**: these routes are `export const dynamic = "force-dynamic"`, and Next.js `<Link>` prefetching fetches the RSC payload for dynamic routes on hover/viewport entry in production. Every lesson title on a path page is a `<Link>`. A server-render write would therefore mark items "in progress" that the learner merely scrolled past, which corrupts exactly the data FR-PROG-003's percentages and FR-PROG-002's resume target are computed from. Secondary reasons: RSC renders can be retried, so a write during render is not once-only; and a side-effecting GET is a posture the auth item deliberately avoided.

Rejected: **middleware-based view tracking** — `src/middleware.ts` documents at length that the Edge runtime cannot call Prisma, so this is not available even in principle. Rejected: **an `<img>` / `sendBeacon` pixel** — same effect as the fetch, but with no error handling and no way to reflect the new status in the UI without a refresh.

The tracker fails silently (a failed beacon must never surface an error to a learner reading a lesson) and is only rendered when a session exists, so anonymous browsing writes nothing.

### 5. Percentages and resume targets are computed at read time; nothing is denormalized

`learning-paths-content` note #8 already established that a course's and a path's estimated duration are summed from their items at read time "so it cannot drift out of sync". Progress percentage follows the same precedent, and the argument is *stronger* here because a stored percentage has two independent drift sources rather than one: the learner's own completions, and content-pack imports that change the denominator. A denormalized `percentComplete` would mean every `npm run content:import` that adds an item to a course has to recompute a column for every user who has touched that course — a 100k-user backfill triggered by a routine content edit, which is exactly the "without redesign" scalability NFR-SCALE-002 is asking for.

Concretely (`src/lib/progress/percent.ts`, pure, no Prisma, unit-tested without a database — the same split `plan-import.ts` uses):

- **Denominator** = the items *currently* published in the course/path, i.e. exactly what `src/lib/content/queries.ts` already returns (it filters `status: "PUBLISHED"` at every level). Retired items therefore drop out of both numerator and denominator; a learner who completed an item that was later retired does not get punished for it, and their history row survives (content decision #2).
- **Path percentage de-duplicates by `contentItemId`** across the path's courses, so an item appearing in two courses of the same path is counted once and the percentage can never exceed 100.
- **Rounding is honest at the ends**: 0% only when nothing is complete, 100% only when every item is complete; anything in between clamps to 1-99. A path showing "100%" must mean finished, because FR-CERT will read that meaning later.
- **Empty course or path** = 0% with a "no items yet" label rather than a divide-by-zero.

Rejected: **a `CourseProgress`/`PathProgress` summary table maintained on every mark-complete** — faster dashboard reads, but needs transactional maintenance on two independent write paths (the user's and the importer's), and is wrong from the instant a course gains an item until a backfill runs. Rejected: **a Postgres materialized view** — same staleness problem plus a refresh job and operational surface this project deliberately does not have. If the dashboard ever gets slow, the right first move is caching (NFR-SCALE-004), not denormalization, and that decision already has an owner (the FR-SEARCH item).

### 6. Resume is positional within a path; `lastViewedAt` orders *which paths* to show, not *where* to land

`findResumeTarget()` flattens a path into `courses[].position` then `items[].position` order, de-duplicates by content item, and returns **the first entry that is not `COMPLETE`**. All complete -> a "path complete" state. Nothing started -> the first item, labelled **Start** rather than **Resume**. The same function, applied to a single course, gives FR-PROG-002's "or course" half.

Why positional rather than "the most recently viewed incomplete item"? Because a path is a *curated ordered curriculum* (FR-PATH-001), so "where they left off" means the front of the unfinished part. A most-recently-viewed cursor would send a learner who idly clicked ahead to item 12 back to item 12 instead of to item 3, which is the item they actually need next — and it is non-deterministic to test. Positional resume is deterministic, needs no extra state, and is the behaviour that survives a learner exploring out of order.

`lastViewedAt` is still stored on every row, and is used for three things it is genuinely needed for: ordering the dashboard's *list of active paths* by recency, giving FR-PROG-004 (P2) the per-day activity signal a streak needs without a later backfill, and FR-ADMIN-006's drop-off analytics (R2). Rejected: **a `lastViewedContentItemId` cursor column on `User`** — a second source of truth for something derivable, and it breaks the moment the item it points at is retired. Rejected: **no `lastViewedAt` at all** — then "which paths are active, most recent first" has nothing to sort by, and FR-PROG-004 would need a data backfill that is impossible to reconstruct after the fact.

Resume link target: `/lessons/<slug>` for an `ORIGINAL` item; for a `CURATED` item (no detail page) it links to `/courses/<courseSlug>#item-<itemSlug>`, so the learner lands in the app on the card that holds the outbound link and the completion control, rather than being thrown straight out to a third-party site. This requires `<ContentItemCard>` to render a stable `id="item-<slug>"`.

### 7. FR-PATH-009 "just works" — this item demonstrates it rather than building for it

Switching role/level writes only `User.roleArchetype`/`User.level` via the existing `PATCH /api/account/profile`; it touches no progress row and needs no new code. An item shared by two paths is one `ContentItem` row (verified above), so a `Progress` row on it is simultaneously progress in every path that contains it. Two things make this observable rather than merely true:

1. **e2e** (`e2e/progress-dashboard.spec.ts`): complete `what-is-artificial-intelligence` in `/paths/technical-builder/zero-knowledge`, switch to Executive / Non-Technical - Zero Knowledge, and assert the item already reads **Complete** there and that the new path's percentage already reflects it.
2. **The dashboard keeps showing previously-active paths.** "Active path" = the user's current role/level path, **plus** any other path containing at least one of the user's progress rows, ordered by the most recent `lastViewedAt` among its items (current path always first; other paths capped at 5, which at R1's six paths is effectively uncapped). So after switching, the learner *sees* their old path with its retained percentage instead of it silently vanishing — retention as a visible product behaviour, not just a schema property.

Rejected: **keying progress on `(userId, pathId, contentItemId)`** — it would make the same completion count separately per path, which is the precise behaviour FR-PATH-009 forbids, and multiplies row count by path membership. Rejected: **an `activePathId` column on `User`** — role plus level already determine the current path (`Path` carries `@@unique([roleArchetype, level])`), and a second, redundant pointer is a consistency bug waiting to happen.

### 8. No new rate limiter for `POST /api/progress`, and here is the bounded blast radius

The existing rate limiting is Better Auth's, scoped to auth routes (`RateLimit` table, `src/lib/auth/options.ts`). This endpoint gets none, deliberately: the write is idempotent, self-scoped by `requireUser()`, sends no mail, costs no third-party call, and is bounded above by one row per (user, published content item) — roughly 5,000 rows per user at the NFR-SCALE-002 target, i.e. a bounded table rather than unbounded growth, and only for an authenticated account. Adding a limiter would mean either extending Better Auth's config to non-auth routes or writing a second limiter, both of which are more surface than the risk justifies at R1. Recorded as Risks #4 with the trigger that would change the answer.

### 9. Progress is personal data, so it goes in the account export and cascades on delete

`Progress.userId` is `onDelete: Cascade`, so `prisma.user.delete` (the existing account-deletion route) removes progress with no extra code — and the e2e teardown's `user.deleteMany` by test-email domain keeps working unchanged. `GET /api/account/export` gains a `progress` array (item slug, title, status, timestamps) because FR-ACC-007/NFR-COMP-004 promise the user's data, and "what I have completed" is unambiguously theirs. The export deliberately carries the item **slug and title**, not the cuid, so the file is meaningful to a human reading it.

## Prisma schema design

Appended to `prisma/schema.prisma` after the learning-paths-content block, with a header comment in the file's established style.

New enum:

```prisma
enum ProgressStatus {
  IN_PROGRESS
  COMPLETE
}
```

Two values only — "not started" is the absence of a row (decision #2).

New model:

```prisma
model Progress {
  id            String         @id @default(cuid())
  userId        String
  contentItemId String
  status        ProgressStatus @default(IN_PROGRESS)
  lastViewedAt  DateTime       @default(now())
  completedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  contentItem ContentItem @relation(fields: [contentItemId], references: [id], onDelete: Cascade)

  @@unique([userId, contentItemId])
  @@index([userId, lastViewedAt])
  @@index([contentItemId])
  @@map("progress")
}
```

Field notes:

- `createdAt` **is** the "started at" timestamp — no separate column, since a row only ever comes into existence at the moment of first view (decision #1).
- `completedAt` is nullable and stamped once (decision #3); it is written now and read by nobody until FR-CERT, because it cannot be reconstructed later.
- `lastViewedAt` defaults to `now()` and is bumped by every `view` action; its uses are enumerated in decision #6.

Index rationale, sized for NFR-SCALE-002's 100,000 users / 5,000 items:

- `@@unique([userId, contentItemId])` — the natural key and the workhorse. It enforces one row per user per item (so the upsert is a single indexed statement with no read-then-write race), and its leftmost `userId` prefix is also the index that serves "load all progress for this user", which is the only read the dashboard, path page, course page, and lesson page ever need.
- `@@index([userId, lastViewedAt])` — orders the dashboard's active-path list by recency (decision #6) and is the index FR-PROG-004's streak query will want.
- `@@index([contentItemId])` — Postgres does not index the referencing side of a foreign key automatically, so without this both the cascade check on content-item deletion and FR-ADMIN-006's future "completion rate for this item" become sequential scans over the largest table in the database.
- **Considered and deliberately omitted: `@@index([userId, status])`.** The `userId` prefix of the unique index already narrows to one learner's rows — tens, not thousands — after which filtering by status is a trivial heap filter. A fourth index would add write amplification to the one endpoint NFR-PERF-004 puts a 500 ms budget on, in exchange for nothing measurable. Noted here so a future reader knows it was a choice, not an oversight.

Back-relations added to existing models (**virtual — they generate no DDL against `user` or `content_item`**):

- `User`: `progress Progress[]`
- `ContentItem`: `progress Progress[]`

Migration: one migration, `npx prisma migrate dev --name add_progress_tracking`. The generated SQL must contain only `CREATE TYPE "ProgressStatus"`, `CREATE TABLE "progress"`, its three index statements, and two `ALTER TABLE "progress" ADD CONSTRAINT ... FOREIGN KEY` statements. It must contain **no** `DROP`, and no `ALTER TABLE` against `user`, `session`, `account`, `verification`, `rateLimit`, `path`, `course`, `path_course`, `course_item`, `content_item`, `content_item_version`, `topic`, `glossary_term`, or `role_profile`. Task 2 verifies this by reading the file.

Explicitly **not** added: any `Rating`, `Certificate`, `Streak`, `Badge`, or `Bookmark` model; any denormalized percentage column on `Course`, `Path`, or `User`; any `activePathId` on `User`; any progress-related column on a content table.

## Tasks

Ordered so each is independently completable. Paths are relative to the project root `C:\Users\amitn\MyAIprojects\AI Learning Platform`.

### Schema and data model

1. - [x] `prisma/schema.prisma`: append the `ProgressStatus` enum and the `Progress` model exactly as specified in "Prisma schema design", preceded by a header comment block matching the file's existing style — stating that this is the progress-tracking work item, that "not started" is deliberately the absence of a row (decision #2), that keying on `ContentItem.id` rather than `CourseItem.id` is required because the importer rotates join-row ids (see the verification section), and that no rating/certificate/streak model is added. Add the `progress Progress[]` back-relation to `User` (next to `sessions`/`accounts`/`verifications`) and to `ContentItem` (next to `courses`/`versions`).
2. - [x] `prisma/migrations/**` (new): commit the migration from `npx prisma migrate dev --name add_progress_tracking`. Read the generated `migration.sql` and confirm it matches the allow-list in "Prisma schema design" — no `DROP`, no `ALTER` against any pre-existing table.

### Library modules

3. - [x] `src/lib/validation/progress.ts` (new): `progressActionSchema` — a Zod object with `contentItemSlug` (trimmed, 1-200 chars, slug-shaped: lowercase alphanumerics and hyphens, must start with an alphanumeric) and `action` (`z.enum(["view", "complete", "reopen"])`). Follows the conventions in `src/lib/validation/account.ts` (trim, length cap, explicit messages). Export `ProgressActionInput`.
4. - [x] `src/lib/progress/status.ts` (new): the display vocabulary FR-PROG-001 names. `export type DisplayProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE"`, `PROGRESS_STATUS_LABELS` ("Not started" / "In progress" / "Complete"), and `displayStatusFor(row | undefined): DisplayProgressStatus` implementing absence-as-not-started (decision #2). Single source of truth for every label and badge in the app.
5. - [x] `src/lib/progress/percent.ts` (new): pure, no Prisma import, so it is unit-testable without a database (mirrors `src/lib/content/plan-import.ts`). Exports `computeCourseProgress(items, progressByItemId)` and `computePathProgress(courses, progressByItemId)` returning `{ completedCount, totalCount, percent }` with the de-duplication, retired-exclusion, and 0/100 honesty rules from decision #5; and `findResumeTarget(courses, progressByItemId)` returning a discriminated union — `{ kind: "start" | "resume", item, course }`, `{ kind: "complete" }`, or `{ kind: "empty" }` — per decision #6. Input types are minimal structural interfaces (id, slug, title, sourceType, position), not Prisma types, so tests can build fixtures by hand.
6. - [x] `src/lib/progress/mutations.ts` (new): `recordView`, `markComplete`, `reopen`, each taking `{ userId, contentItemId }` and implementing decision #3's semantics — `recordView` upserts with `create: { status: IN_PROGRESS }` and `update: { lastViewedAt }` only (never touching `status`, so it cannot downgrade `COMPLETE`); `markComplete` upserts to `COMPLETE` and sets `completedAt` only when currently null; `reopen` updates to `IN_PROGRESS` and nulls `completedAt`. Also `resolvePublishedContentItemBySlug(slug)` returning `{ id, slug, sourceType }` or null, filtered to `status: "PUBLISHED"`. Kept out of the route handler so it is unit-testable with a mocked Prisma client, matching `src/lib/auth/__tests__/options.test.ts`.
7. - [x] `src/lib/progress/queries.ts` (new): the only place routes read progress from, mirroring `src/lib/content/queries.ts` and wrapped in React `cache()`. `getProgressMapForUser(userId)` returning a `Map` from contentItemId to `{ status, lastViewedAt, completedAt }` (one indexed `findMany`); `listActivePathsForUser(user, progressMap)` implementing decision #7's current-path-plus-touched-paths rule in one join query (`pathCourse` -> `course` -> `items` filtered by `contentItemId in [...]`), ordered by recency, capped at 5; and `getDashboardProgress(user)` composing the two plus `getPathForRoleLevel` from the content queries. Must issue a fixed number of queries independent of item count — no per-item or per-course query (NFR-PERF-006).

### API

8. - [x] `src/app/api/progress/route.ts` (new): `POST` — `requireUser()`, parse JSON (400 "Invalid JSON body" on failure, matching `src/app/api/account/profile/route.ts` verbatim), `progressActionSchema.safeParse` (400 with the first issue message), `resolvePublishedContentItemBySlug` (404 `{ success: false, error: "Content item not found" }`), dispatch to the matching mutation, return `{ success: true, progress: { status, lastViewedAt, completedAt } }`. No other HTTP method is exported.
9. - [x] `src/app/api/account/export/route.ts`: add a third parallel query fetching the user's progress rows with `contentItem: { select: { slug: true, title: true } }`, and add a `progress` array to `exportPayload` shaped `{ slug, title, status, startedAt: createdAt, lastViewedAt, completedAt }` (decision #9). Do not add any content-item id to the payload. Update the route's header comment.

### Components

10. - [ ] `src/components/progress/progress-bar.tsx` (new, server): accessible percentage bar — an outer element with `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={percent}`, an `aria-valuetext` of the form "3 of 8 items complete (38%)", and an accessible name from a required `label` prop. Visual fill uses the existing `--color-primary`/`--color-border` tokens. Renders a "No items yet" variant at `totalCount === 0` (decision #5).
11. - [ ] `src/components/progress/progress-status-badge.tsx` (new, server): a small chip rendering `PROGRESS_STATUS_LABELS[status]` from task 4, with distinct token-based styling per state and no reliance on colour alone (the text is the signal). Renders nothing for `NOT_STARTED` on anonymous views.
12. - [ ] `src/components/progress/progress-control.tsx` (new, client): the FR-PROG-001 completion control. A single button — **Mark complete** when not complete, **Mark as not complete** when complete (decision #1) — that POSTs `/api/progress` with `complete`/`reopen`, applies the new state optimistically, reverts and shows an inline error on failure, disables while pending, announces the result in an `aria-live="polite"` region, and calls `router.refresh()` on success so server-rendered percentages update. Follows the conventions in `src/components/content/path-switcher.tsx` and `src/components/account/delete-account-form.tsx`. Accepts `{ contentItemSlug, contentItemTitle, initialStatus }` and includes the item title in the button's accessible name so a list of them is not a row of identical "Mark complete" buttons for a screen-reader user.
13. - [ ] `src/components/progress/view-tracker.tsx` (new, client): renders `null`; fires exactly one `POST /api/progress` with `{ action: "view" }` in a mount effect, guarded against React strict-mode double-invocation with a ref. Swallows every error (decision #4). Documents in a comment why this is a client beacon rather than a server-render write (`<Link>` prefetch of dynamic routes).
14. - [ ] `src/components/progress/curated-open-tracker.tsx` (new, client): wraps the curated card's outbound `<ExternalLink>` in a span with an `onClick` that fires the same `view` beacon with `fetch(..., { keepalive: true })` and does **not** call `preventDefault`, so navigation is never blocked or delayed. Deliberately wraps rather than modifying `src/components/content/external-link.tsx`, which stays a pure server component with no progress knowledge.
15. - [ ] `src/components/progress/resume-card.tsx` (new, server): FR-PROG-002. Takes a `findResumeTarget` result and renders one of four states — **Start the path** (nothing begun), **Resume: <item title>** with the course name as context, **Path complete** with a link back to the path, or nothing when the path is empty. The link target follows decision #6 (`/lessons/<slug>` for original, `/courses/<courseSlug>#item-<slug>` for curated). Used by the dashboard, the path page, and the course page.
16. - [ ] `src/components/content/content-item-card.tsx`: add an optional `progress?: { status: DisplayProgressStatus }` prop and an optional `showControl?: boolean`. When `progress` is supplied render `<ProgressStatusBadge>` next to the sample-content badge; when the item is `CURATED` and `showControl` is set, wrap the existing external-link paragraph in `<CuratedOpenTracker>` and render `<ProgressControl>` beneath it (decision #1 and content decision #10). Original items get the badge here but **not** the control — theirs lives at the end of the lesson. Add an `id` of the form `item-<slug>` to the `<li>` so the resume deep-link from task 15 has an anchor. Every existing call site keeps working unchanged when the new props are omitted.

### Routes

17. - [ ] `src/app/lessons/[slug]/page.tsx`: call `getCurrentUser()`; when signed in, load this item's progress row, render `<ViewTracker>` and, after the Markdown body and before the previous/next nav, a completion section with `<ProgressStatusBadge>` and `<ProgressControl>`. When anonymous, render a single muted line linking to `/sign-in?next=/lessons/<slug>` explaining that signing in tracks progress. No other behaviour changes.
18. - [ ] `src/app/courses/[slug]/page.tsx`: call `getCurrentUser()` (this page does not currently) and, when signed in, `getProgressMapForUser`. Render a `<ProgressBar>` for the course beneath the existing duration line, a `<ResumeCard>` scoped to this course, and pass `progress` plus `showControl` into every `<ContentItemCard>`. Anonymous rendering is what it is today apart from the sign-in hint.
19. - [ ] `src/app/paths/[role]/[level]/page.tsx`: reuse the `user` it already fetches; when signed in, load the progress map, render a path-level `<ProgressBar>` and `<ResumeCard>` above the course list, a per-course `<ProgressBar>` inside each `<section>` next to `<CourseSummary>`, and pass `progress` plus `showControl` into every `<ContentItemCard>`. Do not add a second `getCurrentUser()` call.
20. - [ ] `src/app/(app)/dashboard/page.tsx`: FR-PROG-003 — replace the placeholder path card with a real progress view. Keep the verify-email banner, greeting, and role/level list. For each active path from `getDashboardProgress` (current path first, then retained paths per decision #7): the path title linking to the path page, a path `<ProgressBar>`, a per-course `<ProgressBar>` list, and a `<ResumeCard>`; retained (non-current) paths are visually distinguished and labelled as previously-followed so the FR-PATH-009 retention reads as intentional. Keep `<PathSwitcher>`. Preserve the existing `NOT_SURE_YET` / no-path branch, which now also states that progress will appear once they start a path.

### Tests — unit and component

21. - [ ] `src/lib/validation/__tests__/progress.test.ts` (new): the action enum rejects an unknown action; a missing or empty `contentItemSlug` is rejected; an over-length slug is rejected; a slug containing a path traversal or uppercase characters is rejected; a valid payload parses to the expected shape.
22. - [ ] `src/lib/progress/__tests__/status.test.ts` (new): `displayStatusFor(undefined)` is `NOT_STARTED`; the two persisted values map through unchanged; every `DisplayProgressStatus` has a label in `PROGRESS_STATUS_LABELS`.
23. - [ ] `src/lib/progress/__tests__/percent.test.ts` (new): course percentage for none/some/all complete; an item shared between two courses of the same path is counted **once** in the path percentage; an empty course returns zero counts without dividing by zero; a partially complete course never rounds up to 100 and a partially started one never rounds down to 0; `findResumeTarget` returns `kind: "start"` on the first item when nothing is started, `kind: "resume"` on the **first non-complete item in course-then-item order** even when a later item was completed first, `kind: "complete"` when everything is complete, and `kind: "empty"` for a path with no items; and a 50-item / 8-course fixture produces the right numbers (the NFR-PERF-006 shape).
24. - [ ] `src/lib/progress/__tests__/mutations.test.ts` (new, mocked Prisma): `recordView` on an existing `COMPLETE` row updates `lastViewedAt` and **does not** include `status` in the update payload; `recordView` on a missing row creates at `IN_PROGRESS`; `markComplete` stamps `completedAt` when null and leaves an existing `completedAt` untouched on a repeat call; `reopen` sets `IN_PROGRESS` and nulls `completedAt`; `resolvePublishedContentItemBySlug` queries with `status: "PUBLISHED"` and returns null for an unknown slug.
25. - [ ] `src/lib/progress/__tests__/queries.test.ts` (new, mocked/counting Prisma): NFR-PERF-006 as an automated assertion — `getDashboardProgress` for a user with 50 progress rows spread across 8 courses issues a **fixed** number of Prisma calls (assert the exact count), with no call made per item or per course, and `getProgressMapForUser` issues exactly one `findMany` filtered by `userId`.
26. - [ ] `src/app/api/__tests__/progress.test.ts` (new, node vitest environment, following `src/app/api/account/__tests__/export.test.ts`'s mocking style): malformed JSON returns 400 with the standard message; an invalid action returns 400; an unknown or unpublished slug returns 404 and calls no mutation; each of the three valid actions dispatches to the matching mutation with the session user's id (never an id taken from the request body); the success response shape matches the convention.
27. - [ ] `src/components/progress/__tests__/progress-control.test.tsx` (new, RTL + user-event): the button's accessible name includes the item title; clicking POSTs `/api/progress` with the `complete` action (fetch mocked) and the label flips optimistically; clicking again sends `reopen`; a failed request reverts the label and shows an inline error; the control is disabled while pending; the result is announced in an `aria-live` region.
28. - [ ] `src/components/progress/__tests__/progress-bar.test.tsx` (new, RTL): renders `role="progressbar"` with correct `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, an `aria-valuetext` naming the counts, and an accessible name from `label`; the zero-item variant renders the "no items yet" text and no bar. Also covers `<ProgressStatusBadge>`: each display status renders its label text (not colour alone).
29. - [ ] `src/components/progress/__tests__/resume-card.test.tsx` (new, RTL): the `start` state reads "Start"; the `resume` state names the item and links to `/lessons/<slug>` for an original item and to the course anchor for a curated one; the `complete` state renders the completion message and no resume link; the `empty` state renders nothing.
30. - [ ] `src/components/content/__tests__/content-item-card.test.tsx`: extend for task 16 — a card with `progress` renders the matching status badge; a curated card with `showControl` renders the completion control and an original card with `showControl` does not; a card with no `progress` prop renders exactly as before (guarding the anonymous path); the `<li>` carries the `item-<slug>` id.

### Tests — e2e (Playwright)

31. - [ ] `e2e/helpers/db.ts`: add `findProgressForEmail(email)` returning the user's progress rows joined to content-item slugs, for assertions the UI does not expose. Add a comment confirming that `cleanupTestUsers()` needs no change because `Progress.userId` cascades — and that the teardown must still never touch content rows.
32. - [ ] `e2e/progress-complete.spec.ts` (new): FR-PROG-001. Register and onboard as Technical Builder / Zero Knowledge; open `/paths/technical-builder/zero-knowledge` and assert the first item reads **Not started**; open the original lesson `what-is-artificial-intelligence`; return to the path and assert it now reads **In progress** (the auto-view path); click **Mark complete** on the lesson and assert the badge, then reload and assert it persists; assert via `findProgressForEmail` that exactly one row exists with `status = COMPLETE` and a non-null `completedAt`; finally mark it not complete and assert it returns to **In progress**. Also complete a **curated** item from its card to cover the no-detail-page control path, and assert an anonymous visit to the same path renders no controls.
33. - [ ] `e2e/progress-resume.spec.ts` (new): FR-PROG-002. With a fresh user, assert the dashboard offers **Start the path** pointing at the path's first item; complete the first item; assert the dashboard's resume entry now names the **second** item and that following it lands on that item's page or anchor; complete every item in the first course and assert the resume target advances into the second course; complete the whole path and assert the dashboard shows the path-complete state with no resume link.
34. - [ ] `e2e/progress-dashboard.spec.ts` (new): FR-PROG-003 plus FR-PATH-009. Complete a known number of items and assert the dashboard's path and per-course percentages are the exact expected integers (and that the progressbar's `aria-valuenow` matches the visible text); then switch to Executive / Non-Technical - Zero Knowledge via the switcher, assert the shared item `what-is-artificial-intelligence` already reads **Complete** in the new path and is counted in its percentage, and assert the previously-followed Technical Builder path is still listed on the dashboard with its retained percentage.
35. - [ ] `e2e/account-data.spec.ts`: extend the existing export assertion — after completing one item, the downloaded export JSON contains a `progress` entry for that item's slug with `status: "COMPLETE"`, and still contains no password or token field.

### Docs

36. - [ ] `docs/architecture/progress.md` (new): decision record in the style of `docs/architecture/auth.md` and `docs/architecture/content.md` — decisions #1-#9 with their rejected alternatives, the `Progress` schema and the index rationale (including the omitted `[userId, status]` index), the FR/NFR mapping, the verification of `learning-paths-content` decision #6 including the join-row-id-rotation finding, and an explicit statement of what FR-CERT and FR-RATE inherit (`completedAt` is authoritative for certificate issuance; FR-RATE-008's "has started/completed" gate is `Progress` row existence and `status = COMPLETE`).
37. - [ ] `docs/content/authoring-guide.md`, `docs/architecture/content.md`, `README.md`: add the **"never rename a published item slug"** rule to the authoring guide with the reason (a rename retires the old row and creates a new id, stranding every learner's progress on the retired item) and the safe procedure if a rename is unavoidable; add a one-line cross-reference to `docs/architecture/progress.md` in content.md section 6 noting the commitment was honoured; add a short progress section to the README's feature list.

## New manual provisioning steps (human-only)

**None.** This item introduces no new environment variable, no new external service, no new account, and no new build or deploy step. It adds one Prisma migration, which the existing `npm run prisma:deploy` step already covers, and one API route inside the existing Next.js app. The read-time percentage decision (#5) was chosen partly for this reason: a denormalized alternative would have needed a one-off backfill script run against production, which is exactly the kind of manual step this project avoids. Confirmed as true rather than assumed — see Risks #5 for the one thing that would change the answer.

## Acceptance criteria

1. For every content item a signed-in user sees, the system shows one of exactly three states — **Not started**, **In progress**, **Complete** — where "not started" is the absence of a `Progress` row and the other two are persisted values of `ProgressStatus`. Opening an original lesson moves it to **In progress** without any further action; clicking through to a curated resource does the same; nothing ever reaches **Complete** without an explicit click, and **Complete** can be reversed back to **In progress**. _(FR-PROG-001, decisions #1 and #2)_
2. `POST /api/progress` accepts `{ contentItemSlug, action }` for `view`/`complete`/`reopen` only, always scopes the write to the session user (never to an id supplied by the client), returns 400 for malformed JSON or a schema violation and 404 for a slug that is not published, and a `view` action never downgrades an already-complete row. _(FR-PROG-001, NFR-SEC-004, decision #3)_
3. Automatic "in progress" is recorded by a client-side beacon on mount, not by a write during server render: no Prisma write occurs anywhere in a page component's render path, so hovering a lesson link (which prefetches the dynamic route) creates no progress row. _(decision #4)_
4. The dashboard shows, for the user's current path and for every path they have previously made progress in, the path's percent complete and each of its courses' percent complete, computed from published items only, de-duplicated across courses, reading 0% only when nothing is complete and 100% only when everything is. _(FR-PROG-003, decision #5)_
5. The dashboard, the path page, and the course page each offer a resume entry point that links to the first item in authored order that is not complete — labelled "Start" when nothing has begun, naming the item when resuming, and replaced by a completion message when everything is done. Following it lands the learner on that item's lesson page, or on its card's anchor within the course page when the item is curated. _(FR-PROG-002, decision #6)_
6. Completing an item that appears in two paths leaves it complete in both, counted in both percentages, with a single `Progress` row and a single `ContentItem` id; switching role/level via the existing switcher creates, deletes, and modifies no progress row; and the previously-followed path remains visible on the dashboard with its retained percentage. _(FR-PATH-009, decision #7)_
7. The dashboard's progress data is assembled with a fixed number of Prisma queries that does not grow with the number of items, courses, or progress rows — asserted automatically for a 50-in-progress-item user — and the page loads in under 2 seconds against that data. _(NFR-PERF-006, NFR-PERF-004)_
8. `prisma/schema.prisma` gains exactly one enum and one model; the generated migration contains no `DROP` statement and no `ALTER TABLE` against any table that existed before this item, and applies cleanly on top of the auth and content migrations. `Progress` carries `@@unique([userId, contentItemId])`, `@@index([userId, lastViewedAt])`, and `@@index([contentItemId])`. _(NFR-SCALE-002, scope discipline)_
9. Deleting an account removes that user's progress rows via the database-level cascade with no application code involved, and `GET /api/account/export` includes a `progress` array carrying item slug, title, status, and timestamps — and still contains no password hash and no session or verification token. _(FR-ACC-007, NFR-COMP-004, decision #9)_
10. Every progress affordance is keyboard-operable with a visible focus ring; the percentage bar is a real `role="progressbar"` whose `aria-valuenow` and `aria-valuetext` agree with the visible text; status changes are announced in an `aria-live` region; and the pages remain usable at 375px, 768px, and 1280px. _(NFR-A11Y-002, NFR-A11Y-004)_
11. Anonymous visitors can still read `/paths`, `/courses`, and `/lessons` routes in full, see no progress controls, cause no progress write, and are offered a sign-in link that returns them to the page they were on. _(FR-ACC-008)_
12. `prisma/schema.prisma` contains no `Rating`, `Certificate`, `Streak`, `Badge`, or `Bookmark` model, and no stored percentage column anywhere. _(scope discipline, FR-PROG-004 deferred to P2)_
13. `docs/architecture/progress.md` records the nine decisions with their rejected alternatives and states what FR-CERT and FR-RATE inherit; `docs/content/authoring-guide.md` states the never-rename-a-published-slug rule and why. _(NFR-MAINT-005, Risks #1)_
14. `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`, and `npm run test:e2e` all pass locally, and both CI jobs stay green — including `build-and-test`, which builds against a placeholder `DATABASE_URL` and must not attempt to prerender any progress-bearing route. _(NFR-MAINT-004)_

## Test plan

| What | Type | Maps to |
| --- | --- | --- |
| `progressActionSchema`: unknown action, empty/over-long/malformed slug, valid payload | Unit (Vitest) — `validation/progress.test` | AC2 |
| Absence-as-not-started mapping and label completeness | Unit (Vitest) — `progress/status.test` | AC1 |
| Course/path percentages, shared-item de-duplication, empty course, 0/100 honesty, 50-item fixture | Unit (Vitest) — `progress/percent.test` | AC4, AC6, AC7 |
| Resume target: start / first-non-complete-in-order / all-complete / empty | Unit (Vitest) — `progress/percent.test` | AC5 |
| `recordView` never downgrades COMPLETE; `completedAt` stamped once; `reopen` clears it; published-only slug resolution | Unit (Vitest, mocked Prisma) — `progress/mutations.test` | AC1, AC2 |
| Dashboard query count is fixed for a 50-item user; no per-item/per-course query | Unit (Vitest, counting Prisma) — `progress/queries.test` | AC7 |
| `POST /api/progress`: 400 bad JSON, 400 bad action, 404 unknown slug, session-scoped dispatch, response shape | Unit (Vitest, node env) — `api/progress.test` | AC2, AC11 |
| `<ProgressControl>`: accessible name, optimistic flip, reopen, failure revert, pending state, live region | Component (RTL + user-event) — `progress-control.test` | AC1, AC10 |
| `<ProgressBar>` ARIA values and zero-item variant; `<ProgressStatusBadge>` label text | Component (RTL) — `progress-bar.test` | AC10 |
| `<ResumeCard>` four states and the original vs curated link target | Component (RTL) — `resume-card.test` | AC5 |
| `<ContentItemCard>`: badge per status, control on curated only, unchanged without the prop, anchor id | Component (RTL) — `content-item-card.test` | AC1, AC5, AC11 |
| Mark complete end to end: not started to auto in progress to complete to persisted to reopened; curated item too | E2E — `progress-complete.spec.ts` | AC1, AC2, AC3 |
| Resume advances item by item and course by course; path-complete state | E2E — `progress-resume.spec.ts` | AC5 |
| Dashboard percentages are exact; FR-PATH-009 shared item stays complete across a switch; old path retained | E2E — `progress-dashboard.spec.ts` | AC4, AC6 |
| Account export contains the progress entry and still leaks no secret | E2E — `account-data.spec.ts` | AC9 |
| Migration applies over the auth + content schema and alters no pre-existing table | CI (`prisma migrate deploy`) + reading `migration.sql` | AC8 |
| Account deletion removes progress rows via cascade | E2E (existing delete spec + `findProgressForEmail`) | AC9 |
| Anonymous browse of a path/course/lesson writes no progress row and shows no controls | E2E (assertion inside `progress-complete.spec.ts`) | AC11 |
| Dashboard wall-clock load with ~50 in-progress items seeded | Manual (before ship, dev tools / Vercel timing) | AC7 |
| Keyboard-only walkthrough of mark complete + resume; 375/768/1280 responsive check | Manual (before ship) | AC10 |
| Hovering lesson links on a path page creates no progress rows (prefetch check) | Manual (prod build, watch the `progress` table) | AC3 |

Notes: the e2e suite already imports the content pack via `e2e/global-setup.ts` and cleans up only test-domain users in `e2e/global-teardown.ts` — neither needs a change, because `Progress.userId` cascades on user deletion (task 31 records this). The unit tests never touch a database: `percent.ts` is pure by design and `mutations.ts`/`queries.ts` are tested against a mocked client, which is the whole reason the computation is split out of the query module. The prefetch check (AC3) is manual because asserting the *absence* of a network-triggered write is unreliable in Playwright; the design that makes it true (decision #4) is the real control, and the manual check is the confirmation.

## Risks / open questions

Answered by the human before build (recorded here, not open):

1. **Slug renames** — accepted: document a "don't rename published slugs" authoring rule (task 37) rather than building importer rename-mapping support now. Consistent with the solo-maintainer, low-ops bias this project has followed throughout; a rename-mapping flag remains the natural upgrade if this ever becomes a real problem.
2. **Dashboard scope** — accepted: show the user's current path plus up to 5 previously-followed paths with retained percentages (decision #7), rather than a strict single-active-path view. Makes FR-PATH-009's retention promise visible, not just true.
3. **`POST /api/progress` rate limiting** — accepted: no rate limiter for R1 (decision #8). Bounded blast radius (a signed-in user can only ever write rows for themselves) makes this an acceptable R1 tradeoff; extend the existing Better Auth rate-limit config to this route later if abuse or gaming ever appears, rather than building a second limiter now.

Flagged for the human. These do not block the build, but confirm before ship:

4. **"In progress" for a curated item means "clicked the link", which is a weak signal.** The learner may have bounced off the external page in two seconds. This is unavoidable — the platform cannot observe a third-party site (NFR-COMP-001 means we never proxy or rehost it) — and it is why completion for curated items is always explicit. Worth knowing before FR-ADMIN-006's analytics treat "in progress" as engagement: for curated items it means "opened", nothing more.

Lower-stakes notes (no answer needed):

5. **Obligations this item creates for later work items**, recorded so they are not surprises: FR-CERT should treat `Progress.completedAt` as the authoritative issuance timestamp and must decide what happens when a certified course later gains an item (the learner's percentage drops below 100 after a certificate was issued — a real edge case, not hypothetical, given decision #5's live denominator). FR-RATE-008's "has started / has completed" gate is the existence of a `Progress` row / `status = COMPLETE`, needing no new column. FR-PROG-004's streaks should derive from `lastViewedAt` and `completedAt` rather than adding an activity-log table, at least until a streak needs multiple events per day.
6. **A content import that adds an item to a course silently lowers every learner's percentage for that course**, including from 100% to 90%. This is correct behaviour — the path genuinely got longer — but it is worth a line in the authoring guide's review-cadence section eventually, and it is the reason percentages are not stored (decision #5).
7. **The 5-path cap on retained dashboard paths is arbitrary** and only exists so the dashboard cannot grow unboundedly once FR-PATH-003's R2 roles and FR-PATH-010's custom paths exist. At R1 there are six paths total, so it is effectively inert.
8. **`Progress` has no `pathId`**, so "which path was the learner in when they completed this" is unanswerable. Deliberate (decision #7 — recording it would break the shared-item semantics FR-PATH-009 requires), but if FR-ADMIN-006's analytics ever want per-path attribution rather than per-item completion rates, that is a new column on a new table, not a change to this one.
9. **`NOT_SURE_YET` users still have no path** (`learning-paths-content` Risks #10), so their dashboard shows the browse prompt plus, now, any progress they have made from browsing directly. That combination is handled, but it means a learner can have a non-zero progress list and no "current path" — worth remembering when FR-CERT decides what a path certificate requires.
