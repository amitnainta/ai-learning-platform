import { computeContentHash } from "@/lib/content/hash";
import type {
  ContentPack,
  LoadedContentItem,
  LoadedCourse,
  LoadedGlossaryTerm,
  LoadedPath,
  LoadedRoleProfile,
  LoadedTopic,
} from "@/lib/content/loader";

/**
 * Pure function taking the loaded pack plus the current database state (as
 * plain objects) and returning a typed plan: items to create, update
 * (`version + 1`), leave unchanged, and retire; courses, paths, topics, and
 * glossary terms likewise (task 10). Kept separate from the Prisma writes
 * (src/lib/content/import.ts) specifically so the version-bump and
 * retire-not-delete rules (decisions #2 and #8) are unit-testable without a
 * database.
 */

export type SimpleAction = "create" | "update" | "unchanged" | "retire";

export interface ExistingRow {
  id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
}

// Topic (prisma/schema.prisma) carries no `status`/lifecycle column at all
// (Prisma schema design, PLAN.md) — it is pure taxonomy data, not
// content with a publish/retire lifecycle. `planTopics` below therefore
// never proposes a "retire": a topic that disappears from
// content/taxonomy.yaml is simply left alone in the database (still not
// deleted, consistent with decision #2, just via "do nothing" rather than a
// status flip there is no column to hold).
export interface ExistingTopicRow {
  id: string;
  slug: string;
  label: string;
  description: string | null;
}

export interface ExistingContentItemRow extends ExistingRow {
  contentHash: string;
  version: number;
}

export interface ExistingCourseRow extends ExistingRow {
  title: string;
  summary: string;
  description: string | null;
  /** Ordered content-item slugs, in current position order. */
  itemSlugs: string[];
}

export interface ExistingPathRow extends ExistingRow {
  role: string;
  level: string;
  title: string;
  summary: string;
  description: string;
  /** Ordered course slugs, in current position order. */
  courseSlugs: string[];
}

export interface ExistingRoleProfileRow extends ExistingRow {
  title: string;
  summary: string;
  body: string;
}

export interface ExistingGlossaryRow extends ExistingRow {
  term: string;
  shortDefinition: string;
  body: string;
  aliases: string[];
  relatedSlugs: string[];
}

export interface CurrentContentState {
  topics: ExistingTopicRow[];
  roleProfiles: ExistingRoleProfileRow[];
  items: ExistingContentItemRow[];
  courses: ExistingCourseRow[];
  paths: ExistingPathRow[];
  glossary: ExistingGlossaryRow[];
}

export interface SimplePlanEntry<T> {
  action: SimpleAction;
  slug: string;
  existingId?: string;
  data?: T;
}

export interface ContentItemPlanEntry {
  action: SimpleAction | "unretire";
  slug: string;
  existingId?: string;
  data?: LoadedContentItem;
  contentHash?: string;
  nextVersion?: number;
  wasRetired?: boolean;
}

export interface ImportPlan {
  topics: SimplePlanEntry<LoadedTopic>[];
  roleProfiles: SimplePlanEntry<LoadedRoleProfile>[];
  glossary: SimplePlanEntry<LoadedGlossaryTerm>[];
  items: ContentItemPlanEntry[];
  courses: SimplePlanEntry<LoadedCourse>[];
  paths: SimplePlanEntry<LoadedPath>[];
}

