# AI Learning Platform — Handover Brief for Build Team

_Prepared: July 25, 2026. This is the cover note for the project package being handed to Claude Code / the software factory framework. Read this first, then the four documents it references, in order._

## 1. What This Project Is

A free website that teaches artificial intelligence through a learning path personalized to the visitor's role (e.g., software engineer, IT project manager, architect, senior director of software delivery, president, CEO, investor) and current knowledge level (zero-knowledge, intermediate, advanced). Content is a hybrid of original short lessons and curated links to the best free AI resources on the web, selected and maintained using patterns validated by learner-review research. Users rate individual courses and full paths, with text feedback, and that feedback drives ongoing content curation. The site is not code or built yet — this package is the full requirements handoff to start implementation.

## 2. Reading Order and What Each Document Is For

1. **`01_market_research_findings.md`** — Web research on existing free AI courses, learner review patterns, role-based/executive AI literacy programs, completion/dropout/gamification/certificate data, content-freshness challenges, and the competitive gap this product fills. Use this for the _why_ behind product decisions.
2. **`02_mvp_requirements.md`** — Personas (4 flagship role archetypes x 3 levels), core user journeys, MVP feature scope (in vs. explicitly out), success metrics, and the content operations model. Use this for overall MVP shape.
3. **`03_product_roadmap.md`** — Sequencing: MVP Release 1 (Beta: 2 paths, self-selected level, manual content ops) → MVP Release 2 (Full launch: all 4 paths, diagnostic quiz, certificates, built admin tooling) → Phase 2 → Phase 3 → parking lot. Use this to know what to build first vs. later.
4. **`04_detailed_requirements.md`** — The buildable specification: every functional and non-functional requirement has a trackable ID (`FR-xxx`, `NFR-PERF-xxx`, `NFR-SEC-xxx`, `NFR-SCALE-xxx`, and others), a MoSCoW priority, and a release tag (R1/R2/P2/P3) mapping straight to the roadmap. **This is the primary implementation reference.**

## 3. Immediate Build Scope (R1 — MVP Beta)

Everything tagged **R1** and priority **Must** in `04_detailed_requirements.md` is the actual first-build target. In short: accounts with manual role/level self-selection (no diagnostic quiz yet), the Technical Builder and Executive/Non-Technical paths fully populated across all three levels, hybrid content (original lessons + curated tagged links), progress tracking with resume, per-course and per-path star + text ratings, the AI glossary, full-library search/filter, and a manual/spreadsheet-driven content process (no admin UI yet). R2 (diagnostic quiz, remaining two paths, certificates, built admin UI) follows once R1 usage and ratings data comes in.

## 4. Things the Build Team Should Confirm or Own

A few items were deliberately left open in the requirements package rather than pre-decided, per `04_detailed_requirements.md` section 5: the specific tech stack and hosting/CDN provider, whether a dedicated search index is needed at R1 scale or database full-text search suffices, exact numeric SLA targets once real infra costs are known, and the plain-language style guide for zero-knowledge content (should be drafted alongside whoever writes the first lessons). None of these block starting R1 architecture and scaffolding work.

## 5. Traceability

If a requirement's rationale is unclear during implementation, `04_detailed_requirements.md` section 4 maps key requirements back to the specific research finding or product decision behind them (e.g., why ratings feed a curator review queue, why content is versioned, why lesson units are kept short). Use that before deviating from a requirement — it's usually there for a specific, evidence-backed reason, not arbitrarily.

## 6. Requirement ID Namespace Reference

`FR-ACC` accounts/profile · `FR-PLACE` placement/diagnostic · `FR-PATH` paths/content · `FR-PROG` progress tracking · `FR-RATE` ratings/feedback · `FR-CERT` certification · `FR-SEARCH` search/discovery · `FR-ADMIN` admin/curation · `NFR-PERF` performance · `NFR-SEC` security · `NFR-SCALE` scalability · `NFR-AVAIL` availability/reliability · `NFR-A11Y` usability/accessibility · `NFR-COMP` compliance/legal · `NFR-MAINT` maintainability/content ops · `NFR-OBS` observability.
