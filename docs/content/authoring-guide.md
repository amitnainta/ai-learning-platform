# Content Authoring Guide (NFR-MAINT-005)

How to add, edit, and retire content in `content/` and get it live. Written
so someone who has never seen this repo can add a curated item and an
original lesson end to end. See `docs/content/taxonomy.md` for the tag
vocabulary and `docs/architecture/content.md` for the decisions behind all
of this.

## Layout

```
content/
  taxonomy.yaml         topics + the format/source-type vocabulary
  roles/*.md              one file per RoleArchetype landing page
  paths/*.yaml              one file per (role, level) path — orders its courses
  courses/*.yaml             one file per course — orders its content items
  items/*.md                  one file per content item (original lesson or curated link)
  glossary/*.md                 one file per glossary term
```

Markdown files (`roles/*.md`, `items/*.md`, `glossary/*.md`) use YAML
**frontmatter** — a `---`-delimited block at the top of the file — for
structured fields, and everything after the closing `---` is the Markdown
body. YAML files (`paths/*.yaml`, `courses/*.yaml`) have no separate body;
`description` fields inside them can still contain multi-line Markdown.

## Workflow

```bash
npm run content:check    # validates the whole pack, writes nothing
npm run content:import   # applies it
```

Always run `content:check` first. It parses and cross-validates every file
and reports **every** problem at once (not just the first one) with the
file path attached, for example:

```
content/items/my-lesson.md: topics — references undeclared topic "foo" (add it to content/taxonomy.yaml)
content/courses/my-course.yaml: references unknown content item "some-slug"
```

`content:import` applies the pack inside one database transaction and
prints a summary:

```
items   created=1 updated=2 unchanged=17 retired=0 unretired=0
```

It's **idempotent** — importing an unchanged pack a second time reports
everything as `unchanged` and writes nothing. It never deletes a row:
removing a file and re-importing marks that item `RETIRED` (excluded from
rendering, but the row and its id survive — future progress/rating rows
will reference it). Re-adding the same slug un-retires it.

## Adding a curated item

1. Create `content/items/<slug>.md`. The slug becomes the file name and the
   `slug` field — must match, lowercase, hyphenated.
2. Frontmatter (all required unless marked optional):

   ```yaml
   ---
   slug: my-curated-item
   title: "A Clear, Specific Title"
   summary: One or two sentences — shown on cards, not the article itself.
   sourceType: CURATED
   roles: [TECHNICAL_BUILDER] # one or more RoleArchetype values
   level: INTERMEDIATE # ZERO_KNOWLEDGE | INTERMEDIATE | ADVANCED
   format: ARTICLE # see docs/content/taxonomy.md
   estimatedMinutes: 15 # a realistic read/watch/complete time
   topics: [machine-learning] # one or more slugs from content/taxonomy.yaml
   lastReviewedAt: 2026-06-01 # the date you last actually opened the link
   externalUrl: "https://example.com/the-actual-article" # must be https
   sourcePublisher: "Publisher Name" # required — NFR-COMP-001 attribution
   sourceAuthor: "Author Name" # optional
   sourcePublishedOn: 2025-03-01 # optional, the source's own publish date
   attributionNote: "Free to read; registration required for the full course." # optional
   # reviewCadenceDays: 90   # optional override; CURATED defaults to 90
   ---
   ```

3. Leave the body empty (or delete it) — `CURATED` items are forbidden from
   having a `body`; the schema rejects one if present.
4. Reference the new slug from a course's `items` list
   (`content/courses/*.yaml`) so it's actually reachable from a path.
5. `npm run content:check`, fix anything it flags, then
   `npm run content:import`.

Curated items get **no detail page** — they render as a card with your
attribution and link straight to the source (`target="_blank"`,
`rel="noopener noreferrer"`). Don't add a `content/items/<slug>.md` file
expecting a `/lessons/<slug>` page for it; only `ORIGINAL` items get one.

## Adding an original lesson

