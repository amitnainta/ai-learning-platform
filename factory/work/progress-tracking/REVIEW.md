# REVIEW - progress-tracking

Independent review stage, **pass 2** (final). Pass 1 returned CHANGES REQUESTED with one blocking
finding (B1). A fix pass landed as commit `0196016` and the tester re-verified. Everything below is
re-derived first-hand from the actual diff and the shipped source, plus my own probe runs - not from
the builder's or tester's account of it.

## Verdict

**APPROVED WITH NOTES** - ready for `/factory-ship`. No blocking items remain.

B1 is genuinely closed. I re-derived the fix's boolean logic myself, enumerated every reachable
combination of (role/level state) x (path resolves) x (retained progress), and found **no remaining
dead-end case** - including two combinations that neither the tester's two live scenarios nor the
shipped test suite covers. Both of those behave correctly; I verified them directly rather than by
inspection. The nine follow-ups below are non-blocking and none of them needs to be fixed before ship.

---

## B1 re-verification (the blocking finding from pass 1)

### The derivation is correct

`src/lib/progress/queries.ts:249` now returns `hasCurrentPath: currentPathDetail !== null` - derived
from whether `getPathForRoleLevel()` actually resolved a published `Path` row, not from whether the
user's fields are populated. The old internal boolean was renamed to `roleAndLevelSet` (line 233) and
is now used only for what it actually means: deciding whether it is worth issuing the
`getPathForRoleLevel` query at all. That is the right split, and it is the split whose absence caused
B1.

`src/app/(app)/dashboard/page.tsx:101-103`:

    const roleOrLevelUnset =
      !user.roleArchetype || user.roleArchetype === "NOT_SURE_YET" || !user.level;
    const showBrowsePrompt = roleOrLevelUnset || (!hasCurrentPath && activePaths.length === 0);

`requireOnboardedUser()` (`src/lib/auth/session.ts`) redirects to `/onboarding` when either field is
null, so on this route `roleOrLevelUnset` is reachable only for `NOT_SURE_YET`. The two render blocks
(lines 116-132 browse prompt, lines 134-140 path cards) are **independent siblings**, not an
if/else - which is what makes the `NOT_SURE_YET`-with-progress case come out right.

### The full matrix, and what the two tested scenarios missed

Enumerating every reachable combination on `/dashboard`:

| # | Role/level | Path resolves | Retained progress | Renders | Covered by |
| --- | --- | --- | --- | --- | --- |
| 1 | NOT_SURE_YET | no (by definition) | no | prompt only | tester live check 3(a); no automated test |
| 2 | NOT_SURE_YET | no | yes | prompt AND retained cards | nothing - I verified it myself |
| 3 | real role | yes | no | current-path card, no prompt | unit + tester 3(b) |
| 4 | real role | yes | yes (other paths) | current + retained cards, no prompt | existing e2e retention test |
| 5 | real role | no | no | prompt only | new unit + new e2e (the original B1) |
| 6 | real role | no | yes | retained cards, no prompt | new unit + new e2e |
| 7 | real role | no | rows exist but no published path contains them | prompt only | nothing - I verified it myself |
| 8 | real role | yes, but path has zero published courses | any | card with the "No items yet" bar | percent.ts unit tests |

The tester's two live scenarios covered rows 5 and 6, and their regression checks covered rows 1 and
3. **Rows 2 and 7 were untested by anyone.** I closed both myself with a temporary Vitest probe
against the real `getDashboardProgress` (mocked Prisma/content-query, deleted afterwards - working
tree confirmed clean):

- **Row 2 (the case the parent asked about specifically).** For a `NOT_SURE_YET` user with one
  `COMPLETE` row: `getPathForRoleLevel` is never called, `hasCurrentPath` is `false`, and
  `activePaths` still contains one non-current path summary at the correct 50%. Replaying the page's
  own booleans verbatim gives `showBrowsePrompt === true` AND `activePaths.length > 0` - so the user
  sees the onboarding prompt and their retained path card. The onboarding branch does **not** take
  precedence and does not suppress the card. That matches PLAN.md Risks #9 exactly. No dead end, no
  swallowed progress.
