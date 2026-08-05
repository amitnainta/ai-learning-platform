# Progress Decision Record

Status: accepted for R1. Owner: solo maintainer. Complements
`docs/architecture/auth.md` (the `User` model and session helpers this item
builds on) and `docs/architecture/content.md` (the `Path`/`Course`/
`ContentItem` model this item's `Progress` table references — see that
document's section 6, "Progress and rating attachment points", for the
commitment this item honours). Covers decisions #1-#9 from
`factory/work/progress-tracking/PLAN.md` — see that plan for the full task
list, acceptance criteria, and test plan.

## Accepted context

`FR-PROG-001/002/003` (completion status, resume, the dashboard) all hang
off one new table, `Progress`, keyed `(userId, contentItemId)`. Because an
item shared by two paths is a single `ContentItem` row, a single `Progress`
row against it is simultaneously progress in every path that contains it —
this is what makes `FR-PATH-009`'s "retain progress on overlapping items"
promise true by construction, not by extra logic. No `Rating`, `Certificate`,
`Streak`, or `Badge` table is created; this item only fixes the attachment
points those later items will use.

## 1. "In progress" is observed; "complete" is always asserted by the learner

The axis that matters is `SourceType`, not `ContentFormat`, because it
determines whether the platform can observe anything at all:

| Item kind                                  | becomes `IN_PROGRESS` when…                                                                                            | becomes `COMPLETE` when…                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ORIGINAL` lesson (`/lessons/<slug>`)      | the lesson page is opened by a signed-in user (`<ViewTracker>` fires one `view` POST on mount)                         | the learner clicks **Mark complete** at the end of the lesson |
| `CURATED` item (card only, no detail page) | the learner clicks through to the external resource (`<CuratedOpenTracker>` fires a `view` POST on the outbound click) | the learner ticks **Mark complete** on the item card          |

**Nothing auto-completes.** Rejected: auto-completing short items after a
dwell timer or on scroll-to-bottom — any threshold is a guess, and a false
"complete" is not cosmetic: it becomes `FR-CERT-001/002` certificate
eligibility and `FR-RATE-008` rating eligibility later. Rejected: requiring
an explicit "start" click as well as opening the item — it is friction for
zero information; opening the lesson is already unambiguous.

**Completion is reversible.** `<ProgressControl>` on a completed item offers
**Mark as not complete**, which sets the row back to `IN_PROGRESS` (not to
"not started" — the learner demonstrably viewed it) and clears
`completedAt`. Mis-clicks happen, and an irreversible flag that later drives
certificates is a bad thing to make a learner support-ticket their way out
of.

## 2. Three states, two persisted: "not started" is the absence of a row

The Prisma enum is `ProgressStatus { IN_PROGRESS, COMPLETE }`. There is no
`NOT_STARTED` value and no row for an untouched item; the read layer
(`src/lib/progress/status.ts`) maps `undefined` to the display value
`NOT_STARTED`, the three-state vocabulary `FR-PROG-001` asks for.

Rationale is `NFR-SCALE-002`: materialising "not started" for the year-one
target of 100,000 users x 5,000 content items is 500,000,000 rows carrying
no information, and it would additionally require the content importer to
fan out a row-per-user on every new content item. With absence-as-not-
started the table is proportional to actual engagement (a 50-item learner
has 50 rows) and the importer stays completely uninvolved with user data.

Rejected: a three-value enum with `NOT_STARTED` never written — a dead enum
value the next reader will reasonably assume has rows, silently breaking a
query. Rejected: a nullable `completedAt` alone with no status column — it
cannot distinguish "viewed, not finished" from "never touched" once
`lastViewedAt` also exists, and it makes every query a null-check instead of
a readable filter.

## 3. One write endpoint, an action vocabulary, addressed by slug

`POST /api/progress`, body `{ contentItemSlug: string, action: "view" |
"complete" | "reopen" }`, validated by `src/lib/validation/progress.ts` and
guarded by `requireUser()`.

- `view` — upsert: create at `IN_PROGRESS` if absent; if present, bump
  `lastViewedAt` **only**. Never downgrades a `COMPLETE` row — precisely why
  the vocabulary is actions rather than a target status (`PUT { status:
"IN_PROGRESS" }` would be ambiguous about that).
- `complete` — upsert to `COMPLETE`, stamping `completedAt` only if not
  already set, so re-clicking cannot move the completion date a future
  certificate would cite.
- `reopen` — `COMPLETE` -> `IN_PROGRESS`, clearing `completedAt`.

Addressed by **slug, not id**: every UI surface already carries slugs
(`src/lib/content/routes.ts`); the route resolves the slug against
`status: "PUBLISHED"` content and returns 404 otherwise, so a client cannot
create a progress row against a draft, retired, or nonexistent item, and no
cuid is ever exposed to the client (`NFR-SEC-004`).

Rejected: a Next.js server action — the codebase's established pattern for
client-driven writes is a fetch to a route handler behind Zod
(`sign-up-form.tsx`, `path-switcher.tsx`, `delete-account-form.tsx`).
Rejected: `PUT /api/progress/[slug]` — RESTfully tidier, but pushes the
"view must not downgrade complete" rule into the client's choice of body.

## 4. Automatic "in progress" is a client beacon, never a server-render write

`<ViewTracker>` is a client component that renders nothing and POSTs
`{ action: "view" }` once in a mount effect (`fetch(..., { keepalive: true
})`). The obvious alternative — calling the upsert directly inside the
`/lessons/[slug]` server component — is wrong for a specific, checkable
reason: these routes are `export const dynamic = "force-dynamic"`, and
Next.js's `<Link>` prefetches the RSC payload for dynamic routes on
hover/viewport entry in production. Every lesson title on a path page is a
`<Link>`. A server-render write would mark items "in progress" that the
learner merely scrolled past, corrupting exactly the data `FR-PROG-003`'s
percentages and `FR-PROG-002`'s resume target are computed from. Secondary
reasons: RSC renders can be retried, so a write during render is not
once-only; a side-effecting GET is a posture the auth item deliberately
avoided.

`keepalive: true` on the beacon's `fetch` (added after the Playwright suite
caught the gap in practice, not just in review): without it, a learner who
opens a lesson and navigates away again within milliseconds — back button,
another `<Link>` — can have the request cancelled mid-flight by the
navigation before it reaches the server, silently dropping the write.
`<CuratedOpenTracker>`'s identical-purpose beacon (fired on an outbound
click that triggers navigation in the same tick) already used `keepalive`
for the same reason; `<ViewTracker>` now matches it.

Rejected: middleware-based view tracking — `src/middleware.ts` documents
that the Edge runtime cannot call Prisma, so this isn't available even in
principle. Rejected: an `<img>`/`sendBeacon` pixel — same delivery
guarantee as a keepalive `fetch`, but no error handling and no way to
reflect the new status in the UI without a full page refresh.

The tracker fails silently (a failed beacon must never surface an error to
a learner reading a lesson) and is only rendered when a session exists, so
anonymous browsing writes nothing.

## 5. Percentages and resume targets are computed at read time

`learning-paths-content` already established that a course's/path's
estimated duration is summed from its items at read time "so it cannot
drift out of sync" (`docs/architecture/content.md` section 7). Progress
percentage follows the same precedent, and the argument is stronger here:
a stored percentage would have two independent drift sources — the
learner's completions, and content-pack imports that change the
denominator. A denormalized `percentComplete` would mean every
`npm run content:import` that adds an item to a course has to recompute a
column for every user who has touched that course.

`src/lib/progress/percent.ts` is pure, has no Prisma import, and is
unit-tested without a database (the same split `plan-import.ts` uses):

- **Denominator** = items _currently_ published in the course/path — exactly
  what `src/lib/content/queries.ts` already returns. Retired items drop out
  of both numerator and denominator; a learner who completed an item later
  retired doesn't get punished for it, and their history row survives.
- **Path percentage de-duplicates by `contentItemId`** across the path's
  courses, so a shared item is counted once and the percentage can never
  exceed 100.
- **Rounding is honest at the ends**: 0% only when nothing is complete, 100%
  only when everything is complete; anything in between clamps to 1-99. A
  path showing "100%" must mean finished, because `FR-CERT` will read that
  meaning later.
- **Empty course or path** = 0% with a "no items yet" label rather than a
  divide-by-zero.

Rejected: a `CourseProgress`/`PathProgress` summary table maintained on
every mark-complete — needs transactional maintenance on two independent
write paths (the user's and the importer's), and is wrong from the instant
a course gains an item until a backfill runs. Rejected: a Postgres
materialized view — same staleness problem plus a refresh job this project
deliberately doesn't have. If the dashboard ever gets slow, the right first
move is caching (`NFR-SCALE-004`), not denormalization — that decision
already has an owner (the `FR-SEARCH` item).

## 6. Resume is positional; `lastViewedAt` orders _which paths_ to show

`findResumeTarget()` flattens a path into `courses[].position` then
`items[].position` order, de-duplicates by content item, and returns the
first entry that is not `COMPLETE`. All complete -> "path complete". Nothing
started -> the first item, labelled **Start** rather than **Resume**. The
same function applied to a single course gives `FR-PROG-002`'s "or course"
half.

Why positional rather than "most recently viewed incomplete item"? A path is
a curated ordered curriculum (`FR-PATH-001`), so "where they left off" means
the front of the unfinished part. A most-recently-viewed cursor would send a
learner who idly clicked ahead to item 12 back to item 12 instead of item 3
— the item they actually need next — and it is non-deterministic to test.

`lastViewedAt` is still stored on every row and used for three things:
ordering the dashboard's _list of active paths_ by recency, giving
`FR-PROG-004` (P2) the per-day activity signal a streak needs without a
later backfill, and `FR-ADMIN-006`'s (R2) drop-off analytics. Rejected: a
`lastViewedContentItemId` cursor column on `User` — a second source of
truth for something derivable, and it breaks the moment the item it points
at is retired. Rejected: no `lastViewedAt` at all — "which paths are
active, most recent first" would have nothing to sort by.

Resume link target: `/lessons/<slug>` for an `ORIGINAL` item; for a
`CURATED` item (no detail page) `/courses/<courseSlug>#item-<itemSlug>`, so
the learner lands on the card holding the outbound link and the completion
control rather than being thrown straight to a third-party site.
`<ContentItemCard>` renders a stable `id="item-<slug>"` for this.