1. Create `content/items/<slug>.md` with `sourceType: ORIGINAL`:

   ```yaml
   ---
   slug: my-lesson
   title: "My Lesson Title"
   summary: One or two sentences for the card/preview.
   sourceType: ORIGINAL
   roles: [TECHNICAL_BUILDER, EXECUTIVE_NON_TECHNICAL]
   level: ZERO_KNOWLEDGE
   format: ARTICLE # or VIDEO if you're also attaching a video block
   estimatedMinutes: 8
   topics: [ai-fundamentals]
   lastReviewedAt: 2026-06-01
   # reviewCadenceDays: 365   # optional override; ORIGINAL defaults to 365
   ---
   Your Markdown body goes here. Standard Markdown — headings, lists,
   **bold**, `code`, blockquotes, tables (via GFM) — all render.
   ```

2. Write to the **plain-language rules** below if the item's `level` is
   `ZERO_KNOWLEDGE` (NFR-A11Y-003).
3. Add `[link text](glossary:some-slug)` wherever a term has a glossary
   entry (see the next section) — it renders as an accessible inline
   definition, not a plain link.
4. Reference the slug from a course, `content:check`, then
   `content:import`.

### Plain-language rules (NFR-A11Y-003) for zero-knowledge content

- One idea per sentence. Prefer short sentences to compound ones joined
  with "and"/"which"/"that".
- Define a term the first time you use it, in the same sentence or the one
  right after — don't assume prior vocabulary. Then link it via
  `glossary:` so a reader who forgets can look it up without losing their
  place.
