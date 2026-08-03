# Request

**Date**: 2026-08-02

Fix a pre-existing bug found during review of the `learning-paths-content` work item: real GitHub Actions CI on `main` is currently red, unrelated to that item's diff.

**Root cause** (confirmed via `gh run list --branch main` and reproduced locally): `.github/workflows/ci.yml`'s `build-and-test` job sets `MAIL_TRANSPORT: "file"` at job level, intended only for the "Build" step, but it leaks into the "Unit tests" step and breaks 6 assertions in `src/lib/mail/__tests__/mailer.test.ts` that assume no `MAIL_TRANSPORT` env var is set (i.e. the mailer's own default-transport-selection logic).

**Fix, both sides** (per the reviewer's recommendation, to make this a durable fix rather than papering over one symptom):
1. Scope `MAIL_TRANSPORT: "file"` in `ci.yml` to only the step(s) that actually need it (the build/e2e steps), not the entire job — so it no longer leaks into "Unit tests".
2. Harden `mailer.test.ts` so it isn't ambient-environment-sensitive going forward: explicitly clear/stub `MAIL_TRANSPORT` (and any other relevant env vars the transport-selection logic reads) in a `beforeEach`/`afterEach`, so a future CI or local-shell env var can't silently break these tests again the same way.

This item exists specifically to get `main`'s required CI checks green again before `learning-paths-content` merges on top of it (that item explicitly scoped `ci.yml`/`mailer.test.ts` changes out of its own diff to avoid scope creep, per its plan and review). Small, targeted fix — not an invitation to touch anything else in CI or the mail module.
