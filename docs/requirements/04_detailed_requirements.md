# AI Learning Platform — Detailed Requirements

_Prepared: July 25, 2026. Step 5 of the project process (Brainstorm → Research → MVP Requirements → Product Roadmap → **Detailed Requirements**). This is the requirements artifact intended for direct handoff to the build team. Builds on `01_market_research_findings.md`, `02_mvp_requirements.md`, and `03_product_roadmap.md`._

## 1. How to Read This Document

Every requirement has a trackable ID in the form `CATEGORY-###`. Functional requirements are grouped by module (e.g., `FR-ACC` for Accounts). Non-functional requirements are grouped by concern (`NFR-PERF`, `NFR-SEC`, `NFR-SCALE`, and others below). Each requirement carries a priority using MoSCoW (Must / Should / Could) and a release tag mapping it to the roadmap: **R1** (MVP Beta), **R2** (MVP Full Launch), **P2** (Phase 2), **P3** (Phase 3). Requirements tagged R1/R2 are the actual MVP build scope; P2/P3 are included here for traceability so later work doesn't have to be re-derived from scratch, but are not MVP build targets.

IDs are stable identifiers — if a requirement changes materially in future revisions, it should be superseded with a note rather than renumbered, so references from design docs, tickets, or test cases stay valid.

## 2. Functional Requirements

### 2.1 Accounts and Profile (FR-ACC)

| ID         | Requirement                                                                                                                                         | Priority | Release |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-ACC-001 | User can register an account with email and password.                                                                                               | Must     | R1      |
| FR-ACC-002 | User can log in and log out.                                                                                                                        | Must     | R1      |
| FR-ACC-003 | User can reset a forgotten password via email verification.                                                                                         | Must     | R1      |
| FR-ACC-004 | User profile captures a selected role archetype (Technical Builder, Engineering Leader, Executive/Non-Technical, Investor, or "not sure yet").      | Must     | R1      |
| FR-ACC-005 | User profile captures a selected or assessed level (zero-knowledge, intermediate, advanced).                                                        | Must     | R1      |
| FR-ACC-006 | User can manually change their role and/or level at any time after initial selection.                                                               | Must     | R1      |
| FR-ACC-007 | User can export their personal data and request account/data deletion.                                                                              | Must     | R1      |
| FR-ACC-008 | Unauthenticated visitors can browse public content and path descriptions without an account, but cannot track progress, rate, or earn certificates. | Should   | R1      |
| FR-ACC-009 | User can register/log in via third-party SSO (e.g., Google).                                                                                        | Could    | P2      |

### 2.2 Placement and Diagnostic (FR-PLACE)

| ID           | Requirement                                                                                                   | Priority | Release |
| ------------ | ------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-PLACE-001 | New user is presented with the four flagship role archetypes plus a "not sure yet" option during onboarding.  | Must     | R1      |
| FR-PLACE-002 | User can self-select their level directly (zero-knowledge / intermediate / advanced) without taking a quiz.   | Must     | R1      |
| FR-PLACE-003 | User can take a fixed-length diagnostic quiz that estimates level based on responses.                         | Must     | R2      |
| FR-PLACE-004 | Diagnostic quiz results map to a level band and a suggested path; user may accept or override the suggestion. | Must     | R2      |
| FR-PLACE-005 | User can retake the diagnostic quiz or change their placement at any later time.                              | Should   | R2      |
| FR-PLACE-006 | Diagnostic quiz adapts question-by-question based on prior answers (full adaptive/IRT-style testing).         | Could    | P3      |

### 2.3 Learning Paths and Content (FR-PATH)

| ID          | Requirement                                                                                                                          | Priority | Release |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- |
| FR-PATH-001 | System supports defining a "path" as an ordered sequence of content items for a given role x level combination.                      | Must     | R1      |
| FR-PATH-002 | Technical Builder and Executive/Non-Technical paths are populated across all three levels.                                           | Must     | R1      |
| FR-PATH-003 | Engineering Leader and Investor paths are populated across all three levels.                                                         | Must     | R2      |
| FR-PATH-004 | Every content item is tagged with role(s), level, topic, format, estimated duration, and source type (original or curated).          | Must     | R1      |
| FR-PATH-005 | System supports original, platform-hosted lessons (text and/or short video).                                                         | Must     | R1      |
| FR-PATH-006 | System supports curated items that link out to external resources, opening in a new tab with source attribution displayed.           | Must     | R1      |
| FR-PATH-007 | Each content item stores a last-reviewed date and version history to support the content refresh cadence.                            | Must     | R1      |
| FR-PATH-008 | Lesson content contains contextual links to glossary term definitions.                                                               | Should   | R1      |
| FR-PATH-009 | User can switch to a different role/level path at any time, retaining progress on previously completed items where content overlaps. | Should   | R1      |
| FR-PATH-010 | User can assemble a custom path by selecting individual content items from the full library rather than following a pre-built path.  | Could    | P2      |

