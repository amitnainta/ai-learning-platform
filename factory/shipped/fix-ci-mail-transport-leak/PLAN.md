# PLAN — fix-ci-mail-transport-leak

_Work item slug: fix-ci-mail-transport-leak. Plan produced by factory-planner. Source: factory/work/fix-ci-mail-transport-leak/REQUEST.md._

## Summary

CI on `main` is red for a reason unrelated to any in-flight feature work. `.github/workflows/ci.yml`'s `build-and-test` job declares `MAIL_TRANSPORT: "file"` at **job** level, where it was only ever needed by the `Build` step; it leaks into the `Unit tests` step and forces `resolveMailTransport()` to return `"file"` in tests whose whole point is to exercise the default/derived transport-selection logic. Six assertions in `src/lib/mail/__tests__/mailer.test.ts` fail as a result. This item applies the reviewer's two-sided fix: move the variable off the job and onto the one step that wants it, and make `mailer.test.ts` immune to ambient mail-related environment variables so a future CI env block or a developer's shell cannot reintroduce the same class of failure silently.

## Requirement / quality context

This is **not** tied to an `FR-xxx`/`NFR-xxx` from `docs/requirements/04_detailed_requirements.md`, and no mapping should be invented for it. It is CI hygiene: the `user-accounts-auth` item promoted the Playwright e2e job to a blocking check per **NFR-MAINT-004** and established "a red run blocks a merge" as the working rule. A permanently-red `main` erodes that gate into background noise. This fix restores the gate's signal value so `learning-paths-content` (built, tested, reviewed APPROVED WITH NOTES) can merge onto a green base rather than inheriting someone else's failure.

## Verification of the reported bug (done at plan time, not taken on faith)

- `gh run list --branch main` -> latest run `30727549435` (push, 2026-08-02, "Ship user-accounts-auth") = **failure**.
- `gh run view 30727549435 --log-failed` -> `src/lib/mail/__tests__/mailer.test.ts (13 tests | 6 failed)`; overall `Tests 6 failed | 81 passed (87)`. The failing six, with the observed assertions:
  1. `resolveMailTransport > defaults to console when neither MAIL_TRANSPORT nor RESEND_API_KEY is set` — `expected 'file' to be 'console'`
  2. `resolveMailTransport > uses resend when RESEND_API_KEY is set and no explicit override` — `expected 'file' to be 'resend'`
  3. `sendMail — console transport > does not throw when no Resend key is configured` — `expected "log" to be called at least once`
  4. `sendMail — console transport > logs the recipient, subject, and body text` — `expected '' to contain 'user@example.com'`
  5. `sendMail — resend transport > sends via the Resend SDK with the configured from address` — the Resend constructor is never called
  6. `sendMail — resend transport > throws when Resend returns an error, without leaking the API key` — `promise resolved "undefined" instead of rejecting`
- Mechanism confirmed by reading the source, not inferred from REQUEST.md: `src/lib/mail/mailer.ts` lines 32-38 return `env.MAIL_TRANSPORT` whenever it is set (an explicit override wins over every other rule), `src/lib/env.ts` line 49 reads it straight off `process.env` via zod, and `mailer.test.ts`'s `TEST_ENV` block (lines 33-39) stubs `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `BETTER_AUTH_SECRET`, and `NODE_ENV` but **never clears** `MAIL_TRANSPORT`, `RESEND_API_KEY`, or `EMAIL_FROM`. The ambient job-level value therefore survives into every test. All six failures are exactly the tests that assume those vars are unset, which corroborates REQUEST.md's diagnosis precisely.
- `.github/workflows/ci.yml` line 31 is the leak. The comment already sitting above it concedes the value is not actually required ("Console transport would also work here (build/lint/test never send mail)"), and `MAIL_TRANSPORT` is `.optional()` in the env schema, so the `Build` step would pass without it — but per REQUEST.md we keep the explicit pin and simply narrow its scope rather than deleting it.
- The `e2e` job's job-level `MAIL_TRANSPORT: "file"` (line 101) is **correct and stays**: that job runs no Vitest, and `e2e/helpers/mail.ts` genuinely needs the file outbox.

## Scope

### In scope

- Narrowing `MAIL_TRANSPORT` from job-level to step-level in the `build-and-test` job of `.github/workflows/ci.yml`.
- Adding mail-env isolation (`MAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM` explicitly unset) to the existing `beforeEach` in `src/lib/mail/__tests__/mailer.test.ts`.

### Out of scope (explicitly)

- Anything beyond the two fixes above. No broader CI refactoring: the `e2e` job, the `npm audit --omit=dev` scoping, the Node version, dependency caching, job splitting, and the Prisma / `BETTER_AUTH_SECRET` placeholder env values are all untouched.
- No changes to `src/lib/mail/mailer.ts`, `src/lib/mail/templates.ts`, `src/lib/env.ts`, or `playwright.config.ts`. The production transport-selection behaviour is correct as written; only the test's isolation is at fault.
- No sweep of other test files for ambient-env sensitivity, and no shared Vitest setup-file change (`src/test/setup.ts` stays as-is). If the builder notices another suspect file, note it in the build report — do not fix it here.
- No new tests for behaviour that is not already covered; the six existing tests are the regression tests.
- No changelog edit — `factory/CHANGELOG.md` is written at ship time by `/factory-ship`, matching the two entries already there.

## Tasks

