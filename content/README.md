# Content pack

This directory is the **authoring source of truth** for every learning path,
course, content item, and glossary term on the platform (FR-ADMIN-001,
decision #1 in `factory/work/learning-paths-content/PLAN.md`). Postgres is
the **runtime** source of truth — `npm run content:import` reads everything
here and upserts it into the database; nothing in this directory is read at
request time.

See `docs/content/authoring-guide.md` for the full field-by-field reference
and `docs/content/taxonomy.md` for the human-readable taxonomy. This file is
a one-screen map of the layout.

## Layout

```
content/
  taxonomy.yaml         topics + the format/source-type vocabulary (NFR-MAINT-001)
  roles/*.md             one file per RoleArchetype landing page (FR-SEARCH-004)
  paths/*.yaml            one file per (role, level) path — orders its courses
  courses/*.yaml           one file per course — orders its content items
  items/*.md                one file per content item (ORIGINAL lesson or CURATED link)
  glossary/*.md              one file per glossary term (FR-PATH-008)
```

## Validate, then import

```bash
npm run content:check    # validates the whole pack, writes nothing, exits non-zero on any error
npm run content:import   # applies it: upserts, bumps versions on real change, retires removed items
```

Always run `content:check` before `content:import` — it validates every
frontmatter field and cross-checks every reference (a course's items exist,
a path's courses exist, every topic is declared in `taxonomy.yaml`, every
`glossary:` link resolves to a real term) and reports every problem at once
rather than stopping at the first one.

## What the importer does and does not do

- **Never deletes.** Removing an item/course/path/glossary-term file and
  re-running `content:import` marks that row `RETIRED` (excluded from
  rendering) — the row and its id survive, because future `Progress`/
  `Rating`/`Certificate` rows will reference it (decision #2).
- **Only bumps `ContentItem.version` on a real change.** Re-running the
  importer against an unchanged pack is a no-op; changing a lesson body (or
  any other importable field) bumps `version` and appends a
  `ContentItemVersion` snapshot (FR-PATH-007, decision #8). Editing only
  `lastReviewedAt` does **not** bump the version.
- **Is idempotent.** Safe to run repeatedly, in CI, and in Playwright's
  global setup (`e2e/global-setup.ts`).

## The R1 seed pack

This pack ships a deliberately **representative seed**, not the final
content library (FR-PATH-002, roadmap section 6): 2 role profiles, 6 paths
(Technical Builder x Executive/Non-Technical, x 3 levels each), 12 courses,
and ~20 content items — enough to exercise every mechanism (tagging,
overlap between paths, versioning, the glossary, curated attribution) end to
end. Growing it to a launch-ready library is content-sourcing work, not an
engineering task.

Two things are deliberately true about this seed pack, both confirmed with
the product owner before this item was built (see PLAN.md "Risks / open
questions"):

- Every `ORIGINAL` lesson is unreviewed placeholder editorial. The UI labels
  each one with a "Sample content — not yet reviewed" notice
  (`src/components/content/sample-content-badge.tsx`) driven by one constant
  (`SAMPLE_CONTENT_LIBRARY` in `src/lib/content/taxonomy.ts`) — flip it to
  `false` once the library has been reviewed, and every notice disappears in
  one edit. No per-file flag exists for this on purpose.
- The pack ships **no video URL at all**, live or placeholder. The one
  lesson designated to carry FR-PATH-005's video block
  (`content/items/ai-strategy-fundamentals.md`) has its `video:` frontmatter
  committed **commented out** with a `TODO` describing the manual upload
  step in `docs/runbooks/provisioning-checklist.md`. Uncomment it, fill in
  the real Vercel Blob URLs, and re-run `content:check` / `content:import`
  once the asset exists.
