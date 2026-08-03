# Factory changelog

- 2026-07-26 — project-scaffolding-infra — Next.js/TypeScript + Prisma/PostgreSQL scaffold, lint/test/CI harnesses, Sentry error tracking, and documented infra decisions (Vercel host/CDN, Neon Postgres, backup/DR runbooks).
- 2026-08-02 — user-accounts-auth — Registration, login/logout, password reset, role/level onboarding, personal-data export, and account deletion, via Better Auth with database-backed sessions/rate limiting, argon2id hashing, and Tailwind CSS v4.
- 2026-08-02 — fix-ci-mail-transport-leak — Fixed a pre-existing CI env-leak bug (MAIL_TRANSPORT scoping) that was breaking mailer unit tests on main; first fully green Actions run on this repo.
