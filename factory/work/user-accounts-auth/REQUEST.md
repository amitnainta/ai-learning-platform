# Request

**Date**: 2026-07-26

Implement user accounts and authentication, the foundational feature every other R1 product capability (progress tracking, ratings, path assignment) depends on. Covers `FR-ACC-001` through `FR-ACC-008` from `docs/requirements/04_detailed_requirements.md`:

- FR-ACC-001: Register with email + password.
- FR-ACC-002: Log in and log out.
- FR-ACC-003: Reset a forgotten password via email verification.
- FR-ACC-004: Profile captures a selected role archetype (Technical Builder, Engineering Leader, Executive/Non-Technical, Investor, or "not sure yet").
- FR-ACC-005: Profile captures a selected or assessed level (zero-knowledge, intermediate, advanced).
- FR-ACC-006: User can change role/level at any time after initial selection.
- FR-ACC-007: User can export their personal data and request account/data deletion.
- FR-ACC-008: Unauthenticated visitors can browse public content/path descriptions but cannot track progress, rate, or earn certificates.

Also covers the security NFRs that ride directly on this feature: NFR-SEC-001 (bcrypt/argon2 password hashing, no plaintext storage/logging), NFR-SEC-003 (secure session tokens, inactivity expiry, invalidation on logout/password change), NFR-SEC-005 (rate limiting on login/password-reset endpoints), NFR-SEC-007 (sanitize/escape user-submitted content), and NFR-SEC-011 (minimum-age policy acknowledgment at registration, COPPA/GDPR-K consistent).

Out of scope for this item (later work items): the diagnostic placement quiz (FR-PLACE-003/004, tagged R2), SSO (FR-ACC-009, P2), and anything path/content/progress/rating-specific — this item only needs to produce the user/account data model and auth flows those features will attach to.
