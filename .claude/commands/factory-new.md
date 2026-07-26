---
description: Start a new factory work item (feature, bug, or refactor) and run it through planning.
---

A new software factory work item is being started: $ARGUMENTS

0. First, check `CLAUDE.md` for the "Project specifics" section. If it still contains bracketed placeholders like `[e.g. ...]` instead of real answers, stop and tell me to run `/factory-init` first — don't proceed with an unconfigured project.
1. Pick a short, filesystem-safe slug for this work item (kebab-case, e.g. `add-csv-export`).
2. Create `factory/work/<slug>/REQUEST.md` containing the raw request above, verbatim, with today's date.
3. Invoke the `factory-planner` subagent, giving it the request and the slug, and have it produce `factory/work/<slug>/PLAN.md`.
4. Check `CLAUDE.md` for `GitHub issue tracking: enabled`. If enabled, run `gh auth status`; if that succeeds, create an issue with `gh issue create --title "<short description>" --body "<summary from PLAN.md>, tracked locally under factory/work/<slug>/"`, then save the returned issue number (just the number) to `factory/work/<slug>/.issue`. If tracking is disabled, or `gh auth status` fails, or `gh` isn't installed, skip this step silently — never block planning on it.
5. When the plan is ready, show me a short summary of the plan (scope + task count + open questions) and, if one was created, the GitHub issue number/link. Stop. Do not start building until I explicitly approve the plan.