## 7. FR-PATH-009 "just works" — demonstrated, not built for

Switching role/level writes only `User.roleArchetype`/`User.level` via the
existing `PATCH /api/account/profile`; it touches no progress row and needs
no new code. An item shared by two paths is one `ContentItem` row, so a
`Progress` row on it is simultaneously progress in every path that contains
it. Two things make this observable rather than merely true:

1. **e2e** (`e2e/progress-dashboard.spec.ts`): complete
   `what-is-artificial-intelligence` in `/paths/technical-builder/zero-
knowledge`, switch to Executive / Non-Technical - Zero Knowledge, and
   assert the item already reads **Complete** there and the new path's
   percentage already reflects it.
2. **The dashboard keeps showing previously-active paths.** "Active path" =
   the user's current role/level path, plus any other path containing at
   least one of the user's progress rows, ordered by the most recent
   `lastViewedAt` among its items (current path always first; other paths
   capped at 5). The learner _sees_ their old path with its retained
   percentage instead of it silently vanishing.

Rejected: keying progress on `(userId, pathId, contentItemId)` — would make
the same completion count separately per path, exactly what `FR-PATH-009`
forbids, and multiplies row count by path membership. Rejected: an
`activePathId` column on `User` — role plus level already determine the
current path (`Path` carries `@@unique([roleArchetype, level])`), and a
second, redundant pointer is a consistency bug waiting to happen.