### 2.4 Progress Tracking (FR-PROG)

| ID          | Requirement                                                                                            | Priority | Release |
| ----------- | ------------------------------------------------------------------------------------------------------ | -------- | ------- |
| FR-PROG-001 | System tracks completion status (not started / in progress / complete) for each content item per user. | Must     | R1      |
| FR-PROG-002 | User can resume a path or course from where they left off.                                             | Must     | R1      |
| FR-PROG-003 | User has a dashboard showing percent complete for each active path and course.                         | Must     | R1      |
| FR-PROG-004 | System tracks and displays simple engagement indicators such as day streaks or completion badges.      | Should   | P2      |

### 2.5 Rating and Feedback (FR-RATE)

| ID          | Requirement                                                                                                                                                                   | Priority | Release |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-RATE-001 | User can rate an individual course on a 1-5 star scale.                                                                                                                       | Must     | R1      |
| FR-RATE-002 | User can leave free-text feedback on an individual course.                                                                                                                    | Must     | R1      |
| FR-RATE-003 | User can rate a completed path on a 1-5 star scale.                                                                                                                           | Must     | R1      |
| FR-RATE-004 | User can leave free-text feedback on a completed path, covering fit for their role/level.                                                                                     | Must     | R1      |
| FR-RATE-005 | Aggregate average rating and rating count are displayed on each course and path.                                                                                              | Must     | R1      |
| FR-RATE-006 | User can flag a rating/comment as inappropriate for moderator review.                                                                                                         | Should   | R1      |
| FR-RATE-007 | Content whose average rating drops below a defined threshold, or whose feedback text is flagged as outdated/incorrect, is automatically surfaced in the curator review queue. | Should   | R2      |
| FR-RATE-008 | Ratings are only accepted from users who have started (or, configurably, completed) the relevant item, to reduce drive-by noise.                                              | Should   | R1      |

### 2.6 Certification (FR-CERT)

| ID          | Requirement                                                                                                         | Priority | Release |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-CERT-001 | System issues a free certificate upon course completion.                                                            | Must     | R2      |
| FR-CERT-002 | System issues a free certificate upon full path completion.                                                         | Must     | R2      |
| FR-CERT-003 | Certificates are downloadable (e.g., PDF) and shareable via a link.                                                 | Must     | R2      |
| FR-CERT-004 | Each certificate has a unique verifiable ID or URL that third parties (e.g., employers) can check for authenticity. | Should   | R2      |

### 2.7 Search and Discovery (FR-SEARCH)

| ID            | Requirement                                                                       | Priority | Release |
| ------------- | --------------------------------------------------------------------------------- | -------- | ------- |
| FR-SEARCH-001 | User can perform full-text search across the content library.                     | Must     | R1      |
| FR-SEARCH-002 | User can filter content by role, level, topic, format, and duration.              | Must     | R1      |
| FR-SEARCH-003 | User can bookmark/save content items for later.                                   | Should   | R1      |
| FR-SEARCH-004 | Each role archetype has a public landing page describing the path and its levels. | Must     | R1      |

### 2.8 Admin and Content Curation (FR-ADMIN)

| ID           | Requirement                                                                                                     | Priority | Release |
| ------------ | --------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| FR-ADMIN-001 | Content is managed via a manual process (e.g., structured spreadsheet or lightweight CMS import) for Release 1. | Must     | R1      |
| FR-ADMIN-002 | Content is managed via a built admin UI supporting create/edit/retire operations, replacing the manual process. | Must     | R2      |
| FR-ADMIN-003 | Admin UI supports managing the tagging taxonomy (roles, levels, topics, formats).                               | Must     | R2      |
| FR-ADMIN-004 | System flags content that has passed its defined review-cadence window without being reviewed.                  | Should   | R2      |
| FR-ADMIN-005 | Admin UI includes a moderation queue for flagged ratings/comments.                                              | Should   | R1      |
| FR-ADMIN-006 | Admin UI provides an analytics view of completion rates, ratings, and drop-off points per path and course.      | Should   | R2      |
| FR-ADMIN-007 | Content review cadence dashboard highlighting stale curated links vs. stable original content.                  | Could    | P2      |

## 3. Non-Functional Requirements

### 3.1 Performance (NFR-PERF)

