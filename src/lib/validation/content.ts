import { z } from "zod";
import { proficiencyLevelSchema, roleArchetypeSchema } from "@/lib/validation/account";

/**
 * Zod schemas for every content-pack file (task 6). Reuses
 * `roleArchetypeSchema`/`proficiencyLevelSchema` from
 * src/lib/validation/account.ts rather than redeclaring them, and follows
 * that file's conventions: trim, length caps, control-character stripping
 * for free-form text. See src/lib/content/loader.ts for how these combine
 * with the frontmatter split to validate a whole pack, and
 * factory/work/learning-paths-content/PLAN.md decision #6 for why the
 * ORIGINAL/CURATED split is a Zod discriminated union rather than a
 * database check constraint.
 */

// Same control-character-stripping helper as src/lib/validation/account.ts
// (not re-exported from there to avoid a cross-domain dependency between
// account and content validation — duplicating four lines is cheaper than
// coupling the two modules).
const MAX_CONTROL_CODE_POINT = 31;
const DELETE_CODE_POINT = 127;

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint > MAX_CONTROL_CODE_POINT && codePoint !== DELETE_CODE_POINT;
    })
    .join("");
}

// Tab (9), LF (10), and CR (13) are control characters too, but they are the
// characters that give Markdown its block structure (blank lines between
// paragraphs, ATX headings on their own line, list items). Stripping them
// the way `stripControlCharacters` does for single-line fields would
// silently collapse a multi-paragraph body into one run-on line — headings
// and lists would stop parsing as Markdown at all, with no validation error
// to catch it. This variant strips every other control/DEL character but
// preserves those three.
const PRESERVED_WHITESPACE_CONTROL_CODE_POINTS = new Set([9, 10, 13]);

function stripControlCharactersPreservingNewlines(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      if (PRESERVED_WHITESPACE_CONTROL_CODE_POINTS.has(codePoint)) {
        return true;
      }
      return codePoint > MAX_CONTROL_CODE_POINT && codePoint !== DELETE_CODE_POINT;
    })
    .join("");
}

function cleanText(maxLength: number, message?: string) {
  return z
    .string()
    .trim()
    .min(1, message ?? "This field is required")
    .max(maxLength, `Must be ${maxLength} characters or fewer`)
    .transform((value) => stripControlCharacters(value));
}

// For Markdown prose fields (item/role-profile/glossary bodies, course/path
// descriptions) — see `stripControlCharactersPreservingNewlines` above.
function cleanMultilineText(maxLength: number, message?: string) {
  return z
    .string()
    .trim()
    .min(1, message ?? "This field is required")
    .max(maxLength, `Must be ${maxLength} characters or fewer`)
    .transform((value) => stripControlCharactersPreservingNewlines(value));
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_PATTERN, 'Must be a lowercase, hyphenated slug (e.g. "my-item-slug")');

export const contentFormatSchema = z.enum([
  "ARTICLE",
  "VIDEO",
  "INTERACTIVE",
  "COURSE",
  "PAPER",
  "PODCAST",
  "TOOL",
]);

export const sourceTypeSchema = z.enum(["ORIGINAL", "CURATED"]);

export const contentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "RETIRED"]);

// --- content/taxonomy.yaml (NFR-MAINT-001) ----------------------------------

export const taxonomyTopicSchema = z.object({
  slug: slugSchema,
  label: cleanText(80, "Topic label is required"),
  description: cleanText(400).optional(),
});

export const taxonomyFileSchema = z.object({
  topics: z
    .array(taxonomyTopicSchema)
    .min(1, "content/taxonomy.yaml must declare at least one topic"),
  // Documented reference copies of the closed enum vocabularies, kept here
  // so docs/content/taxonomy.md has one file to diff against for AC15 ("...
  // matches content/taxonomy.yaml"). Not used to relax the fixed
  // ContentFormat/SourceType enums.
  formats: z.array(contentFormatSchema).min(1),
  sourceTypes: z.array(sourceTypeSchema).min(1),
});
export type TaxonomyFile = z.infer<typeof taxonomyFileSchema>;

// --- content/roles/*.md (FR-SEARCH-004) -------------------------------------

export const roleProfileFrontmatterSchema = z.object({
  role: roleArchetypeSchema,
  slug: slugSchema,
  title: cleanText(200),
  summary: cleanText(500),
  status: contentStatusSchema.default("PUBLISHED"),
  // The Markdown body (everything after the frontmatter block).
  body: cleanMultilineText(20_000, "A role profile needs a non-empty body"),
});
export type RoleProfileFrontmatter = z.infer<typeof roleProfileFrontmatterSchema>;

// --- content/items/*.md (FR-PATH-004/005/006/007) ---------------------------

