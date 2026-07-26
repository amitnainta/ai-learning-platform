---
description: Run the build + test + review stages for an approved factory work item.
---

Run the factory pipeline for work item: $ARGUMENTS (the slug, e.g. `add-csv-export`)

Preconditions: `factory/work/<slug>/PLAN.md` must exist and must have been approved by me already. If it doesn't exist, tell me to run `/factory-new` first and stop.

1. Invoke the `factory-builder` subagent with the slug. It works on a feature branch and checks off PLAN.md tasks.
2. Once the builder finishes, invoke the `factory-tester` subagent with the slug. It writes tests and produces `TEST_REPORT.md`.
3. If TEST_REPORT.md shows failures, report them to me and stop — do not proceed to review with a failing build.
4. If tests pass, invoke the `factory-reviewer` subagent with the slug. It produces `REVIEW.md` with a verdict.
5. Summarize the outcome for me: task completion, test results, and the review verdict. Tell me clearly whether this work item is ready for `/factory-ship` or needs another build pass.
