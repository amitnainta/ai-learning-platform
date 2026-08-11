# Factory changelog

- 2026-07-26 — project-scaffolding-infra — Next.js/TypeScript + Prisma/PostgreSQL scaffold, lint/test/CI harnesses, Sentry error tracking, and documented infra decisions (Vercel host/CDN, Neon Postgres, backup/DR runbooks).
- 2026-08-02 — user-accounts-auth — Registration, login/logout, password reset, role/level onboarding, personal-data export, and account deletion, via Better Auth with database-backed sessions/rate limiting, argon2id hashing, and Tailwind CSS v4.
- 2026-08-02 — fix-ci-mail-transport-leak — Fixed a pre-existing CI env-leak bug (MAIL_TRANSPORT scoping) that was breaking mailer unit tests on main; first fully green Actions run on this repo.
- 2026-08-02 — learning-paths-content — Content data model (Path/Course/ContentItem/GlossaryTerm), a git-versioned content pack with an idempotent importer, markdown rendering with contextual glossary links, and public browse routes (/paths, /courses, /lessons, /glossary).
- 2026-08-05 — progress-tracking — Per-item completion tracking, resume-from-where-you-left-off, and a real dashboard with per-path/per-course percent complete; completes the observable half of FR-PATH-009's progress retention across path switches.
- 2026-08-05 — fix-brace-expansion-audit-advisory — Bumped brace-expansion to 5.0.9 (lockfile only) to resolve a newly-disclosed high-severity advisory (GHSA-rgw5-rvv9-x895) pulled in via @sentry/nextjs's production dependency tree.
- 2026-08-08 — fix-local-dev-port-3030 — Moved the local dev server from port 3000 (conflicting with another project on this machine) to 3030; registered in the shared local port registry.
- 2026-08-08 — fix-nanoid-jsyaml-audit-advisories — Bumped nanoid and js-yaml (lockfile only) to resolve two newly-disclosed high-severity advisories.
- 2026-08-10 — ratings-and-feedback — 1-5 star ratings and free-text feedback on courses and paths, read-time aggregate display, the FR-RATE-008 eligibility gate, flagging for moderation, and a moderation CLI.
