---
description: Show the status of all in-flight factory work items.
---

List every directory under `factory/work/`. For each, report the slug and which of REQUEST.md / PLAN.md / TEST_REPORT.md / REVIEW.md exist, so I can see at a glance which stage each is stuck at. Flag if `TEST_REPORT.md.stale` or `REVIEW.md.stale` exist (means `/factory-amend` invalidated them and `/factory-build` needs to run again). If a `.issue` file exists for a work item, include its GitHub issue number. If `factory/work/` is empty or doesn't exist, tell me there are no in-flight items.

For a fuller narrative status report across all work items — including shipped history, blocked-item analysis, and live GitHub issue state — use `/factory-report` instead.
