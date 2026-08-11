# Content Decision Record

Status: accepted for R1. Owner: solo maintainer. Complements
`docs/architecture/auth.md` (auth/session/account decisions) and
`docs/architecture/infrastructure.md` (hosting/DB/observability). Covers
decisions #1-13 from `factory/work/learning-paths-content/PLAN.md` — see
that plan for the full task list, the Prisma schema design section, and
acceptance criteria.

## Accepted context

`FR-PATH-001` through `FR-PATH-009`, `FR-ADMIN-001`, and `FR-SEARCH-004` all
hang off the same content data model, file-pack authoring format, and
importer — this record captures the decisions that make those requirements
real, and the mapping onto the NFRs that ride directly on content
(NFR-MAINT-001/002/003/004/005, NFR-COMP-001, NFR-SEC-007, NFR-SCALE-002/003).

Bias carried from the two shipped items: solo maintainer, free educational
site, low-ops, no new external service unless a requirement forces one.

## 1. Content authoring format — a git-versioned file pack, imported into Postgres

**Decision**: `content/` (Markdown + YAML frontmatter for prose, plain YAML
for structure) is the **authoring** source of truth; Postgres is the
**runtime** source of truth. `npm run content:import` (idempotent, dry-run
via `npm run content:check`) reads the pack and upserts it. This is the
FR-ADMIN-001 "structured file import" reading, for R1 (no admin UI).

**Why**: (i) later R1 items force content into the database anyway —
FR-PROG needs per-item progress rows, FR-RATE needs per-course ratings,
FR-SEARCH needs queryable tags, FR-ADMIN-002's R2 admin UI needs writable
rows — so a file-only, build-time system would be rebuilt within two work
items; (ii) files in git give free diff/review/history for a solo
maintainer with no new infrastructure; (iii) the same importer seeds CI and
local dev, so content-ops and the e2e test-fixture problem are solved by one
mechanism (`e2e/global-setup.ts`).

**Rejected**:

- **Spreadsheet/CSV import** — fine for tabular metadata, miserable for
  multi-paragraph lesson bodies (no diff, encoding/quoting bugs). A
  CSV-to-pack converter can be added later for a non-engineer curator
  without a schema change.
- **MDX/Markdown rendered at build time, no database rows** — lowest ops
  today, but no stable content id for `Progress`/`Rating` foreign keys, no
  R2-admin-UI editability, and FR-SEARCH becomes a build-time index problem.
  Optimizes this one item at the cost of the next four.
- **A hosted headless CMS** (Sanity/Contentful/Payload) — real editorial
  tooling, but a new external account, a new cost curve, and a second system
  holding product data with a synchronization problem, for a platform whose
  only editor is the repo owner.

## 2. The importer never deletes — it upserts and retires

**Decision**: a content item removed from the pack is set to
`status = RETIRED` (`retiredAt` stamped), never deleted — future `Progress`/
`Rating`/`Certificate` rows will reference it, and a learner's completed
history must not vanish because a curator dropped a link. Retired items are
excluded from path/course rendering (`src/lib/content/queries.ts` filters
`status: "PUBLISHED"` everywhere). Re-adding the same slug un-retires it.
The write path runs in a single `prisma.$transaction`; `--dry-run` plans and
prints the same summary without writing (`src/lib/content/plan-import.ts`,
kept pure/database-free specifically so this logic is unit-testable).