- Prefer concrete examples over abstract description ("a model trained to
  spot spam email" rather than "a supervised classification task").
- Avoid unexplained acronyms. Spell one out on first use even if it's
  common in the field (e.g. write "large language model (LLM)" once, then
  "LLM" is fine after).
- Keep paragraphs short — three to five sentences. A wall of text is a
  bigger accessibility problem than any single word choice.

### Video (FR-PATH-005, optional)

An `ORIGINAL` item can carry a `video` frontmatter block:

```yaml
video:
  url: "https://<your-blob-store>.vercel-storage.com/my-lesson.mp4"
  captionsUrl: "https://<your-blob-store>.vercel-storage.com/my-lesson.vtt"
  posterUrl: "https://<your-blob-store>.vercel-storage.com/my-lesson-poster.jpg" # optional
  durationSeconds: 480 # optional
```

`captionsUrl` is **mandatory** whenever `url` is present — `content:check`
rejects a video block without it. Both must be absolute Vercel Blob URLs
(NFR-SCALE-003: never proxied through the app). If you don't have the video
asset yet, **don't** commit a placeholder URL — either omit the `video`
block entirely, or comment it out with a `#` on every line and a `TODO`
noting what's pending, the way `content/items/ai-strategy-fundamentals.md`
does for the R1 pack's own not-yet-recorded video. An absent video renders
nothing (clean); a broken URL renders a visibly failing player (bad).

## The `glossary:` link convention (FR-PATH-008)

Inside any Markdown body (an item's, a role profile's, or a glossary term's
own long definition), write `[visible text](glossary:term-slug)` to link to
a glossary term. It renders as a dotted-underline link with an inline
definition shown on hover **and** keyboard focus, and it links through to
`/glossary/term-slug`.

`term-slug` must match a real file in `content/glossary/`. `content:check`
fails with a named error (`unresolved glossary link "glossary:foo"`) if it
doesn't — this is checked across every Markdown body in the pack, so a typo
never ships silently.

## Adding a glossary term

`content/glossary/<slug>.md`:

```yaml
---
slug: my-term
term: My Term
shortDefinition: A one-sentence definition, 200 characters or fewer — this is what shows in the hover/focus tooltip.
aliases: ["alternate name"] # optional
relatedSlugs: [another-term-slug] # optional — must be real glossary slugs
lastReviewedAt: 2026-06-01
---
The longer definition, rendered on /glossary/my-term. Can itself contain
[glossary:](glossary:other-slug) links to related terms.
```

## Adding a course or a path

`content/courses/<slug>.yaml` — `items` is an **ordered** list of content
item slugs (the authored order is the display order, and the importer
rewrites the ordering wholesale on every import, so reordering the list and
re-importing is all it takes to reorder a course):

```yaml
slug: my-course
title: My Course
summary: One or two sentences.
description: | # optional, Markdown, multi-line
  Longer course description if you want one.
items:
  - some-item-slug
  - another-item-slug
```

`content/paths/<slug>.yaml` — same idea, `courses` is the ordered list.
There can be **at most one path file per `(role, level)` pair**;
`content:check` rejects a second one:

```yaml
slug: my-path
role: TECHNICAL_BUILDER
level: ZERO_KNOWLEDGE
title: My Path
summary: One or two sentences.
description: |
  Longer path description, Markdown, shown at the top of the path page.
courses:
  - my-course
  - another-course
```

## The sample-content notice (decision #13) — and how it goes away

Every `ORIGINAL` item currently renders a "Sample content — not yet
reviewed" notice, on its own lesson page and on every card that lists it.
This is driven by exactly two things:

1. `sourceType === "ORIGINAL"` on the item.
2. The `SAMPLE_CONTENT_LIBRARY` constant in `src/lib/content/taxonomy.ts`,
   currently `true`.

There is **no per-item frontmatter field or database column** for this —
adding a new original lesson does not require you to do anything to get the
notice; it appears automatically because the item is `ORIGINAL` and the
constant is `true`.

**Before flipping `SAMPLE_CONTENT_LIBRARY` to `false`**: every `ORIGINAL`
item in the live pack must have actually been editorially reviewed as real
instructional material — not just "the mechanism works," the prose itself.
Flipping the constant with unreviewed prose still in the pack would remove
the one honest signal telling a learner what they're reading hasn't been
checked yet. Do this deliberately, as a single, recorded decision — not
silently as part of an unrelated content update.

## Never rename a published item's slug

`slug` is the one field on a content item that must never change once the
item has been imported and a learner could plausibly have visited it. The
importer (`src/lib/content/import.ts`) treats a slug purely as identity: a
new slug is a _new_ item (a new `ContentItem.id`), not an edit to the old
one. Renaming `content/items/my-lesson.md`'s `slug` from `my-lesson` to
`my-better-lesson-title` and re-importing does exactly what
`docs/architecture/content.md` decision #2 says it should — it retires the
old row (`my-lesson`, excluded from every published listing, its id
preserved) and creates a brand-new row (`my-better-lesson-title`, a new
id).

That's the correct behaviour for _content_, but it's a trap for **progress**
(`docs/architecture/progress.md`, the progress-tracking work item):
`Progress` rows key on `ContentItem.id`, not on slug. A learner who
completed `my-lesson` keeps their `Progress` row — nothing deletes it — but
it now points at a _retired_, unreachable item. Their completion isn't
lost from the database, but it silently drops out of every percentage
(FR-PROG-003's read-time computation excludes retired items from both
numerator and denominator — `docs/architecture/progress.md` decision #5),
and the item they actually finished is gone from their resume path. The
same applies to a course or path `slug` and any future rating/certificate
that comes to key on it.

**If a rename is genuinely unavoidable** (a typo in the URL-visible slug, a
legal/naming change), the safe procedure is:

1. Keep the file name and `slug` as they are for anything already live —
   resist the urge to "clean it up" as part of an unrelated content edit.
2. If the slug truly must change, do it as its own deliberate, recorded
   step (a dedicated commit/PR, not folded into a content refresh), and
   flag it to whoever owns the progress-tracking item's backlog — a
   rename-mapping mechanism in the importer is the correct fix, not
   something to work around per-rename.
3. Never reuse a retired slug for an unrelated new item — the importer will
   happily un-retire and repurpose it (decision #2), which would attach a
   totally different item to any progress/rating rows still pointing at
   the old id.

Titles, summaries, body text, tags, and every other field are safe to edit
freely and often — this rule is about the `slug` field specifically.

## Review cadence (NFR-MAINT-002/003) — the human process

`reviewCadenceDays` and the derived `nextReviewDueAt` are stored on every
item (90 days curated / 365 days original, by default) but **nothing in the
app enforces or surfaces them proactively at R1** — `nextReviewDueAt` is
indexed and ready for FR-ADMIN-004's R2 automated staleness flagging, but
until that ships, reviewing content on schedule is a manual process:

1. Set a recurring calendar reminder (see
   `docs/runbooks/provisioning-checklist.md`).
2. When it fires, open every curated link changed or added since the last
   review and confirm it still resolves and the attribution is still
   accurate (NFR-COMP-001). For original lessons, re-read the prose for
   continued accuracy.
3. Update `lastReviewedAt` to today's date, even if nothing else changed —
   this alone does **not** bump `version` or create a new snapshot
   (`docs/architecture/content.md` decision #8), so a routine review-only
   pass is free to record without inflating version history.
4. `npm run content:check` then `npm run content:import`.
