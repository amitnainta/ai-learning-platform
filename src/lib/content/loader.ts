import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";
import { REVIEW_CADENCE_DAYS_CURATED, REVIEW_CADENCE_DAYS_ORIGINAL } from "@/lib/content/taxonomy";
import { parseFrontmatter } from "@/lib/content/frontmatter";
import {
  contentItemFrontmatterSchema,
  courseFileSchema,
  glossaryFrontmatterSchema,
  pathFileSchema,
  roleProfileFrontmatterSchema,
  taxonomyFileSchema,
  type ContentItemFrontmatter,
  type CourseFile,
  type GlossaryFrontmatter,
  type PathFile,
  type RoleProfileFrontmatter,
  type TaxonomyFile,
} from "@/lib/validation/content";

/**
 * Reads a content pack directory from disk, parses and validates every
 * file, then cross-checks references (task 8). Returns a typed
 * `ContentPack` or an **aggregated** list of errors with file paths
 * (matching the aggregated-error convention `src/lib/env.ts` established) —
 * never throws on the first problem.
 */

export interface LoadedTopic {
  slug: string;
  label: string;
  description?: string;
}

export type LoadedRoleProfile = RoleProfileFrontmatter & { sourceFile: string };

// `ContentItemFrontmatter` is a discriminated union (ORIGINAL | CURATED,
// decision #1) — an `interface extends` can't extend a union, so this is an
// intersection type instead.
export type LoadedContentItem = ContentItemFrontmatter & {
  reviewCadenceDays: number;
  sourceFile: string;
};

export type LoadedCourse = CourseFile & { sourceFile: string };

export type LoadedPath = PathFile & { sourceFile: string };

export type LoadedGlossaryTerm = GlossaryFrontmatter & { sourceFile: string };

export interface ContentPack {
  taxonomy: TaxonomyFile;
  roleProfiles: LoadedRoleProfile[];
  paths: LoadedPath[];
  courses: LoadedCourse[];
  items: LoadedContentItem[];
  glossary: LoadedGlossaryTerm[];
}

export type LoadContentPackResult =
  { success: true; pack: ContentPack } | { success: false; errors: string[] };

const GLOSSARY_LINK_PATTERN = /\]\(glossary:([a-z0-9-]+)\)/g;

async function listFiles(dir: string, extension: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => path.join(dir, entry.name))
      .sort();
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw cause;
  }
}

function relativePath(packDir: string, filePath: string): string {
  return path.relative(path.dirname(packDir), filePath).split(path.sep).join("/");
}

/** Reads and validates every `*.md` file in `dir` against `schema`, combining frontmatter fields with the parsed Markdown body. */
async function loadMarkdownCollection<T>(
  packDir: string,
  dir: string,
  schema: ZodType<T>,
  errors: string[],
): Promise<Array<T & { sourceFile: string }>> {
  const files = await listFiles(dir, ".md");
  const results: Array<T & { sourceFile: string }> = [];

  for (const filePath of files) {
    const displayPath = relativePath(packDir, filePath);
    const raw = await readFile(filePath, "utf8");
    const parsed = parseFrontmatter(raw, displayPath);
    if (!parsed.success) {
      errors.push(parsed.error);
      continue;
    }

    const candidate = { ...parsed.value.data, body: parsed.value.body.trim() };
    const result = schema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${displayPath}: ${issue.path.join(".") || "(root)"} — ${issue.message}`);
      }
      continue;
    }

    results.push({ ...result.data, sourceFile: displayPath });
  }

  return results;
}

/** Reads and validates every `*.yaml` file in `dir` against `schema`. */
async function loadYamlCollection<T>(
  packDir: string,
  dir: string,
  schema: ZodType<T>,
  errors: string[],
): Promise<Array<T & { sourceFile: string }>> {
  const files = await listFiles(dir, ".yaml");
  const results: Array<T & { sourceFile: string }> = [];

  for (const filePath of files) {
    const displayPath = relativePath(packDir, filePath);
    const raw = await readFile(filePath, "utf8");

    let data: unknown;
    try {
      data = parseYaml(raw);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      errors.push(`${displayPath}: could not parse YAML — ${message}`);
      continue;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${displayPath}: ${issue.path.join(".") || "(root)"} — ${issue.message}`);
      }
      continue;
    }

    results.push({ ...result.data, sourceFile: displayPath });
  }

  return results;
}

function findDuplicateSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) {
      duplicates.add(slug);
    }
    seen.add(slug);
  }
  return [...duplicates];
}

function reviewCadenceFor(item: ContentItemFrontmatter): number {
  if (item.reviewCadenceDays) {
    return item.reviewCadenceDays;
  }
  return item.sourceType === "CURATED" ? REVIEW_CADENCE_DAYS_CURATED : REVIEW_CADENCE_DAYS_ORIGINAL;
}

/**
 * Scans a Markdown body for `[text](glossary:slug)` links (FR-PATH-008).
 */
export function findGlossaryLinks(markdown: string): string[] {
  const slugs: string[] = [];
  for (const match of markdown.matchAll(GLOSSARY_LINK_PATTERN)) {
    const slug = match[1];
    if (slug) {
      slugs.push(slug);
    }
  }
  return slugs;
}

