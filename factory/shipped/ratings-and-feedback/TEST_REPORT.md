# TEST_REPORT — ratings-and-feedback

Independent re-verification, performed fresh against `feature/ratings-and-feedback` (6 commits
ahead of `main`, not merged/pushed), with a real local Postgres (WSL2 Ubuntu, forwarded to
`localhost:5432`; app DB `ai_learning_platform`). Everything in this report is first-hand: the
toolchain was re-run from a clean `npm ci`, and every claim about direct DB/API behaviour was
produced by SQL I ran myself (`psql` inside WSL) or HTTP requests I made myself against a real
running instance of the app (`next start` on port 3030, matching `BETTER_AUTH`'s `trustedOrigins`),
not by re-reading the builder's report or re-running only the shipped tests unmodified.

**Update (fix-pass re-verification, commit `6b63d34`):** see "## Re-verification — REVIEW.md B1 fix
pass" below for a second, independent pass performed after the builder's fix for the one
review-blocking finding (B1). That section supersedes the "Defect found" note further down this
document for current ship-readiness purposes; the original defect writeup is left intact as the
historical record of how the bug was first found.

## Overall verdict: **PASS** — B1 confirmed fixed with fresh first-hand evidence; no other defects found

All 15 acceptance criteria are met by the shipped code, with first-hand evidence for each. The
toolchain is clean (lint/format/tsc/build/unit/e2e all green, freshly run, both in the original pass
and in the fix-pass re-verification). The CHECK constraints, the FR-RATE-008 gate, the star-rating
accessibility fix, cascade deletes, sanitization, and the moderation CLI all hold up under direct
SQL/API manipulation, not just through the UI or the shipped test suite. The one real, reproducible
gap found during the original pass — re-flagging a rating whose earlier flag by the same user was
already resolved silently stayed resolved and never returned to the queue (REVIEW.md B1) — was fixed
in commit `6b63d34` and is independently confirmed fixed below, using the exact original repro
sequence plus a fresh live reproduction against a running instance and a real database, not by
trusting the diff or the new automated test.

## Toolchain — fresh run, my own execution

| Step | Result |
| --- | --- |
| `npm ci` | Clean install, 701 packages, `prisma generate` ran via `postinstall`. |
| `npm run lint` | Clean, no output/errors. |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npx tsc --noEmit` | Clean, no output. |
| `npm run build` | Succeeds. All routes including `/courses/[slug]`, `/paths/[role]/[level]`, `/api/ratings`, `/api/ratings/flags` render as `ƒ` (Dynamic) — **none statically prerendered**, confirmed in the build's own route table, not just claimed. |
| `npm run test` (Vitest) | **345/345 passed, 39/39 files** on a clean re-run. One flake seen on the very first full-suite run (`src/lib/auth/__tests__/options.test.ts`, a 5s timeout under load, unrelated to this work item — pre-existing test, not touched by this branch); reproduced as passing in isolation and on a second full-suite run. Not a ratings-and-feedback regression. |
| `npx playwright test --workers=1` | **41/41 passed** in real Chromium, single worker, against the real Postgres DB and a production build (`next build && next start`). |

**Superseded by the fix-pass re-verification below**: after commit `6b63d34`, a fresh `npm ci` +
full toolchain re-run against the same local Postgres produced **347/347 Vitest tests passing across
40 files** (up from 345/39 — the two new `mutations.test.ts` B1 assertions plus the new
`flag-lifecycle.test.ts` file) and **41/41 Playwright tests passing** at `--workers=1`. See below for
the full breakdown.

Migration cleanliness (independently re-verified, not just read): created a brand-new empty
Postgres database (`ratings_verify_fresh`) and ran `npx prisma migrate deploy` against it — all
five migrations, including `20260808180524_add_ratings_and_feedback`, applied cleanly end to end.
Read `migration.sql` directly: the only `ALTER TABLE` statements target the two new tables
(`rating`, `rating_flag`); no `DROP` anywhere; no `ALTER TABLE` against any pre-existing table
(`user`, `session`, `account`, `verification`, `rateLimit`, `role_profile`, `path`, `course`,
`path_course`, `course_item`, `content_item`, `content_item_version`, `topic`, `glossary_term`,
`progress`) — confirmed by grep, not sampling.

## First-hand evidence requested specifically

### 1. Star-rating accessibility fix (deviation #3) — genuinely fixed, verified via real mouse clicks and real keyboard, not just the shipped e2e spec

Wrote my own standalone script (not the shipped `e2e/rating-course.spec.ts`, not its `clickStar`
helper's approach reused verbatim — I drove the DOM directly) using a real headless Chromium via
Playwright's core API against the live production build, authenticated via a freshly-registered
user made eligible by completing a real course item through the real API.

**Mouse**: clicked the visible label/glyph for each of the five stars in turn (1 through 5) and,
after each click, read the DOM directly (`document.querySelector('fieldset input[type=radio]:checked')`)
rather than trusting the visible text alone. Result: clicking star *N* checked radio `star-N` and
only `star-N`, for all five stars, with the visible text ("`N` out of 5") updating correctly each
time. This is exactly the bug class the deviation describes (a sibling-collision hit-test bug where
clicking one star's visible glyph would check a *different* star's hidden radio) — and it does not
reproduce; the fix holds under a real click.

**Keyboard**: clicked star 3 to establish a known starting state and focus, then sent
`ArrowRight, ArrowRight, ArrowLeft, ArrowLeft, ArrowLeft, ArrowLeft` via `page.keyboard.press`. At
every step the checked radio, the focused element, and the visible text all moved together and
matched (checked id === focused id, in every one of the six steps) — native roving-focus radio
group behaviour, exactly what NFR-A11Y-004 requires (arrow-key operable, focus tracks selection).
Final state after six presses starting from 3: `3→4→5→4→3→2→1`, ending on star 1, confirmed by both
DOM state and visible text ("1 out of 5").

**Visual state vs. submitted form value**: with the keyboard-selected value left at 1 (not
re-clicked), filled the feedback field and submitted, capturing the actual `POST /api/ratings`
request body via a Playwright network listener. Captured body:
`{"targetType":"course","targetSlug":"ai-foundations-for-builders","stars":1,"feedback":"Keyboard-selected star test"}`
— `stars: 1`, matching exactly what was visually selected and what the DOM reported as checked.
Then queried the database directly and confirmed the persisted row:
`stars=1, feedback='Keyboard-selected star test'` for that user — the visual state, the network
payload, and the database row all agree. No re-run of the shipped Playwright spec was involved in
this specific check; it is new, independent evidence.

### 2. FR-RATE-008 eligibility gate — held under direct API calls, not just the UI

All via raw `fetch` to a running instance, never through a form:

- Fresh user, no progress: `POST /api/ratings` for `ai-foundations-for-builders` → **403**,
  `{"error":"Start this course to leave a rating and feedback.","reason":"COURSE_NOT_STARTED"}`.
- Same user after completing one real content item via `POST /api/progress`: same `POST /api/ratings`
  call → **200**, rating created.
- Fresh user, path at 0%: `POST /api/ratings` for `technical-builder-zero-knowledge` → **403**
  `PATH_NOT_COMPLETE`.
- Same user after completing 4 of the path's 5 seeded items (80%): same call → still **403**
  `PATH_NOT_COMPLETE` (confirms it is a hard 100% gate, not a lower threshold).
- Same user after completing the 5th and final item (exactly 100%): same call → **200**, rating
  created with feedback, aggregate returned in the response.

### 3. The two hand-written CHECK constraints — genuinely enforced, direct SQL, not just present in the migration file

Against the fresh empty database created for migration verification (with real `user`/`course`/`path`
rows inserted to avoid FK errors masking the CHECK):

- `INSERT INTO rating (..., "courseId", "pathId", ...) VALUES (..., NULL, NULL, ...)` →
  `ERROR: new row for relation "rating" violates check constraint "rating_exactly_one_target"`.
- `INSERT INTO rating (..., "courseId", "pathId", ...) VALUES (..., 'c1', 'p1', ...)` (both set,
  real FK-satisfying ids) → same `rating_exactly_one_target` violation.
- `INSERT INTO rating (..., "courseId", "pathId", stars, ...) VALUES (..., 'c1', NULL, 0, ...)` →
  `ERROR: ... violates check constraint "rating_stars_range"`.
- A valid single-target row (`courseId` set, `pathId` NULL, `stars=5`) inserted successfully — the
  constraints reject only the bad shapes, not everything.
- Also re-verified the DB-level `@@unique([userId, courseId])`/`@@unique([userId, pathId])`
  constraints directly: a second `INSERT` for the same `(userId, courseId)` pair fails with
  `duplicate key value violates unique constraint "rating_userId_courseId_key"`.

## Criterion-by-criterion (PLAN.md "Acceptance criteria")

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Started-course rating/feedback; not-started sees message + no form; anonymous sees aggregate + sign-in link | **PASS** | Direct API: `COURSE_NOT_STARTED` 403 before starting, 200 after. `e2e/rating-course.spec.ts` (re-run, passing) covers the anonymous/message/form-absence UI states; visually confirmed via my own script that the form (`fieldset` with legend "Your rating") renders after eligibility. |
| 2 | Completed-path (100% via `computePathProgress`) rating with role/level prompt; below 100% refused; direct `POST` returns 403 and writes nothing | **PASS** | Direct API: 403 at 0% and at 80% (4/5 items), 200 at exactly 100%. Confirmed via `src/lib/ratings/eligibility.ts` reading `computePathProgress` verbatim (no reimplementation). No row was written on either 403 (verified by aggregate count/DB state before and after). |
| 3 | Every course/path page and path-page course cards show avg (1dp) + count, read-time, "Not yet rated" at 0, updates on submit/edit/remove | **PASS** | Read `src/lib/ratings/queries.ts` directly — `getCourseRatingAggregates`/`getPathRatingAggregates` are `groupBy`, no denormalized column anywhere in `schema.prisma` (grepped for `ratingSum`/`ratingCount`/`flagCount` — none found). Live-verified: course page aggregate went 4→3→4 ratings across hide→unhide via the moderation CLI, and my own edit/submit/remove sequence in the star-rating script changed the aggregate live on the page. |
| 4 | One rating per user per course/path, DB-unique-enforced; re-submit updates not duplicates; author can remove, aggregate follows | **PASS** | Direct SQL: duplicate `(userId, courseId)` insert rejected by `rating_userId_courseId_key`. Direct API: submitting the same course target twice as the same user updates the existing row (`upsertRating` upserts on the compound unique — read in `mutations.ts`); a second user submitting the same course target creates a *separate* row (aggregate count went 3→4), proving it's per-user, not global. `DELETE` removed exactly the caller's row and the aggregate dropped accordingly. |
| 5 | Feedback trimmed/control-char-stripped-with-newlines-preserved/newline-normalized/2000-cap/plain-escaped-text; `nameSchema` unchanged | **PASS** | Direct API: a payload with `<script>`/`<img onerror>` plus 4 consecutive newlines was accepted, stored verbatim as literal text (confirmed via the API response and a DB query), with the run of 4 newlines collapsed to 2 (one blank line) exactly per `normalizeMultilineText`'s documented behaviour. 2001-char feedback → 400 rejected; exactly-2000-char feedback → 200 accepted, persisted length 2000 (boundary-tested, not just "under the cap"). `src/components/ratings/rating-list.tsx` renders feedback as plain JSX text inside a `whitespace-pre-line` element — no `dangerouslySetInnerHTML`, no `<Markdown>` anywhere in the ratings code (grepped). `src/lib/validation/account.ts`'s `nameSchema` now imports `stripControlCharacters` from the shared `text.ts` with `allowNewlines` defaulting to `false` — behaviourally identical, and the existing `account.test.ts` passed untouched in the fresh 345/345 run. |
| 6 | Flag = durable `RatingFlag` row unique per (rating,user); self-flag refused; flag never hides; `moderation:queue` lists with context; `hide`/`unhide`/`dismiss` work end to end; hidden rating excluded from list+aggregate but stays in author's export | **PASS**, with one gap noted below | Direct API: flag created (200), self-flag rejected (400 "You cannot flag your own rating"), re-flag by the same user upserts (DB shows exactly 1 row, reason/note updated) rather than duplicating. `npx tsx scripts/moderation.ts list` (run directly, not via any wrapper) correctly listed the flag with rating text, target, reasons, notes. `hide` excluded the rating from the public course page (feedback text disappeared, aggregate count dropped 4→3) and drained the queue (flags auto-resolved). `unhide` restored both (count 3→4, text reappeared). Author's own `GET /api/account/export` showed the rating with `"hidden": true` while hidden — never disappears from the owner's own data. `dismiss` resolves flags without hiding — verified structurally via `dismissRatingFlags` and via the CLI's own output, but see the defect note below: dismiss/hide **do not reset `resolvedAt` to null** on a later re-flag by the same user, so a repeat report from someone whose earlier report was already resolved silently never reaches the queue. |
| 7 | Every write via `requireUser()`, session-attributed, no body userId, slug-resolved against published content, eligibility re-checked server-side, no cross-user edit/delete | **PASS** | Read all three route handlers — none accept a `userId` field in any schema (`ratingSubmissionSchema`, `ratingRemovalSchema`, `ratingFlagSchema` — grepped, no `userId` field). `DELETE`/`POST /api/ratings` are structurally incapable of touching another user's row: they take no rating id at all, only a target slug, and every mutation is `WHERE userId: session.user.id`. Directly proved: user B "editing" the same course target as user A created B's *own* separate row (never touched A's — A's feedback text and stars were unchanged after B's submit, confirmed by re-reading A's row); B's `DELETE` for that target only ever removed B's own row (a second `DELETE` attempt correctly 404'd, proving it wasn't a wildcard). |
| 8 | Exactly one enum + two models; migration has no `DROP`/no `ALTER` on pre-existing tables; applies cleanly on auth+content+progress; both CHECK constraints present; index set matches spec | **PASS** | Verified by reading `schema.prisma` and `migration.sql` directly, by a clean `prisma migrate deploy` against a fresh empty DB (all 5 migrations, in order), and by `\d rating` / `\d rating_flag` in `psql` showing the exact index/constraint set the plan specifies (`@@unique([userId,courseId])`, `@@unique([userId,pathId])`, `@@index([courseId])`, `@@index([pathId])` on `rating`; `@@unique([ratingId,userId])`, `@@index([ratingId])`, `@@index([resolvedAt])` on `rating_flag`). |
| 9 | Per-path-page course aggregates via one `groupBy`, never per-course; feedback list capped at 20; submission is one eligibility read + one indexed upsert | **PASS**, minor wording nuance | `getCourseRatingAggregates`/`getPathRatingAggregates` in `queries.ts` are each a single `groupBy` call for the whole id list — confirmed by reading the code (no loop, no per-id query) and matches the shipped `queries.test.ts` call-count assertion. `listVisibleRatings` uses `take: 20`. The "one eligibility read" wording is not literal for either target type: course eligibility is two small indexed queries (the disclosed deviation #2: a `courseItem.count` plus a scoped `progress.count`, to distinguish `NO_ITEMS` from `COURSE_NOT_STARTED`), and path eligibility was already two queries before this deviation (`path.findUnique` + `getProgressMapForUser`, both needed to reuse `computePathProgress` verbatim per decision #2). Neither is an N+1 pattern or a per-row query; both are small, fixed, indexed reads. Treated as materially satisfying NFR-PERF-004's intent (bounded, indexed, no fan-out) even though the literal "one read" wording is an approximation the plan's own decision #2 already implied before the deviation. |
| 10 | Account deletion cascades ratings+flags via DB-level cascade, no app code; export includes `ratings`/`ratingFlags` with slugs/titles, no secrets | **PASS** | Direct DB: before deletion, a test user had 1 `rating` row (as author) and their rating had 1 `rating_flag` row from a *different* user. Deleted the account through the real `DELETE /api/account` route (typed-confirmation flow, not a raw SQL delete). Re-queried directly: the `user` row, the `rating` row, and the `rating_flag` row referencing that rating (authored by someone else entirely) were **all** gone — a second-order cascade (`rating_flag.ratingId → rating.id → user.id`) with zero orphaned rows and zero application code executed beyond `prisma.user.delete`. Export payload for a still-existing user showed `ratings: [{targetType, targetSlug, targetTitle, stars, feedback, hidden, createdAt, updatedAt}]` and `ratingFlags: [{ratingId, reason, note, createdAt, resolved}]` — slugs/titles present, no `userId`/password/token anywhere in either array (grepped the full export JSON). |
| 11 | Star control keyboard-operable radio group, value as text, textarea labelled with live counter, aria-live on submit, usable at 375/768/1280 | **PASS** (responsive check is code-review only, see gap list) | Keyboard operability and text-not-color-alone value directly proven above (section 2). Read `star-rating-input.tsx`: native `<fieldset>`/`<legend>`, five `<input type=radio>`, visible numeric text below the control. Read `textarea-field.tsx`/`rating-form.tsx`: `aria-live="polite"` on both the error region and the `role="status"` announcement region; character counter present. The 375/768/1280 responsive check itself was not driven through a real viewport resize by me — the components use flex/gap layout with no fixed pixel widths beyond small fixed-size star buttons (`h-9 w-9`, ~9 stars fit trivially at 375px), so nothing in the code suggests a breakage, but this is a code-review inference, not a rendered-and-measured check. Listed explicitly as a manual-only gap below, consistent with the plan's own test plan (task plan lists this as "Manual (before ship)"). |
| 12 | Feedback entries show display name/role/level; form states this publicly beforehand | **PASS** | `rating-list.tsx` renders `entry.author.name`, `roleLabel`, `levelLabel` per entry (confirmed by reading the component and by the live course page showing "Owner A" / role-level line during my manual moderation test). `rating-form.tsx`'s `TextAreaField` hint reads "Optional. Your feedback will be shown publicly, along with your name, role, and level." — present before submission. |
| 13 | No `Certificate`/`Bookmark`/search-index model, no denormalized aggregate column, no `flagCount`, no `deletedAt`; nothing sorts/filters by rating | **PASS** | Grepped `schema.prisma` for `Certificate`, `Bookmark`, `flagCount`, `deletedAt`, `ratingSum`, `ratingCount`, `ratingAverage` — every hit is an explicit "deliberately absent" comment, never an actual field. No `orderBy`/`sort` on a rating field found in the content/search code paths. |
| 14 | `docs/architecture/ratings.md` + `docs/runbooks/content-moderation.md` exist and are substantive; cross-references in progress.md/content.md; authoring-guide slug-rename note updated | **PASS** | Confirmed both docs exist (27KB and 4.4KB respectively, non-trivial content) and read excerpts; confirmed the cross-reference sentences in `docs/architecture/progress.md` and `docs/architecture/content.md` point at `docs/architecture/ratings.md`; confirmed `docs/content/authoring-guide.md` now says a slug rename strands ratings too. |
| 15 | `lint`/`format:check`/`test`/`build`/`test:e2e` all pass locally; CI stays green; no rating route prerendered | **PASS** for the local half (re-run fresh by me, see Toolchain table). CI itself was not re-run by me (no push was made, per the branch's not-pushed status and the "never push/merge without `/factory-ship`" rule) — this is not a gap in my verification, it's out of scope for a local-only re-check; the build output directly confirms no rating-bearing route is statically prerendered. | See Toolchain table above. |

## Defect found (new, not previously disclosed)

**STATUS: FIXED as of commit `6b63d34` — see "## Re-verification — REVIEW.md B1 fix pass" above for
independent, fresh confirmation.** This section is left as originally written, as the historical
record of how the defect was first found (it also became REVIEW.md's B1, the sole blocking review
finding).

**Re-flagging a rating whose earlier flag (from the same reporter) was already resolved does not
return it to the moderation queue.** `flagRating`'s upsert (`src/lib/ratings/mutations.ts`) only
updates `{ reason, note }` on a repeat report — it never resets `resolvedAt` to `null`. Reproduced
directly: user B flagged user A's rating (`SPAM`), the maintainer resolved it via `hide`
(hide resolves that rating's unresolved flags), the maintainer then `unhid` the rating, and B
submitted a **new, different** report against the same rating (`OTHER`, a new note) — the API
returned `{"success":true}`, but a DB query showed the *same* flag row updated with the new reason
and note, **and `resolvedAt` still set to the earlier resolution timestamp**. `moderation:queue list`
correctly reported "No unresolved flags" and `dismiss` on that rating id failed with "No unresolved
flags found" — the new report is invisible to the maintainer even though the reporter was told it
succeeded.

Impact: bounded to the specific case of the *same* user re-flagging the *same* rating after their
earlier flag was actioned — a different reporter, or a first-time flag, is unaffected (confirmed:
the very first flag and a first-time flag from a different user both surfaced correctly in the
queue). Does not violate any literal AC as worded (AC6 says "a flag never hides the rating" and
"`moderation:queue` lists unresolved flags" — it does, faithfully, for every flag whose `resolvedAt`
is actually null), but it does undercut FR-RATE-006's intent that a report reaches the maintainer,
specifically for a repeat reporter on already-actioned content — arguably the most likely real
scenario for something like `OUTDATED_OR_INCORRECT`, where the same user might reasonably flag the
same stale comment again months later after a first flag was dismissed. Recommend either (a) the
upsert's `update` clause also sets `resolvedAt: null`, or (b) a deliberate decision that a
same-user re-flag after resolution is intentionally suppressed, recorded as such — currently it is
neither tested nor documented either way. Reported here per instructions rather than patched by me.

## Acceptance criteria I could not test automatically (manual-only gaps, explicitly listed)

- **AC11's 375px/768px/1280px responsive walkthrough** — reviewed the component CSS for anything
  that would obviously break (none found: flex/gap layout, small fixed-size star buttons), but did
  not drive a real viewport resize and visually inspect. The plan itself lists this as "Manual
  (before ship)."
- **Screen-reader pass over the star group** — the plan lists this as manual-only; I verified the
  underlying accessibility tree structurally (native radio group, roving focus, `aria-live`
  regions) and via real keyboard operation, which is the mechanism a screen reader also depends on,
  but did not run an actual screen reader (NVDA/VoiceOver/JAWS).
- **`npm run moderation:queue` "manual, before ship" line in the plan's own test plan** — I did run
  it live, repeatedly, against real data (see above), which supersedes the "manual" designation;
  noting it here only because the plan explicitly called it out as a manual step.
- **~500-seeded-rating wall-clock load check (AC9's dev-tools/Vercel-timing manual step)** — not
  performed; would require seeding hundreds of rows and is explicitly listed in the plan as a
  pre-ship manual step, not something this pass attempted.
- **CI green** — not re-run (branch is intentionally unpushed per the factory workflow); local
  toolchain re-run stands in for it and matches the CI job's steps.

## Manual provisioning checklist

Confirmed empty as claimed. `git diff main feature/ratings-and-feedback -- .env.example` shows
**no changes** to `.env.example` on this branch — no new environment variable was introduced. No
new external service, account, or deploy step appears anywhere in the diff (`git diff main
feature/ratings-and-feedback --stat` — 52 files changed, all within `src/`, `prisma/`, `scripts/`,
`e2e/`, `docs/`, `package.json`, and `factory/work/`). The one non-engineering obligation the plan
itself flags (Risks #1: the privacy policy must eventually state that ratings/feedback/name/role/
level are public) is a genuine open item but is explicitly out of this item's scope per the plan,
not a manual *provisioning* step.

## Deviation spot-check (instruction #11)

- **Deviation #1 (disposable DB for migration verification)** — reasonable and produces the same
  guarantee; I independently repeated the exact same verification technique (fresh empty DB,
  `migrate deploy`, direct SQL to break both CHECK constraints and both unique constraints) and it
  holds. No gap.
- **Deviation #2 (two-query course eligibility instead of one `progress.count`)** — read the code;
  no race condition or off-by-one found. The two queries (`courseItem.count` for `NO_ITEMS`, then a
  scoped `progress.count` for `COURSE_NOT_STARTED`) are not atomic with each other, but the only
  window this opens is content changing (an item published/retired) between the two reads — already
  an accepted, documented behaviour of this feature (decision #2's "eligibility is evaluated at
  write time only"; Risks #6). A single-query approach would not have been meaningfully more
  correct here, since `computePathProgress`-based path eligibility already runs multiple queries for
  the same underlying reason (reusing progress-tracking's existing modules verbatim). No gap.

## Files touched by this verification pass

No production code was modified. Verification artifacts (standalone Node/Playwright scripts used
for direct API/DOM checks) were created in a temp/scratch location and in the project root
temporarily, then deleted after use; all test users and rating/flag rows created during
verification were cleaned up directly in Postgres afterward. `git status` after cleanup shows only
the pre-existing CRLF/LF line-ending noise that was present before this verification pass began
(confirmed via `git diff`, which shows no content differences for those files) — no new untracked
or modified files remain.

---

## Re-verification — REVIEW.md B1 fix pass (commit `6b63d34`)

Performed after the builder's fix pass addressing REVIEW.md's one blocking finding (B1: `flagRating`'s
upsert never cleared `resolvedAt`, so a repeat report from the same reporter after their earlier
report was resolved silently never reached the moderation queue, even though the API returned
success). This is a second, independent pass, not a re-reading of the diff: a fresh `npm ci`, a fresh
full toolchain run, and — most importantly — a fresh live reproduction of the *exact* original repro
sequence against a real running instance and a real Postgres database, plus one adjacent case
(a different reporter) and a scope/regression check.

### Scope check: the fix touches exactly what it claims to

`git diff --stat 0e11c77 6b63d34` (the commit immediately before the fix pass, to the fix-pass
commit), with `factory/work/**` excluded to double-check nothing else crept in:

```
factory/work/ratings-and-feedback/PLAN.md        |   8 ++
src/lib/ratings/__tests__/flag-lifecycle.test.ts | 121 +++++++++++++++++++++++
src/lib/ratings/__tests__/mutations.test.ts      |  18 +++-
src/lib/ratings/mutations.ts                     |   9 +-
4 files changed, 153 insertions(+), 3 deletions(-)
```

Exactly the four files the builder notes claim: `mutations.ts` (the fix itself), the two test files,
and `PLAN.md` (the fix-pass notes). No route, schema, migration, UI component, or doc file is
touched. Re-running the same command with `factory/work/**` excluded drops only `PLAN.md`, confirming
the production-code diff is `mutations.ts` alone. **Confirmed: in scope.**

The fix itself, read directly (`src/lib/ratings/mutations.ts:80-87`):

```ts
export async function flagRating(input: FlagRatingInput, client: PrismaClient = prisma) {
  const { ratingId, userId, reason, note } = input;
  return client.ratingFlag.upsert({
    where: { ratingId_userId: { ratingId, userId } },
    create: { ratingId, userId, reason, note },
    update: { reason, note, resolvedAt: null },
  });
}
```

`resolvedAt: null` is now in the `update` branch, exactly what REVIEW.md's B1 asked for (option (a),
"fix it").

### My own fresh live repro — the exact original sequence, against a real running app and a real database

Ran `npm run build && PORT=3030 npm run start` (matching `BETTER_AUTH_URL`/`APP_URL`'s trusted
origin) against the real local Postgres, then drove the whole sequence through the real HTTP API with
a hand-written cookie-jar script (not Playwright, not the shipped e2e spec, not the shipped unit test)
— independent evidence, not a re-run of anything the builder wrote:

1. **Registered a fresh author and a fresh reporter A** via `/api/auth/sign-up/email` +
   `/api/account/profile` (the same endpoints `e2e/helpers/register.ts` uses).
2. **Made the author eligible** by completing `what-is-artificial-intelligence` via
   `POST /api/progress`, then **submitted a rating** via `POST /api/ratings` for
   `ai-foundations-for-builders` (2 stars). Response gave a real rating id:
   `cmsnuokqy0003708k06rbcd2d`.
3. **Reporter A flagged it** via `POST /api/ratings/flags` (`reason: "SPAM"`, `note: "first report"`)
   → `{"success":true}`.
4. **`npx tsx scripts/moderation.ts list`** (the real CLI, run directly, no wrapper) showed it:
   ```
   1 rating(s) with unresolved flags:
   Rating cmsnuokqy0003708k06rbcd2d — course "AI Foundations for Builders" (ai-foundations-for-builders)
     flags: 1  reasons: SPAM
       note: first report
   ```
5. **`npx tsx scripts/moderation.ts dismiss cmsnuokqy0003708k06rbcd2d`** → `"Resolved 1 flag(s) ...
   without hiding it."` **`moderation.ts list`** immediately after → `"No unresolved flags."` A direct
   `psql` query on `rating_flag` confirmed the row's `resolvedAt` was now stamped
   (`2026-08-10 23:16:21.806`).
6. **Reporter A (the SAME user, same session/cookie identity, signed back in fresh) re-flagged the
   SAME rating** via `POST /api/ratings/flags` with a *different* reason and note
   (`reason: "OUTDATED_OR_INCORRECT"`, `note: "still wrong months later"`) → `{"success":true}`.
7. **The moment that matters — `npx tsx scripts/moderation.ts list` immediately after**, run fresh,
   showed:
   ```
   1 rating(s) with unresolved flags:
   Rating cmsnuokqy0003708k06rbcd2d — course "AI Foundations for Builders" (ai-foundations-for-builders)
     flags: 2  reasons: OUTDATED_OR_INCORRECT, INAPPROPRIATE
       note: still wrong months later
       note: from reporter C
   ```
   (The second flag/reason is reporter C's, from the adjacent check below, run in the same pass — see
   next section.) **The re-flag from reporter A is back in the queue, with the new reason and note
   visible to the maintainer.**
8. **Direct `psql` confirmation, not just the CLI's word for it** — queried `rating_flag` for this
   rating id directly:
   ```
   id                         | ratingId                   | userId                             | reason                 | note                      | resolvedAt | createdAt
   cmsnuokrz0005708kr4qy255k  | cmsnuokqy0003708k06rbcd2d  | GHTb3GeKVomlTiAPdj6yGAa3naGw0zL7   | OUTDATED_OR_INCORRECT  | still wrong months later  |            | 2026-08-10 23:16:12.72
   ```
   This is the **same row id** (`cmsnuokrz0005708kr4qy255k`) as reporter A's original flag from step
   3 — confirming the upsert updated the existing row rather than creating a new one (as designed,
   `@@unique([ratingId, userId])`) — and its `resolvedAt` column is genuinely `NULL` again, not merely
   absent from a query filter. **This is the exact failure mode REVIEW.md B1 and my original
   TEST_REPORT.md "Defect found" section described, reproduced step for step, and it no longer
   occurs.**

**Conclusion: B1 is fixed.** The moderation queue genuinely surfaces a repeat report from the same
reporter after their earlier report on the same rating was resolved — proven by the real CLI output
and by a direct, independent SQL query against `resolvedAt`, not by trusting the API's `{"success":
true}` response (which, recall, was never the problem — it always returned success; the defect was
that the queue silently didn't reflect it).

### Adjacent case: a different reporter after resolution (regression check, not previously exercised in this depth)

Before the re-flag in step 6 above, I also had a **third user, reporter C, who had never flagged this
rating before**, submit `POST /api/ratings/flags` (`reason: "INAPPROPRIATE"`, `note: "from reporter
C"`) — *after* reporter A's original flag had already been dismissed in step 5. Result:
`{"success":true}`, and the `psql` query above shows it as a **separate new row**
(`cmsnupijq0009708k83pcu9j8`), also with `resolvedAt` null, also correctly surfaced in the same
`moderation:queue list` output. This is the case REVIEW.md's diff already covered correctly (a
different reporter has a different `(ratingId, userId)` key, so it was never affected by the bug) —
confirmed here with fresh live evidence rather than by trusting that reasoning. **No regression: a
different user's flag after a prior resolution behaved correctly before the fix and still does.**

Cleanup: the queue entry was dismissed again via the CLI, the flag/rating rows and all three test
users (`b1-author-*`, `b1-reporterA-*`, `b1-reporterC-*`) were deleted directly in Postgres after the
check completed — no artefact of this repro remains in the database.

### Toolchain, re-run fresh after the fix (commit `6b63d34`)

| Step | Result |
| --- | --- |
| `npm ci` | Clean install, 701 packages, `prisma generate` via `postinstall`. |
| `npx prisma migrate deploy` | "No pending migrations to apply" — schema unchanged by this fix, as expected (fix is application code only). |
| `npm run lint` | Clean, no output. |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npx tsc --noEmit` | Clean, no output. |
| `npm run build` | Succeeds. Route table unchanged from the original pass: `/api/ratings`, `/api/ratings/flags`, `/courses/[slug]`, `/paths/[role]/[level]` all still `ƒ` (Dynamic), none prerendered. |
| `npm run test` (Vitest) | **347/347 passed, 40/40 files** — up from 345/39, exactly the two new `flagRating` assertions in `mutations.test.ts` plus the one new `flag-lifecycle.test.ts` file the builder notes describe. Read both files directly (see below) rather than trusting the count alone. |
| `npx playwright test --workers=1` | **41/41 passed**, real Chromium, single worker, against the real Postgres DB and a fresh production build. All three ratings specs (`rating-course.spec.ts`, `rating-flag.spec.ts`, `rating-path.spec.ts`) green. |

`src/lib/ratings/__tests__/mutations.test.ts`'s `flagRating` describe block now has two cases: the
original case's assertion is `expect(call.update).toEqual({ reason: "SPAM", note: null, resolvedAt:
null })` (previously asserted the defective shape with no `resolvedAt`), plus a second case asserting
`resolvedAt: null` is present regardless of the reason/note values. `src/lib/ratings/__tests__/
flag-lifecycle.test.ts` is a genuine end-to-end regression test against a small in-memory fake of the
`ratingFlag` table (flag → confirm in queue → dismiss → confirm queue empty → re-flag same reporter →
confirm queue entry reappears with the new reason) — the same sequence I drove live against the real
app and database above, just also codified as a fast, repeatable unit test. Both read directly, not
assumed from the builder notes.

### Regression spot-checks (not a full adversarial re-pass, per instructions)

- **The two hand-written CHECK constraints** — still enforced. Direct SQL against the live dev
  database: `INSERT INTO rating (..., "courseId", "pathId", ...) VALUES (..., NULL, NULL, ...)` →
  `ERROR: ... violates check constraint "rating_exactly_one_target"`; a row with `stars = 0` →
  `ERROR: ... violates check constraint "rating_stars_range"`. Both hold.
- **FR-RATE-008 eligibility gate** — still enforced. A brand-new user with zero progress, `POST
  /api/ratings` for `ai-foundations-for-builders` → `403 {"error":"Start this course to leave a
  rating and feedback.","reason":"COURSE_NOT_STARTED"}`, checked live against the real API.
- **Cascade delete** — still correct, including the second-order case. Before deleting the test
  author's account, their rating had one `RatingFlag` row from reporter C (a *different* user).
  Deleted the account through the real `DELETE /api/account` route (typed-confirmation flow). A
  direct `psql` re-query afterward: `remaining_rating = 0`, `remaining_flags = 0`,
  `remaining_user = 0` — the user row, their rating, and the flag *authored by someone else against
  that rating* were all removed by `prisma.user.delete`'s database-level cascade, zero rows orphaned,
  zero application code beyond the delete call.

No other areas were re-driven (per instructions, this is a targeted spot-check, not a full
adversarial re-pass); nothing here contradicts the original pass's findings.

### Updated overall verdict

**PASS.** REVIEW.md's B1 — the sole blocking finding — is fixed and independently confirmed with
fresh, first-hand evidence reproducing the exact original repro end to end against a real running
instance and a real database, not by re-reading the diff or trusting the new automated test. The fix
is scoped exactly as claimed (`mutations.ts` + two test files + `PLAN.md`, confirmed by `git diff
--stat`). The full toolchain is green: lint, format, `tsc`, build, **347/347 Vitest** (up from
345/345), and **41/41 Playwright** at `--workers=1`. The different-reporter case, the CHECK
constraints, the FR-RATE-008 gate, and the account-deletion cascade (including its second-order flag
cascade) were all spot-checked live and still hold. No new defects found during this pass.
