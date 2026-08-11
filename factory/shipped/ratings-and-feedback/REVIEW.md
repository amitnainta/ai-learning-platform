# REVIEW — ratings-and-feedback

_Independent review by factory-reviewer. Branch `feature/ratings-and-feedback`, 7 commits ahead of
`main`, not pushed. This file now contains **two** passes: the fix-pass re-review (current verdict,
below) and, retained beneath it, the original first-pass review that raised B1._

## Verdict (fix pass, commit `6b63d34`): **APPROVED WITH NOTES**

B1 — the sole blocking finding of the first pass — is **closed**, and I verified that first-hand
rather than on the builder's or the tester's word. The remaining items (NB1-NB9) are non-blocking
follow-ups. This is ready for `/factory-ship`.

---

## Re-review of the B1 fix

### What actually changed

`git show 6b63d34 --stat` — exactly four files, and I read all four:

| File | Change |
| --- | --- |
| `src/lib/ratings/mutations.ts` | `flagRating`'s upsert `update` clause is now `{ reason, note, resolvedAt: null }`, plus an 8-line docstring explaining why |
| `src/lib/ratings/__tests__/mutations.test.ts` | The defective assertion at the old line 85 corrected; one new assertion case added |
| `src/lib/ratings/__tests__/flag-lifecycle.test.ts` | New — flag -> queue -> dismiss -> queue empty -> re-flag (same reporter) -> queue reappears |
| `factory/work/ratings-and-feedback/PLAN.md` | A "Builder notes (fix pass)" appendix; no task reopened, no scope added |

No production file other than `mutations.ts` was touched. No route, query, component, schema,
migration, doc, or e2e file changed. That is exactly the surface a B1-only fix should have.

### 1. Is the fix correct and complete — including the `create` branch?

**Yes, and the `create` branch genuinely needs no change.** I checked this rather than assumed it,
because it is the obvious place for a half-fix to hide:

- `create: { ratingId, userId, reason, note }` omits `resolvedAt` entirely. That is only safe if the
  column is nullable with no non-null default.
- `prisma/schema.prisma:577` declares `resolvedAt DateTime?` with **no `@default`**.
- The shipped DDL agrees — `prisma/migrations/20260808180524_add_ratings_and_feedback/migration.sql:27`
  is `"resolvedAt" TIMESTAMP(3),` — nullable, no `DEFAULT` clause. An `INSERT` that omits the column
  therefore stores SQL `NULL`, which is precisely what
  `listUnresolvedFlagsGroupedByRating`'s `where: { resolvedAt: null }` filter selects.

So a **first** flag from any user (the `create` branch) has always reached the queue, and still does;
adding `resolvedAt: null` to `create` would be redundant, not a missing half. The only broken path was
the `update` branch, and that is the one the fix repairs. The tester's live run independently
corroborates both halves: the different-reporter-after-resolution case (create branch) produced a
separate new row with `resolvedAt` NULL, and the same-reporter case (update branch) flipped the
existing row's `resolvedAt` back to NULL.

I looked for a remaining gap in the adjacent state machine and found none that is a defect:

- `hideRating` resolves that rating's unresolved flags, and a hidden rating **cannot** be re-flagged at
  all, because `POST /api/ratings/flags` resolves the rating with
  `findFirst({ where: { id, hiddenAt: null } })` and 404s otherwise. So the hide path cannot produce a
  silently-swallowed report.
- `unhideRating` deliberately does not un-resolve flags — that is the "reviewed, no action" outcome
  the plan specifies, and after an unhide the rating is flaggable again, now correctly.
- Concurrency: the write is a single `upsert` on the `@@unique([ratingId, userId])` key, so two
  simultaneous reports from one user collapse to one row with no lost-update window that matters.
- One cosmetic consequence, not a bug: a reopened flag keeps its **original** `createdAt`, so it
  re-enters the `orderBy: { createdAt: "asc" }` queue at its old position rather than at the end.
  The queue does not display flag timestamps at all, so nothing misleads a maintainer. Noted as NB9.

### 2. Is `flag-lifecycle.test.ts` a genuine test, or does its fake mask the bug?