- **Row 7.** Progress rows exist but no published path contains those items (an item in a course
  attached to no path, or the user's former path having been unpublished since). `activePaths` comes
  back empty, `hasCurrentPath` is false, `showBrowsePrompt` is true - the fallback shows. Correct;
  this is the case a naive "has progress, so skip the prompt" fix would have got wrong.

I also checked the `NOT_SURE_YET` interaction with the retained-path query: `listActivePathsForUser`
adds `NOT: { roleArchetype: "NOT_SURE_YET", level }`, which matches no `Path` row and is therefore a
no-op rather than an over-exclusion. Correct outcome, though see F8 on how it is named.

**Conclusion: no gap. B1 is closed, and the fix is architecturally sound rather than merely passing
the two scenarios someone thought to check.** The condition is now derived from the same fact the
render depends on (did a path resolve), in one place, exported as one field.

### One observation on the boolean, not a defect

`!hasCurrentPath && activePaths.length === 0` is logically redundant today: `getDashboardProgress`
unconditionally pushes the current-path summary when `currentPathDetail` is non-null, so
`hasCurrentPath === true` implies `activePaths.length >= 1`, and the expression reduces to
`activePaths.length === 0`. Keeping the explicit `hasCurrentPath` term is defensive and
self-documenting, and it is what makes the intent readable. Recorded only so a future reader does not
assume it is load-bearing in a way it is not.

### Test quality of the new coverage

Not shallow, and not tautological:

- `src/lib/progress/__tests__/queries.test.ts:141` and `:157` mock `getPathForRoleLevel` to resolve
  `null` - i.e. they simulate the actual production condition (no published path for that role/level)
  rather than asserting the field echoes an input. The second case additionally proves the retained
  path is still surfaced with `isCurrent: false`, which is the half of the fix that could have
  regressed FR-PATH-009. The pre-existing NFR-PERF-006 call-count assertions were extended with
  `hasCurrentPath: true`, not weakened.
- `e2e/progress-dashboard.spec.ts` (2 new cases) exercises a real browser against a real database.
  The first asserts three positive locators (heading, the exact copy string, the `/paths` link) plus
  two negative `toHaveCount(0)` assertions on the current-path / previously-followed-path regions -
  so it fails both if the fallback disappears and if stray partial UI appears. The second asserts the
  retained region is visible AND that the fallback heading has count 0, so it would catch an
  over-eager fix that showed both. Neither is vacuous: `registerAndOnboard`
  (`e2e/helpers/register.ts:39-44`) throws on a failed profile PATCH, so an `ENGINEERING_LEADER`
  onboarding that silently failed would error rather than pass, and a user left un-onboarded would be
  redirected to `/onboarding` and fail the heading assertion.

I re-ran the unit suite myself: **246/246 passed, 28/28 files**, and `npx tsc --noEmit` is clean. I
did not re-run Playwright; the tester's 37/37 is documented with both new test names visible in the
run output, and I read both new specs directly.

---

## Scope of the fix pass

`git diff --name-only 69ebbfd..HEAD` returns exactly five files: `src/lib/progress/queries.ts`,
`src/app/(app)/dashboard/page.tsx`, `src/lib/progress/__tests__/queries.test.ts`,
`e2e/progress-dashboard.spec.ts`, `factory/work/progress-tracking/PLAN.md`. No scope creep. The
PLAN.md edit is an appended "Builder notes (fix pass)" section that accurately describes what was done
and reopens no task.

Working tree: `git status --short` shows 25 modified source files but `git diff --shortstat` returns
nothing - CRLF/LF normalisation noise from `core.autocrlf=true`, identical to pass 1. There is no
uncommitted content on this branch. The four `factory/work/progress-tracking/` artifacts
(`REVIEW.md`, `TEST_REPORT.md`, `REQUEST.md`, `.issue`) remain untracked (see F7).

## Pass-1 follow-ups: none touched, none made worse

`git diff --stat 69ebbfd..HEAD` over every file named in F1-F7 (`mutations.ts`,
`progress-control.tsx`, `curated-open-tracker.tsx`, `view-tracker.tsx`, `content-item-card.tsx`,
`lessons/[slug]/page.tsx`, `courses/[slug]/page.tsx`, `api/progress/route.ts`,
`api/account/export/route.ts`, `prisma/schema.prisma`) is **empty**. F1-F6 are unchanged and
unaffected. F7's second bullet (duplicate `hasCurrentPath`/`hasPath` computation) is the thing the fix
pass addressed - partially; see F8, which is the residue of it.

## Security and data-model conclusions: reconfirmed, unchanged

Every file the pass-1 security analysis rested on is byte-identical since `69ebbfd`, so those
conclusions carry forward rather than being re-asserted on faith:

- **IDOR posture unchanged.** `src/app/api/progress/route.ts` and `src/lib/progress/mutations.ts` are
  untouched. `userId` still comes only from `requireUser()`; the Zod object still strips an
  attacker-supplied `userId`; `resolvePublishedContentItemBySlug` still gates on
  `status: "PUBLISHED"`; the test asserting an attacker-chosen `userId` is ignored still passes.
- **`completedAt` and percentage trustworthiness unchanged.** `mutations.ts` and `percent.ts` are
  untouched: stamped once on first completion, preserved on repeat, nulled on reopen; 100% still means
  every currently-published item complete, de-duplicated first. FR-CERT and FR-RATE can still build on
  this without rework, with the same two recorded caveats (concurrent-complete millisecond ambiguity;
  no CHECK constraint behind the status/timestamp invariant).
- **The fix itself adds no attack surface.** `hasCurrentPath` is a boolean derived from a query already
  scoped to the session user via `requireOnboardedUser()`. It exposes no new data, no new field to the
  client, no new query, and no new input. `getDashboardProgress` has exactly one consumer (the
  dashboard page), verified by grep.

---

## Non-blocking follow-ups

F1-F7 are carried forward from pass 1 (still open, still non-blocking). F8-F9 are new, arising from
the fix pass.

- **F1.** `reopen` on a nonexistent row throws Prisma P2025 through an unguarded route, producing a
  500 instead of a clean 404 (`src/lib/progress/mutations.ts:65-71`). Reachable only by a crafted
  request or a narrow stale-page race; nothing is corrupted and nothing leaks. Cheapest fix: make
  `reopen` an upsert, or catch P2025 in the route. Add the missing test either way.
- **F2.** `ProgressControl`'s `await fetch` has no try/catch, so a rejected promise (offline, reset)
  leaves the button stuck on "Saving...". This is the established repo convention
  (`path-switcher.tsx`, `delete-account-form.tsx` have the same shape), so fix all three together
  rather than making this one inconsistent.
- **F3.** `CuratedOpenTracker` wraps the ExternalLink plus the publisher span, so clicking
  non-interactive text marks the item "in progress". One-line scope tightening.
- **F4.** `ViewTracker`'s `firedRef` is never reset when `contentItemSlug` changes; correctness depends
  on App Router remounting the segment. Add a `key` on the slug and one e2e assertion that clicking
  "Next" from lesson A marks lesson B in progress.
- **F5.** The `item-<slug>` anchor id can duplicate if one item ever appears twice in a single path -
  which `computePathProgress` explicitly anticipates. Latent only against today's content pack.
- **F6.** The lesson page loads the user's whole progress map to read one row; a `findUnique` on the
  composite key is the natural shape.
- **F7.** Smaller items: the `"#"` `backHref` dead link in `courses/[slug]/page.tsx` when a course
  belongs to no published path; the untracked `factory/work/progress-tracking/` artifacts (the ship
  stage should commit `TEST_REPORT.md`, `REVIEW.md`, `REQUEST.md`, `.issue`); and documenting the
  keepalive 64 KiB payload ceiling and the Firefox-below-133 fallback in
  `docs/architecture/progress.md` so the decision record reflects the fix's real guarantees.
- **F8 (new).** Name collision - the same trap that produced B1. `listActivePathsForUser` has a local
  `hasCurrentPath` at `src/lib/progress/queries.ts:148` defined as
  `Boolean(user.roleArchetype) && Boolean(user.level)` - i.e. "the fields are set", which does not
  exclude `NOT_SURE_YET` and does not mean a path resolved. It now sits 60 lines above an exported
  field of the identical name meaning the opposite thing. It is behaviourally harmless today (I
  verified the resulting `NOT` filter is a no-op for `NOT_SURE_YET` because no `Path` row carries that
  role), but it is exactly the ambiguity the fix was meant to retire. Rename it to `roleAndLevelSet`
  to match its sibling in `getDashboardProgress`.
- **F9 (new).** Copy wart in the row-2 case. For a `NOT_SURE_YET` user who has made progress, the
  prompt reads "Your progress will appear here once you start a path." directly above cards that are
  already showing their progress. Correct behaviour, mildly contradictory wording. Also worth noting
  that the `NOT_SURE_YET` dashboard branch has zero automated coverage of any kind (grep for
  `NOT_SURE_YET` across `e2e/` returns nothing) - it was verified live by the tester and by my probe,
  but a cheap e2e case would lock it in.

---

## Pass-1 findings retained (re-confirmed unchanged)

All of the following were verified first-hand in pass 1 against files that the fix pass did not
touch, and therefore still hold:

- The `keepalive: true` beacon fix is the correct primitive (`sendBeacon` cannot set a JSON
  content-type), with the payload-ceiling and Firefox-133 caveats recorded in F7.
- "Not started" is genuinely the absence of a row: two-value enum, one mapping point
  (`displayStatusFor`), type-enforced labels, no write path that can produce a third state.
- Percentages are read-time only: `percent.ts` imports nothing, `queries.ts` uses React `cache()`
  (per-request, not persistent), and there is no denormalized column anywhere.
- The migration contains only `CREATE TYPE`, `CREATE TABLE progress`, three indexes and two
  `ADD CONSTRAINT` - no `DROP`, no `ALTER` against any pre-existing table. AC8 met exactly.
- Scope discipline: no `Rating`/`Certificate`/`Streak`/`Badge`/`Bookmark` model or code path; the
  three earlier deviations (#2 landmark regions, #3 e2e locator narrowing, #4 export test) are genuine
  fixes and net-additive, not weakened assertions.
- Export and cascade are correctly user-scoped, with no cuid and no secret in the payload.
- The plan's designated-manual checks (prefetch-absence, 375/768/1280 responsive pass, wall-clock
  dashboard timing) remain genuinely manual and were not silently dropped. Worth the human's few
  minutes before ship, as the plan itself specifies.
