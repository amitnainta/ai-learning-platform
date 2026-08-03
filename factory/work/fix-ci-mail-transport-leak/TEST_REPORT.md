# TEST REPORT — fix-ci-mail-transport-leak

Independently re-verified (not taken on the builder's report). Branch `fix/ci-mail-transport-leak`
(3 commits from `main`), not pushed. All commands run locally against the actual branch state.

## Diff scope (AC 4, "no scope creep")

`git diff main..HEAD --name-only`:

```
.github/workflows/ci.yml
factory/work/fix-ci-mail-transport-leak/PLAN.md
src/lib/mail/__tests__/mailer.test.ts
```

Exactly the two files the plan names, plus the plan's own checkbox update. Confirmed
`src/lib/mail/mailer.ts` and `src/lib/env.ts` are untouched — matches the plan's explicit
out-of-scope list.

## AC 1 — passes with `MAIL_TRANSPORT=file` ambient (the acceptance-critical check)

**CONFIRMED, genuinely holds.** Ran `npx vitest run src/lib/mail/__tests__/mailer.test.ts`
with `MAIL_TRANSPORT=file` exported in the shell before invoking vitest (the exact leak
condition that broke CI):

```
Test Files  1 passed (1)
     Tests  13 passed (13)
```

To rule out a coincidental pass, I reproduced the *original* failure first: temporarily
swapped in `main`'s (pre-fix) `mailer.test.ts` in the working tree, ran it under the same
`MAIL_TRANSPORT=file` ambient condition, and got the identical 6-failure signature from the
plan's diagnosis (`expected 'file' to be 'console'`, `expected 'file' to be 'resend'`, empty
console-log assertions, Resend constructor never called, promise not rejecting). Restored the
fixed file (`git diff` on the file was then empty) and re-ran — all 13 pass. This proves the
fix, not just the absence of a regression.

## AC 2 — robust to other ambient mail vars, not narrowly patched to one value

All run against the fixed `mailer.test.ts`, each a separate ambient condition:

| Ambient env | Result |
|---|---|
| `MAIL_TRANSPORT=file` | 13/13 pass |
| `MAIL_TRANSPORT=resend` | 13/13 pass |
| `MAIL_TRANSPORT=console` | 13/13 pass |
| `RESEND_API_KEY=<value>` only | 13/13 pass |
| `EMAIL_FROM=<value>` only | 13/13 pass |
| All three set simultaneously (`MAIL_TRANSPORT=file RESEND_API_KEY=re_x EMAIL_FROM=a@b.com`) | 13/13 pass |
| Clean shell (none set) | 13/13 pass |

The `beforeEach` fix (`vi.stubEnv(name, undefined)` for all three vars) is comprehensive, not
narrowly patched to the one value that happened to break CI.

## AC 3 — full suite green

`npm run test` (Vitest, clean shell): **87/87 passed**, 9 test files.

## AC 4 — ci.yml scoping, `e2e` job untouched

Confirmed by reading the diff and by parsing the resulting YAML programmatically (`js-yaml`):

- `build-and-test` job-level `env` keys: `DATABASE_URL, DIRECT_URL, NODE_ENV, APP_URL,
  BETTER_AUTH_SECRET` — no `MAIL_TRANSPORT`.
- `Build` step's own `env`: `{ MAIL_TRANSPORT: 'file' }` — present only there.
- `Lint`, `Unit tests`, `Dependency audit` steps have no `env` block, so they inherit only the
  job-level vars above (never `MAIL_TRANSPORT`).
- `e2e` job is byte-for-byte identical to before this branch (`git diff main..HEAD` shows zero
  hunks touching the `e2e:` block); its job-level `MAIL_TRANSPORT: "file"` is intentionally
  unchanged.
- YAML step-level `env` semantics: a step's `env:` block is merged into the job-level env *for
  that step's process only*; it does not replace or leak into other steps' environments. This
  is standard, documented GitHub Actions behavior and matches what the diff does — no subtle
  YAML structuring mistake.

## AC 5 — build still succeeds with the pinned transport

`npm run build` (with the same env vars the CI job sets, including `MAIL_TRANSPORT=file` on
this step exactly as the workflow now does): succeeded, all 15 routes compiled/generated. One
pre-existing, unrelated warning (`"middleware" file convention is deprecated`) — not caused by
this change.

## AC 6 — real GitHub Actions run

**Not verified — cannot be, without pushing.** `gh` is installed and authenticated
(`amitnainta`), but the branch is intentionally unpushed per the task's constraints, and
pushing was not requested by the user for this verification pass. I did not push. In lieu of a
real run, I relied on: (a) exact reproduction of the local leak condition and its fix (AC 1/2
above), (b) programmatic YAML parsing confirming the env-scoping structure is correct, and (c)
running every other CI step's command locally (lint, build, unit tests, e2e) with equivalent
env vars. This is the best available substitute for an actual Actions run but is not a
substitute for AC 6 itself — flagging explicitly rather than claiming it's covered.

## AC 7 — lint / format on the two edited files

`npm run lint` — clean, no errors/warnings.
`npm run format:check` — "All matched files use Prettier code style!"
(Both run repo-wide, which subsumes the two edited files; no findings anywhere.)

## Additional toolchain checks (not separately numbered in AC, but requested)

- `npm ci` — clean install, 603 packages, no errors (1 pre-existing high-severity advisory in
  a dev-only transitive dep, unrelated to this change, already documented in `ci.yml`'s
  Dependency audit step comment).
- `npx tsc --noEmit` — no errors.
- `npx playwright test --workers=1` (against a local WSL2 Postgres, migrations applied via
  `npx prisma migrate deploy`/status) — **15/15 passed**, all core journeys (registration,
  login/logout, password reset, account profile, account data export/deletion, smoke).

## Overall result

**PASS.** All locally-verifiable acceptance criteria (1, 2, 3, 4, 5, 7) hold under independent
re-verification, including the acceptance-critical AC 1 reproduced from a genuine before/after
(confirmed the bug on `main`'s test file, confirmed the fix resolves it, under the identical
`MAIL_TRANSPORT=file` ambient condition that broke real CI). AC 6 (a real GitHub Actions run
green on both jobs) cannot be verified without pushing the branch and is explicitly called out
as unverified rather than assumed. The diff is minimal and surgical: exactly
`.github/workflows/ci.yml` and `src/lib/mail/__tests__/mailer.test.ts`, no other production or
test files touched.
