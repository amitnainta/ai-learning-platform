# TEST_REPORT — progress-tracking

Independent verification, not a re-statement of the builder's report. Everything below was
re-run or re-derived from the actual branch state (`feature/progress-tracking`, 8 commits
ahead of `main`, working tree clean apart from LF/CRLF normalization noise from
`core.autocrlf=true` — confirmed with `git diff --shortstat`, zero real content diff) against
a real local Postgres (WSL2 Ubuntu), not mocked at the e2e layer.

**Update (2026-08-04/05): a fix pass landed on top of this original verification, addressing
REVIEW.md's one blocking finding (B1). See "Re-verification — B1 fix pass (commit 0196016)"
below for fresh, independent evidence covering that fix. Everything below that section is the
original pre-fix verification, left intact for history; the toolchain counts it reports
(244/244 Vitest, 35/35 Playwright) are superseded by the post-fix counts in the new section
(246/246, 37/37).**

## Re-verification — B1 fix pass (commit `0196016`)

Independently re-verified, not taken on the builder's word. `git show --stat 0196016` confirms
the fix touches exactly five files: `src/lib/progress/queries.ts`,
`src/app/(app)/dashboard/page.tsx`, `src/lib/progress/__tests__/queries.test.ts`,
`e2e/progress-dashboard.spec.ts`, and `factory/work/progress-tracking/PLAN.md` — nothing outside
the stated scope. `getDashboardProgress()` now returns `hasCurrentPath: boolean` derived from
`currentPathDetail !== null` (i.e. whether `getPathForRoleLevel()` actually resolved a path), and
the dashboard page branches its fallback on `roleOrLevelUnset || (!hasCurrentPath &&
activePaths.length === 0)` instead of the old "role/level merely populated" check that caused B1.

### Fresh toolchain run (post-fix)