| ID           | Requirement                                                                                                                                                          | Priority | Release |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-PERF-001 | Core pages (home, path landing, lesson view) achieve first contentful paint under 2 seconds on a standard broadband connection.                                      | Must     | R1      |
| NFR-PERF-002 | Core pages remain usable (interactive within 4 seconds) on a throttled 3G-equivalent connection, given zero-knowledge users may be on lower-end devices/connections. | Should   | R1      |
| NFR-PERF-003 | Search and filter results return within 1 second for a content library of up to 5,000 items.                                                                         | Must     | R1      |
| NFR-PERF-004 | Core API endpoints (auth, progress update, rating submission) respond within 500ms at the 95th percentile under expected MVP load.                                   | Must     | R1      |
| NFR-PERF-005 | Diagnostic quiz scoring and path recommendation completes within 1 second of quiz submission.                                                                        | Must     | R2      |
| NFR-PERF-006 | Dashboard/progress views load within 2 seconds for users with up to 50 in-progress items.                                                                            | Should   | R1      |

### 3.2 Security (NFR-SEC)

| ID          | Requirement                                                                                                                                                                    | Priority | Release                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| NFR-SEC-001 | Passwords are stored using a modern salted hash (e.g., bcrypt or argon2); plaintext passwords are never stored or logged.                                                      | Must     | R1                                                          |
| NFR-SEC-002 | All traffic (site and APIs) is served over HTTPS/TLS; no unencrypted endpoints.                                                                                                | Must     | R1                                                          |
| NFR-SEC-003 | Session tokens are securely generated, expire after a defined inactivity period, and are invalidated on logout or password change.                                             | Must     | R1                                                          |
| NFR-SEC-004 | Application defends against OWASP Top 10 classes of vulnerability (XSS, CSRF, SQL/NoSQL injection, broken access control, etc.), verified via security testing before launch.  | Must     | R1                                                          |
| NFR-SEC-005 | Login, password reset, and quiz-submission endpoints are rate-limited to mitigate brute-force and abuse.                                                                       | Must     | R1                                                          |
| NFR-SEC-006 | Admin/curation functions are protected by role-based access control, separate from standard user permissions.                                                                  | Must     | R2 (R1 manual process is access-controlled outside the app) |
| NFR-SEC-007 | All user-submitted content (ratings, free-text feedback) is sanitized/escaped before storage and rendering to prevent stored XSS.                                              | Must     | R1                                                          |
| NFR-SEC-008 | Any third-party authentication (SSO) integration follows OAuth best practices and never stores third-party credentials directly.                                               | Must     | P2 (with FR-ACC-009)                                        |
| NFR-SEC-009 | Dependencies and third-party libraries are scanned for known vulnerabilities on a recurring basis (e.g., automated scanning in CI).                                            | Must     | R1                                                          |
| NFR-SEC-010 | Administrative actions (content edits, moderation decisions, account actions) are logged with actor, timestamp, and change detail for audit purposes.                          | Should   | R2                                                          |
| NFR-SEC-011 | User registration requires acknowledgment of a minimum-age policy consistent with applicable child-privacy law (e.g., COPPA/GDPR-K); the platform is not directed at children. | Must     | R1                                                          |

### 3.3 Scalability (NFR-SCALE)

| ID            | Requirement                                                                                                                                                                                                   | Priority | Release |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-SCALE-001 | Application tier is stateless and horizontally scalable behind a load balancer.                                                                                                                               | Must     | R1      |
| NFR-SCALE-002 | Database schema and indexing support growth to at least 100,000 registered users and 5,000 content items in year one without redesign.                                                                        | Must     | R1      |
| NFR-SCALE-003 | Static assets and original lesson media are served via CDN rather than the application origin.                                                                                                                | Must     | R1      |
| NFR-SCALE-004 | Frequently accessed, slow-changing data (path structures, aggregate ratings, published content) is cached with a defined invalidation strategy.                                                               | Should   | R1      |
| NFR-SCALE-005 | Search/filter infrastructure (e.g., dedicated search index) is architected to scale to at least 50,000 tagged content items without material latency degradation, anticipating Phase 2/3 content growth.      | Should   | R2      |
| NFR-SCALE-006 | System supports at least 10x current active-user load through horizontal scaling alone, without architectural rework, to accommodate viral growth or press coverage spikes common to free education launches. | Should   | R1      |

### 3.4 Availability and Reliability (NFR-AVAIL)

| ID            | Requirement                                                                                                                                          | Priority | Release |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-AVAIL-001 | Platform targets 99.5% uptime for MVP (roughly 3.6 hours of allowed downtime per month), reviewed for tightening post-MVP.                           | Must     | R1      |
| NFR-AVAIL-002 | User data and content are backed up automatically on a recurring schedule (e.g., daily) with tested restore procedures.                              | Must     | R1      |
| NFR-AVAIL-003 | A documented disaster-recovery process defines recovery time objective (RTO) and recovery point objective (RPO) targets.                             | Should   | R1      |
| NFR-AVAIL-004 | System periodically checks curated external links for availability and flags broken links for curator review rather than silently failing for users. | Should   | R2      |

