import type { ContentFormat, ProficiencyLevel, RoleArchetype, SourceType } from "@prisma/client";

/**
 * Single source of truth for anything the UI, the importer, and the docs
 * (docs/content/taxonomy.md) all have to agree on: display labels, URL
 * slugs, default review cadences, and the sample-content constants (task 4
 * in factory/work/learning-paths-content/PLAN.md).
 *
 * `RoleArchetype`/`ProficiencyLevel` are the auth item's enums (reused,
 * decision #9) — the labels/slugs here are this item's addition. `Topic` is
 * data, not an enum (declared in content/taxonomy.yaml), so it has no entry
 * here.
 */

export const ROLE_ARCHETYPE_LABELS: Record<RoleArchetype, string> = {
  TECHNICAL_BUILDER: "Technical Builder",
  ENGINEERING_LEADER: "Engineering Leader",
  EXECUTIVE_NON_TECHNICAL: "Executive / Non-Technical",
  INVESTOR: "Investor",
  NOT_SURE_YET: "Not sure yet",
};

// URL segment for each role archetype (src/lib/content/routes.ts builds the
// bidirectional lookup from this map). `NOT_SURE_YET` has no path or
// `RoleProfile` (Risks/open questions #10, PLAN.md) — it is included here
// only for completeness of the enum-to-label map, never used to build a URL.
export const ROLE_ARCHETYPE_SLUGS: Record<RoleArchetype, string> = {
  TECHNICAL_BUILDER: "technical-builder",
  ENGINEERING_LEADER: "engineering-leader",
  EXECUTIVE_NON_TECHNICAL: "executive-non-technical",
  INVESTOR: "investor",
  NOT_SURE_YET: "not-sure-yet",
};

export const PROFICIENCY_LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  ZERO_KNOWLEDGE: "Zero Knowledge",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const PROFICIENCY_LEVEL_SLUGS: Record<ProficiencyLevel, string> = {
  ZERO_KNOWLEDGE: "zero-knowledge",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
};

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  ARTICLE: "Article",
  VIDEO: "Video",
  INTERACTIVE: "Interactive",
  COURSE: "Course",
  PAPER: "Paper",
  PODCAST: "Podcast",
  TOOL: "Tool",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  ORIGINAL: "Original (platform-authored)",
  CURATED: "Curated (external)",
};

/**
 * Default review cadences (NFR-MAINT-002/-003, decision #7). Either can be
 * overridden per item in frontmatter; these are the values the importer
 * falls back to when a file doesn't set `reviewCadenceDays`.
 */
export const REVIEW_CADENCE_DAYS_CURATED = 90;
export const REVIEW_CADENCE_DAYS_ORIGINAL = 365;

/**
 * Decision #13: the whole R1 seed pack is unreviewed placeholder editorial.
 * `SAMPLE_CONTENT_LIBRARY` plus `sourceType === "ORIGINAL"` is the signal
 * `<SampleContentBadge>` reads — flip this one constant to `false` once the
 * library is editorially reviewed and every notice in the app disappears.
 * No schema column, no migration, no per-item frontmatter flag.
 */
export const SAMPLE_CONTENT_LIBRARY = true;
export const SAMPLE_CONTENT_NOTICE = "Sample content — not yet reviewed";
