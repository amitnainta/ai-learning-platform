# REVIEW — learning-paths-content

_Independent review by factory-reviewer. Branch `feature/learning-paths-content`, 9 commits
ahead of `main`. I did not write this code and re-derived every conclusion below from the
diff, not from PLAN.md or TEST_REPORT.md claims._

## Verdict: **APPROVED WITH NOTES** (non-blocking)

The diff does what the plan said it would do, stays inside its declared scope, has no
security defects I can find, and is backed by tests that actually exercise the acceptance
criteria rather than restating them. 15 of 16 ACs are genuinely met; AC14 is manual-only by
the plan's own design, and AC16 is met locally but blocked at the repository level by a
pre-existing CI bug this branch did not cause.

**Nothing in this item's diff must change before ship.** There are six tracked follow-ups
below, two of which (F1, F2) I would want picked up in the next content-touching work item
rather than left indefinitely.

**One merge-gate condition that is not this item's fault:** CI on `main` is red right now
(see section 5c). I recommend fixing that as a separate one-file work item that lands
*before* this PR merges, so the ship decision has a real automated signal.

---

## 1. Correctness against the plan

I checked all 16 acceptance criteria against the diff. Rather than repeat the tester's
table, here is what I independently re-derived or disagreed with:

- **AC1/AC2/AC5/AC10/AC11 (structure, tags, curated attribution, role landing pages,
  anonymous readability)** — met. `content/paths/*.yaml` has all 6 role x level files; array
  order in the YAML is the authored position and `import.ts` writes it to
  `PathCourse.position`/`CourseItem.position`; `queries.ts` orders by it. Every query in
  `src/lib/content/queries.ts` filters `status: PUBLISHED` at every nesting level (paths,
  courses, and items), which is what makes AC11 "retired slugs 404" true rather than merely
  claimed. Route params go through `parseRoleSegment`/`parseLevelSegment`, which return
  `null` for anything not in the enum map, so unknown segments `notFound()` before any query
  runs.
- **AC3 (no `dangerouslySetInnerHTML`, raw HTML inert)** — met, verified by my own grep: the
  only two hits in `src/` are the word appearing inside comments. See section 3.
- **AC4 (video path proven without a live asset)** — met. I confirmed
  `content/items/ai-strategy-fundamentals.md` has the entire `video:` block commented at the
  YAML level, so `yaml.parse` never sees the key; it is the only file in the pack with any
  video reference. `videoBlockSchema` puts `url` and `captionsUrl` in the same required
  object, so captions genuinely cannot be omitted, and `LessonVideo` additionally returns
  `null` if either is missing — belt and braces.
- **AC6 (version/hash/review cadence)** — met **with one narrow, real exception**: see F2.
  `computeContentHash` serializes `Date` values as `{}`, so a change to a curated item's
  `sourcePublishedOn` produces an identical hash and the importer plans the item as
  `unchanged` — no version bump, no snapshot, and the stale value stays in the database. I
  reproduced this directly. It is latent today because `sourcePublishedOn` is set on exactly
  one seed item and is never rendered, which is why it is a follow-up and not a blocker.
- **AC9 (importer semantics)** — met. `plan-import.ts` never emits a delete for a
  `ContentItem`/`Course`/`Path`; `import.ts` only ever flips `status` to `RETIRED`. The
  dry-run path is implemented by throwing a `DryRunSentinel` inside the transaction and
  catching it outside, which is a legitimate way to guarantee nothing commits — the summary
  is computed from the plan before any write is attempted.
- **AC12 (scope discipline in the schema)** — met, verified by reading the full schema diff.
  No `Progress`/`Rating`/`Bookmark`/`Certificate` model, no user-referencing column on any
  content table, and the migration's only `ALTER TABLE` statements add foreign keys between
  new content tables.
- **AC13** — met; `docs/architecture/content.md:180` states the `(userId, contentItemId)`
  commitment in the durable place the next work items will read.
- **AC16** — met locally (I re-ran `npm run test`: 173/173, and one clean `npm run build`
  with the CI env: success). Not true of real CI; see section 5c.

**AC14 is the one genuinely unmet criterion**, and it is unmet in the way the plan
anticipated: a manual responsive/keyboard walkthrough that no automated check covers. The
mechanism is present and correct by inspection (`group-hover`/`group-focus-within` with
`aria-describedby`, no JS dependency, so the glossary tooltip works for keyboard users), but
"usable at 375/768/1280px with a visible focus ring" has not been observed by anyone. That
belongs on the human's ship checklist, not on the builder's.

### Schema future-proofing for FR-PROG / FR-RATE

