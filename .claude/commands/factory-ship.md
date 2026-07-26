---
description: Human approval gate — summarize a work item's status and, only on my explicit go-ahead, merge it.
---

Prepare a ship decision for work item: $ARGUMENTS (the slug)

1. Read `factory/work/<slug>/PLAN.md`, `TEST_REPORT.md`, and `REVIEW.md`. If any of these are missing, tell me which stage hasn't been completed and stop. If `TEST_REPORT.md.stale` or `REVIEW.md.stale` exist (left behind by `/factory-amend`), tell me this work item was amended after its last test/review pass and needs `/factory-build` run again before it can ship — stop here, don't proceed to step 2.
2. Show me, concisely:
   - The review verdict (APPROVED / APPROVED WITH NOTES / CHANGES REQUESTED).
   - Test suite result (pass/fail counts).
   - Any unmet acceptance criteria or open notes from the review.
   - The `git diff --stat` against the base branch, so I can see the blast radius at a glance.
3. Do not merge, push, or run any git command that changes branch state yet. Explicitly ask me: "Ship this? (yes / no / changes needed)"
4. Only if I reply yes: merge the feature branch into the base branch (no `--no-verify`, no force), then move `factory/work/<slug>/` to `factory/shipped/<slug>/` and append a one-line entry to `factory/CHANGELOG.md` (date, slug, one-line summary).
5. If `factory/work/<slug>/.issue` exists (before you move the directory) and `gh auth status` succeeds, close that GitHub issue with a comment referencing the merge commit: `gh issue close <number> --comment "Shipped in <merge-commit-hash>: <one-line summary>"`. If `gh` isn't available or tracking was disabled, skip this silently.
6. If I reply "changes needed," ask me what's needed and route it back to `/factory-build` framing rather than shipping.

This command is the one non-negotiable human gate in the whole pipeline. Never skip step 3.