## 8. No new rate limiter for `POST /api/progress`

The existing rate limiting is Better Auth's, scoped to auth routes
(`RateLimit` table, `src/lib/auth/options.ts`). This endpoint gets none,
deliberately: the write is idempotent, self-scoped by `requireUser()`,
sends no mail, costs no third-party call, and is bounded above by one row
per (user, published content item) — roughly 5,000 rows per user at the
`NFR-SCALE-002` target, a bounded table rather than unbounded growth, and
only for an authenticated account. Adding a limiter would mean either
extending Better Auth's config to non-auth routes or writing a second
limiter — more surface than the risk justifies at R1. Revisit if abuse or
gaming ever appears; the extension point is the existing `RateLimit` table
and `options.ts` config, not a new mechanism.

## 9. Progress is personal data: exported and cascaded

`Progress.userId` is `onDelete: Cascade`, so `prisma.user.delete` (the
existing account-deletion route) removes progress with no extra code, and
the e2e teardown's `user.deleteMany` by test-email domain keeps working
unchanged. `GET /api/account/export` gains a `progress` array (item slug,
title, status, timestamps) because `FR-ACC-007`/`NFR-COMP-004` promise the
user's data, and "what I have completed" is unambiguously theirs. The
export deliberately carries the item **slug and title**, not the cuid, so
the file is meaningful to a human reading it.