Spot-checked as asked. `ContentItem`, `Course`, and `Path` each carry
`id String @id @default(cuid())` plus a `@unique` author-controlled `slug`, and the importer
never deletes or recreates a row — worst case it flips `status` to `RETIRED` — so ids are
genuinely stable across imports. A later `Progress` table keyed `(userId, contentItemId)` and
a `Rating` table keyed on `courseId`/`pathId` are pure additive migrations: they add tables
and foreign keys, and touch no existing column. The many-to-many `CourseItem`/`PathCourse`
joins are what make FR-PATH-009's retention guarantee structural rather than aspirational —
a shared item is one row with one id, so completing it in one path is already completing it
in the other. I could not find anything here that would force rework.

## 2. Scope

Clean. I checked for the four categories of scope creep the plan warned about:

- No FR-PROG, FR-RATE, FR-SEARCH-001/002/003, FR-CERT, FR-PATH-003, or FR-PATH-010
  functionality. Grepping `src/` and the schema for `progress|rating|bookmark|certificate`
  returns only home-page marketing copy and the schema's own "deliberately absent" comment.
- No settled decision from the two prior shipped items is re-litigated. No stack, hosting,
  auth-library, or styling change. `src/lib/auth/*`, `src/lib/mail/*`, and `ci.yml` are
  untouched.
- The only edits to pre-existing files are the four the plan authorised (tasks 31/32/48):
  dashboard, site header, home page, and the `home.test.tsx`/`smoke.spec.ts` assertions those
  changes invalidate — plus one line in `e2e/account-profile.spec.ts`.
- That `account-profile.spec.ts` change deserves a specific note, because a text-matcher edit
  in someone else's spec is exactly the shape a papered-over regression takes. It is not one:
  `getByText("ADVANCED")` became `getByText("ADVANCED", { exact: true })`, a **stricter**
  matcher, made necessary because the dashboard's new `<PathSwitcher>` renders an "Advanced"
  `<option>`. Correct fix, correctly commented.

New dependencies (`react-markdown`, `remark-gfm`, `yaml`, `tsx`) are exactly the four the
plan named, pinned exactly, matching the file's no-range convention.

## 3. Security

I read `loader.ts`, `validation/content.ts`, `frontmatter.ts`, `scripts/import-content.ts`,
and the whole rendering path myself, specifically asking what breaks if this pack format is
ever fed less-trusted input.

**Path traversal — safe, and safe for the right reason.** File paths are only ever built from
`readdir` results (`path.join(dir, entry.name)`), never from a slug, title, or any other
author-supplied *content* field. Slugs are validated against
`/^[a-z0-9]+(?:-[a-z0-9]+)*$/` and used only as database keys and URL segments, never as
filesystem paths. `readdir` is non-recursive and there is no directory recursion anywhere, so
there is no unbounded-recursion or symlink-descent surface. The one operator-controlled path
is `loadContentPack(packDir)` from `argv` — a CLI argument a human types, equivalent in trust
to the shell they typed it in.

**YAML parsing — safe.** `yaml` (eemeli, v2) is used with `parse()` and no custom schema or
tag resolution, so there is no `!!js/function`-style construct to deserialize, and it applies
its own alias-expansion cap, so a billion-laughs pack is not a DoS. Both the frontmatter
parser and the collection loaders wrap `parseYaml` in try/catch and turn failures into
aggregated, file-attributed errors rather than throwing.

**Regex — no ReDoS.** The slug pattern's nested quantifier is unambiguous (the inner group
must begin with a `-`, which is not in the outer character class), so it cannot backtrack
catastrophically. `GLOSSARY_LINK_PATTERN` is a module-level `/g` regex but is only used with
`String.prototype.matchAll`, which clones the regex — so there is no shared-`lastIndex`
statefulness bug across calls.

**No XSS surface in the Markdown path — confirmed, including the `urlTransform` carve-out.**
This was the thing most worth checking independently, and it holds:

- `react-markdown` produces a React element tree, never an HTML string. `rehype-raw` is
  deliberately absent, so raw HTML in a body is inert text. Two tests assert this with a live
  `<script>` payload and an `<img onerror=...>` payload and check the sentinel global was
  never set.
- The custom `urlTransform` only returns a URL unsanitized when it `startsWith("glossary:")`;
  everything else falls through to `defaultUrlTransform`, so `javascript:`, `data:`, and
  `vbscript:` are still emptied. The check is case-sensitive `startsWith`, so `GLOSSARY:` is
  not a bypass — it falls to the default sanitizer and is stripped.