function planSimple<T extends { slug: string }, E extends ExistingRow>(
  packRows: T[],
  existingRows: E[],
  isUnchanged: (packRow: T, existingRow: E) => boolean,
): SimplePlanEntry<T>[] {
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
  const packSlugs = new Set(packRows.map((row) => row.slug));
  const entries: SimplePlanEntry<T>[] = [];

  for (const row of packRows) {
    const existing = existingBySlug.get(row.slug);
    if (!existing) {
      entries.push({ action: "create", slug: row.slug, data: row });
    } else if (existing.status === "RETIRED" || !isUnchanged(row, existing)) {
      entries.push({ action: "update", slug: row.slug, existingId: existing.id, data: row });
    } else {
      entries.push({ action: "unchanged", slug: row.slug, existingId: existing.id });
    }
  }

  for (const existing of existingRows) {
    if (!packSlugs.has(existing.slug) && existing.status !== "RETIRED") {
      entries.push({ action: "retire", slug: existing.slug, existingId: existing.id });
    }
  }

  return entries;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The subset of a loaded content item's fields that participate in the version hash. `lastReviewedAt`/`changeNote` are excluded by `computeContentHash` itself. */
function hashableItem(item: LoadedContentItem): Record<string, unknown> {
  const { sourceFile: _sourceFile, ...rest } = item;
  return rest;
}

export function planTopics(
  pack: ContentPack,
  current: CurrentContentState,
): SimplePlanEntry<LoadedTopic>[] {
  const existingBySlug = new Map(current.topics.map((row) => [row.slug, row]));
  const entries: SimplePlanEntry<LoadedTopic>[] = [];

  for (const topic of pack.taxonomy.topics) {
    const existing = existingBySlug.get(topic.slug);
    if (!existing) {
      entries.push({ action: "create", slug: topic.slug, data: topic });
    } else if (
      existing.label !== topic.label ||
      (existing.description ?? undefined) !== topic.description
    ) {
      entries.push({ action: "update", slug: topic.slug, existingId: existing.id, data: topic });
    } else {
      entries.push({ action: "unchanged", slug: topic.slug, existingId: existing.id });
    }
  }

  // Deliberately no "retire" pass here — see the `ExistingTopicRow` comment
  // above.
  return entries;
}

export function planRoleProfiles(
  pack: ContentPack,
  current: CurrentContentState,
): SimplePlanEntry<LoadedRoleProfile>[] {
  return planSimple(
    pack.roleProfiles,
    current.roleProfiles,
    (row, existing) =>
      row.title === existing.title &&
      row.summary === existing.summary &&
      row.body === existing.body,
  );
}

export function planGlossary(
  pack: ContentPack,
  current: CurrentContentState,
): SimplePlanEntry<LoadedGlossaryTerm>[] {
  return planSimple(
    pack.glossary,
    current.glossary,
    (row, existing) =>
      row.term === existing.term &&
      row.shortDefinition === existing.shortDefinition &&
      row.body === existing.body &&
      arraysEqual(row.aliases, existing.aliases) &&
      arraysEqual(row.relatedSlugs, existing.relatedSlugs),
  );
}

export function planCourses(
  pack: ContentPack,
  current: CurrentContentState,
): SimplePlanEntry<LoadedCourse>[] {
  return planSimple(
    pack.courses,
    current.courses,
    (row, existing) =>
      row.title === existing.title &&
      row.summary === existing.summary &&
      (row.description ?? null) === existing.description &&
      arraysEqual(row.items, existing.itemSlugs),
  );
}

export function planPaths(
  pack: ContentPack,
  current: CurrentContentState,
): SimplePlanEntry<LoadedPath>[] {
  return planSimple(
    pack.paths,
    current.paths,
    (row, existing) =>
      row.role === existing.role &&
      row.level === existing.level &&
      row.title === existing.title &&
      row.summary === existing.summary &&
      row.description === existing.description &&
      arraysEqual(row.courses, existing.courseSlugs),
  );
}

/**
 * FR-PATH-007 / decision #8: the only entity with real version tracking.
 * `unchanged` never bumps version or writes a snapshot; `update` always
 * does; `unretire` flips status back to PUBLISHED without a version bump
 * because the content itself did not change while retired.
 */
export function planContentItems(
  pack: ContentPack,
  current: CurrentContentState,
): ContentItemPlanEntry[] {
  const existingBySlug = new Map(current.items.map((row) => [row.slug, row]));
  const packSlugs = new Set(pack.items.map((item) => item.slug));
  const entries: ContentItemPlanEntry[] = [];

  for (const item of pack.items) {
    const contentHash = computeContentHash(hashableItem(item));
    const existing = existingBySlug.get(item.slug);

    if (!existing) {
      entries.push({ action: "create", slug: item.slug, data: item, contentHash, nextVersion: 1 });
      continue;
    }

    const hashChanged = existing.contentHash !== contentHash;
    const wasRetired = existing.status === "RETIRED";

    if (!hashChanged && !wasRetired) {
      entries.push({ action: "unchanged", slug: item.slug, existingId: existing.id });
    } else if (!hashChanged && wasRetired) {
      entries.push({
        action: "unretire",
        slug: item.slug,
        existingId: existing.id,
        data: item,
        contentHash,
        wasRetired: true,
      });
    } else {
      entries.push({
        action: "update",
        slug: item.slug,
        existingId: existing.id,
        data: item,
        contentHash,
        nextVersion: existing.version + 1,
        wasRetired,
      });
    }
  }

  for (const existing of current.items) {
    if (!packSlugs.has(existing.slug) && existing.status !== "RETIRED") {
      entries.push({ action: "retire", slug: existing.slug, existingId: existing.id });
    }
  }

  return entries;
}

export function planImport(pack: ContentPack, current: CurrentContentState): ImportPlan {
  return {
    topics: planTopics(pack, current),
    roleProfiles: planRoleProfiles(pack, current),
    glossary: planGlossary(pack, current),
    items: planContentItems(pack, current),
    courses: planCourses(pack, current),
    paths: planPaths(pack, current),
  };
}