export async function loadContentPack(packDir = "content"): Promise<LoadContentPackResult> {
  const resolvedDir = path.isAbsolute(packDir) ? packDir : path.resolve(process.cwd(), packDir);
  const errors: string[] = [];

  // --- taxonomy.yaml ---------------------------------------------------
  let taxonomy: TaxonomyFile | undefined;
  const taxonomyPath = path.join(resolvedDir, "taxonomy.yaml");
  try {
    const raw = await readFile(taxonomyPath, "utf8");
    let data: unknown;
    try {
      data = parseYaml(raw);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      errors.push(`content/taxonomy.yaml: could not parse YAML — ${message}`);
    }
    if (data !== undefined) {
      const result = taxonomyFileSchema.safeParse(data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(
            `content/taxonomy.yaml: ${issue.path.join(".") || "(root)"} — ${issue.message}`,
          );
        }
      } else {
        taxonomy = result.data;
      }
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      errors.push(
        "content/taxonomy.yaml: file not found — a content pack must declare its taxonomy",
      );
    } else {
      throw cause;
    }
  }

  // --- collections -------------------------------------------------------
  const roleProfiles = await loadMarkdownCollection(
    resolvedDir,
    path.join(resolvedDir, "roles"),
    roleProfileFrontmatterSchema,
    errors,
  );
  const items = await loadMarkdownCollection(
    resolvedDir,
    path.join(resolvedDir, "items"),
    contentItemFrontmatterSchema,
    errors,
  );
  const glossary = await loadMarkdownCollection(
    resolvedDir,
    path.join(resolvedDir, "glossary"),
    glossaryFrontmatterSchema,
    errors,
  );
  const courses = await loadYamlCollection(
    resolvedDir,
    path.join(resolvedDir, "courses"),
    courseFileSchema,
    errors,
  );
  const paths = await loadYamlCollection(
    resolvedDir,
    path.join(resolvedDir, "paths"),
    pathFileSchema,
    errors,
  );

  if (!taxonomy) {
    // Nothing further can be safely cross-checked without a taxonomy.
    return { success: false, errors };
  }

  // --- cross-checks --------------------------------------------------------
  const topicSlugs = new Set(taxonomy.topics.map((topic) => topic.slug));
  const itemSlugs = new Set(items.map((item) => item.slug));
  const courseSlugs = new Set(courses.map((course) => course.slug));
  const glossarySlugs = new Set(glossary.map((term) => term.slug));

  for (const dup of findDuplicateSlugs(roleProfiles.map((r) => r.slug))) {
    errors.push(`content/roles: duplicate slug "${dup}"`);
  }
  for (const dup of findDuplicateSlugs(items.map((i) => i.slug))) {
    errors.push(`content/items: duplicate slug "${dup}"`);
  }
  for (const dup of findDuplicateSlugs(courses.map((c) => c.slug))) {
    errors.push(`content/courses: duplicate slug "${dup}"`);
  }
  for (const dup of findDuplicateSlugs(paths.map((p) => p.slug))) {
    errors.push(`content/paths: duplicate slug "${dup}"`);
  }
  for (const dup of findDuplicateSlugs(glossary.map((g) => g.slug))) {
    errors.push(`content/glossary: duplicate slug "${dup}"`);
  }

  const roleLevelSeen = new Map<string, string>();
  for (const pathFile of paths) {
    const key = `${pathFile.role}:${pathFile.level}`;
    const existing = roleLevelSeen.get(key);
    if (existing) {
      errors.push(
        `${pathFile.sourceFile}: duplicate path for role "${pathFile.role}" and level "${pathFile.level}" (already declared in ${existing})`,
      );
    } else {
      roleLevelSeen.set(key, pathFile.sourceFile);
    }

    for (const courseSlug of pathFile.courses) {
      if (!courseSlugs.has(courseSlug)) {
        errors.push(`${pathFile.sourceFile}: references unknown course "${courseSlug}"`);
      }
    }
  }

  for (const course of courses) {
    for (const itemSlug of course.items) {
      if (!itemSlugs.has(itemSlug)) {
        errors.push(`${course.sourceFile}: references unknown content item "${itemSlug}"`);
      }
    }
  }

  for (const item of items) {
    for (const topicSlug of item.topics) {
      if (!topicSlugs.has(topicSlug)) {
        errors.push(
          `${item.sourceFile}: references undeclared topic "${topicSlug}" (add it to content/taxonomy.yaml)`,
        );
      }
    }
    if (item.sourceType === "ORIGINAL") {
      for (const glossarySlug of findGlossaryLinks(item.body)) {
        if (!glossarySlugs.has(glossarySlug)) {
          errors.push(
            `${item.sourceFile}: unresolved glossary link "glossary:${glossarySlug}" (no matching content/glossary term)`,
          );
        }
      }
    }
  }

  for (const term of glossary) {
    for (const relatedSlug of term.relatedSlugs) {
      if (!glossarySlugs.has(relatedSlug)) {
        errors.push(
          `${term.sourceFile}: relatedSlugs references unknown glossary term "${relatedSlug}"`,
        );
      }
    }
    for (const glossarySlug of findGlossaryLinks(term.body)) {
      if (!glossarySlugs.has(glossarySlug)) {
        errors.push(
          `${term.sourceFile}: unresolved glossary link "glossary:${glossarySlug}" (no matching content/glossary term)`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    pack: {
      taxonomy,
      roleProfiles,
      paths,
      courses,
      items: items.map((item) => ({ ...item, reviewCadenceDays: reviewCadenceFor(item) })),
      glossary,
    },
  };
}