- The carve-out cannot be turned into a scheme bypass, because the `glossary:` branch never
  puts the author's string into an `href` verbatim: it strips the scheme and passes the
  remainder to `glossaryUrl()`, which always prefixes `/glossary/`. Even a crafted
  `[x](glossary:javascript:alert(1))` renders `href="/glossary/javascript:alert(1)"` — a
  same-origin relative path, not a scheme. There is no open-redirect variant either, since a
  `//host` input ends up as `/glossary///host`.
- `<ExternalLink>` always sets `rel="noopener noreferrer"` with `target="_blank"`, and its
  `href` for curated cards comes from an `externalUrl` the import schema forces to be a valid,
  `https://`-prefixed URL.

**Input validation** is thorough and fails closed: both branches of the content-item union are
`.strict()`, so supplying the other branch's fields is a hard validation error. That is what
actually implements "CURATED forbids body", and it is also what makes AC5's "no external
content is copied into the database" structurally true rather than a matter of author
discipline. Every free-text field has a length cap and control-character stripping, and the
Markdown-prose variant (`stripControlCharactersPreservingNewlines`) correctly preserves
tab/LF/CR with a comment explaining why that variant has to exist.

**No secrets.** The only credential-shaped string in the diff is the shared e2e test password
already used by five existing specs.

**Permissions.** The importer is a `tsx` CLI, not an API route, so there is no new
authenticated write surface — consistent with decision #12 and with NFR-SEC-006 (RBAC) not
existing yet. `<PathSwitcher>` reuses the existing `PATCH /api/account/profile` rather than
adding an endpoint, so it inherits that route's session check and validation.

## 4. Correctness bugs and style

Six findings, all non-blocking, listed as F1-F6 in section 6. The two worth reading are F2
(the `Date`-in-hash bug, a narrow AC6 violation) and F1 (the NFT over-tracing). Style is
consistent with the codebase throughout: the aggregated-error convention from
`src/lib/env.ts`, a `cache()`-wrapped query module as the single read path, `--color-*`
tokens, a `role="note"` banner styled like `verify-email-banner.tsx`, and comments that
explain *why* rather than *what*. The `plan-import.ts` / `import.ts` split is the right call
and is what makes the retire-not-delete and version-bump rules testable without a database;
the tests take genuine advantage of it.

One thing I want to credit rather than fault: three of the four deviations the builder
self-reported (the newline-stripping fix, the `urlTransform` fix, the `timeZone: "UTC"` date
fix) are cases where the builder found a real bug in its own first implementation and fixed it
with a comment explaining the failure mode. That is the behaviour you want.

## 5. The three flagged items — my own read

### 5a. The reported build-breaking crash: I concur it is not real

I ran one clean `npm run build` with the exact CI env vars. It succeeded, compiled in 5.3s,
and printed all 22 routes — every one of them marked dynamic, which independently confirms
decision #11 is honoured and no content route attempts to prerender against the placeholder
`DATABASE_URL`. That makes five successful builds across three independent agents, versus zero
reproductions of the reported failure.

I also looked for a mechanism, not just a repro count. `Cannot read properties of null
(reading 'useContext')` during prerender is the classic signature of either a duplicated React
copy in the module graph or a build worker dying and leaving a half-initialised renderer.
Nothing in this diff can produce the first: no new React copy, no client component imported
into a server-only context, and the only change to a globally rendered file is two `<Link>`s
added to the server-component site header. `/_global-error` renders no content route and
imports none of this item's modules. There is no narrowly triggered path I can find that would
make the crash real-but-rare. Combined with this machine's documented low-RAM history from the
two prior items, transient resource contention is the only explanation that fits the evidence.
**Not a blocker, and not worth further investigation.**

### 5b. NFT over-tracing: the tester's diagnosis is correct; my call is fast-follow

Confirmed by reading `loader.ts` directly. `findGlossaryLinks` (a pure 9-line regex scan,
lines 189-198) lives in the same module as `listFiles`, `loadMarkdownCollection`,
`loadYamlCollection`, and `loadContentPack`, all of which call `readdir`/`readFile` against
`path.resolve(process.cwd(), packDir)`. `src/app/lessons/[slug]/page.tsx:5` and the glossary
term page import `findGlossaryLinks` from that module, so Next's tracer — which cannot bound a
dynamically resolved `readdir` — conservatively pulls the whole `content/` tree into both
functions. My build reproduced the warning, and its import trace names exactly that chain.

I agree it is bloat and not a correctness or security bug: nothing on the request path ever
calls `loadContentPack`, and page rendering goes exclusively through the Prisma-only
`queries.ts`. I also agree the fix is trivial in code — move `findGlossaryLinks` into
`src/lib/content/glossary-links.ts`, have `loader.ts` import it, update two page imports.