It is genuine, and I proved it by **breaking the fix and watching the test fail**, which is the only
evidence that actually distinguishes a real regression test from a decorative one:

1. I reverted `mutations.ts:85` to the defective `update: { reason, note }`.
2. `npx vitest run src/lib/ratings/__tests__/flag-lifecycle.test.ts` -> **FAIL**:
   `expected [] to have a length of 1 but got +0` — i.e. the re-flagged rating did not come back to
   the queue, reproducing the exact B1 symptom through the fake.
3. The two `mutations.test.ts` assertions failed as well (3 failures total across the two files).
4. I restored `mutations.ts` from a byte-level backup and confirmed `git diff` on it is empty.

On divergence risk from the in-memory fake, which was the fair question to ask: the fake models the
three behaviours the test depends on, and each matches real Prisma/Postgres semantics —
`upsert` update as a partial merge (`Object.assign(existing, update)`), `updateMany` scoped by
`resolvedAt: null` (strict `=== null`, so a `Date` never matches, which is exactly how SQL `IS NULL`
behaves), and `findMany` filtered on `resolvedAt: null`. The fake's `create` path defaults
`resolvedAt` to `null`, which I confirmed above is what the real nullable-no-default column does.
The one place a fake like this *could* mislead — whether Prisma's real `ON CONFLICT DO UPDATE`
actually emits `SET "resolvedAt" = NULL` — is precisely what the tester's live `psql` observation
settles, and the two lines of evidence agree. I am satisfied the unit test and the live repro
corroborate rather than substitute for each other.

### 3. Toolchain, verified by me

- `npm run test` (full suite, my own run): **40 files, 347 tests, all passing** — up from 345, the
  delta being exactly the two new B1 cases. No flake seen on my run.
