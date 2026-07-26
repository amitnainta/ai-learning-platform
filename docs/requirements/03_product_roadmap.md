# AI Learning Platform — Product Roadmap

_Prepared: July 25, 2026. Step 4 of the project process (Brainstorm → Research → MVP Requirements → **Product Roadmap** → Detailed Requirements → Non-Functional Requirements). Builds on `01_market_research_findings.md` and `02_mvp_requirements.md`._

## 1. Purpose and Approach

This roadmap sequences the MVP scope into buildable waves and lays out what comes after MVP. Timing below is expressed in relative waves/sprints rather than fixed calendar dates, since actual velocity depends on the delivery team and software factory framework that will execute this — the sequencing and dependencies are the durable part, the calendar mapping is for the delivery team to size.

Three sequencing principles drove the ordering, each resolving an open item from the MVP requirements document: ship the two most differentiated persona paths first rather than all four at once, so real usage and ratings data informs the remaining paths before they're built; treat manual role/level self-selection as good enough for first release, with the diagnostic quiz as a fast-follow rather than a launch blocker; and start content curation with a lightweight manual process rather than building full admin tooling before there's any content to manage.

## 2. Phase 1 — MVP

### Release 1: Beta (foundation + two flagship paths)

Scope: user accounts and profile (manual role and level self-selection, no quiz yet); the Technical Builder and Executive/Non-Technical paths, each across all three levels, since these anchor the two ends of the audience spectrum and will surface the widest range of content and design issues fastest; hybrid content for those two paths (original spine lessons plus curated, tagged external resources); progress tracking and resume; per-course and per-path rating (stars + text); the AI glossary; full-library search and filtering, scoped to whatever content exists at this point; and a manual, spreadsheet-or-lightweight-CMS-backed content management process — no built admin UI yet. This release is a real product, not a throwaway prototype, but is treated as a beta to gather rating/feedback data before committing further build effort.

Exit criteria for Release 1: both paths are fully populated at all three levels, the rating/feedback loop is functioning end-to-end, and there's at least a first read on completion rates and ratings to inform Release 2.

### Release 2: Full MVP launch

Scope: add the Engineering Leader and Investor paths, informed by whatever content and structural lessons came out of Release 1's ratings and feedback; add the diagnostic placement quiz (fixed-length, mapped to level and role, replacing pure self-selection — self-selection remains available as an override); add free completion certificates for courses and paths; and replace the manual content process with a basic built admin/curation workflow (add, edit, retire, tag, and version content) sized to the content volume that now exists across four paths.

Exit criteria for Release 2: all four flagship paths live at all three levels, diagnostic quiz in production, certificates issuing correctly, and admin tooling in place to support ongoing content operations without manual file-editing. This is the point at which the platform matches the full scope defined in the MVP requirements document.

## 3. Phase 2 — Near-Term Enhancements (post-MVP)

Priorities for the first enhancement wave after MVP, roughly ordered by expected impact based on the research findings: lightweight gamification beyond basic progress tracking (streaks, completion badges) given the documented 25-50%+ completion-rate lift this pattern shows elsewhere; expansion beyond the four flagship roles into secondary role variants (e.g., splitting "Engineering Leader" into IT Project Manager and Senior Director sub-tracks if usage data shows they diverge enough to warrant it); a content freshness dashboard for curators, operationalizing the review-cadence process defined in the MVP requirements doc rather than tracking it manually; and discussion/comments on individual courses, giving learners a lightweight peer-feedback channel beyond star ratings without building a full forum yet.

## 4. Phase 3 — Growth and Scale

Candidates for a second enhancement wave, generally larger investments: an AI chat tutor/assistant embedded in lessons to answer learner questions inline; a move from fixed-length diagnostic placement toward fully adaptive (IRT-style) testing if placement accuracy becomes a measurable problem; native mobile apps if browser usage data shows enough mobile demand to justify it; full discussion forums; and localization/multi-language support if international usage warrants it.

## 5. Parking Lot (not committed, worth revisiting later)

Items intentionally not sequenced yet, to be revisited based on how the platform performs: any monetization path (the platform is free by design for MVP and the near term, but premium features such as live mentor sessions or team/employer accounts could be evaluated later without compromising the free core); enterprise or team accounts with manager-level reporting; live cohort-based or mentor-led sessions; and a full points-economy/leaderboard gamification layer, since research supports lightweight gamification but doesn't clearly support competitive mechanics for this kind of educational content.

## 6. Dependencies and Risks

The two-path Release 1 approach depends on having enough curated + original content ready for six persona/level combinations (2 roles x 3 levels) before beta launch — content sourcing and initial curation work should start immediately and in parallel with any engineering work, since it's very likely the longer pole. The admin-tooling-last sequencing (manual first, built UI in Release 2) is a deliberate bet that content volume stays small enough to manage manually through Release 1; if content volume grows faster than expected, building basic admin tooling earlier should be revisited. The content freshness risk flagged in the research (AI curricula/tools drifting stale within roughly 8-12 weeks) applies from day one of Release 1, so the review-cadence process needs to be operating in some form even before the Phase 2 dashboard exists — manually at first is acceptable, skipping it is not.

## 7. Summary

| Wave                        | Key scope                                                                                                                     | Resolves                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| MVP Release 1 (Beta)        | Accounts, self-selected role/level, Technical Builder + Executive paths (all 3 levels), ratings, glossary, manual content ops | De-risks content and UX before building remaining paths |
| MVP Release 2 (Full launch) | + Engineering Leader + Investor paths, diagnostic quiz, certificates, built admin tooling                                     | Completes MVP requirements scope                        |
| Phase 2                     | Lightweight gamification, role sub-tracks, freshness dashboard, course comments                                               | Near-term retention and ops improvements                |
| Phase 3                     | AI tutor, adaptive testing, native apps, forums, localization                                                                 | Larger bets pending usage evidence                      |
| Parking lot                 | Monetization, enterprise accounts, live cohorts, leaderboards                                                                 | Deliberately deferred, not scoped                       |
