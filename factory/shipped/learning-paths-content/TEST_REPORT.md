# TEST_REPORT — learning-paths-content

Independent verification, run against `feature/learning-paths-content` (9 commits ahead of
`main`, not pushed). All commands re-run fresh by the tester; nothing here is taken on the
builder's word alone.

## Overall verdict: **PASS**, with two items flagged for the ship gate (not blockers on this
item's own correctness, but real findings that should be resolved or consciously accepted
before shipping):

1. The reported `npm run build` blocker **does not reproduce** — see "Build failure
   investigation" below. It was very likely the transient resource-contention failure the
   builder itself hedged about, not a deterministic pre-existing bug.
2. A genuine (if modest today) **NFT over-tracing / deployment-bloat** issue exists in
   `src/lib/content/loader.ts` — see "NFT tracing warning investigation." Recommend a
   trivial follow-up fix before or shortly after ship.
3. **Not this item's fault, but real**: GitHub's actual CI on `main` is currently red, for a
   reason unrelated to this work item (pre-existing `MAIL_TRANSPORT=file` job-level env
   leaking into the "Unit tests" step, shipped by `user-accounts-auth`). AC16's "both CI jobs
   stay green" is not literally true of the repository right now. See below.

---

## 1. Build-failure discrepancy — RESOLVED: not reproducible

Ran `npm run build` from a fully clean state (`rm -rf node_modules && npm ci && rm -rf .next`)
**three times** with the CI job's exact placeholder env vars
(`DATABASE_URL`/`DIRECT_URL=postgresql://ci:ci@localhost:5432/ci_placeholder`,
`NODE_ENV=test`, `BETTER_AUTH_SECRET=ci-placeholder-secret-not-real-min-32-chars`,
`MAIL_TRANSPORT=file`), plus a fourth run with `next build --webpack` to rule out a
Turbopack-specific bug. **All four builds succeeded cleanly** — no crash, no
`useContext`/null error, `/_global-error` and every other route (including all 7 new content
routes) built and printed in the route table every time. No flakiness observed across 4
consecutive builds.

