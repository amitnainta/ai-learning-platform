---
description: Interactively configure this project for the factory workflow — run this once, right after setup.ps1, before any /factory-new.
---

Configure this project's factory workflow. Ask me the following, one at a time, and wait for my answer before moving to the next — do not guess plausible-sounding defaults on my behalf:

1. What's the stack? (language, framework, and whether it's split into separate frontend/backend, e.g. "FastAPI backend + React/Vite frontend").
2. What's the test command? If there are multiple suites (e.g. separate backend and frontend tests), get each one and which directory it runs from.
3. What's the lint/format command? Same — get each one separately if there's more than one.
4. What's the base branch name? (If I have no strong preference, default to `main` and confirm with me rather than assuming silently.)
5. What's the deploy process, if any? ("not set up yet" is a completely fine answer — record it as-is rather than inventing one.)
6. Do you want work items also tracked as GitHub issues? If yes, check `gh auth status` first — if it fails or `gh` isn't installed, tell me clearly what's missing (install the GitHub CLI, then run `gh auth login`) and ask whether to enable it anyway for later, or leave it off for now.
7. Any other project-specific conventions, tools, or house rules that every agent working in this repo should always follow? (Optional — skip if I have nothing to add.)

Once I've answered all of these:

1. Replace the "Project specifics" placeholders at the bottom of `CLAUDE.md` with my exact answers — don't paraphrase or "clean up" what I said, use it directly. Include a `GitHub issue tracking:` line set to `enabled` or `disabled` based on question 6.
2. Update `.claude/hooks/post-edit.ps1`, replacing the no-op with real commands that run the lint/format command(s) I gave you. If there's more than one (e.g. backend + frontend), run each in its own directory in sequence, and wrap each so a failure in one doesn't stop the other or crash the hook.
3. Show me the final "Project specifics" section of CLAUDE.md and the full contents of post-edit.ps1 so I can confirm they're correct before we run any work items.

If I later change my stack, test command, lint command, or GitHub issue tracking preference, I can re-run `/factory-init` and it should update these same files again rather than duplicating content.
