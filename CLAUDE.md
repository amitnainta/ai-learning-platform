<!--
  Appended automatically by setup.ps1. The "Project specifics" section below
  is normally filled in by running /factory-init in Claude Code — it asks
  you these questions conversationally instead of you hand-editing this file.
-->

## Software factory workflow

This project uses a lights-on software-factory pipeline. Every non-trivial change goes through: init → intake → plan → build → test → review → ship. Work items live under `factory/work/<slug>/`.

- `/factory-init` — run once, first, in any new project. Asks about stack, test/lint commands, base branch, deploy process, and GitHub issue tracking, then fills in this file and `post-edit.ps1`.
- `/factory-new <description>` — capture a new feature/bug and produce a plan (factory-planner). Creates a GitHub issue too, if enabled below.
- `/factory-amend <slug>` — a requirement changed mid-flight; updates the plan, marks stale test/review artifacts, and forces re-approval.
- `/factory-build <slug>` — build, test, and review an approved plan (factory-builder → factory-tester → factory-reviewer).
- `/factory-ship <slug>` — human approval gate; nothing merges to the base branch without my explicit "yes" here. Closes the linked GitHub issue, if any.
- `/factory-status` — quick listing of in-flight work items and which stage each is at.
- `/factory-report` — full narrative status report (factory-manager) across in-flight and shipped work, including blocked-item analysis and GitHub issue state.

Rules for every agent working in this repo:

1. Never commit or push directly to `main`/`master`. Always work on a feature branch and open a PR; nothing merges without explicit human approval via `/factory-ship`.

## Project specifics

**Stack**: Next.js (React + TypeScript), App Router, full-stack monolith — Next.js handles both the frontend (SSR/SSG pages) and the backend (API routes) in one deployable unit. Database: PostgreSQL via Prisma ORM. Not yet scaffolded.

**Test commands** (single project root, once scaffolded):

- Unit/component tests: `npm run test` (Vitest + React Testing Library)
- E2E tests: `npm run test:e2e` (Playwright) — covers the core user journeys required by NFR-MAINT-004 (registration, placement, course completion, rating, certificate issuance)

**Lint/format commands** (single project root):

- `npm run lint` (ESLint — `eslint-config-next` + `typescript-eslint`)
- `npm run format` (Prettier)

**Base branch**: `main`

**Deploy process**: not set up yet.

**GitHub issue tracking**: enabled. `gh` is installed and authenticated as `amitnainta`. `/factory-new` opens an issue per work item; `/factory-ship` closes it on merge.

**Additional conventions**:

- Every work item references the specific requirement ID(s) it implements (`FR-xxx`/`NFR-xxx` from `docs/requirements/04_detailed_requirements.md`) in its plan and PR description, for traceability back to the requirements package.
- Build order respects release tags from the requirements doc: R1 Must items before R1 Should, before touching anything tagged R2/P2/P3.
- Every core user journey (registration, placement, course completion, rating, certificate issuance) must have Playwright e2e coverage before shipping, per NFR-MAINT-004.