// FR-PATH-005 / decision #4: captions are mandatory in the schema whenever a
// video is present. Both fields live in the same object, so a `video` block
// cannot exist without `captionsUrl`.
export const videoBlockSchema = z.object({
  url: z.string().trim().url("video.url must be a valid URL"),
  captionsUrl: z.string().trim().url("video.captionsUrl is required whenever video.url is set"),
  posterUrl: z.string().trim().url().optional(),
  durationSeconds: z.number().int().positive().optional(),
});
export type VideoBlock = z.infer<typeof videoBlockSchema>;

const contentItemBaseSchema = z.object({
  slug: slugSchema,
  title: cleanText(200),
  summary: cleanText(500),
  roles: z.array(roleArchetypeSchema).min(1, "At least one role is required"),
  level: proficiencyLevelSchema,
  format: contentFormatSchema,
  estimatedMinutes: z.number().int().positive("estimatedMinutes must be a positive integer"),
  topics: z.array(slugSchema).min(1, "At least one topic is required"),
  status: contentStatusSchema.default("PUBLISHED"),
  lastReviewedAt: z.coerce.date(),
  // Overrides the sourceType-derived default (90 curated / 365 original,
  // decision #7) when present.
  reviewCadenceDays: z.number().int().positive().optional(),
});

const originalContentItemSchema = contentItemBaseSchema
  .extend({
    sourceType: z.literal("ORIGINAL"),
    // The Markdown body (everything after the frontmatter block).
    body: cleanMultilineText(50_000, "ORIGINAL items require a non-empty body"),
    video: videoBlockSchema.optional(),
  })
  .strict();

const curatedContentItemSchema = contentItemBaseSchema
  .extend({
    sourceType: z.literal("CURATED"),
    externalUrl: z
      .string()
      .trim()
      .url("externalUrl must be a valid URL")
      .refine((value) => value.startsWith("https://"), "externalUrl must use https"),
    sourcePublisher: cleanText(200, "CURATED items require sourcePublisher"),
    sourceAuthor: cleanText(200).optional(),
    sourcePublishedOn: z.coerce.date().optional(),
    attributionNote: cleanText(500).optional(),
  })
  .strict();

// The FR-PATH-006/decision #1 union: ORIGINAL requires a non-empty body and
// forbids externalUrl/sourcePublisher/etc.; CURATED requires an https
// externalUrl + sourcePublisher and forbids body/video. `.strict()` on both
// branches means supplying the other branch's fields is an "unrecognized
// key" validation error, which is what implements "forbids" here.
export const contentItemFrontmatterSchema = z.discriminatedUnion("sourceType", [
  originalContentItemSchema,
  curatedContentItemSchema,
]);
export type ContentItemFrontmatter = z.infer<typeof contentItemFrontmatterSchema>;

// --- content/courses/*.yaml --------------------------------------------------

export const courseFileSchema = z.object({
  slug: slugSchema,
  title: cleanText(200),
  summary: cleanText(500),
  description: cleanMultilineText(4000).optional(),
  status: contentStatusSchema.default("PUBLISHED"),
  // Ordered content-item slugs — array order is the authored position
  // (PathCourse/CourseItem.position, decision #5).
  items: z.array(slugSchema).min(1, "A course needs at least one item"),
});
export type CourseFile = z.infer<typeof courseFileSchema>;

// --- content/paths/*.yaml (FR-PATH-001/002) ---------------------------------

export const pathFileSchema = z.object({
  slug: slugSchema,
  role: roleArchetypeSchema,
  level: proficiencyLevelSchema,
  title: cleanText(200),
  summary: cleanText(500),
  description: cleanMultilineText(20_000, "A path needs a non-empty description"),
  status: contentStatusSchema.default("PUBLISHED"),
  // Ordered course slugs — array order is the authored position.
  courses: z.array(slugSchema).min(1, "A path needs at least one course"),
});
export type PathFile = z.infer<typeof pathFileSchema>;

// --- content/glossary/*.md (FR-PATH-008) ------------------------------------

export const glossaryFrontmatterSchema = z.object({
  slug: slugSchema,
  term: cleanText(200),
  shortDefinition: cleanText(200, "shortDefinition is required"),
  aliases: z.array(cleanText(200)).default([]),
  relatedSlugs: z.array(slugSchema).default([]),
  lastReviewedAt: z.coerce.date(),
  status: contentStatusSchema.default("PUBLISHED"),
  // The Markdown body (everything after the frontmatter block) — the long
  // definition rendered on the term page.
  body: cleanMultilineText(20_000, "A glossary term needs a non-empty body"),
});
export type GlossaryFrontmatter = z.infer<typeof glossaryFrontmatterSchema>;
