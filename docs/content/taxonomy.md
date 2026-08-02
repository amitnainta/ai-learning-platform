# Content Taxonomy (NFR-MAINT-001)

The versioned, human-readable record of the FR-PATH-004 tagging taxonomy.
This document must match `content/taxonomy.yaml` (the machine-validated
source the importer actually reads) — if you add a topic, add it in both
places. See `docs/content/authoring-guide.md` for how.

Every content item is tagged with all six axes below: role(s), level,
topic(s), format, estimated duration (a plain integer, not a taxonomy
value), and source type. The importer (`npm run content:check`) refuses a
file missing any required tag or referencing an undeclared topic.

## Roles (`RoleArchetype`)

A **closed enum**, owned by the auth item (`prisma/schema.prisma`) and
reused here — not redeclared. R1 ships content for the first two; the
other three exist in the schema and routes already (FR-PATH-003 is R2 —
adding their content is a content-pack change, no code change).

| Value                     | URL segment               | Label                     | Content shipped in R1?                                                                                                |
| ------------------------- | ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `TECHNICAL_BUILDER`       | `technical-builder`       | Technical Builder         | Yes                                                                                                                   |
| `EXECUTIVE_NON_TECHNICAL` | `executive-non-technical` | Executive / Non-Technical | Yes                                                                                                                   |
| `ENGINEERING_LEADER`      | `engineering-leader`      | Engineering Leader        | No — R2 (FR-PATH-003)                                                                                                 |
| `INVESTOR`                | `investor`                | Investor                  | No — R2 (FR-PATH-003)                                                                                                 |
| `NOT_SURE_YET`            | `not-sure-yet`            | Not sure yet              | No path/`RoleProfile` — routes a user to `/paths` instead (see `docs/architecture/content.md` §6-adjacent Risks note) |

## Levels (`ProficiencyLevel`)

A **closed enum**, also reused from the auth item.

| Value            | URL segment      | Label          |
| ---------------- | ---------------- | -------------- |
| `ZERO_KNOWLEDGE` | `zero-knowledge` | Zero Knowledge |
| `INTERMEDIATE`   | `intermediate`   | Intermediate   |
| `ADVANCED`       | `advanced`       | Advanced       |

## Formats (`ContentFormat`)

A **closed enum**, new in this item.

| Value         | Label       |
| ------------- | ----------- |
| `ARTICLE`     | Article     |
| `VIDEO`       | Video       |
| `INTERACTIVE` | Interactive |
| `COURSE`      | Course      |
| `PAPER`       | Paper       |
| `PODCAST`     | Podcast     |
| `TOOL`        | Tool        |

## Source types (`SourceType`)

A **closed enum**. `ORIGINAL` requires a Markdown `body` and forbids
`externalUrl`; `CURATED` requires an `https` `externalUrl` plus
`sourcePublisher` and forbids `body` (`src/lib/validation/content.ts`'s
discriminated union — see `docs/architecture/content.md` decision #1).

| Value      | Label                        |
| ---------- | ---------------------------- |
| `ORIGINAL` | Original (platform-authored) |
| `CURATED`  | Curated (external)           |

## Topics (open-ended — declared in `content/taxonomy.yaml`)

Unlike the four axes above, topics are **data, not an enum**
(`docs/architecture/content.md` decision #9) — a `Topic` table declared in
`content/taxonomy.yaml`, because new AI subject areas appear constantly and
FR-ADMIN-003 (R2) expects this list to eventually be editable without a
code change. The importer rejects any content item referencing a topic
slug not declared here.

The R1 seed pack declares:

| Slug                    | Label                 | Description                                                                              |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `ai-fundamentals`       | AI Fundamentals       | What AI/ML is, how it differs from traditional software, and the core vocabulary.        |
| `machine-learning`      | Machine Learning      | How models learn from data — supervised/unsupervised learning, training, and evaluation. |
| `deep-learning`         | Deep Learning         | Neural networks and the architectures behind modern AI systems.                          |
| `large-language-models` | Large Language Models | How LLMs are built, trained, and used, and their capabilities and limits.                |
| `prompt-engineering`    | Prompt Engineering    | Techniques for getting reliable, useful output from generative AI models.                |
| `generative-ai`         | Generative AI         | Models that create text, images, audio, or code rather than only classifying input.      |
| `ai-ethics`             | AI Ethics             | Bias, fairness, transparency, and the human impact of AI systems.                        |
| `ai-governance`         | AI Governance         | Risk management, policy, and organizational controls for AI systems.                     |
| `ai-strategy`           | AI Strategy           | How organizations decide where and how to invest in AI.                                  |
| `ai-business-value`     | AI Business Value     | Measuring and communicating the return on AI initiatives.                                |
| `mlops`                 | MLOps                 | Deploying, monitoring, and maintaining machine learning systems in production.           |
| `data-literacy`         | Data Literacy         | Reading, questioning, and reasoning about data and model output.                         |

Adding a topic: add an entry to `content/taxonomy.yaml`'s `topics` list
(slug, label, optional description), add the same row to the table above,
then reference the new slug from any item's `topics` frontmatter field.
`npm run content:check` will fail loudly if the two files disagree about
what an item is allowed to reference.

## Review cadence (NFR-MAINT-002/003)

Not a taxonomy axis exactly, but governed by source type
(`docs/architecture/content.md` decision #7): `CURATED` items default to a
90-day review cadence, `ORIGINAL` items to 365 days. Either can be
overridden per item via `reviewCadenceDays` in frontmatter. See
`docs/content/authoring-guide.md` for the review workflow.
