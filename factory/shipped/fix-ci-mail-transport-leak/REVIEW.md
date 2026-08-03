# REVIEW — fix-ci-mail-transport-leak

**Verdict: APPROVED WITH NOTES (approve-with-followups).**

No code changes requested. The diff is correct, minimal, and does exactly what the plan says.
One acceptance criterion (**AC 6 — a real green GitHub Actions run**) is genuinely unmet and
must be satisfied *during* `/factory-ship`, before the merge, rather than by another
build/test/review cycle. See "AC 6" below — I consider this a hard pre-merge gate, not a
formality, and the reason is stronger than the tester's report conveys.

Reviewed independently: I read the diff and the full `ci.yml` myself, re-ran the
acceptance-critical checks, and re-derived the before/after reproduction rather than accepting
`TEST_REPORT.md`'s word for it.

---

## 1. The diff (verified, not summarised from the plan)

`git diff main..HEAD --name-only` produces exactly three files:

```
.github/workflows/ci.yml
factory/work/fix-ci-mail-transport-leak/PLAN.md      (checkbox ticks only)
src/lib/mail/__tests__/mailer.test.ts
```

Three commits, cleanly separated (ci fix / test fix / plan checkboxes). Both code hunks are
small and are the ones the plan describes:

- `ci.yml`: removes the four-line job-level `MAIL_TRANSPORT: "file"` block from `build-and-test`
  and adds a step-level `env:` block on the `Build` step, with a comment that explains *why* it
  must stay step-scoped. Correct and complete.
- `mailer.test.ts`: three `vi.stubEnv(<name>, undefined)` calls appended to the existing
  `beforeEach`, after the `TEST_ENV` loop and before the console spies. Correct placement —
  per-test `vi.stubEnv` calls (lines 88, 95, 101, 128, 144-145, 162, 170) still run after
  `beforeEach`, so every opt-in test keeps working, and the untouched `afterEach`'s
  `vi.unstubAllEnvs()` still restores everything.

`vi.stubEnv(name, undefined)` is valid on the installed Vitest **4.1.10** — I confirmed the
signature in `node_modules/vitest/dist/index.d.ts:593` types the value as `string | undefined`.
The plan's claim here is accurate, not assumed.

No production code touched: `src/lib/mail/mailer.ts` and `src/lib/env.ts` are byte-identical to
`main`. Correct — the transport-resolution logic was never the bug.

## 2. YAML env scoping — independently re-verified

I did not take the tester's `js-yaml` claim on faith; I re-parsed the file myself:

- `build-and-test` job-level `env` keys: `DATABASE_URL, DIRECT_URL, NODE_ENV, APP_URL,
  BETTER_AUTH_SECRET`. **No `MAIL_TRANSPORT`.**
- Per-step `env`: `Checkout=null, Setup Node=null, Install dependencies=null, Lint=null,
  Unit tests=null, Build={"MAIL_TRANSPORT":"file"}, Dependency audit=null`.
  `MAIL_TRANSPORT` exists on exactly one step, and it is `Build`.
- `e2e` job: job-level env still carries `MAIL_TRANSPORT: "file"` alongside the postgres
  DSNs, and all six of its steps have no step-level env. `git diff main..HEAD` produces zero
  hunks in the `e2e:` block — it is untouched.

The e2e job-level placement is **correct and must stay job-level**, and I checked the reason
rather than assuming it: `npm run test:e2e` runs `playwright test`, whose `webServer.command` is
`npm run build && npm run start` (playwright.config.ts:39) with `env: { ...process.env, ... }`.
That job's mail transport therefore has to be in scope for both the build and the running
server across a single step, and `e2e/helpers/mail.ts` needs the real `.mail-outbox/`.
Narrowing it there would break the suite. The asymmetry between the two jobs is deliberate and
now documented in the comment. Good.

## 3. Acceptance criteria

