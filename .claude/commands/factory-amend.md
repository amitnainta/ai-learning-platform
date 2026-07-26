---
description: Amend an in-flight work item's requirements mid-pipeline, invalidate stale test/review artifacts, and force re-approval before build continues.
---

Amend work item: $ARGUMENTS (the slug)

1. Confirm `factory/work/<slug>/PLAN.md` exists. If not, tell me to run `/factory-new` first and stop.
2. Ask me directly what changed about the requirement — don't guess or infer it from context. Get a clear statement of the new or changed requirement.
3. Update `PLAN.md`:
   - Add or append to an **Amendments** section (create it if it doesn't exist yet) with today's date, what changed, and why.
   - Update the Scope, Tasks, and Acceptance criteria sections directly so they reflect the new requirement — don't just log the change and leave the now-wrong original sections in place.
   - Uncheck any task checkboxes that need to be redone because of this change.
4. If `factory/work/<slug>/TEST_REPORT.md` or `REVIEW.md` already exist, they were written against the old requirement and are now stale. Rename them to `TEST_REPORT.md.stale` and `REVIEW.md.stale` (keep the history, don't delete) and tell me clearly that this work item needs to go through `/factory-build` again before it can ship.
5. If `factory/work/<slug>/.issue` exists and `gh auth status` succeeds, add a comment to that GitHub issue summarizing the amendment: `gh issue comment <number> --body "Requirement amended: <summary>"`. If `gh` isn't available, skip this silently.
6. Show me the updated Scope, Tasks, and Acceptance criteria sections so I can confirm the amendment is captured correctly before we continue.

Never amend silently mid-build without this confirmation step — an amendment changes what "done" means, so it deserves the same explicit approval a new plan would get. Do not resume `/factory-build` yourself after amending; wait for me to run it.