**My recommendation is still fast-follow, for a process reason rather than a code reason.**
The fix is cheap in lines but not free in pipeline: any change to this branch requires a new
build + test + review pass over a 142-file diff, to buy a deployment-size improvement worth
tens of KB and zero user-visible behaviour, on a project that has not deployed yet and is
nowhere near Vercel's function-size limit. That is a bad trade today. It becomes a good trade
the moment the content library grows or the first deploy is imminent, so I would bind it to
the next work item that touches `src/lib/content/` (FR-SEARCH or FR-PROG) rather than filing
it as an open-ended "someday". If the human would rather absorb one extra pipeline pass now to
keep the module boundary clean while it is still small, I would approve that change on sight —
it is behaviour-preserving.

### 5c. The pre-existing CI-red bug: fix it as its own work item, landing before this merges

I verified this independently rather than taking it on report:

- `gh run list --branch main` shows the latest `main` run (`63549d6`, "Ship
  user-accounts-auth") **failed**, with `build-and-test` failing specifically at the "Unit
  tests" step and the `e2e` job green.
- `.github/workflows/ci.yml` sets `MAIL_TRANSPORT: "file"` in the **job-level** `env:` block
  (line 30), which applies to every step in `build-and-test`, not just the "Build" step its
  own comment says it exists for.
- `MAIL_TRANSPORT=file npx vitest run src/lib/mail/__tests__/mailer.test.ts` reproduces
  exactly 6 failures locally. Those tests assume no ambient `MAIL_TRANSPORT`, and
  `vi.unstubAllEnvs()` cannot undo a real `process.env` value.
- `git diff main...HEAD` confirms this branch touches neither file.

**Recommendation: spin it off as its own small work item and land it on `main` before this PR
merges.** Concretely: move `MAIL_TRANSPORT` out of the job-level `env:` into the "Build" step's
own `env:`, *and* have `mailer.test.ts` explicitly clear or stub `MAIL_TRANSPORT` in a
`beforeEach` so the suite is immune to ambient environment regardless of what CI does. Fixing
both sides is what stops this recurring.

The tradeoff, stated plainly:

- **Fixing it inside this work item** is cheapest in wall-clock terms and would make this PR's
  own CI genuinely green. But it means committing `ci.yml` and `mailer.test.ts` changes on a
  branch whose plan explicitly scopes both out — and I would then have to flag that as scope
  creep in this very document. If the human prefers this route it is defensible, but it should
  go through `/factory-amend` so the widened scope is recorded rather than smuggled in.
- **Spinning it off** keeps scope discipline intact and produces a 2-file PR that is trivial to
  review. Cost: one extra pipeline cycle, and this item waits on it.
- **Noting it and leaving it** is the option I would argue against. `main` is red either way,
  so "shipping now does not make it worse" is literally true — but the `e2e` job was promoted
  to *blocking* only one work item ago, and merging a second feature over a known-red required
  check is how a team learns to stop reading CI. The point of the ship gate is that the human
  gets a trustworthy signal; right now `build-and-test` provides none.

To be unambiguous about the boundary: this is **not** a defect in `learning-paths-content` and
**not** a reason to withhold approval of this diff. It is a condition I recommend the human
attach to the *merge*, not to the *code review*.

## 6. Follow-ups (tracked, none blocking)

- **F1 — Split `findGlossaryLinks` out of `loader.ts`.** Deployment bloat, no runtime effect.
  Bind to the next work item touching `src/lib/content/`. (Section 5b.)
- **F2 — `computeContentHash` hashes `Date` values as `{}`.** `stableStringify` falls into its
  object branch for a `Date`, and `Object.entries(date)` is empty, so two different dates
  serialize identically. Consequence: editing a curated item's `sourcePublishedOn` is invisible
  to the importer — no version bump, no snapshot, and the database keeps the stale value while
  the operator is told "unchanged". This is a narrow violation of AC6's "changing a file and
  re-importing bumps `version`". Latent today (one seed item sets the field, nothing renders
  it), which is why it is a follow-up rather than a blocker. Fix: add
  `if (value instanceof Date) return JSON.stringify(value.toISOString());` to
  `stableStringify`, and add a `hash.test.ts` case using real `Date` objects — the existing
  date cases all pass strings, which is exactly why this slipped through.
- **F3 — `publishedAt` is overwritten with `new Date()` on every update** (`import.ts:306`).
  A "first published at" column that silently becomes "last imported at". Nothing reads it yet;
  fix before anything does.