| AC | Status | Evidence (mine, re-run) |
|---|---|---|
| 1 — 13/13 with `MAIL_TRANSPORT=file` ambient | **Met** | Ran the mailer suite with `MAIL_TRANSPORT=file RESEND_API_KEY=re_ambient_xyz EMAIL_FROM=ambient@example.com` exported: 13/13 passed. Then copied `main`'s pre-fix `mailer.test.ts` into the suite and ran it under `MAIL_TRANSPORT=file`: **6 failed / 7 passed**, the exact original signature. Removed the temp file; `git status src/lib/mail/` clean afterwards. The fix is causal, not coincidental. |
| 2 — robust to other ambient mail vars | **Met** | Covered by the three-var run above plus the tester's matrix; the `beforeEach` clears all three vars the transport path reads. |
| 3 — full suite green | **Met** | `npm run test`: 87/87, 9 files. Also re-ran with the *exact* `build-and-test` job-level env (`DATABASE_URL`/`DIRECT_URL`/`NODE_ENV=test`/`APP_URL`/`BETTER_AUTH_SECRET`/`CI=true`): 87/87. That is the closest local analogue of the CI unit-test step. |
| 4 — ci.yml scoping | **Met** | Section 2 above. |
| 5 — build still succeeds with the pin | **Met locally** | Tester ran `npm run build` successfully with the step env. Not re-run here (slow, and no reason to doubt it) — but see AC 6: this step has never run on a real runner. |
| 6 — real green Actions run on both jobs | **NOT MET** | See below. |
| 7 — lint / format | **Met** | Tester ran both repo-wide clean; the two edited files are a YAML file and a Prettier-formatted TS file with no style deviation from their neighbours. |

## 4. AC 6 — why the live run matters more than "unverified"

The tester flagged AC 6 as unverified and did not overclaim, which is the right call. But I
looked at the actual Actions history and found something the report does not mention, which
changes how much weight the live run carries:

`gh run list` shows this repo has had **exactly two CI runs ever, both on `main`, both red**:

- `30205659439` (ship project-scaffolding-infra) — failed at **Install dependencies**;
  Lint, Unit tests, Build, Dependency audit all **skipped**.
- `30727549435` (ship user-accounts-auth) — Lint success, **Unit tests failure**, and
  Build + Dependency audit **skipped**.

So on a real GitHub runner:

- `Lint` has passed exactly once. Good.
- `Unit tests` is what this item fixes. Good.
- **`Build` has never executed.** Not once, in either configuration. The step-level `env:`
  block this diff introduces will be exercised on a runner for the very first time.
