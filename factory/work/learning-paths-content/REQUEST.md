# Request

**Date**: 2026-08-02

Implement the learning paths and content system — the second foundational feature every remaining R1 capability (progress tracking, ratings, search) depends on, the same way user-accounts-auth was the first. Covers `FR-PATH-001` through `FR-PATH-009` (except `FR-PATH-010`, which is `P2`) from `docs/requirements/04_detailed_requirements.md`:

- FR-PATH-001: System supports defining a "path" as an ordered sequence of content items for a given role x level combination.
- FR-PATH-002: Technical Builder and Executive/Non-Technical paths are populated across all three levels.
- FR-PATH-004: Every content item is tagged with role(s), level, topic, format, estimated duration, and source type (original or curated).
- FR-PATH-005: System supports original, platform-hosted lessons (text and/or short video).
- FR-PATH-006: System supports curated items that link out to external resources, opening in a new tab with source attribution displayed.
- FR-PATH-007: Each content item stores a last-reviewed date and version history to support the content refresh cadence.
- FR-PATH-008: Lesson content contains contextual links to glossary term definitions. (Should)
- FR-PATH-009: User can switch to a different role/level path at any time, retaining progress on previously completed items where content overlaps. (Should — note: progress tracking itself, FR-PROG, is a later work item; this item should not block on it, but the schema/design should not preclude it)

Also covers `FR-ADMIN-001` (content managed via a manual process — structured file or spreadsheet import — for Release 1; no built admin UI yet, that's R2) and `FR-SEARCH-004` (each role archetype has a public landing page describing the path and its levels).

Per the roadmap (`docs/requirements/03_product_roadmap.md`), actual content *sourcing* — writing the original lesson content and curating external links for all six role x level combinations — is likely the longer pole and is expected to happen in parallel, largely outside engineering. This work item builds the system (data model, tagging, versioning, content rendering, the import mechanism, an AI glossary) and seeds it with enough real or representative placeholder content to prove the system end-to-end — it does not need to deliver the full, final content library for both paths.

Out of scope for this item (later work items): FR-PATH-003 (Engineering Leader and Investor paths, R2), FR-PATH-010 (custom path assembly, P2), FR-PROG (progress tracking/resume/dashboard), FR-RATE (ratings/feedback), FR-SEARCH-001/002/003 (full-text search, filtering, bookmarking — beyond the per-role landing pages), and FR-ADMIN-002 through 007 (built admin UI, R2).