| Check | Result |
| --- | --- |
| `npm ci` | Clean install, 701 packages, `prisma generate` via postinstall succeeded |
| `npx prisma migrate deploy` | "No pending migrations to apply" |
| `npm run lint` | Clean, no output |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npx tsc --noEmit` | Clean, no output |
| `npm run build` | Succeeded against CI-equivalent env (placeholder `DATABASE_URL`/`DIRECT_URL`, `NODE_ENV=test`, `BETTER_AUTH_SECRET` placeholder, `MAIL_TRANSPORT=file` — matching `.github/workflows/ci.yml`'s `build-and-test` job). All app routes render `ƒ (Dynamic)`, none prerendered. (Building with the real dev `DATABASE_URL` and no `NODE_ENV` override hit an unrelated Turbopack `/_global-error` prerender crash — an environment quirk of this Next.js 16.2.12/Turbopack combination when run outside the CI-equivalent env, not caused by this fix; the CI-equivalent build is the one that matters and it is clean. The same build succeeds under Playwright's `webServer` command, which forces `NODE_ENV=production` — used for the e2e run below.) |
| `npm run test` (Vitest) | **246/246 passed, 28/28 files** — up from 244/244, the +2 being the new `queries.test.ts` cases for the B1 fix |
| `npx playwright test --workers=1` (matching CI) | **37/37 passed** in 33.9s — up from 35/35, the +2 being the new `progress-dashboard.spec.ts` cases for the B1 fix. Both new tests are present in the run output: `[33/37] ... a role with no path and no prior progress sees the browse-paths fallback, not a dead end` and `[34/37] ... a role with no path but progress on a previously-followed path still sees that path card, not the fallback` |

### Scenario 1 — live: role with no published path, no prior progress (the previously-broken case)

Registered a real user via the running app's actual API (not a mock), on a server built from
this branch and running against real local Postgres:

1. `POST /api/auth/sign-up/email` — new user created.
2. `PATCH /api/account/profile` with `{ "roleArchetype": "ENGINEERING_LEADER", "level":
   "ZERO_KNOWLEDGE" }` — `200`, profile set.
3. `GET /dashboard` (authenticated) — `200`. The rendered HTML contains:
   - The "Browse learning paths" heading.
   - The exact copy `"No path is available for your current role and level yet."`
   - A working `"Browse paths"` link with `href="/paths"`.
   - **Zero** `role="region"` elements anywhere on the page — i.e. no path cards, no stray
     partial UI, no dead end. (`grep -c 'role="region"' dashboard1.html` → `0`.)

This is the exact case REVIEW.md's B1 described as broken (dead end: no explanation, no path
cards, no fallback). It is now fixed, confirmed against a live running instance of this branch's
code, not just the shipped Playwright spec.

### Scenario 2 — live: role switched away from a path with retained progress

Registered a second real user and drove the full sequence through the real API:

1. Signed up, then `PATCH /api/account/profile` → `{ "roleArchetype": "TECHNICAL_BUILDER",
   "level": "ZERO_KNOWLEDGE" }`.
2. `POST /api/progress` → `{ "contentItemSlug": "what-is-artificial-intelligence", "action":
   "complete" }` — `200`, `{"status":"COMPLETE", ...}`.
3. `GET /dashboard` **before** the switch — path bar reads `aria-valuenow="20"`,
   `aria-valuetext="1 of 5 items complete (20%)"` for the Technical Builder / Zero Knowledge path.
4. `PATCH /api/account/profile` → `{ "roleArchetype": "ENGINEERING_LEADER", "level":
   "ZERO_KNOWLEDGE" }` — switching to a role with **no** published path.
5. `GET /dashboard` **after** the switch — `200`. The rendered HTML:
   - Contains **zero** occurrences of "Browse learning paths" (the fallback is correctly
     suppressed — the user has retained progress to show instead).
   - Contains a region labelled `"Technical Builder — Zero Knowledge — previously followed
     path"`, still showing `aria-valuetext="1 of 5 items complete (20%)"` — identical percentage
     to before the switch, i.e. the retained path's percentage did not change or reset.
   - Also (correctly, per decision #7's "any path containing a touched item" rule) shows a
     second retained region, `"Executive / Non-Technical — Zero Knowledge — previously followed
     path"`, since `what-is-artificial-intelligence` is shared between both paths — this is
     expected FR-PATH-009 behaviour, not a bug.
   - Role/Level fields on the page correctly read `ENGINEERING_LEADER` / `ZERO_KNOWLEDGE`
     (the switch itself took effect).

This is the exact case the B1 fix needed to avoid breaking while fixing scenario 1: a user with
no current path but real retained progress must see their path card, not the fallback. Confirmed
live against the real app and database.

### Regression check 3(a) — NOT_SURE_YET still sees the unchanged onboarding prompt

Registered a third user, set `{ "roleArchetype": "NOT_SURE_YET", "level": "ZERO_KNOWLEDGE" }`,
loaded `/dashboard`: exactly one "Browse learning paths" occurrence, with the
`NOT_SURE_YET`-specific copy `"You haven't picked a role yet — browse the paths to find one that
fits."` present verbatim. Unchanged from pre-fix behaviour.

### Regression check 3(b) — a role/level with a real path still shows normal path cards

Registered a fourth user, set `{ "roleArchetype": "TECHNICAL_BUILDER", "level":
"ZERO_KNOWLEDGE" }` with no prior progress, loaded `/dashboard`: zero "Browse learning paths"
occurrences, and a region labelled `"Technical Builder — Zero Knowledge — current path"` with
`aria-valuetext="0 of 5 items complete (0%)"`. Unchanged from pre-fix behaviour.

All four manually-created test users (and their cascaded rows) were deleted directly against the
database after this pass (`prisma.user.deleteMany` scoped to the `@e2e-test.example.com` domain
used for these accounts) so no residue was left in the shared dev database.

### Spot-check: previously-confirmed-solid things still hold

Not a full re-run of the original adversarial harness (not needed — B1 touched none of these
files, confirmed by `git show --stat 0196016` above), just confirmation nothing else broke:

- **Keepalive fix**: `keepalive: true` is still present, unchanged, in both
  `src/components/progress/view-tracker.tsx` and `src/components/progress/curated-open-tracker.tsx`
  (grepped directly). `e2e/progress-complete.spec.ts` (which exercises the auto-view-on-mount
  path this fix protects) passed in both the full 37/37 run and an isolated re-run.
- **Non-sequential resume targeting**: `src/lib/progress/__tests__/percent.test.ts`'s
  "first-non-complete-in-order-even-when-a-later-item-was-completed-first" case is part of the
  246/246 Vitest pass. `e2e/progress-resume.spec.ts` passed in both the full run and an isolated
  re-run.
- **Cascade delete**: `e2e/account-data.spec.ts` (which deletes an account and asserts its
  Verification rows are gone) passed in both the full run and an isolated re-run. Independently,
  my own four manually-created test users' `Progress` rows (created via live `POST
  /api/progress` calls in scenario 2 above) were removed as a side effect of `prisma.user.deleteMany`
  during cleanup with no separate `Progress` deletion needed — the database-level `ON DELETE
  CASCADE` fired correctly.

### Verdict on the B1 fix

**Confirmed fixed, with fresh live evidence, not just re-running the builder's tests.** Both of
REVIEW.md's B1 cases now behave correctly: a role/level with no published path and no prior
progress shows the "no path available, browse paths" fallback instead of a dead end (scenario 1);
a role/level with no published path but retained progress on a previously-followed path shows
that path's card with its correct, unchanged percentage instead of the fallback (scenario 2). The
two previously-correct cases (no role/level or `NOT_SURE_YET`; a role/level with a real path)
remain unchanged. The fix is scoped exactly as described, with no unrelated changes. Vitest is at
246/246 (up from 244/244) and Playwright is at 37/37 (up from 35/35), with both new test files'
additions specifically targeting this fix.

---

## Original verification (pre-fix) — retained for history

Everything below this line was written before the B1 fix pass and describes the branch state at
commit `69ebbfd` (before `0196016`). The toolchain counts here (244/244, 35/35) are stale; see
the section above for current counts. Left unedited as an accurate record of what was verified at
that point in time.

## Toolchain — fresh run results

| Check | Result |
| --- | --- |
| `npm ci` | Clean install, 701 packages, `prisma generate` via postinstall succeeded |
| `npx prisma migrate deploy` | "No pending migrations to apply" — schema already applied cleanly |
| `npm run lint` | Clean, no output |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npx tsc --noEmit` | Clean, no output |
| `npm run build` | Succeeded. All 23 app routes render as `ƒ (Dynamic)` — none prerendered, matching AC14's "must not attempt to prerender any progress-bearing route" |
| `npm run test` (Vitest) | **244/244 passed, 28/28 files** — ran twice (once mid-session, once as a final clean re-run), identical result both times |
| `npm run test:e2e` (Playwright, `--workers=1`, matching CI) | **35/35 passed** — ran three times across the session (see "Environmental issues" below for why); the final clean run (fresh build, real Postgres, no ambient interference) passed 35/35 in 34.3s |

Builder's reported numbers (244/244, 35/35, tsc/lint/format clean) are confirmed independently,
not merely trusted.

## Environmental issues encountered (not code defects)

1. **WSL2 Postgres reachability.** The WSL2 Ubuntu VM's `postgresql` service was stopped at
   session start (Windows had suspended the idle VM) and one mid-session e2e run hit
   `Can't reach database server at localhost:5432` transiently. Both times, `wsl -d Ubuntu -e
   bash -c "sudo service postgresql start"` (and a background keep-alive loop for the rest of
   the session) resolved it immediately; a retry of the same command passed cleanly. This
   matches the builder's disclosed WSL2/Postgres flakiness note — confirmed as a real,
   recurring environmental quirk on this machine, not a code defect.
2. **A second, unrelated environmental issue I found myself**: an already-running `next dev`
   server from a **different, unrelated project** (`C:\Users\amitn\MyAIprojects\MathQuest`,
   apparently another active session on this machine) intermittently squatted on port 3000,
   which is Playwright's default port. When it held the port, our own `npm run build && npm
   run start` failed silently with `EADDRINUSE`, and requests that should have hit our app
   instead hit MathQuest's server (whose email/password sign-up is disabled), producing
   confusing `EMAIL_PASSWORD_SIGN_UP_DISABLED` failures that had nothing to do with this
   branch's code. Confirmed via `Get-CimInstance Win32_Process` showing the listening PID's
   command line pointed at `MathQuest\node_modules\next\dist\server\lib\start-server.js`, and
   by directly curling the port and getting MathQuest's auth response. Worked around by running
   verification passes on `PORT=3100` (with `APP_URL`/`BETTER_AUTH_URL` overridden to match) to
   get an uncontended port; the final official 35/35 confirmation run used this approach. This
   is a pre-existing multi-project machine-sharing artifact, unrelated to progress-tracking's
   code.

Neither issue reflects a defect in the build under test.

## The keepalive fix (deviation #1) — independent stress test, not just code reading

The plan's deviation #1 claims `<ViewTracker>` needed `fetch(..., { keepalive: true })` because
fast navigation away from a lesson page could cancel the in-flight "view" POST before it
reached the server. I did not take this on trust. I wrote an adversarial Playwright spec
(`e2e/tmp-keepalive-stress.spec.ts`, temporary — not committed, removed after use) that:

- Intercepts `POST /api/progress` at the network layer (`page.route`) and holds it for 1.5s
  before letting it continue to the real network — this reliably forces the request to still be
  in flight at the moment of navigation (a plain `page.goto()`-based race turned out to be too
  fast to reproduce reliably on localhost; the delayed-network approach is what actually
  exercises the race the fix is for).
- Waits for the lesson page to hydrate (the "Mark complete" button becoming visible, a reliable
  signal that `<ViewTracker>`'s mount effect has fired), then immediately navigates away
  (`page.goto` to the path page) without waiting for the delayed request to resolve.
- Confirms via `findProgressForEmail()` (direct Prisma read) that a progress row exists with
  `status = IN_PROGRESS`.

**Step 1 — reproduce the bug.** I temporarily removed `keepalive: true` from
`src/components/progress/view-tracker.tsx`, rebuilt, and ran the stress spec: **it failed
reliably** — the progress row was `undefined` in every run (`run 0` through the first several
runs all failed the same way, `expect(lessonRow).toBeTruthy()` received `undefined`). This
proves the failure mode is real, not hypothetical.

**Step 2 — restore the fix and confirm it resolves the bug.** I reverted the edit
(`git checkout -- src/components/progress/view-tracker.tsx`, restoring `keepalive: true`
exactly as committed), rebuilt, and re-ran the identical stress spec: **5/5 passed** — every run
found an `IN_PROGRESS` row despite navigating away while the request was still artificially
delayed.

This is direct, reproduced-both-ways evidence that the fix is genuine and does what it claims,
not just a plausible-sounding comment. The working tree was confirmed clean
(`git status --short`) after reverting, and the temporary spec file was deleted — no trace left
in the branch.

## Resume/percentage/retention — adversarial (non-sequential) verification

### Positional resume, proven non-sequentially

The shipped unit test `src/lib/progress/__tests__/percent.test.ts` ("returns kind 'resume' on
the first non-complete item in course-then-item order, even when a later item was completed
first") already covers this at the pure-function level and passed in the 244/244 run.

I additionally wrote and ran a live, end-to-end adversarial spec
(`e2e/tmp-resume-adversarial.spec.ts`, temporary, removed after use) against the real app and
database:

1. Registered a fresh user onto Technical Builder / Zero Knowledge.
2. Completed **item 3** (`elements-of-ai-course`, the *last* item in course 1) via a direct
   `POST /api/progress` call — **without ever touching items 1 or 2**.
3. Loaded `/dashboard` and confirmed the current-path region's resume link still names
   **item 1** (`what-is-artificial-intelligence`) — not item 3, and not "nothing to resume."
   (It read "Resume:", not "Start:", because decision #6's `nothingStarted` check correctly
   treats "the path has *any* progress row" as "not nothing started," even though the specific
   resume target itself has never been touched — a subtlety I verified by reading
   `findResumeTarget` and then confirming it live.)
4. Completed item 1 and reloaded the dashboard: the resume link advanced to **item 2**
   (`google-ai-crash-course`), not back to item 3 (already complete) and not to a different
   course.
5. Queried the `Progress` table directly: exactly two `COMPLETE` rows (items 1 and 3), and
   **no row at all** for item 2 — confirming "not started" is genuinely row-absence even for an
   item sitting positionally *between* two completed ones, not a third stored value.

Test passed. This is a materially more adversarial ordering than the shipped
`progress-resume.spec.ts` (which completes items in strict authored order); it directly
contradicts what a "most-recently-touched" implementation would produce (which would have
resumed at item 3 or item 1 depending on interpretation, never correctly at item 1 then item 2).

### Percentages — read-time, no denormalization

- `src/lib/progress/percent.ts` is a pure module (no Prisma import, confirmed by reading it) —
  `computeCourseProgress`/`computePathProgress` take a `Map` and item list as arguments and
  compute counts/percent inline on every call. No memoization beyond React's per-request
  `cache()` wrapper in `queries.ts` (request-scoped de-duplication, not a persistent/cross-request
  cache).
- `prisma/schema.prisma` has no `percentComplete`, `progressPercent`, or any denormalized numeric
  column on `Course`, `Path`, or `User` (`grep -n -i "percentComplete\|activePathId"` returns
  nothing but the "deliberately absent" comments).
- Confirmed live: `e2e/progress-dashboard.spec.ts` (part of the official 35/35 run) asserts
  exact `aria-valuenow`/`aria-valuetext` values (`"40"` / `"2 of 5 items complete (40%)"` etc.)
  computed from real DB rows on every page load — no seeded/cached value to match against.

### FR-PATH-009 retention — live, not just asserted in prose

`e2e/progress-dashboard.spec.ts` (official suite, passed) completes an item shared between two
paths, switches paths via the real UI switcher, and asserts: the shared item reads **Complete**
in the new path, the new path's percentage already reflects it, and the previously-followed path
remains listed on the dashboard with its own retained, independently-correct percentage. I read
`listActivePathsForUser`/`getDashboardProgress` in `src/lib/progress/queries.ts` and confirmed
the retained-paths query explicitly excludes the current path (`NOT: { roleArchetype, level }`)
and caps at `.slice(0, 5)` — matching decision #7 and the human-answered "cap at 5" decision.

## Item-by-item verification against the parent's 12-point checklist

| # | Check | Result |
| --- | --- | --- |
| 1 | Fresh toolchain run against real local Postgres | **Done** — see table above. 244/244 Vitest, 35/35 Playwright `--workers=1`, lint/format/tsc/build all clean. |
| 2 | Stress-test `keepalive: true` fix, reproduce original bug | **Done, genuine.** Reproduced the failure with keepalive removed (fails reliably), confirmed the fix resolves it (passes reliably) using a network-delay-forced race, not just a plain fast-navigation test (which was too fast to reproduce the race on localhost). |
| 3 | "Not started" is genuinely absence of a row; no third enum value/sentinel | **Confirmed.** `ProgressStatus` enum has exactly `IN_PROGRESS`/`COMPLETE` (schema read). Live DB check: an item positioned between two completed items, never touched, has **no row at all** (`bySlug.has("google-ai-crash-course") === false`), not a "NOT_STARTED" row. |
| 4 | No code path auto-completes on view/open | **Confirmed.** Only `markComplete()` (`src/lib/progress/mutations.ts`) ever writes `status: "COMPLETE"` — repo-wide grep for `"COMPLETE"` shows no other write site. `recordView()` never touches `status` on update (only `lastViewedAt`), matching the "must never downgrade or upgrade" contract. `<ProgressControl>`'s `handleClick` (the only caller of the `complete` action) fires exclusively from a `<button onClick>` — no mount effect, no timer, no scroll listener. |
| 5 | Percentages computed at read time, no cache/denormalization | **Confirmed.** `percent.ts` is pure/stateless; no denormalized column anywhere in schema; `cache()` in `queries.ts` is per-request only. |
| 6 | FR-PATH-009 retention live: complete shared item, verify both paths | **Confirmed** via the official `progress-dashboard.spec.ts` run (passed) plus code reading of the retained-paths query. |
| 7 | Resume lands on first non-complete item in authored order, not last-viewed, under non-sequential completion | **Confirmed**, both via the shipped unit test and my own live adversarial e2e run (complete item 3 before item 1; resume correctly targets item 1, then item 2). |
| 8 | Export includes progress; account deletion cascades to Progress rows | **Confirmed.** Code-read `GET /api/account/export` (queries `prisma.progress.findMany`, includes slug/title/status/timestamps, no cuid). Live test: completed an item, captured `userId`, deleted the account through the real UI, then queried `prisma.progress.findMany({ where: { userId } })` directly — **zero rows**, and the `User` row itself is gone — proving the database-level cascade, not an assumption from the schema alone. |
| 9 | Three human-answered decisions genuinely implemented | **Confirmed.** (a) No rename-mapping code anywhere in `src/lib/content/*` (grep for `rename` returns nothing) — only the authoring-guide rule exists. (b) `listActivePathsForUser` ends in `.slice(0, 5)` — hard cap confirmed in code. (c) `src/app/api/progress/route.ts` has no rate-limit import/check of any kind — grep for `rateLimit`/`RateLimit` in that file returns nothing. |
| 10 | Spot-check deviations #2/#3/#4 are genuine fixes | **Confirmed**, via `git show` on the actual commits. #2: `ActivePathCard` really changed from `<div>` to `<section aria-label=...>` with `"<course> progress"` labels (and my own adversarial e2e tests independently relied on and successfully used these `role="region"` locators, proving the change is functionally real, not cosmetic). #3: the pre-existing `content-path-switch.spec.ts` fix narrows a locator from a loose regex to an exact-text match — a legitimate disambiguation (the new `<ResumeCard>` link is a real second match), not a weakened assertion; the test still checks visibility and the correct `href`. #4: `export.test.ts`'s Prisma mock gained `progress.findMany` **and** a new assertion (`includes a progress array with slug/title/status, never a content-item id`) — a net-new test, not a loosened one. |
| 11 | Every AC individually verified | See table below. |
| 12 | No manual provisioning checklist; nothing silently assumed | **Confirmed.** `git diff main..feature/progress-tracking --stat -- docs/runbooks/` is empty — `docs/runbooks/provisioning-checklist.md` untouched. The migration applies via the existing `prisma:deploy` step; no new env var is read anywhere in the diff (confirmed by reading `src/lib/env.ts`, which is unchanged by this branch). |

## Acceptance criteria — individual verification

| AC | Criterion (abridged) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Three states; not-started = absent row; in-progress automatic; complete always explicit and reversible | **Pass** | `e2e/progress-complete.spec.ts` (official run); code read of `mutations.ts`/`status.ts`; live DB check of absent row |
| 2 | `POST /api/progress` action vocabulary, session-scoped, 400/404s correct, `view` never downgrades | **Pass** | `src/app/api/__tests__/progress.test.ts` (part of 244/244); code read of `route.ts`/`mutations.ts` (`recordView` never writes `status` on update) |
| 3 | Auto "in progress" via client beacon only, never server-render write | **Pass** (mechanism) / **manual-only for the prefetch-absence check** | `<ViewTracker>` fires only in a `useEffect` (confirmed by reading it); no page component calls a mutation during render (confirmed by reading `lessons/[slug]/page.tsx`, which only reads via `getProgressMapForUser`). The *absence* of a write on link-prefetch is explicitly manual per the plan's own Test plan notes — Playwright cannot reliably assert a negative network effect; I did not attempt to override that call, consistent with the plan's own reasoning. |
| 4 | Dashboard shows percent per current + previously-touched path, per course, honest 0/100 | **Pass** | `e2e/progress-dashboard.spec.ts` (official run); `percent.ts` unit tests (0/100 honesty, de-dup) |
| 5 | Resume link on dashboard/path/course pages, positional, correct link target | **Pass** | `e2e/progress-resume.spec.ts` (official run) + my own adversarial live test |
| 6 | Shared item complete in both paths; role/level switch writes no progress row; retained path stays visible | **Pass** | `e2e/progress-dashboard.spec.ts` (official run); `PATCH /api/account/profile` (unchanged by this branch, confirmed by diff) touches only `User` fields |
| 7 | Fixed query count for dashboard, independent of item/course count | **Pass** | `src/lib/progress/__tests__/queries.test.ts` (exact call-count assertions, part of 244/244) |
| 8 | Exactly one enum + one model; migration has no DROP/ALTER against pre-existing tables; correct indexes | **Pass** | Read `migration.sql` directly — matches the plan's allow-list exactly; read `schema.prisma` — `Progress` has all three specified indexes |
| 9 | Account deletion cascades to Progress; export includes progress array, no secrets | **Pass** | Live cascade-delete DB test (see above); `e2e/account-data.spec.ts` (official run) |
| 10 | Keyboard-operable, real `progressbar` role, `aria-live` announcements, focus rings | **Pass** (automated parts) / **375/768/1280 responsive check is manual-only** | `progress-bar.test.tsx`/`progress-control.test.tsx` (244/244); live `aria-valuenow`/`aria-valuetext` agreement confirmed in `progress-dashboard.spec.ts`; global `:focus-visible` rule in `globals.css` applies to all buttons/links including `<ProgressControl>`. Responsive breakpoint check is explicitly manual per the plan's own test plan — not attempted with a visual tool in this pass. |
| 11 | Anonymous browsing: full read access, no controls, no writes, sign-in link returns to page | **Pass** | `e2e/progress-complete.spec.ts`'s anonymous-visitor assertion (official run) |
| 12 | No Rating/Certificate/Streak/Badge/Bookmark model; no stored percentage column | **Pass** | Grepped `schema.prisma` model/enum list directly — only `ProgressStatus`/`Progress` added |
| 13 | `docs/architecture/progress.md` records decisions #1-#9; authoring guide has the rename rule | **Pass** | Both files read directly; `docs/content/authoring-guide.md` has a `## Never rename a published item's slug` section with a safe procedure |
| 14 | lint/format/test/build/e2e all pass locally; CI stays green | **Pass locally** (see toolchain table). CI itself was not re-run in this pass (no `gh` CI trigger performed) — local re-run of the identical commands CI uses (`npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e --workers=1`) all passed against the actual CI-equivalent env (placeholder-DB build confirmed all routes render dynamically, matching what `build-and-test`'s placeholder-`DATABASE_URL` job requires). |

## Manual-only gaps (explicitly not covered by automation, consistent with the plan's own test plan)

- **AC3's "no write on link prefetch"** — the plan itself designates this manual ("asserting the
  absence of a network-triggered write is unreliable in Playwright"). I did not attempt to
  override that judgment; the design (`<ViewTracker>` fires only in a mount effect, never during
  server render) is sound by inspection and is the control the plan relies on.
- **AC10's 375px/768px/1280px responsive check** — not performed with a visual/screenshot tool
  in this verification pass. Recommend a quick manual pass before ship, as the plan itself
  specifies.
- **AC7's "loads in under 2 seconds" wall-clock claim** — the *fixed query count* half is
  automated and confirmed (`queries.test.ts`); the wall-clock timing half is designated manual
  by the plan ("dev tools / Vercel timing") and was not separately measured here.
- **CI's actual green run** — I did not push/open a PR or trigger the GitHub Actions workflow;
  I instead ran the exact same commands CI runs, locally, against equivalent conditions. This is
  the best available substitute without pushing to a remote, which is out of scope for a test-stage
  verification.

## Overall verdict

**Pass.** Every acceptance criterion is either automatically verified and passing, or is one of
the plan's own explicitly-designated manual-only checks (AC3's prefetch-absence, AC10's
responsive breakpoints, AC7's wall-clock timing) — none of which were silently dropped, and none
of which are code defects. No test was weakened to pass; the three spot-checked deviations (#2,
#3, #4) are genuine, narrowly-scoped fixes. The keepalive fix (deviation #1) is proven, not
assumed — I reproduced the original race condition by temporarily removing it (reliable
failure), then confirmed the shipped code resolves it (reliable pass), using a network-delay
harness that forces the race deterministically rather than hoping to catch it by chance.
Resume-target selection, percentage computation, and FR-PATH-009 retention all hold up under
adversarial (non-sequential) live testing against the real database, not just their own unit
tests. Two unrelated environmental issues (WSL2 Postgres suspend, and a different project's dev
server squatting on port 3000) caused transient failures during this verification session; both
were diagnosed, worked around, and are documented above as non-code-defect noise, not treated as
build failures.