- **F4 — `nextReviewDueAt` is computed with local-time `setDate()`** (`import.ts:275-276`) on a
  UTC-midnight `lastReviewedAt`, so it can land a day off for a server west of UTC. Nothing
  reads it until FR-ADMIN-004 (R2). Worth noting that the *display* path got this exactly right
  (`timeZone: "UTC"`, with a comment); this arithmetic just did not get the same treatment.
- **F5 — `loader.test.ts`'s "aggregates every error" test asserts nothing.** Its only assertion
  is `expect(Array.isArray(result.errors)).toBe(true)`, and its own comment admits it does not
  build a multi-problem fixture. Task 35 and the test plan both explicitly called for "multiple
  errors are reported together rather than one at a time". The behaviour is correct by
  inspection, but this is the one test in the item that provides no signal — a fixture with two
  independent problems and an `errors.length >= 2` assertion would fix it.
- **F6 — No test flips `SAMPLE_CONTENT_LIBRARY` to `false`** to prove every badge disappears
  (the tester noted this too). Decision #13's whole promise is "one constant removes all of
  them"; that promise is currently unproven. One test case.

Minor notes, no action required: the designated video lesson is tagged `format: VIDEO` while
shipping no video, so a learner sees "Video, 12 min" on a text-only lesson until the manual
upload step is done — consistent with the recorded plan, but worth a glance during the manual
ship checklist. `<PathSwitcher>` does not `try`/`catch` its `fetch`, so a network error would
leave the button stuck disabled — but this matches the existing `role-level-form.tsx`
convention exactly, so it is a codebase-wide nit, not a regression introduced here.
`REQUEST.md` was not committed alongside `PLAN.md`; factory hygiene only.

## 7. Test quality

The tests genuinely exercise the acceptance criteria rather than restating them. Specific
evidence I checked myself:

- `markdown.test.tsx` uses **live attack payloads** (a `<script>` that sets a global, an
  `<img onerror>` that sets another) and asserts both that no element was created and that the
  sentinel global is still `undefined`. That is a real XSS test, not a snapshot.
- `loader.test.ts` drives seven distinct broken fixture packs through the real loader and
  asserts on the specific error strings, not just on failure. (Its eighth case is F5.)
- `plan-import.test.ts` tests the rules the plan committed to in prose — retire-not-delete,
  un-retire, no version bump on unchanged — against plain objects, with no database.
- The e2e specs assert *ordering* against the authored YAML, the actual `href`/`target`/`rel`
  triple on a curated anchor, and 404 status codes for unknown segments.
  `content-lesson.spec.ts` asserting the *absence* of a `<video>` element is a good instinct:
  it pins the seed pack's "no broken player" promise, so a future accidental placeholder URL
  turns the suite red.
- `lesson-video.test.tsx` covers both the present and absent branches plus the defensive
  "url without captions renders nothing" case, which is the right way to prove FR-PATH-005
  without a live asset.

The weakest spots are F5 and F6, both single missing cases in otherwise strong files, and
neither hides a defect.

## 8. Verification I ran myself

| Check | Result |
| --- | --- |
| `npm run test` | 173/173 passed, 19/19 files |
| `npm run build` (CI env vars, Turbopack) | Success; 22 routes, all dynamic; NFT warning reproduced |
| `MAIL_TRANSPORT=file npx vitest run .../mailer.test.ts` | 6 failures — CI-red bug reproduced |
| `gh run list --branch main` + job/step inspection | Latest `main` run failed at `build-and-test` -> "Unit tests"; `e2e` green |
| `grep -rn dangerouslySetInnerHTML src/ e2e/ scripts/` | Zero real usages (comments only) |
| Scope grep for `progress\|rating\|bookmark\|certificate` | No models, no functionality — copy and comments only |
| `stableStringify` on two distinct `Date` values | Identical output `{}` — F2 confirmed |
| Full read of `loader.ts`, `validation/content.ts`, `frontmatter.ts`, `hash.ts`, `plan-import.ts`, `import.ts`, `queries.ts`, `routes.ts`, `markdown.tsx`, `glossary-link.tsx`, `external-link.tsx`, `content-item-card.tsx`, `lesson-video.tsx`, `sample-content-badge.tsx`, `path-switcher.tsx`, schema diff, all modified pre-existing files | See findings above |

## 9. Would I ship this under my own name?

Yes — with the CI-red condition in section 5c resolved or consciously accepted by the human,
and with AC14's manual responsive/keyboard walkthrough actually performed rather than assumed.
The security posture of the rendering pipeline is the part of this item that most needed to be
right before FR-RATE brings user-submitted text into the same components, and it is right.
