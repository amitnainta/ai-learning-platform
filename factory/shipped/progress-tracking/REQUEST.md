# Request

**Date**: 2026-08-02

Implement progress tracking — the third foundational feature, building directly on `user-accounts-auth` (the user/session model) and `learning-paths-content` (the Path/Course/ContentItem data model, which was explicitly designed so this item would be a purely additive migration keying on `(userId, contentItemId)`). Covers `FR-PROG-001` through `FR-PROG-003` from `docs/requirements/04_detailed_requirements.md`:

- FR-PROG-001: System tracks completion status (not started / in progress / complete) for each content item per user.
- FR-PROG-002: User can resume a path or course from where they left off.
- FR-PROG-003: User has a dashboard showing percent complete for each active path and course.

Also relevant: `FR-PATH-009` (switching role/level paths retains progress on previously completed items where content overlaps — the content item is shared, so progress keyed on `contentItemId` should already satisfy this by construction; this item should verify and demonstrate that, not just assume it) and `NFR-PERF-006` (dashboard/progress views load within 2 seconds for users with up to 50 in-progress items).

Out of scope for this item (later work items): `FR-PROG-004` (streaks/badges, Should/P2), `FR-RATE` (ratings/feedback — depends on progress existing, since ratings are gated on having started/completed an item per `FR-RATE-008`), `FR-CERT` (certificates, R2, depends on completion tracking existing but the certificate issuance/PDF/verification mechanics are their own item), and `FR-SEARCH` (full-text search/filtering).

This item should give users a real way to mark content as started/in-progress/complete (e.g., an explicit "mark complete" action on lesson/curated-item pages, and automatic "in progress" on first view), and should replace the current dashboard placeholder (which only shows role/level) with a real progress view showing per-path and per-course completion percentages and a "resume" entry point back into the last-viewed incomplete item.