- [x] 1. `.github/workflows/ci.yml`: in the `build-and-test` job, delete the job-level `MAIL_TRANSPORT: "file"` entry (line 31) and its now-misleading comment, and add a step-level `env:` block holding `MAIL_TRANSPORT: "file"` to the `Build` step only. Replace the comment with one stating *why* it must stay step-scoped: at job level it leaks into `Unit tests` and overrides the default-transport logic that `src/lib/mail/__tests__/mailer.test.ts` asserts on. Leave the `Lint`, `Unit tests`, and `Dependency audit` steps with no mail env, and leave the `e2e` job's env block completely unchanged.
- [x] 2. `src/lib/mail/__tests__/mailer.test.ts`: in the existing `beforeEach` (currently lines 53-64), after the `TEST_ENV` stubbing loop, explicitly clear the three mail-related variables the transport-selection path reads: `MAIL_TRANSPORT`, `RESEND_API_KEY`, and `EMAIL_FROM`, each via `vi.stubEnv(name, undefined)` (Vitest 4's `stubEnv` accepts `undefined` to delete a variable — the installed signature in `vitest/dist/index.d.ts` types the value as `string | undefined`). Individual tests that opt in with their own `vi.stubEnv(...)` keep working, because the per-test stub runs after `beforeEach`. The existing `afterEach`'s `vi.unstubAllEnvs()` already restores everything, so `afterEach` needs no change. Add a one-line comment saying these are cleared deliberately so an ambient CI or shell value cannot silently invert the default-transport assertions.

That is the entire change set: two files, no new files, no deletions.

## Branch note

Branch from `main` (e.g. `fix/ci-mail-transport-leak`), **not** from `feature/learning-paths-content`. The whole point is that this lands on `main` first so `learning-paths-content` then merges onto green.

## New manual provisioning steps (human-only)

None. No new environment variable, secret, service, account, or migration. `.env.example` and `docs/runbooks/provisioning-checklist.md` need no edits.

## Acceptance criteria

1. All 13 tests in `src/lib/mail/__tests__/mailer.test.ts` pass **while `MAIL_TRANSPORT=file` is set in the ambient shell/CI environment** — i.e. the six failures listed above are gone under the exact condition that produced them, not merely when the variable happens to be absent.
2. The same file also still passes with `MAIL_TRANSPORT` unset, and with `RESEND_API_KEY` and/or `EMAIL_FROM` set to arbitrary ambient values.
3. `npm run test` is green overall (87/87 as of planning).
4. `.github/workflows/ci.yml` no longer defines `MAIL_TRANSPORT` at the `build-and-test` job level; the `Build` step defines it at step level; the `e2e` job's env block is unchanged.
5. `npm run build` still succeeds in CI — the `Build` step keeps its `MAIL_TRANSPORT=file` pin, so nothing about build behaviour changes.
6. A real GitHub Actions run on this branch's PR is **green on both jobs** (`Lint, test, build, audit` and `Playwright e2e (auth core journeys)`). A local pass alone is not sufficient evidence for this item: the bug only ever manifested in CI, so CI is the acceptance surface.
7. `npm run lint` and `npm run format:check` pass on the two edited files.

## Test plan

| Check | Type | Covers |
|---|---|---|
| Run `npm run test -- src/lib/mail` with `MAIL_TRANSPORT=file` exported in the shell (reproduces CI's condition locally); confirm it fails **before** the test-file fix and passes after | Unit — existing tests, none added | AC 1 |
| Run the same suite with `MAIL_TRANSPORT` unset, then again with `RESEND_API_KEY=x MAIL_TRANSPORT=console EMAIL_FROM=a@b` set | Unit | AC 2 |
| Full `npm run test` | Unit | AC 3 |
| Read back `git diff .github/workflows/ci.yml`; confirm it touches only the `build-and-test` job | Manual / review | AC 4 |
| CI's own `Build` step on the PR | Integration (CI) | AC 5 |
| Open the PR and watch both jobs to completion | Integration (CI) | AC 6 |
| `npm run lint`, `npm run format:check` | Static | AC 7 |

No new test files. The six previously-failing assertions **are** the regression tests for this bug; the fix's job is to make them robust, not to add coverage. The tester should record the before/after result of the `MAIL_TRANSPORT=file` local reproduction explicitly in `TEST_REPORT.md`, since that is the single piece of evidence distinguishing a real fix from a coincidental pass.

## Risks / open questions

- **No blocking open questions.** The failure is reproduced, the mechanism is read off the source, and REQUEST.md prescribes both halves of the fix; nothing here required a judgement call that would change the plan's shape.
- **Low-stakes note 1 — does `Build` need `MAIL_TRANSPORT` at all?** Probably not: it is optional in `src/lib/env.ts` and no build-time route sends mail. Keeping the step-level pin is the conservative choice REQUEST.md asks for and costs nothing. Not worth revisiting in this item.
- **Low-stakes note 2 — other ambient-env-sensitive tests.** Only `mailer.test.ts` failed in the red run, so nothing else is affected today, but the same pattern (stub the vars you want, never clear the ones you assume absent) could exist elsewhere. Deliberately out of scope; if the builder or tester spots one, it belongs in a follow-up item, not this diff.
- **Sequencing risk.** `learning-paths-content` must not merge before this. It is already reviewed and waiting, so the only real risk to this item is a merge-order mistake, not a technical one. Ship this PR first, then rebase/merge `learning-paths-content` and confirm its CI is green on the new base.