- **`Dependency audit` has never executed.** `npm audit --omit=dev --audit-level=high` queries
  the live npm advisory database at run time. It exits 0 locally today (I ran it: "found 0
  vulnerabilities"), but that is a network-dependent, date-dependent result.

The `e2e` job **did** pass in run `30727549435` ("Playwright e2e (auth core journeys):
success"), which is reassuring — the half of the pipeline this diff does not touch is proven
green on a runner.

Net: this fix almost certainly resolves the *known* red step, and I would bet on the run going
green. But "the run goes green" is not the same claim as "the unit test step goes green," and
two of the four steps in that job are about to run on Actions for the first time in the
project's history. The whole purpose of this work item is to restore a trustworthy CI gate, so
declaring victory without ever seeing that gate go green would be self-defeating.

**Recommendation (procedural, for the human at `/factory-ship`, not a code change):**

1. Push the branch **and open a PR against `main`**. Note the trigger config —
   `on: pull_request: branches: [main]` plus `push: branches: [main]` — means pushing the
   branch alone triggers **nothing**. A PR is required to get a run. This is a network-visible
   action on the user's GitHub account and should be their explicit call, not something an
   agent does silently.
2. Wait for both `Lint, test, build, audit` and `Playwright e2e (auth core journeys)` to
   report green.
3. Only then merge. If either job is red, that is a **new build to test to review cycle**, not
   something to wave through — particularly if it fails in `Build` or `Dependency audit`,
   since those failures would be new information about the pipeline, not about this fix.
4. Then rebase/merge `learning-paths-content` onto the now-green base and confirm its own run,
   per that item's sequencing note.

I am deliberately not treating AC 6 as CHANGES REQUESTED: there is nothing in the diff to
change, and the criterion is only satisfiable by an action that belongs to the human ship gate.
It is a **merge-blocking condition**, not a rework item.

## 5. Scope

**No scope creep.** Two code files, both named in the plan's in-scope list; the third file is
the plan's own checkboxes. Every item on the plan's out-of-scope list is genuinely untouched:
`mailer.ts`, `env.ts`, `templates.ts`, `playwright.config.ts`, `src/test/setup.ts`, the e2e
job, the `npm audit --omit=dev` scoping, Node version, caching, the Prisma and
`BETTER_AUTH_SECRET` placeholders, and `factory/CHANGELOG.md` (correctly left for
`/factory-ship`).

**Working-tree hygiene note for ship time (not a defect in this branch):** the working tree
currently shows about ten tracked files as modified (`README.md`, `package.json`,
`playwright.config.ts`, `src/app/page.tsx`, e2e specs, and others). I checked
`git diff --numstat` — it is **empty**, i.e. these are CRLF/LF line-ending differences only,
with no content change. There are also untracked `factory/work/learning-paths-content/`
artifacts sitting in the tree. None of this is in the branch's commits, but whoever runs
`/factory-ship` should avoid a blanket `git add -A` that would sweep another work item's
artifacts into this PR.

## 6. Security

Nothing of concern. No secrets or credentials added; the CI placeholder secret is unchanged
and still clearly labelled as a throwaway. No new inputs, deserialization, or permissions. The
change is directionally a small *improvement*: an environment variable that previously applied
to four steps now applies to one, which is least-privilege for env scope. The
"never logs the Resend API key" test (mailer.test.ts:169) still passes under the new
`beforeEach`, so the secret-leak guarantee established by `user-accounts-auth` is intact.

## 7. Style / consistency

Matches the file's conventions. The `ci.yml` comment follows the existing house style in that
workflow (multi-line comment block above the thing it explains, stating rationale rather than
restating the code) and is the right length for a non-obvious constraint that someone would
otherwise "tidy up" back to job level. The `mailer.test.ts` comment does the same and, usefully,
names the specific failure mode and points at `ci.yml`. Quoting, indentation, and Prettier
formatting are consistent with their surroundings.

## 8. Test quality

Strong, and the tester's report is honest — the two things that matter here are the before/after
reproduction and the refusal to claim AC 6, and both are handled correctly.

- The regression tests are the six pre-existing assertions, which is the right call: the bug was
  test-environment sensitivity, not missing coverage. Adding new tests would have been noise.
- The before/after reproduction is the load-bearing evidence, and I reproduced it myself rather
  than trusting it. It holds exactly.
- AC 2's ambient matrix goes beyond the one value that broke CI, so the fix is not narrowly
  patched to a single symptom.

One gap in the test *report*, not the tests: it does not mention the Actions run history in
section 4 above, which is the strongest available argument for why AC 6 should not be waived.

## 9. Consistency with prior shipped items and the review that flagged this

- This is precisely the two-sided fix prescribed by
  `factory/work/learning-paths-content/REVIEW.md` (lines 242-259: move `MAIL_TRANSPORT` out of
  the job-level `env:` into the Build step's own `env:`, *and* have `mailer.test.ts` explicitly
  clear or stub `MAIL_TRANSPORT`). Both halves are implemented as specified. Nothing is
  reopened or contradicted.
- Nothing here undoes `user-accounts-auth`: the e2e job stays blocking (NFR-MAINT-004), the
  file transport still reaches the e2e outbox, and `mailer.ts`'s resolution order
  (explicit override, then resend-if-key, then console) is unchanged.
- `feature/learning-paths-content` touches neither `ci.yml` nor `mailer.test.ts` — I checked
  `git diff main...feature/learning-paths-content --name-only`. No merge conflict when this
  lands first, which is the required order.

## 10. Follow-up (non-blocking, for a separate work item)

**`src/lib/auth/__tests__/options.test.ts` has the identical class of bug.** The plan explicitly
put a sweep of other test files out of scope and asked that any sighting be recorded rather than
fixed here, so this is correctly *not* in this diff — recording it as instructed:

Its `beforeEach` stubs the same five `TEST_ENV` vars and clears nothing else. Running it with
`E2E_DISABLE_RATE_LIMIT=true` in the ambient shell:

```
x buildAuthOptions > enables rate limiting by default (production behaviour)
  Tests  1 failed | 18 passed (19)
```

Ambient `BETTER_AUTH_URL` alone is harmless (19/19). This is **not** red in CI today —
`build-and-test` does not set `E2E_DISABLE_RATE_LIMIT`, and `playwright.config.ts` sets it only
inside `webServer.env` — but it is exactly the trap this item just closed for the mailer, one
env var away. A developer who exports it, or a future workflow env addition, reproduces the
same class of silent inversion. Worth a small follow-up item that clears the vars each
env-sensitive suite assumes absent (or moves that clearing into a shared `src/test/setup.ts`
helper).

Minor process note: no build report exists in `factory/work/fix-ci-mail-transport-leak/`
(only `PLAN.md`, `REQUEST.md`, `TEST_REPORT.md`), so the plan's instruction "if the builder
notices another suspect file, note it in the build report" had nowhere to land. Recording it
here instead.

---

## Summary

The change is correct, minimal, well-commented, and does not touch a line it should not. Six
acceptance criteria are met and independently re-verified, including the acceptance-critical
before/after reproduction. The seventh — a green Actions run — is unmet and should be confirmed
by pushing the branch, opening a PR, and watching both jobs before the merge, because two steps
in the affected job have never executed on a runner in this repo's history. Approve, with that
as a merge-blocking condition and one follow-up item logged.