## Prisma schema

```prisma
enum ProgressStatus {
  IN_PROGRESS
  COMPLETE
}

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

`createdAt` doubles as "started at" — a row only ever comes into existence
at the moment of first view, so no separate column is needed.

Index rationale, sized for `NFR-SCALE-002`'s 100,000 users / 5,000 items:

- `@@unique([userId, contentItemId])` — the natural key and the workhorse.
  Enforces one row per user per item (a single indexed upsert, no
  read-then-write race), and its leftmost `userId` prefix serves "load all
  progress for this user" — the only read the dashboard, path page, course
  page, and lesson page ever need.
- `@@index([userId, lastViewedAt])` — orders the dashboard's active-path
  list by recency (decision #6) and is the index `FR-PROG-004`'s streak
  query will want.
- `@@index([contentItemId])` — Postgres does not index the referencing side
  of a foreign key automatically; without this, both the cascade check on
  content-item deletion and `FR-ADMIN-006`'s future "completion rate for
  this item" become sequential scans over the largest table in the
  database.
- **Considered and deliberately omitted: `@@index([userId, status])`.** The
  `userId` prefix of the unique index already narrows to one learner's rows
  — tens, not thousands — after which filtering by status is a trivial heap
  filter. A fourth index would add write amplification to the one endpoint
  `NFR-PERF-004` puts a 500ms budget on, in exchange for nothing
  measurable. Recorded so a future reader knows it was a choice.

## Verification of `learning-paths-content` decision #6 ("purely additive")

That plan's decision #6 and `docs/architecture/content.md` section 6 commit
that progress keys on `(userId, contentItemId)` against ids that are
"stable across re-imports". Checked against the real importer code, not
taken on trust:

1. **`ContentItem.id` really is stable across imports.**
   `src/lib/content/import.ts`'s `applyContentItems()` only ever calls
   `contentItem.create`/`contentItem.update` (including a status/retiredAt
   flip) — never `.delete`/`.deleteMany`. `planContentItems()` in
   `plan-import.ts` emits `retire`, never a delete, for a slug that leaves
   the pack. The claim holds.
2. **Keying on `contentItemId` rather than a join row is not just
   convenient, it is necessary.** `rewriteCourseOrdering()` and
   `rewritePathOrdering()` in the same file `deleteMany` and recreate
   `CourseItem`/`PathCourse` rows on _every_ course/path update. So those
   join-row ids **rotate** on a routine ordering or metadata edit — a
   `Progress` row pointing at a `CourseItem` would be orphaned by a content
   edit that changes nothing a learner would notice. Keying on
   `ContentItem.id` avoids this entirely; this is the concrete reason
   decision #6 (of the content item) was right, worth recording because
   it's not obvious from the schema alone.
3. **The overlap FR-PATH-009 depends on genuinely exists in the seed
   pack.** `what-is-artificial-intelligence` is referenced by both
   `content/courses/ai-foundations-for-builders.yaml` (Technical Builder,
   Zero Knowledge) and `content/courses/ai-literacy-for-leaders.yaml`
   (Executive/Non-Technical, Zero Knowledge); `google-ai-crash-course` is
   similarly shared between `ai-foundations-for-builders.yaml` and
   `content/courses/understanding-ai-capabilities.yaml`. One row, multiple
   paths — demonstrable against real seeded data, not only assertable in
   prose (`e2e/progress-dashboard.spec.ts`).
4. **No existing table needs a column.** `User` and `ContentItem` each
   gain a `progress Progress[]` back-relation, resolved virtually by
   Prisma. The generated migration is `CREATE TYPE` + `CREATE TABLE` +
   three index statements + two `ADD CONSTRAINT ... FOREIGN KEY`
   statements — nothing on `user`, `content_item`, or any other existing
   table is altered or dropped.

**One caveat, stated plainly:** the stable identity is the
**author-controlled `slug`**, not the file or the title. If a curator
renames a published item's slug, the importer retires the old row
(preserving its id and the progress rows pointing at it) and creates a
_new_ row with a _new_ cuid — the learner's progress isn't deleted, but it
is stranded on a retired item and their percentages silently drop.
`docs/content/authoring-guide.md` now states a "never rename a published
slug" rule for exactly this reason (task 37). This is the only respect in
which "purely additive" needed a caveat, and it is not fixed in code here —
a rename-detection mechanism belongs to the content importer, not this
item.

## What FR-CERT and FR-RATE inherit

Recorded here so those future work items don't have to re-derive it:

- **`Progress.completedAt` is the authoritative certificate-issuance
  timestamp.** It is stamped once, on first completion, and never moved by
  a re-click — free to write now, and a backfill later would be impossible
  to do accurately. `FR-CERT` must decide what happens when a course that
  already issued a certificate later gains an item (the learner's live
  percentage — decision #5 — can drop below 100 after issuance); that is a
  real edge case this item's read-time percentages create, not a
  hypothetical one.
- **`FR-RATE-008`'s "has started / has completed" gate is `Progress` row
  existence and `status = COMPLETE`** — no new column needed.
- **`FR-PROG-004`'s streaks should derive from `lastViewedAt` and
  `completedAt`**, at least until a streak needs multiple events per day;
  no activity-log table is anticipated here.
- **`Progress` has no `pathId`**, so "which path was the learner in when
  they completed this" is unanswerable — deliberate (decision #7 —
  recording it would break the shared-item semantics `FR-PATH-009`
  requires). If `FR-ADMIN-006`'s analytics ever want per-path attribution
  rather than per-item completion rates, that is a new column on a new
  table, not a change to this one.

## FR/NFR mapping summary

| Requirement                   | How this item satisfies it                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FR-PROG-001`                 | `Progress`/`ProgressStatus`, absence-as-not-started, `<ProgressControl>` (§1, §2)                                               |
| `FR-PROG-002`                 | `findResumeTarget()`, `<ResumeCard>` on the dashboard, path page, and course page (§6)                                          |
| `FR-PROG-003`                 | `getDashboardProgress()`, `<ProgressBar>` per path/course (§5)                                                                  |
| `FR-PATH-009`                 | Progress keyed on `ContentItem.id`; retention demonstrated by e2e (§7)                                                          |
| `NFR-PERF-004`                | `POST /api/progress` is a single indexed upsert behind one session check (§3)                                                   |
| `NFR-PERF-006`                | Fixed Prisma-call count independent of item/course count (`src/lib/progress/__tests__/queries.test.ts`)                         |
| `NFR-SCALE-002`               | Index set sized for 100k users / 5k items; "not started" not materialised (§2, schema)                                          |
| `NFR-SEC-004`                 | Every read/write scoped to the session user; slug resolved against published content only (§3)                                  |
| `NFR-COMP-004` / `FR-ACC-007` | Export gains a `progress` array; cascade on user deletion (§9)                                                                  |
| `NFR-A11Y-002` / `-004`       | Real `role="progressbar"` with matching `aria-valuenow`/`aria-valuetext`; keyboard-operable controls; `aria-live` announcements |
| `NFR-MAINT-004`               | `e2e/progress-complete.spec.ts`, `progress-resume.spec.ts`, `progress-dashboard.spec.ts`                                        |