`Topic` is the one exception: it carries no `status`/lifecycle column at all
(pure taxonomy data, not content) — a topic that disappears from
`content/taxonomy.yaml` is simply left alone (still never deleted, just via
"do nothing" rather than a status flip there's no column to hold).

**Rejected**: delete-and-recreate on every import — simplest to write, but
every import would rotate every id, which is exactly the corner FR-PROG/
FR-RATE/FR-CERT (decision #6) depend on this item not painting the schema
into.

## 3. Original lesson rendering — `react-markdown` + `remark-gfm`, no `dangerouslySetInnerHTML`

**Decision**: lesson bodies are stored as Markdown text and parsed to a
React element tree at render time (`src/components/content/markdown.tsx`, a
server component) — no HTML string is ever produced, so there is no
`dangerouslySetInnerHTML` anywhere in the content pipeline and no sanitizer
to get wrong. The component map is where FR-PATH-006/008 live: an `href`
beginning `glossary:` renders `<GlossaryLink>`, any other absolute URL
renders `<ExternalLink>` (`target="_blank" rel="noopener noreferrer"` plus
the visible host), internal hrefs render `next/link`, and headings get
stable, slugified ids. `rehype-raw` is deliberately not used, so raw HTML
embedded in a body (a stray `<script>` tag, an `<img onerror=...>`) renders
as **inert literal text** — proven by
`src/components/content/__tests__/markdown.test.tsx`.

**A subtlety worth recording**: react-markdown's `defaultUrlTransform`
sanitizes every href through an allow-list of protocols
(`http(s)`/`irc(s)`/`mailto`/`xmpp`) and silently empties anything else —
which strips the `glossary:` scheme before the component map ever sees it.
`<Markdown>` supplies a `urlTransform` that carves out an exception for
`glossary:` and defers to the library's own sanitizer for everything else
(so `javascript:` etc. are still stripped). Found and fixed during this
item's build via manual verification against a real running app, not by the
automated suite alone — see the Builder notes in
`factory/work/learning-paths-content/PLAN.md`.

**Rejected**:

- **MDX** (`next-mdx-remote` or runtime `@mdx-js/mdx`) — component-in-content
  power not needed for text-and-video lessons; runtime-compiling
  database-stored content as MDX effectively executes authored code, a bad
  property to hand a future admin UI.
- **`marked`/`markdown-it` + `dangerouslySetInnerHTML`** (with
  `rehype-sanitize`/DOMPurify) — fastest render, but reintroduces exactly
  the injection surface this codebase has avoided so far, for no benefit.

## 4. Video — an optional frontmatter block, native `<video>`, mandatory captions

**Decision**: `video: { url, captionsUrl, posterUrl?, durationSeconds? }` in
an `ORIGINAL` item's frontmatter renders as
`<video controls preload="metadata" src={url}>` with a
`<track kind="captions" default>` (`src/components/content/lesson-video.tsx`)
pointing at an absolute Vercel Blob CDN URL. Captions are **mandatory in the
schema** whenever a video is present — `url` and `captionsUrl` live in the
same Zod object (`src/lib/validation/content.ts`'s `videoBlockSchema`), so a
video block without captions fails `content:check`. This honours the
shipped NFR-SCALE-003 decision (media served from the CDN, never proxied
through a serverless function) and needs no player library.

**Seed-pack consequence, confirmed with the human (PLAN.md Risks #3)**: the
R1 pack ships **no video URL at all, live or placeholder**. The designated
video lesson (`content/items/ai-strategy-fundamentals.md`) carries its
`video:` block committed **commented out**, with a `TODO` pointing at the
manual upload step in `docs/runbooks/provisioning-checklist.md`. A
placeholder CDN URL would render a visibly broken player on a public page;
an absent block renders nothing, which is honest and looks intentional. The
FR-PATH-005 video path is therefore proven by
`src/components/content/__tests__/lesson-video.test.tsx` (full markup when
a video is present, empty render when it isn't — which is the pack's actual
state today) plus the schema test that a captions-less video block is
rejected, not by e2e against seeded data —
`e2e/content-lesson.spec.ts` explicitly asserts **no** `<video>` element on
the seeded lesson.

**Rejected**:

- **YouTube/Vimeo iframes** — free hosting and adaptive bitrate, but
  third-party-hosted rather than "platform-hosted" as FR-PATH-005 words it,
  drags third-party cookies into a site that still owes a cookie-consent
  mechanism (NFR-COMP-003), and revisits the `frame-ancestors` CSP posture.
- **A JS player** (Video.js, Mux Player) — a dependency and client bundle
  for functionality the native element already provides for short lessons.

## 5. Content hierarchy — `Path` -> `Course` -> `ContentItem`, many-to-many ordered joins

**Decision**: three explicit levels (`Path`, `Course`, `ContentItem`), with
ordered many-to-many joins at both levels (`PathCourse`, `CourseItem`, each
carrying `position`) rather than a parent foreign key. The requirements use
all three nouns as distinct addressable things: FR-PATH-001 orders content
items within a path, FR-PROG-001 tracks completion per content item,
FR-PROG-003 shows percent-complete per path _and_ course, FR-RATE-001/003
rates a course _and_ a path, FR-CERT-001/002 issues certificates for a
course _and_ a path. Many-to-many (not `ContentItem.courseId`) is what makes
FR-PATH-009's "retain progress on overlapping items" true by construction —
the same item, and the same course, can appear in more than one path,
because it's one row referenced from two join rows, not two rows. The R1
seed pack deliberately exercises this: `what-is-artificial-intelligence`
and `google-ai-crash-course` each appear in both the Technical Builder and
Executive/Non-Technical zero-knowledge paths.

`Path` carries `@@unique([roleArchetype, level])` — at R1/R2 there is
exactly one curated path per role x level. FR-PATH-010's user-assembled
custom paths are a separate future `UserPath` model, not extra rows here, so
this constraint doesn't block them (see Risks/open questions #9 in PLAN.md
for the one plausible future feature — A/B path variants — that would need
it removed).

## 6. Progress and rating attachment points — fixed now, nothing else built

**This is the commitment the next work items inherit.** Nothing beyond this
paragraph is built for progress or ratings in this item — no `Progress`,
`Rating`, `Bookmark`, or `Certificate` table, and no columns "for later" —
but the attachment points are decided and written down so those items are
purely additive migrations:

- **FR-PROG** keys progress on `(userId, contentItemId)`, referencing
  `User.id` (existing, auth item) and `ContentItem.id` (this item). Because
  an overlapping item is a single row (decision #5), completing it once
  completes it everywhere it's shown — this is what makes FR-PATH-009's
  retention promise true by construction rather than by extra logic.
- **FR-RATE** attaches to `Course.id` and `Path.id`.
- **FR-CERT** issues against `Course.id` and `Path.id`.
- Curated items have no detail page (decision #10) — FR-PROG/FR-RATE's
  per-item controls for a curated item must live on
  `<ContentItemCard>`, not a page that doesn't exist.

Every id referenced above is `String @id @default(cuid())` and stable
across re-imports (decision #2's upsert-by-slug, decision #8's version
tracking) — a re-import never rotates an id that a `Progress`/`Rating`/
`Certificate` row already points to.

**Commitment honoured**: the progress-tracking work item verified this
claim against the real importer code (not taken on trust) and shipped
`Progress` exactly as promised here — see
`docs/architecture/progress.md`'s "Verification of `learning-paths-content`
decision #6" section for the check, including the one caveat it surfaced
(a published item's `slug`, not just its id, must stay stable — see the
"Never rename a published item's slug" rule in
`docs/content/authoring-guide.md`).

**Commitment honoured a second time**: the ratings-and-feedback work item
verified the `Course.id`/`Path.id` attachment point promised above against
the same importer code and shipped `Rating` keyed on exactly those ids,
with no join-row (`PathCourse`/`CourseItem`) ever used as a key — see
`docs/architecture/ratings.md`'s "Verification of the shipped items'
attachment-point commitments" section, which surfaces the same
slug-rename caveat for ratings that `progress-tracking` surfaced for
progress.

## 7. Review cadence — stored per item, derived at import

**Decision**: `sourceType = CURATED` defaults to `reviewCadenceDays = 90`
(NFR-MAINT-002's 8-12-week staleness finding), `ORIGINAL` to `365`
(NFR-MAINT-003); either is overridable per item in frontmatter
(`src/lib/content/loader.ts`'s `reviewCadenceFor`). The importer maintains
`nextReviewDueAt = lastReviewedAt + reviewCadenceDays`, indexed
(`@@index([nextReviewDueAt])`). Nothing reads that column at R1 — it's free
to write now, and FR-ADMIN-004/-007's R2/P2 staleness flagging would
otherwise need a backfill over the whole library later. `lastReviewedAt` is
displayed on lesson pages and item cards so the freshness promise is
visible to learners, not just curators.

## 8. Version history — in the database, not just in git

**Decision**: FR-PATH-007 requires the _system_ to store version history —
"git log" is invisible to the app and unusable by a future R2 admin UI. Each
`ContentItem` carries a monotonic `version` and a `contentHash` (stable,
key-order-independent SHA-256 of its importable fields,
`src/lib/content/hash.ts`, deliberately excluding `lastReviewedAt`/
`changeNote` so re-reviewing an unchanged item doesn't create a spurious
version). When the hash changes, the importer increments `version` and
appends a `ContentItemVersion` row (a full JSON `snapshot`, append-only,
`@@unique([contentItemId, version])`). Unchanged items are left completely
untouched — re-running the importer against an unchanged pack is a no-op,
verified directly in `src/lib/content/__tests__/plan-import.test.ts` and
manually via a real create/create/edit/import cycle against the local dev
database during this item's build (see the Builder notes for the exact
counts).

Un-retiring a previously retired item whose content is byte-identical to
what it was before retirement does **not** bump the version or write a
snapshot — only the status flips back to `PUBLISHED`. A retired item that
reappears **with changed content** does both (status flip and version bump)
in one step.

**Rejected**: relying on git history alone (invisible to the app, unusable
by a future admin UI); column-level audit triggers in Postgres (opaque,
unportable, outside Prisma's model). `ContentItemVersion.snapshot` is
deliberately untyped `Json` — a snapshot must survive future schema changes
without a backfill; if a later item ever renders an old version in a UI, it
should validate the snapshot through a versioned Zod schema at read time
rather than trusting the column (Risks/open questions #11, PLAN.md).

## 9. Topics are data; roles/levels/formats/source-types are enums

**Decision**: `Topic` is a table (`slug`, `label`, `description?`, implicit
many-to-many to `ContentItem`), declared in `content/taxonomy.yaml` — the
one open-ended axis, since new AI subject areas appear constantly, and
FR-ADMIN-003 (R2) expects the taxonomy to eventually be manageable.
`RoleArchetype`/`ProficiencyLevel` are the **existing** Prisma enums from
the auth item, reused as-is (no duplication, no new migration touching
`User`). `ContentFormat`/`SourceType`/`ContentStatus` are new enums, because
those are closed sets fixed by the requirements. The importer rejects an
item referencing an undeclared topic — this is what keeps NFR-MAINT-001's
"documented and versioned taxonomy" honest rather than aspirational
(`docs/content/taxonomy.md` must match `content/taxonomy.yaml`).

## 10. Curated items have no detail page

**Decision**: a curated item renders as a card in the path/course listing —
title, publisher attribution, tags, duration, last-reviewed date, an anchor
straight to the external URL (`target="_blank" rel="noopener noreferrer"`).
Only `SourceType.ORIGINAL` items get `/lessons/[slug]`; a curated slug at
that route 404s. NFR-COMP-001 wants us linking to the source, and an
interstitial page inserts a click between the learner and the resource while
adding a route with nothing platform-authored to show.

**Consequence recorded for the future** (repeated from decision #6): when
FR-PROG and FR-RATE land, their per-item controls for curated items must
live on `<ContentItemCard>`, not a detail page — a deliberate, recorded
constraint, not an oversight discovered later.

## 11. Content routes render dynamically, not ISR

**Decision**: every content route (`/paths`, `/paths/[role]`,
`/paths/[role]/[level]`, `/courses/[slug]`, `/lessons/[slug]`, `/glossary`,
`/glossary/[slug]`) sets `export const dynamic = "force-dynamic"`, with
per-request deduplication via React `cache()` in
`src/lib/content/queries.ts`. Content is exactly the slow-changing data
NFR-SCALE-004 wants cached, and ISR is the obvious fit — but every content
route reads Prisma, and the CI `build-and-test` job builds against a
placeholder `DATABASE_URL` with no database behind it, so prerendering these
routes at build time would break the build. Dynamic rendering keeps CI
honest and is comfortably inside the NFR-PERF-001 two-second FCP budget for
a small library served from a co-located Neon instance.

**Rejected**: giving the CI build job a live Postgres service purely so it
can prerender — doubles build-job runtime for a caching win the R1 library
size doesn't need. Promoting these routes to ISR (or `use cache` with
tag-based invalidation triggered by the importer) is a documented follow-up
tied to NFR-SCALE-004, flagged in PLAN.md's Risks section as a conscious
deferral, not a gap nobody owns — the natural home for fixing it is the
FR-SEARCH work item, which will be making caching/indexing decisions anyway.

## 12. The importer is a `tsx` script, not a seed hook or an API route

**Decision**: `npm run content:import` / `npm run content:check --dry-run`
run `scripts/import-content.ts` under `tsx`. It's an operational tool a
human runs deliberately, dry-run first — wiring it to `prisma db seed` would
conflate schema seeding with content operations, and exposing it as an
authenticated API route would be a mini admin UI, which R1 explicitly
doesn't want and which NFR-SEC-006 (RBAC, R2) doesn't exist yet to protect.
`e2e/global-setup.ts` calls `importContentPack()` directly (not the CLI
script — no child process), so local and CI e2e runs are self-seeding.

## 13. Sample-content labelling — one build-time constant, no schema column

**Decision, confirmed with the human before build (PLAN.md Risks #2)**:
every original lesson in the R1 pack is placeholder editorial written to
demonstrate the mechanisms, not reviewed instructional material — so every
one carries a small, unmissable "Sample content — not yet reviewed" notice
(`<SampleContentBadge>`) on its lesson page and its card in every path/course
listing. The signal is `sourceType === "ORIGINAL"` **plus** the pack-level
`SAMPLE_CONTENT_LIBRARY` constant (`src/lib/content/taxonomy.ts`) — because
at R1 _every_ original item is seed prose, there's no reviewed original
content for a per-item flag to distinguish it from, so one constant
expresses exactly as much truth as a column would and is removed in a single
edit once the library is editorially reviewed. Curated items are **never**
labelled — they're real third-party resources, already carrying publisher
attribution and a last-reviewed date.

**Rejected**:

- **An `isSample`/`reviewState` column on `ContentItem`** — needs a
  migration, a frontmatter field, and an import rule, and its value would be
  identical on every row this item ships. The durable "has a human reviewed
  this" axis already exists (`lastReviewedAt`/`reviewCadenceDays`/
  `nextReviewDueAt`, decision #7); a second parallel review flag would
  compete with it rather than complement it.
- **Writing the disclaimer into the lesson body prose** — unmissable only if
  every author remembers it, inconsistent in placement, and impossible to
  remove later in one edit.

## NFR mapping summary

| NFR               | How this item satisfies it                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-MAINT-001     | `content/taxonomy.yaml` + `docs/content/taxonomy.md`, cross-checked at import (§9)                                                                        |
| NFR-MAINT-002/003 | Per-item `reviewCadenceDays`/`nextReviewDueAt`, defaulted by source type, displayed to learners (§7)                                                      |
| NFR-MAINT-004     | Playwright coverage: browse a path, view a lesson, follow curated attribution, the glossary, switch paths (e2e/content-*.spec.ts)                         |
| NFR-MAINT-005     | `docs/content/authoring-guide.md` — the `content:check` -> `content:import` procedure                                                                     |
| NFR-COMP-001      | Curated items link out, never rehosted; publisher attribution on every card (§10)                                                                         |
| NFR-SEC-007       | No `dangerouslySetInnerHTML` anywhere in the content pipeline; raw HTML in a body renders inert (§3)                                                      |
| NFR-SCALE-002     | Indexes on `status`, `sourceType`, `level`, `nextReviewDueAt` sized for the year-one 5,000-item target; no GIN/tsvector index yet — deferred to FR-SEARCH |
| NFR-SCALE-003     | Video referenced by absolute Vercel Blob URL, never proxied through the app origin (§4)                                                                   |
| NFR-SCALE-004     | Flagged, not yet implemented — dynamic rendering today, ISR/`use cache` deferred to FR-SEARCH (§11, PLAN.md Risks #4)                                     |
| NFR-A11Y-002/004  | Responsive layouts, keyboard-operable controls, focus-visible convention reused; glossary tooltip is CSS/focus-driven, no JS                              |
| NFR-A11Y-003      | Zero-knowledge lessons written to plain-language rules, documented in the authoring guide                                                                 |