### 3.5 Usability and Accessibility (NFR-A11Y)

| ID           | Requirement                                                                                                                                                                      | Priority | Release |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-A11Y-001 | Site meets WCAG 2.1 Level AA accessibility standards.                                                                                                                            | Must     | R1      |
| NFR-A11Y-002 | Site is fully responsive and usable on desktop, tablet, and mobile browser widths.                                                                                               | Must     | R1      |
| NFR-A11Y-003 | Zero-knowledge-level content follows a plain-language style guide (short sentences, defined terms, minimal jargon), consistent with research findings on beginner learner needs. | Must     | R1      |
| NFR-A11Y-004 | All interactive elements are fully operable via keyboard alone.                                                                                                                  | Must     | R1      |

### 3.6 Compliance and Legal (NFR-COMP)

| ID           | Requirement                                                                                                                                             | Priority | Release |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-COMP-001 | Curated external content is linked to, not scraped or rehosted, and displays clear source attribution, consistent with copyright and fair-use practice. | Must     | R1      |
| NFR-COMP-002 | Published, accessible privacy policy and terms of service govern account data, ratings content, and certificate issuance.                               | Must     | R1      |
| NFR-COMP-003 | Cookie/tracking consent mechanisms comply with applicable regulations (e.g., GDPR/ePrivacy) for users in scope.                                         | Must     | R1      |
| NFR-COMP-004 | Data handling supports applicable privacy-rights requests (access, correction, deletion) per FR-ACC-007.                                                | Must     | R1      |

### 3.7 Maintainability and Content Operations (NFR-MAINT)

| ID            | Requirement                                                                                                                                                                                        | Priority | Release |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-MAINT-001 | The content tagging taxonomy (roles, levels, topics, formats, source types) is formally documented and versioned.                                                                                  | Must     | R1      |
| NFR-MAINT-002 | Curated external content has a defined review cadence (recommended: quarterly), reflecting the research finding that AI tooling specifics can go stale within roughly 8-12 weeks.                  | Must     | R1      |
| NFR-MAINT-003 | Original "spine" conceptual content has a defined, longer review cadence (recommended: annually), since it is framing/conceptual rather than tool-specific.                                        | Should   | R1      |
| NFR-MAINT-004 | Core user journeys (registration, placement, course completion, rating, certificate issuance) have automated regression test coverage.                                                             | Must     | R1      |
| NFR-MAINT-005 | Codebase and architecture are documented sufficiently for handoff to and ongoing work by the delivery team/software factory framework, including setup, deployment, and content-import procedures. | Must     | R1      |

### 3.8 Observability (NFR-OBS)

| ID          | Requirement                                                                                                                                                                                                                        | Priority | Release |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NFR-OBS-001 | Application logging, monitoring, and alerting are in place for error rates, latency, and availability.                                                                                                                             | Must     | R1      |
| NFR-OBS-002 | Analytics instrumentation captures the MVP success metrics defined in the requirements doc: placement completion rate, activation rate, course/path completion rate, average ratings, 30-day return rate, and certificates issued. | Must     | R1      |
| NFR-OBS-003 | Errors are captured and triaged via an error-tracking tool rather than relying solely on logs.                                                                                                                                     | Should   | R1      |

## 4. Traceability Notes

Every FR/NFR above maps back to a specific finding or decision in the earlier artifacts: role/level personalization (FR-PATH, FR-PLACE) traces to the brainstorm's personalization decision and the research finding that irrelevance is a top dropout driver; short, resumable content units and progress tracking (FR-PROG, NFR-PERF) trace to the MOOC completion-rate research; ratings feeding curator review (FR-RATE-007, NFR-MAINT-002) trace directly to the content-freshness research finding; and the content-tagging/versioning requirements (FR-PATH-007, NFR-MAINT-001/002/003) trace to the hybrid content model decision. This chain should make it straightforward for the build team to understand _why_ a requirement exists, not just what it says, if scope trade-off decisions come up during implementation.

## 5. Open Items for Delivery Team

A few items are deliberately left for the delivery team (Claude Code + software factory framework) to finalize rather than over-specified here: the specific search/indexing technology (e.g., whether a dedicated search service is needed at R1 scale or whether database full-text search suffices until R2/P2); the specific tech stack and hosting/CDN provider; exact numeric SLA targets beyond the directional ones given here, once real infrastructure costs and constraints are known; and the specific plain-language style guide content for NFR-A11Y-003, which should be drafted collaboratively with whoever authors the original lesson content.