This machine has 15.7 GB RAM total; free memory dipped to ~5 GB at one point during this
session (consistent with the "documented low-RAM OOM issues" noted in prior work items'
builder notes). The most plausible explanation for the builder's reported failure is a
transient resource-contention crash during their run, misdiagnosed as a deterministic
pre-existing bug — especially since their own claim ("identical failure every time, both
Windows and WSL2, both Turbopack and webpack") could not be reproduced under the same
conditions here. I did not have a failing run to capture a stack trace from; there simply
wasn't one to capture in 4 attempts.

**Conclusion: the build failure is not real / not reproducible as described. It should not
block shipping this item.**

## 2. NFT tracing warning investigation — real, but not a crash risk

Every build (Turbopack) emits:

```
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
Import trace:
  Server Component:
    ./next.config.ts
    ./src/lib/content/loader.ts
    ./src/app/lessons/[slug]/page.tsx
```

Root cause, confirmed by inspecting `.next/server/app/lessons/[slug]/page.js.nft.json` and
`.next/server/app/glossary/[slug]/page.js.nft.json` directly:

- `src/app/lessons/[slug]/page.tsx` and `src/app/glossary/[slug]/page.tsx` import
  `findGlossaryLinks` (a pure regex function) from `@/lib/content/loader` — but that's the
  *same module* as `loadContentPack`, `listFiles`, `loadMarkdownCollection`, and
  `loadYamlCollection`, which call `readdir`/`readFile` with a dynamically-resolved directory
  path (`path.resolve(process.cwd(), packDir)`). Next's file tracer can't statically prove
  the bound of that `readdir`, so it conservatively includes the entire `content/` directory
  (60 files: all 12 course YAMLs, 20 item Markdown files, 6 path YAMLs, 2 role profiles, 19
  glossary terms, `taxonomy.yaml`, `README.md`) **and** `docs/content/*.md` in both routes'
  traced-file list — verified by diffing the NFT JSON against the real `content/` directory
  listing; every single file in `content/` shows up.
- **Is it ever actually read at request time?** No. `loadContentPack` is called only from
  `scripts/import-content.ts` (the CLI importer) and `e2e/global-setup.ts` — confirmed by
  grepping every call site in `src/` and `scripts/`. Every page route reads content
  exclusively through `src/lib/content/queries.ts`, which is Prisma-only. So this is
  **wasted bundle weight, not a functional bug** — the deployed function will never actually
  read those files.
- **Is this pattern new to this item, or did the prior scaffolding item already have
  something similar?** New to this item. `next.config.ts`'s only fs-adjacent code
  (`serverExternalPackages: ["@node-rs/argon2"]`) is a static config list, not a dynamic fs
  call, so the prior two shipped items introduced nothing like this.
- **Severity / recommendation:** at the current seed-pack size (60 files, mostly small
  Markdown/YAML, probably tens of KB) this is not a functional problem and is unlikely to
  meaningfully affect cold-start time today. But it's a real, easily-fixed design smell that
  will get worse linearly as the content library grows toward the stated year-one 5,000-item
  target, at which point it means bundling the *entire* content source tree into two
  serverless functions on every deploy for no runtime benefit. **The fix is trivial**: move
  `findGlossaryLinks` out of `loader.ts` into its own small module (e.g.
  `src/lib/content/glossary-links.ts`) with no fs imports, and have `loader.ts` import it
  instead of the reverse. This does not require a schema, test, or behavior change.
  **Recommendation: worth fixing before or shortly after ship, but not a ship blocker** — it
  degrades gracefully (extra bytes, not broken behavior) and the fix is small enough to be a
  fast-follow.

## 3. Standard verification — re-run fresh, independently

| Check | Result |
| --- | --- |
| `npm ci` (clean `node_modules`) | Clean install, 701 packages, `postinstall` (`prisma generate`) succeeded |
| `npm run lint` | Clean, no errors/warnings |
| `npm run format:check` | Clean — "All matched files use Prettier code style!" |
| `npx tsc --noEmit` | Clean, no output/errors |
| `npm run build` (Turbopack) ×3 + `--webpack` ×1 | 4/4 succeeded; all 21 routes built; NFT warning present every time (see §2) |
| `npm run test` (Vitest) | **173/173 passed**, 19/19 files, in a clean shell — matches the builder's report. (First attempt showed 6 failures in `mailer.test.ts`; root-caused to my own shell having `MAIL_TRANSPORT=file` exported from the build-reproduction steps, which `vi.unstubAllEnvs()` cannot undo since it's real `process.env`, not a vitest stub. Confirmed self-inflicted by re-running in a clean shell.) |
| `npm run test:e2e` (Playwright), default workers | 29/30 passed, 1 failure in `account-profile.spec.ts` (timing race on sign-out redirect) |
| `npm run test:e2e` (Playwright), `--workers=1` (matches CI's `workers: process.env.CI ? 1 : undefined`) | **30/30 passed**, twice (once full suite, once isolated ×3 repeats of the flaky spec) |

The one e2e failure is a **parallelism-induced flake, not a regression**: re-running
`account-profile.spec.ts` alone with `--workers=1 --repeat-each=3` passed 3/3, and the full
suite at `--workers=1` (the actual CI configuration) passed 30/30 with no failures. Confirmed
this is unrelated to the diff in that file (see §5 below) — the failure was in the
pre-existing sign-out redirect assertion, not the new exact-match line.

### An important, unrelated-but-real finding: CI's `build-and-test` job is currently red on `main`

While reproducing the CI env for the build/test commands, exporting the job's env vars
(including `MAIL_TRANSPORT=file`, which the CI YAML sets at **job level**, so it applies to
every step in that job — not just the intended "Build" step) into my own shell caused the
exact same 6 `mailer.test.ts` failures locally that I initially mistook for a real bug. I then
checked GitHub Actions directly with `gh run view` on the most recent `main` push
(`63549d6`, "Ship user-accounts-auth") and confirmed: **the real, current CI run on `main` is
failing at the "Unit tests" step with the identical 6 `mailer.test.ts` assertions**, because
the job-level `MAIL_TRANSPORT: "file"` env var (added for the later "Build" step's benefit)
also applies to the earlier "Unit tests" step, and `mailer.test.ts`'s
`resolveMailTransport`/`sendMail` tests assume no ambient `MAIL_TRANSPORT` is set unless a
given test explicitly stubs it.

- This bug is **not caused by `learning-paths-content`** — `git diff main...HEAD` confirms
  this branch touches neither `.github/workflows/ci.yml` nor anything under `src/lib/mail/`.
  It's inherited from the already-shipped `user-accounts-auth` item's CI pipeline commit.
- It **is real** and is currently red on GitHub right now, independent of anything in this
  branch.
- Because this branch doesn't touch either file, pushing it as-is would very likely hit the
  same red `build-and-test` job in CI, even though every check passes locally in a clean
  shell.
- AC16 states "`npm run lint`, `format:check`, `test`, `build`, and `test:e2e` all pass
  locally, **and both CI jobs stay green**." The "locally" half is true (confirmed above);
  the literal "both CI jobs stay green" half is **currently false** for the repository as a
  whole, for a reason this item did not introduce and cannot fix without touching files
  outside its own diff.
- **Recommendation**: flag to the human before shipping anything through this pipeline — the
  fix is either scoping `MAIL_TRANSPORT: "file"` to just the "Build" step in `ci.yml`, or
  making the affected `mailer.test.ts` tests robust to an ambient `MAIL_TRANSPORT`. Neither
  fix belongs to `learning-paths-content`'s scope, but it blocks a truthful "CI is green"
  claim for any branch, including this one, until someone fixes it.

## 4. Human-answered decisions — verified live, not just by reading code

**(a) No live/placeholder video URL anywhere in the committed `content/` pack.**
Grepped `content/` for `video`, `https?://`, `.mp4`, `blob.vercel`, `videoUrl`, `captionsUrl`.
The only lesson with a `video:` frontmatter block
(`content/items/ai-strategy-fundamentals.md`) has the entire block — including the
`example-blob.vercel-storage.com` placeholder URLs — commented out with `#` at the YAML
level, so `yaml.parse` never sees a `video` key at all (confirmed: no other item file
contains a `video:` key, live or placeholder). **Confirmed genuinely absent.**

**(b) Sample-content badge renders on original items, not on curated items — checked live.**
Started the production server (`npm run start` against the real dev Postgres) and fetched
rendered HTML directly:
- `/lessons/ai-strategy-fundamentals` (an original lesson): contains the "Sample content —
  not yet reviewed" notice (`role="note"`) and no `<video>` element.
- `/paths/executive-non-technical/intermediate`: queried the DB directly (2 `ORIGINAL` items,
  3 `CURATED` items on this path) and confirmed exactly 2 rendered badges (the apparent 8
  substring matches in the raw HTML are the 2 real badges × 2 [visible text + `aria-label`]
  × 2 [rendered DOM + the embedded RSC hydration payload] — verified by inspecting the actual
  surrounding markup, not just counting substrings). **0 badges on the 3 curated cards.**
  **Confirmed correctly gated on `sourceType === ORIGINAL` and matches decision #13.**

**(c) `lesson-video.test.tsx` genuinely proves the video path.** Read the test file in full:
it covers (1) a `<video controls preload="metadata">` with the correct `src`/`poster`/
`aria-label` when a video is present, (2) exactly one `<track kind="captions" default>` with
`src`/`srclang`/`label`, (3) no `poster` attribute when none supplied, (4) a text fallback
link inside the `<video>` element, (5) renders nothing (`toBeEmptyDOMElement()`) when the item
has no video — the seed pack's actual state, and (6) defensively renders nothing when
`videoUrl` is present without `captionsUrl`, even though the import schema should already
reject that shape. Paired with `validation/content.test.ts`'s
`"rejects a video block declared without captionsUrl"` case. **This genuinely covers the
whole FR-PATH-005 video path without a live asset — confirmed, not just claimed.**

## 5. Spot-checked the four reported deviations

| Deviation | Verified genuine? | Evidence |
| --- | --- | --- |
| `stripControlCharacters` newline-stripping bug | **Yes** | A separate `stripControlCharactersPreservingNewlines` function (preserves tab/LF/CR, codepoints 9/10/13) is used for Markdown prose fields via `cleanMultilineText`, distinct from the single-line `stripControlCharacters`/`cleanText`. Live-rendered the `ai-strategy-fundamentals` lesson body: **4 distinct `<h2>` headings and ~10 `<p>` tags** rendered correctly, not collapsed to one line. |
| `glossary:` URL scheme stripped by react-markdown's default `urlTransform` | **Yes** | `markdown.tsx` defines a custom `urlTransform` that carves out an explicit exception for the `glossary:` scheme before falling back to `defaultUrlTransform` for everything else (so `javascript:` etc. are still stripped). Live-rendered lesson HTML shows `href="/glossary/roi"` (a real, resolved link, not a stripped/empty href), and `GET /glossary/roi` returns `200`. |
| `lastReviewedAt` timezone display bug | **Yes** | Both `content-item-card.tsx` and `lessons/[slug]/page.tsx` format the date with `timeZone: "UTC"` explicitly, with a comment explaining the off-by-one-day risk for US-based visitors. Live-rendered page shows "Last reviewed June 10, 2026" for a lesson whose frontmatter says `lastReviewedAt: 2026-06-10` — exact match, no day shift. |
| `account-profile.spec.ts` text-match fix | **Yes, and it's a strengthening, not a weakening** | The diff changes `getByText("ADVANCED")` (case-insensitive substring match) to `getByText("ADVANCED", { exact: true })`, with a comment explaining the dashboard's new `<PathSwitcher>` `<select>` now also renders an "Advanced" `<option>`, which the old non-exact matcher would ambiguously resolve against too. This is a *stricter* assertion, not a loosened one. (Separately: this spec flaked once at high parallelism on an unrelated line — see §3 — not the changed line.) |

## 6. Acceptance criteria — pass/fail/manual-only

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | 6 role×level paths, ordered courses/items; `/paths/technical-builder/zero-knowledge` renders exact order | **PASS** | `e2e/content-paths.spec.ts` (order assertions, passing); live `curl` 200 on the route |
| AC2 | All 6 tags stored/displayed; importer refuses missing tag or undeclared topic | **PASS** | `validation/content.test.ts`, `loader.test.ts` (undeclared-topic fixture), `e2e/content-paths.spec.ts` ("every FR-PATH-004 tag is visible") |
| AC3 | Lesson renders Markdown as real HTML; no `dangerouslySetInnerHTML`; raw HTML inert; sample-content badge shown while constant is on, none for curated, removable by one constant | **PASS**, with one minor test-coverage gap noted | `grep -rn dangerouslySetInnerHTML src/` returns zero real usages (only comments). `markdown.test.tsx` covers `<script>`/`<img onerror>` rendering as inert literal text. Badge behavior live-verified (§4b). **Gap**: no automated test actually flips `SAMPLE_CONTENT_LIBRARY` to `false` and asserts the badge disappears — this is a single top-of-component boolean check, correct by inspection, but not proven by a red/green test. Recommend a one-line addition to `sample-content-badge`'s coverage, not a blocker. |
| AC4 | `<LessonVideo>` renders correctly with/without video; captions mandatory in schema; seed pack ships no video URL | **PASS** | §4c above; `content.test.ts`'s captions-required case |
| AC5 | Curated item: external anchor, `target="_blank"`, `rel="noopener noreferrer"`, publisher/author attribution; nothing copied into DB/repo | **PASS** | `e2e/content-paths.spec.ts` (curated anchor assertions, passing); `CURATED` branch of the discriminated union schema structurally forbids a `body` field, so no external prose can be imported |
| AC6 | `lastReviewedAt`/`reviewCadenceDays`/`nextReviewDueAt`/`version` stored; re-import bumps version + snapshots; unchanged re-import is a no-op | **PASS** | `hash.test.ts`, `plan-import.test.ts`; live `npm run content:check` (dry-run) against the real seed pack reports **every** collection as `unchanged` (0 created/updated/retired) on a second run, confirming idempotency |
| AC7 | `glossary:` link is an accessible inline definition (hover + keyboard focus) linking to `/glossary/<slug>`; importer fails on unresolved link | **PASS** | `glossary-link.tsx` uses CSS-only `group-hover`/`group-focus-within` plus `aria-describedby`; `loader.test.ts` covers the unresolved-glossary fixture; live-verified real `href` and 200 response |
| AC8 | Signed-in role/level switch persists; a shared item appears in both old and new path as one id | **PASS** | `e2e/content-path-switch.spec.ts` passing (both at default and `workers=1`); direct DB query confirms **7** items shared across >1 path (exceeds the "at least 2" pack requirement) |
| AC9 | `content:check` validates without writing, exits non-zero with aggregated file-attributed errors; `content:import` is transactional and prints summary; removed items are retired, not deleted | **PASS** | Live-ran `content:check` against a real fixture pack with a dangling course reference: exited **1** with `"dangling-course/paths/path.yaml: references unknown course \"course-that-does-not-exist\""`. `plan-import.test.ts` covers retire-not-delete and un-retire |
| AC10 | `/paths/technical-builder` and `/paths/executive-non-technical` public, describe archetype + 3 levels | **PASS** | Live `curl` 200 on both; `docs/content/taxonomy.md` cross-checked against `content/taxonomy.yaml` (roles table matches) |
| AC11 | All 7 new routes anonymously readable; unknown/retired slugs 404, not an error page | **PASS** | Live-checked all 7 route shapes with real and unknown segments: `/paths` 200, `/paths/technical-builder` 200, `/paths/technical-builder/zero-knowledge` 200, `/paths/nonexistent-role` 404, `/paths/technical-builder/nonexistent-level` 404, `/courses/nonexistent-slug` 404, `/lessons/nonexistent-slug` 404, `/glossary` 200, `/glossary/nonexistent-term` 404 — all with no session/cookies |
| AC12 | No `Progress`/`Rating`/`Bookmark`/`Certificate` model or user-referencing column; migration applies cleanly, alters no auth table | **PASS** | `grep` for the four model names returns nothing; migration SQL's only `ALTER TABLE` statements target the new content tables (foreign keys), none touch `user`/`session`/`account`/`verification`/`rateLimit`; `prisma migrate status` against the real dev DB (which already had the auth schema) reports "Database schema is up to date" after all 3 migrations, including this one |
| AC13 | `docs/architecture/content.md` states progress keys on `(userId, contentItemId)`, ratings on `courseId`/`pathId` | **PASS** | Confirmed by direct read of the doc |
| AC14 | Usable at 375/768/1280px; keyboard-operable with visible focus ring; glossary tooltip keyboard-reachable | **Not independently verified — manual/visual check required**, consistent with PLAN.md's own test plan (which marks this row "Manual"). Code inspection shows the mechanism is present (`group-focus-within` CSS, `aria-describedby`, no JS dependency), but I did not perform a visual responsive/keyboard walkthrough. |
| AC15 | Taxonomy doc matches `taxonomy.yaml`; authoring guide sufficient for a newcomer | **PASS** (taxonomy match), **plausible but not independently proven** (authoring-guide sufficiency is inherently a subjective/manual judgment; the guide is 268 lines and structurally thorough, but I did not do a literal newcomer walkthrough — PLAN.md's own test plan also marks this "Manual") | `docs/content/taxonomy.md`'s 12-topic table matches `content/taxonomy.yaml`'s 12 topic slugs exactly; all 5 axes documented |
| AC16 | `lint`/`format:check`/`test`/`build`/`test:e2e` all pass locally; both CI jobs stay green | **PASS locally; NOT true of real CI right now** — see §3's CI finding. This is inherited from a previously shipped item and outside this item's diff, but it means the literal criterion is unmet at the repository level until someone fixes the `ci.yml`/`mailer.test.ts` interaction. |

## 7. Manual provisioning checklist

All entries in `docs/runbooks/provisioning-checklist.md`, including all 5 new ones added by
this item (content-import-after-deploy, video upload, curated-link verification, review-cadence
reminder, "no new env vars" note), are `- [ ]` **unchecked**. Nothing in the codebase silently
assumes any of them (video upload, production content import) is already done — confirmed the
seed pack ships no video URL (§4a) and every content route is dynamic/DB-driven with no
build-time assumption about production data being present.

## 8. Full suite result summary

- Vitest: **173/173 passed** (19/19 files), clean shell
- Playwright e2e: **30/30 passed** at `--workers=1` (matches CI's actual worker config); 1
  parallelism-induced flake at default (8) workers, not reproducible in isolation or at
  `workers=1`
- Lint: clean
- Format check: clean
- `tsc --noEmit`: clean
- Build: 4/4 successful runs (3× Turbopack, 1× webpack), zero crashes, one recurring
  informational NFT warning (§2)

## Files referenced during this verification

- `C:\Users\amitn\MyAIprojects\AI Learning Platform\factory\work\learning-paths-content\PLAN.md`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\lib\content\loader.ts`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\components\content\markdown.tsx`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\components\content\sample-content-badge.tsx`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\components\content\lesson-video.tsx`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\components\content\__tests__\lesson-video.test.tsx`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\lib\validation\content.ts`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\lib\validation\account.ts`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\e2e\account-profile.spec.ts`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\src\lib\mail\__tests__\mailer.test.ts`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\.github\workflows\ci.yml`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\content\items\ai-strategy-fundamentals.md`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\docs\content\taxonomy.md`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\docs\architecture\content.md`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\docs\runbooks\provisioning-checklist.md`
- `C:\Users\amitn\MyAIprojects\AI Learning Platform\prisma\migrations\20260802025913_add_content_model\migration.sql`