- `npx tsc --noEmit`: clean (worth checking specifically, since `resolvedAt: null` has to satisfy
  Prisma's generated `RatingFlagUpdateInput`).
- Targeted re-run of `src/lib/ratings`, `src/lib/validation`, both ratings API test files and the
  ratings components: 15 files, 154 tests, all passing.
- Working tree: `git diff --stat` against the branch is **empty apart from CRLF warnings** — the 27
  "modified" files carry zero content difference, same as the first pass. Nothing uncommitted is
  propping up a green run.
- I did not re-run Playwright. The tester re-ran 41/41 against a real local Postgres and, more
  importantly, hand-reproduced B1 end to end through the real API, the real CLI and direct SQL.
  Nothing in a four-file diff whose only production change is one Prisma field gives me reason to
  doubt that.

### 4. Did the fix pass disturb anything else?

No. NB1-NB7 from the first pass are all untouched and none is made worse — the fix pass never opened
`rating-section.tsx`, `rating-list.tsx`, `rating.ts`, `schema.prisma`, the e2e specs, or the docs.
NB1-NB7 stand exactly as written below.

The original security and scope conclusions also still hold, re-checked rather than assumed since the
fix lands in the same `mutations.ts` I reviewed for IDOR:

- **No new IDOR surface.** `flagRating`'s signature, its `where` clause, and its callers are unchanged;
  `userId` still comes only from `requireUser()` in `src/app/api/ratings/flags/route.ts`, the body
  still cannot name a user, and the route still refuses self-flags and 404s on absent-or-hidden
  ratings with identical wording. `resolvedAt` is a moderation-state field written here to `null`
  only — it grants no read access and exposes nothing to the client (the route still returns a bare
  `{ success: true }`).
- **No new input reaches the database.** The added value is the literal `null`, not user input, so the
  Zod surface, the 2,000/500-char caps, `normalizeMultilineText`, and NFR-SEC-007's render-path
  analysis are all unaffected. No secrets, no env vars, no raw SQL, no new permissions.
- **Scope discipline holds.** Four files, all inside the plan's declared surface (tasks 9 and 30), plus
  a PLAN.md appendix that documents the fix rather than expanding the plan. Nothing from the plan's
  out-of-scope list (FR-RATE-007 thresholds, admin UI/RBAC, certificates, search, caching) appeared.

### 5. New non-blocking notes from this pass

**NB8. The e2e flag spec still stops one step short of the B1 scenario.** `e2e/rating-flag.spec.ts:74-81`
performs a second report by the same reporter and asserts the row is updated rather than duplicated —
but there is no `dismiss` between the two reports, so the browser-level suite still never exercises
"resolved, then re-flagged". The unit lifecycle test plus the tester's live repro cover the behaviour,
so this is a coverage-shape preference, not a gap in verification. Cheap to close whenever
`rating-flag.spec.ts` is next touched.

**NB9. The runbook does not state that a repeat report reopens a dismissed entry.**
`docs/runbooks/content-moderation.md` documents `dismiss` as resolving a rating's flags but says
nothing about what happens if the same reporter files again. The behaviour is now the intuitive one,
and `mutations.ts` explains it in a docstring, but a maintainer reading only the runbook would not
know a dismissed entry can come back. One sentence, whenever the runbook is next edited.

### Final summary

| | |
| --- | --- |
| **Blocking** | None. B1 closed — the fix is complete across both the `create` and `update` paths of the upsert, and its regression test was verified to actually fail without the fix. |
| **Tracked follow-ups** | NB1-NB7 (unchanged, below) plus NB8 (e2e does not cover dismiss-then-re-flag) and NB9 (runbook silent on re-opening). NB6 (privacy-policy copy) and NB7 (manual responsive + screen-reader passes) are the two worth confirming at the ship gate. |

Ready for `/factory-ship`. I would be comfortable shipping this under my own name.

---

_Everything below is the original first-pass review, retained as the record of why B1 was raised.
Its "CHANGES REQUESTED" verdict is **superseded** by the fix-pass verdict above; B1 as described
there is fixed in commit `6b63d34`. NB1-NB7 remain open as tracked follow-ups._

---

# Original review (first pass) — ratings-and-feedback

_Independent review by factory-reviewer. Branch `feature/ratings-and-feedback`, 6 commits ahead of
`main`, not pushed. Reviewed against `factory/work/ratings-and-feedback/PLAN.md` and
`TEST_REPORT.md`, but the verdict below is based on reading the diff itself
(`git diff main...HEAD`, 52 files) and re-running part of the suite, not on either report._

## Verdict (first pass, superseded): **CHANGES REQUESTED**

One blocking item, and it is a small one. Everything else in this work item is, in my judgement,
production-ready: the schema and migration are exactly what the plan specified, the FR-RATE-008 gate
is genuinely server-side, the access-control model is structurally IDOR-free rather than
defensively-checked, NFR-SEC-007 is discharged properly, scope discipline is clean, and the test
suite actually exercises the acceptance criteria rather than decorating them.

The single blocker is the flag `resolvedAt` defect the tester found. My reasoning for treating it as
blocking rather than as a tracked follow-up is set out in full below — it rests as much on the fix
being roughly three lines as on the severity.

---

## The blocking item

### B1. `flagRating`'s upsert never clears `resolvedAt`, so a repeat report from the same reporter silently never reaches the moderation queue

**Independently reproduced by code reading; I agree with the tester's root-cause analysis.**

`src/lib/ratings/mutations.ts:75-82`:

```ts
export async function flagRating(input: FlagRatingInput, client: PrismaClient = prisma) {
  const { ratingId, userId, reason, note } = input;
  return client.ratingFlag.upsert({
    where: { ratingId_userId: { ratingId, userId } },
    create: { ratingId, userId, reason, note },
    update: { reason, note },          // <- `resolvedAt` is never reset to null
  });
}
```

`RatingFlag` is uniquely keyed on `(ratingId, userId)` (`prisma/schema.prisma`), so a second report
by the same user against the same rating always takes the `update` branch. `hideRating` and
`dismissRatingFlags` (`mutations.ts:90-125`) both stamp `resolvedAt` on that row, and
`listUnresolvedFlagsGroupedByRating` (`src/lib/ratings/queries.ts:202`) filters `resolvedAt: null`.
So once a reporter's flag has been actioned, every subsequent report that reporter files against that
rating writes a row that is invisible to `npm run moderation:queue` — while
`src/app/api/ratings/flags/route.ts:54` returns `{ success: true }` and `<FlagRatingButton>`
(`flag-rating-button.tsx:80`) announces "Reported — thank you."

**Why blocking rather than a tracked follow-up.** I weighed the "narrow edge case, Should/R1, solo
maintainer, no users yet" argument seriously, and it is a reasonable position. Four things moved me
past it:

1. **It is a silent-success failure, the worst failure signature available.** The reporter is told
   the report was submitted. Nothing anywhere — not the API, not the UI, not the CLI, not the
   runbook — indicates otherwise. There is no error to notice and no artefact to find later.
2. **It contradicts a load-bearing decision of this very work item.** PLAN.md decision #5 explicitly
   rejects "shipping `RatingFlag` with no way to act on it — that is the 'fire-and-forget action'
   REQUEST.md explicitly asked to avoid." This bug re-creates precisely that dead end for a subset
   of reports. `docs/architecture/ratings.md:302` even reassures the reader that a lost report is
   fine "because the surviving rating can be re-flagged by anyone" — a claim the code does not
   honour for anyone who has flagged it before.
3. **The realistic trigger is the most likely repeat-report scenario, not an exotic one.** The
   canonical sequence is: maintainer runs `dismiss` (reviewed, no action), the content stays up, the
   same reporter sees it still up and reports again. "Nothing happened, I'll report it again" is
   ordinary user behaviour, not a corner case. A `hide` then `unhide` cycle produces the same state.
4. **The fix is about three lines and the cost of not fixing it is permanent.**
   `update: { reason, note, resolvedAt: null }`, one assertion updated, one test added. Against that,
   `src/lib/ratings/__tests__/mutations.test.ts:85` currently asserts
   `expect(call.update).toEqual({ reason: "SPAM", note: null })` — the defective behaviour is
   **locked in by a passing test**, so it will read as intentional to every future maintainer and
   will not be found again.

**What must change (either one, not both):**

- **(a) Fix it.** `flagRating`'s `update` clause also sets `resolvedAt: null`. Update
  `mutations.test.ts:85` accordingly and add a case asserting that a repeat flag returns the row to
  the queue. Optionally add the same assertion to `e2e/rating-flag.spec.ts`, which already performs a
  second report at line 75 and today asserts only that no duplicate row is created.
- **(b) Decide it deliberately and make it honest.** If suppressing a same-user re-flag after
  resolution is the intended anti-report-spam behaviour (a defensible product call), then the route
  must not return a bare success — it should tell the reporter their earlier report on this rating
  was already reviewed — and the behaviour must be recorded in `docs/architecture/ratings.md` and
  `docs/runbooks/content-moderation.md` and covered by a test. What is not acceptable is the current
  state: neither chosen, nor documented, nor tested.

Per the factory rules I am not marking this resolved myself; it needs a new build, test, and review
pass. If the human judges the risk acceptable at R1 and prefers to ship with a tracked issue, that
override belongs at the `/factory-ship` gate — but it should be an explicit decision, not an
oversight, and issue text should exist before merge.

---

## Everything else: findings by area

### Correctness against the plan

All 15 acceptance criteria are met by the diff, and I verified the load-bearing ones directly rather
than taking the test report's word:

- **AC8 (schema/migration)** — `prisma/schema.prisma` gains exactly one enum (`RatingFlagReason`) and
  two models, with the index set the plan specifies verbatim. Back-relations on `User`, `Course`,
  `Path` are virtual only. `prisma/migrations/20260808180524_add_ratings_and_feedback/migration.sql`
  contains only the allow-listed statements: one `CREATE TYPE`, two `CREATE TABLE`, seven
  `CREATE [UNIQUE] INDEX`, five `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` (all against the two
  new tables), and the two hand-written `CHECK`s. No `DROP`, no `ALTER` against any pre-existing
  table. Read line by line, not sampled.
- **AC5 / NFR-SEC-007** — normalization order in `src/lib/validation/text.ts:64-69` is correct: CRLF
  first, then control-character strip with newlines spared, then collapse, then trim; the 2,000-char
  cap in `rating.ts` runs on the **post**-normalization value via `.refine()` after `.transform()`,
  so padding cannot smuggle length past it.
- **AC3/AC9 (aggregates)** — `getCourseRatingAggregates`/`getPathRatingAggregates`
  (`queries.ts:55-92`) are a single `groupBy` for the whole id list with an early return on an empty
  list; the path page calls the course version **once** for all courses. Both filter `hiddenAt: null`,
  so a moderation-hidden rating is excluded from the displayed average **and** the count — confirmed
  by reading the query, not inferred. No denormalized column exists anywhere in the schema.
- **AC10 (export)** — both new arrays carry slugs/titles, no cuid except the documented `ratingId`,
  no email, no token; the response is `application/json` with `Content-Disposition: attachment`.

### The four disclosed deviations

1. **Throwaway DB for migration verification — fine.** The substitution is sound and the artefact is
   what matters: I read `migration.sql` myself and it is correct. The tester independently ran
   `prisma migrate deploy` against a fresh empty DB and broke both CHECKs with raw SQL. Nothing
   further needed.
2. **Two-query course eligibility — fine, and arguably better than the plan's one.** The first count
   (`courseItem.count`) is what distinguishes `NO_ITEMS` from `COURSE_NOT_STARTED`; a single
   `progress.count` cannot make that distinction and would tell a user to "start this course" for a
   course nobody can start. No race that matters: the only interleaving is a content publish/retire
   between the two reads, which decision #2 and Risks #6 already accept as this feature's documented
   semantics. Both reads are indexed and have no fan-out. Micro-note: the two awaits are sequential
   where they could be `Promise.all` apart from the short-circuit — genuinely not worth changing.
3. **Star-rating accessibility fix — architecturally sound, not a workaround.** `star-rating-input.tsx`
   uses the native label-wraps-input pattern with `has-[:checked]`/`has-[:focus-visible]` instead of
   `peer-*`, which is the correct consequence of the input becoming a descendant rather than a
   sibling. It keeps real `<input type="radio">`s in a `<fieldset>`/`<legend>`, so arrow-key roving
   focus and group semantics remain native. The `relative` on the label is a real fix (it contains
   the `sr-only` input's absolute positioning) rather than a hit-test hack. The `clickStar` e2e helper
   clicks the visible label — what a real user does and what native `<label>` semantics forward; not
   a test-only escape hatch masking a broken control.
4. **Per-spec exclusive seeded courses — genuinely test isolation, not a masked aggregate bug.** The
   aggregate is a plain `groupBy` with no per-target state; it is correct by construction for
   overlapping and concurrent ratings, and account deletion is handled by the DB cascade with no
   counter to drift. The specs assert exact counts ("... - 1 rating"), so they need target-exclusive
   fixtures. Confirmed all four rating-touching specs use distinct courses. See NB2 for the one gap
   this leaves.

### Security

Reviewed `src/app/api/ratings/route.ts` and `src/app/api/ratings/flags/route.ts` line by line.

- **No IDOR on rating edit/delete, structurally.** Neither `POST` nor `DELETE` accepts a rating id at
  all — only `targetType` + `targetSlug`. The slug is resolved against **published** content only
  (`resolvePublishedCourseBySlug`/`resolvePublishedPathBySlug` filter `status: "PUBLISHED"`), and the
  write is `upsert({ where: { userId_courseId: { userId: <session>, ... } } })` /
  `deleteMany({ where: { userId: <session>, ...target } })`. There is no code path by which a request
  can name another user's row. This is the right design — scoping by construction rather than by an
  ownership `if`. Server-side, not client-side: `<RatingForm>` sends no identifier either, and
  `ratings.test.ts:142-164` proves a body-supplied `userId` is ignored.
- **No IDOR on flag creation.** `userId` comes from `requireUser()` only; `ratingFlagSchema` has no
  `userId` field and the route ignores extra body keys — asserted directly by
  `rating-flags.test.ts:87-107`, which posts `userId: "attacker-id"` and confirms the session id is
  used. Self-flagging is rejected 400 after an ownership read.
- **No misleading response for a nonexistent rating.** `prisma.rating.findFirst({ where: { id,
  hiddenAt: null } })` returns null for both "does not exist" and "is hidden", and both produce the
  same 404 "Rating not found" — no existence oracle, no moderation-state leak. Id enumeration against
  cuids is infeasible, and the worst outcome is bounded by `@@unique([ratingId, userId])`.
- **Input validation** is Zod-first on every route with slug and id regexes, length caps, and integer
  star bounds, backed by two database CHECK constraints. Bad JSON returns the same 400 wording as the
  existing routes.
- **No secrets, no new env vars** (`.env.example` unchanged on the branch), no raw SQL in application
  code, no `eval`/deserialization surface, no new permissions, and no externally-reachable moderation
  endpoint — moderation stays a `tsx` operator script, correct while NFR-SEC-006's RBAC does not
  exist.
- **NFR-SEC-007 render paths audited, all four surfaces:** the rating list (`rating-list.tsx:80-82` —
  plain JSX interpolation inside `whitespace-pre-line`); the course and path pages (render only
  `<StarRatingDisplay>`, i.e. numbers, plus `<RatingSection>`, which delegates to the list — there is
  no second render path for free text); the account export (JSON serialization served as an
  attachment); and the moderation CLI (`scripts/moderation.ts` — `console.log` of feedback and notes,
  truncated to 200 chars, and safe from terminal-escape injection because ESC (27) is stripped at
  input by `stripControlCharacters`). I grepped the whole `src/` tree: `dangerouslySetInnerHTML`
  appears nowhere, and every `<Markdown>` call site is author-controlled content
  (`path.description`, `course.description`, `lesson.body`, glossary, role profile). User-submitted
  text never touches it.

### Scope discipline

Clean. All 52 changed files map to a numbered plan task, with one trivial undeclared addition
(`e2e/helpers/rating.ts`, the `clickStar` helper) that discloses itself in its own header comment.
I checked specifically for the four things the plan put out of scope and found none of them: no
FR-RATE-007 threshold, job, or queue-population logic anywhere; no admin route, page, or RBAC column
(FR-ADMIN-005's UI half); no `Certificate`/`Bookmark`/search-index model and no rating-based sort or
filter (FR-CERT/FR-SEARCH); and nothing re-litigating the stack, auth, content, or progress decisions
from the four shipped items — the eligibility module reuses `computePathProgress` and
`getProgressMapForUser` verbatim rather than reimplementing them. `src/lib/validation/account.ts`'s
change is a pure extraction with the original comment carried across and no behaviour change.

### Style / consistency

Matches the codebase closely: `queries.ts`/`mutations.ts` split with `cache()` on reads and an
injectable `PrismaClient` on writes (mirrors `src/lib/progress/*`), pure formatting isolated in a
Prisma-free module (mirrors `percent.ts`), identical 400/404 error wording and JSON envelope to the
existing routes, `<TextAreaField>` mirroring `<FormField>`, CSS custom-property tokens throughout,
and header comments that cite the decision they implement. `scripts/moderation.ts` follows
`scripts/import-content.ts`.

### Test quality

Substantive, not superficial. The tests assert the things that would actually break: exactly-one
`groupBy` by call count; the `hiddenAt: null` filter; `take: 20`; that no `email` appears in a select;
that a body-supplied `userId` is ignored on both routes; that a 403 writes nothing; that
`deleteRating` scopes by session `userId`; that a `<script>` and an `<img onerror>` payload render as
literal text with no element created; the retired-item live-denominator case; and message-map
completeness. The e2e specs drive real journeys end to end, and the path spec checks the 403 **and**
that no row was written. NFR-MAINT-004's named "rating" journey is covered.

The one place test quality actively failed is B1: no test anywhere covers re-flagging after
resolution, and `mutations.test.ts:85` asserts the defective `update` clause as correct.

---

## Non-blocking notes (fine as tracked follow-ups)

**NB1. The form and the API can disagree for an existing rater whose target changed.**
`rating-section.tsx:54-59` skips the eligibility check entirely when `myRating` exists (its docstring
says so deliberately), but `POST /api/ratings:79-89` re-checks eligibility unconditionally. So a user
who rated a path at 100% and then sees the path gain an item is shown an "Update your rating" form
that will 403 with "Complete every item in this path to rate it." This narrowly contradicts the plan's
own "what the form shows and what the endpoint accepts can never disagree" and the component's own
comment. No security or data impact — the rating survives and `DELETE` still works, matching decision
2's promise — but the interaction is confusing. Pick one: exempt an update-of-an-existing-rating from
the gate server-side, or have the section re-check and render read-only.

**NB2. No coverage of an average across more than one rating on a real render.** Every e2e asserts
"N out of 5 - 1 rating", by design (see deviation 4). Multi-row averaging plus one-decimal rounding is
exercised only by `formatAggregate`/`roundAverage` unit tests and by mocked `groupBy` return values.
The aggregate is correct by construction, so this is a coverage gap, not a suspected bug — but a
second rater inside one spec on a spec-exclusive course would close it cheaply.

**NB3. `feedback: null` in a request body is rejected with a confusing 400.** `feedbackSchema` is
`z.string().optional()`, so an explicit `null` fails with a type message rather than being treated as
"no feedback". The app's own client never sends `null`, so this is robustness only.

**NB4. Two stale schema comments.** `prisma/schema.prisma:160` and `:443` still read "Deliberately
absent: any `Rating` ... model". They are historical, work-item-scoped block comments and were true
when written, but they are now literally contradicted 60 lines further down the same file. One-line
cleanup whenever the schema is next touched.

**NB5. Copy nit — a single review is labelled as an aggregate.** `rating-list.tsx:78` renders each
entry's stars via `<StarRatingDisplay aggregate={{ average: entry.stars, count: 1 }}>`, giving every
individual review the accessible name "Average rating 4 out of 5, from 1 rating". Correct information,
odd phrasing for one person's opinion. A `label` override on `StarRatingDisplay` would fix it.

**NB6. The privacy-policy obligation created by decision 4 (Risks 1) is real and still open.** The
form states the disclosure at the point of entry, which is the honest minimum, but publishing display
name + role + level next to free text needs NFR-COMP-002 copy before public launch. Not this item's to
write; confirm it is tracked at the ship gate.

**NB7. Manual pre-ship checks the plan itself lists remain undone** — the 375/768/1280 responsive
walkthrough and the screen-reader pass. The tester reviewed the CSS and drove real keyboard operation
(the mechanism a screen reader depends on) but did not resize or run NVDA/VoiceOver. Both were
"Manual (before ship)" in the plan, so this is expected, not a regression — just do not lose them.

## Toolchain check performed by me

I re-ran the ratings-relevant unit suites directly (`npx vitest run src/lib/ratings src/lib/validation
src/app/api/__tests__/ratings.test.ts src/app/api/__tests__/rating-flags.test.ts`): **11 files, 126
tests, all passing**. I did not re-run the full 345-test suite, the build, or Playwright — the tester
ran all of those fresh from a clean `npm ci` and reported them green, and nothing in the diff gives me
reason to doubt it. I also confirmed the working tree's 27 modified files are CRLF/LF noise with zero
content difference, as the tester stated.

## Summary

| | |
| --- | --- |
| **Must fix before ship** | B1 only — `flagRating` must either reset `resolvedAt` on a repeat report, or deliberately and visibly suppress it (documented + tested). Includes updating `mutations.test.ts:85`, which currently asserts the defective behaviour as correct. |
| **Fine as tracked follow-ups** | NB1 (form/API eligibility divergence on update), NB2 (multi-rating aggregate coverage), NB3 (`feedback: null` handling), NB4 (stale schema comments), NB5 (single-review copy), NB6 (privacy-policy copy), NB7 (manual responsive + screen-reader passes). |

Re-run `/factory-build ratings-and-feedback` after B1, or override at `/factory-ship` with an explicit
decision and a filed issue. Everything else here I would be comfortable shipping under my own name.
