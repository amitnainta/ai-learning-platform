# Request

**Date**: 2026-08-05

Implement ratings and feedback — the fourth foundational feature, building on `user-accounts-auth` (session/user model), `learning-paths-content` (Course/Path models), and `progress-tracking` (the `Progress` table, which this item's gating rule reads directly). Covers `FR-RATE-001` through `FR-RATE-006` and `FR-RATE-008` from `docs/requirements/04_detailed_requirements.md`:

- FR-RATE-001: User can rate an individual course on a 1-5 star scale.
- FR-RATE-002: User can leave free-text feedback on an individual course.
- FR-RATE-003: User can rate a completed path on a 1-5 star scale.
- FR-RATE-004: User can leave free-text feedback on a completed path, covering fit for their role/level.
- FR-RATE-005: Aggregate average rating and rating count are displayed on each course and path.
- FR-RATE-006: User can flag a rating/comment as inappropriate for moderator review.
- FR-RATE-008: Ratings are only accepted from users who have started (or, configurably, completed) the relevant item, to reduce drive-by noise.

Also relevant: `NFR-SEC-007` (all user-submitted content — ratings, free-text feedback — must be sanitized/escaped before storage and rendering to prevent stored XSS; the `learning-paths-content` and `progress-tracking` items both deliberately deferred this to "the ratings work item" since free-text feedback is the first genuinely open-ended user-generated content field in the app) and `NFR-SEC-004` (broken access control — a user must not be able to rate as someone else, or rate an item they haven't started).

Out of scope for this item (later work items): `FR-RATE-007` (auto-surfacing low-rated/flagged content into a curator review queue, R2 — depends on admin tooling that doesn't exist yet), any built moderation UI for reviewing flagged content (`FR-ADMIN-005`, R1-Should but tied to the admin surface that doesn't exist until `FR-ADMIN-002`, R2 — this item should let users flag content and record it, but a curator-facing review queue UI is not required), and `FR-SEARCH` (full-text search/filtering — the other remaining R1-Must item, tracked separately).

This item should decide: what "completed a path" means precisely for path-level rating eligibility (100% per the progress-tracking item's percentage computation, presumably), whether a user can edit or delete their own rating after submitting it, how the flag-for-moderation action is recorded now that there's no moderation UI to act on it yet (a durable, queryable record that a later admin item can build a UI on top of, not a dead-end action), and how aggregate rating/count is computed and displayed (read-time like progress percentages, or a different tradeoff — decide and justify).
