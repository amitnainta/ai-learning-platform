import type { Prisma, PrismaClient } from "@prisma/client";
import type { ContentPack, LoadedCourse, LoadedPath } from "@/lib/content/loader";
import {
  planImport,
  type ContentItemPlanEntry,
  type CurrentContentState,
  type SimplePlanEntry,
} from "@/lib/content/plan-import";

/**
 * `importContentPack({ prisma, pack, dryRun })` (task 11) — loads current
 * state, calls `planImport`, and applies it in a single
 * `prisma.$transaction`: upsert topics and glossary terms, upsert content
 * items (writing a `ContentItemVersion` snapshot on create and on every
 * version bump), upsert courses and paths, rewrite `PathCourse`/
 * `CourseItem` ordering rows, retire anything absent from the pack. Returns
 * the summary counts. Never deletes a `ContentItem`, `Course`, or `Path`
 * row (decision #2).
 */

type TransactionClient = Prisma.TransactionClient;

export interface ImportCounts {
  created: number;
  updated: number;
  unchanged: number;
  retired: number;
  unretired: number;
}

export interface ImportSummary {
  topics: ImportCounts;
  roleProfiles: ImportCounts;
  glossary: ImportCounts;
  items: ImportCounts;
  courses: ImportCounts;
  paths: ImportCounts;
}

function emptyCounts(): ImportCounts {
  return { created: 0, updated: 0, unchanged: 0, retired: 0, unretired: 0 };
}

function tally(counts: ImportCounts, action: string): void {
  switch (action) {
    case "create":
      counts.created += 1;
      break;
    case "update":
      counts.updated += 1;
      break;
    case "unchanged":
      counts.unchanged += 1;
      break;
    case "retire":
      counts.retired += 1;
      break;
    case "unretire":
      counts.unretired += 1;
      break;
  }
}

async function loadCurrentState(tx: TransactionClient): Promise<CurrentContentState> {
  const [topics, roleProfiles, items, courses, paths, glossary] = await Promise.all([
    tx.topic.findMany({ select: { id: true, slug: true, label: true, description: true } }),
    tx.roleProfile.findMany({
      select: { id: true, slug: true, status: true, title: true, summary: true, body: true },
    }),
    tx.contentItem.findMany({
      select: { id: true, slug: true, status: true, contentHash: true, version: true },
    }),
    tx.course.findMany({
      select: {
        id: true,
        slug: true,
        status: true,
        title: true,
        summary: true,
        description: true,
        items: {
          orderBy: { position: "asc" },
          select: { contentItem: { select: { slug: true } } },
        },
      },
    }),
    tx.path.findMany({
      select: {
        id: true,
        slug: true,
        status: true,
        roleArchetype: true,
        level: true,
        title: true,
        summary: true,
        description: true,
        courses: {
          orderBy: { position: "asc" },
          select: { course: { select: { slug: true } } },
        },
      },
    }),
    tx.glossaryTerm.findMany({
      select: {
        id: true,
        slug: true,
        status: true,
        term: true,
        shortDefinition: true,
        body: true,
        aliases: true,
        relatedSlugs: true,
      },
    }),
  ]);

  return {
    topics,
    roleProfiles,
    items,
    courses: courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      status: course.status,
      title: course.title,
      summary: course.summary,
      description: course.description,
      itemSlugs: course.items.map((join) => join.contentItem.slug),
    })),
    paths: paths.map((pathRow) => ({
      id: pathRow.id,
      slug: pathRow.slug,
      status: pathRow.status,
      role: pathRow.roleArchetype,
      level: pathRow.level,
      title: pathRow.title,
      summary: pathRow.summary,
      description: pathRow.description,
      courseSlugs: pathRow.courses.map((join) => join.course.slug),
    })),
    glossary,
  };
}

async function applyTopics(
  tx: TransactionClient,
  entries: SimplePlanEntry<{ slug: string; label: string; description?: string }>[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const entry of entries) {
    if (entry.action === "create" && entry.data) {
      const row = await tx.topic.create({
        data: {
          slug: entry.data.slug,
          label: entry.data.label,
          description: entry.data.description ?? null,
        },
        select: { id: true },
      });
      idBySlug.set(entry.slug, row.id);
    } else if (entry.action === "update" && entry.data && entry.existingId) {
      await tx.topic.update({
        where: { id: entry.existingId },
        data: { label: entry.data.label, description: entry.data.description ?? null },
      });
      idBySlug.set(entry.slug, entry.existingId);
    } else if (entry.existingId) {
      idBySlug.set(entry.slug, entry.existingId);
    }
  }
  return idBySlug;
}

async function applyGlossary(
  tx: TransactionClient,
  entries: SimplePlanEntry<{
    slug: string;
    term: string;
    shortDefinition: string;
    body: string;
    aliases: string[];
    relatedSlugs: string[];
    lastReviewedAt: Date;
    status: string;
  }>[],
): Promise<void> {
  for (const entry of entries) {
    if (entry.action === "retire" && entry.existingId) {
      await tx.glossaryTerm.update({
        where: { id: entry.existingId },
        data: { status: "RETIRED" },
      });
      continue;
    }
    if (!entry.data) {
      continue;
    }
    const data = {
      term: entry.data.term,
      shortDefinition: entry.data.shortDefinition,
      body: entry.data.body,
      aliases: entry.data.aliases,
      relatedSlugs: entry.data.relatedSlugs,
      lastReviewedAt: entry.data.lastReviewedAt,
      status: entry.data.status as "DRAFT" | "PUBLISHED" | "RETIRED",
    };
    if (entry.action === "create") {
      await tx.glossaryTerm.create({ data: { slug: entry.data.slug, ...data } });
    } else if (entry.action === "update" && entry.existingId) {
      await tx.glossaryTerm.update({ where: { id: entry.existingId }, data });
    }
  }
}

async function applyRoleProfiles(
  tx: TransactionClient,
  entries: SimplePlanEntry<{
    slug: string;
    role: string;
    title: string;
    summary: string;
    body: string;
    status: string;
  }>[],
): Promise<void> {
  for (const entry of entries) {
    if (entry.action === "retire" && entry.existingId) {
      await tx.roleProfile.update({ where: { id: entry.existingId }, data: { status: "RETIRED" } });
      continue;
    }
    if (!entry.data) {
      continue;
    }
    const data = {
      role: entry.data.role as Parameters<typeof tx.roleProfile.create>[0]["data"]["role"],
      title: entry.data.title,
      summary: entry.data.summary,
      body: entry.data.body,
      status: entry.data.status as "DRAFT" | "PUBLISHED" | "RETIRED",
    };
    if (entry.action === "create") {
      await tx.roleProfile.create({ data: { slug: entry.data.slug, ...data } });
    } else if (entry.action === "update" && entry.existingId) {
      await tx.roleProfile.update({ where: { id: entry.existingId }, data });
    }
  }
}

async function applyContentItems(
  tx: TransactionClient,
  entries: ContentItemPlanEntry[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();

  for (const entry of entries) {
    if (entry.action === "retire" && entry.existingId) {
      await tx.contentItem.update({
        where: { id: entry.existingId },
        data: { status: "RETIRED", retiredAt: new Date() },
      });
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }

    if (entry.action === "unchanged" && entry.existingId) {
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }

    if (!entry.data || !entry.contentHash) {
      continue;
    }

    const item = entry.data;
    const nextReviewDueAt = new Date(item.lastReviewedAt);
    nextReviewDueAt.setDate(nextReviewDueAt.getDate() + item.reviewCadenceDays);

    const isOriginal = item.sourceType === "ORIGINAL";

    const baseData = {
      title: item.title,
      summary: item.summary,
      roles: item.roles as string[] as Parameters<typeof tx.contentItem.create>[0]["data"]["roles"],
      level: item.level as Parameters<typeof tx.contentItem.create>[0]["data"]["level"],
      format: item.format as Parameters<typeof tx.contentItem.create>[0]["data"]["format"],
      estimatedMinutes: item.estimatedMinutes,
      sourceType: item.sourceType as Parameters<
        typeof tx.contentItem.create
      >[0]["data"]["sourceType"],
      status: item.status as "DRAFT" | "PUBLISHED" | "RETIRED",
      body: isOriginal ? item.body : null,
      videoUrl: isOriginal ? (item.video?.url ?? null) : null,
      videoCaptionsUrl: isOriginal ? (item.video?.captionsUrl ?? null) : null,
      videoPosterUrl: isOriginal ? (item.video?.posterUrl ?? null) : null,
      videoDurationSeconds: isOriginal ? (item.video?.durationSeconds ?? null) : null,
      externalUrl: !isOriginal ? item.externalUrl : null,
      sourcePublisher: !isOriginal ? item.sourcePublisher : null,
      sourceAuthor: !isOriginal ? (item.sourceAuthor ?? null) : null,
      sourcePublishedOn: !isOriginal ? (item.sourcePublishedOn ?? null) : null,
      attributionNote: !isOriginal ? (item.attributionNote ?? null) : null,
      lastReviewedAt: item.lastReviewedAt,
      reviewCadenceDays: item.reviewCadenceDays,
      nextReviewDueAt,
      contentHash: entry.contentHash,
      retiredAt: null,
      publishedAt: item.status === "PUBLISHED" ? new Date() : null,
    };

    let itemId: string;

    if (entry.action === "create") {
      const created = await tx.contentItem.create({
        data: {
          slug: item.slug,
          version: 1,
          topics: { connect: item.topics.map((slug) => ({ slug })) },
          ...baseData,
        },
      });
      itemId = created.id;
      await tx.contentItemVersion.create({
        data: {
          contentItemId: itemId,
          version: 1,
          contentHash: entry.contentHash,
          snapshot: item as unknown as Prisma.InputJsonValue,
          lastReviewedAt: item.lastReviewedAt,
        },
      });
    } else if (entry.action === "update" && entry.existingId) {
      const updated = await tx.contentItem.update({
        where: { id: entry.existingId },
        data: {
          version: entry.nextVersion,
          topics: { set: item.topics.map((slug) => ({ slug })) },
          ...baseData,
        },
      });
      itemId = updated.id;
      await tx.contentItemVersion.create({
        data: {
          contentItemId: itemId,
          version: entry.nextVersion ?? updated.version,
          contentHash: entry.contentHash,
          snapshot: item as unknown as Prisma.InputJsonValue,
          lastReviewedAt: item.lastReviewedAt,
        },
      });
    } else if (entry.action === "unretire" && entry.existingId) {
      const updated = await tx.contentItem.update({
        where: { id: entry.existingId },
        data: {
          topics: { set: item.topics.map((slug) => ({ slug })) },
          ...baseData,
        },
      });
      itemId = updated.id;
      // No version bump, no snapshot — content unchanged while retired
      // (decision #8).
    } else {
      continue;
    }

    idBySlug.set(entry.slug, itemId);
  }

  return idBySlug;
}

async function applyCourses(
  tx: TransactionClient,
  entries: SimplePlanEntry<LoadedCourse>[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();

  for (const entry of entries) {
    if (entry.action === "retire" && entry.existingId) {
      await tx.course.update({ where: { id: entry.existingId }, data: { status: "RETIRED" } });
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }
    if (entry.action === "unchanged" && entry.existingId) {
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }
    if (!entry.data) {
      continue;
    }
    const data = {
      title: entry.data.title,
      summary: entry.data.summary,
      description: entry.data.description ?? null,
      status: entry.data.status as "DRAFT" | "PUBLISHED" | "RETIRED",
    };
    if (entry.action === "create") {
      const created = await tx.course.create({ data: { slug: entry.data.slug, ...data } });
      idBySlug.set(entry.slug, created.id);
    } else if (entry.action === "update" && entry.existingId) {
      await tx.course.update({ where: { id: entry.existingId }, data });
      idBySlug.set(entry.slug, entry.existingId);
    }
  }

  return idBySlug;
}

async function applyPaths(
  tx: TransactionClient,
  entries: SimplePlanEntry<LoadedPath>[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();

  for (const entry of entries) {
    if (entry.action === "retire" && entry.existingId) {
      await tx.path.update({ where: { id: entry.existingId }, data: { status: "RETIRED" } });
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }
    if (entry.action === "unchanged" && entry.existingId) {
      idBySlug.set(entry.slug, entry.existingId);
      continue;
    }
    if (!entry.data) {
      continue;
    }
    const data = {
      roleArchetype: entry.data.role as Parameters<
        typeof tx.path.create
      >[0]["data"]["roleArchetype"],
      level: entry.data.level as Parameters<typeof tx.path.create>[0]["data"]["level"],
      title: entry.data.title,
      summary: entry.data.summary,
      description: entry.data.description,
      status: entry.data.status as "DRAFT" | "PUBLISHED" | "RETIRED",
    };
    if (entry.action === "create") {
      const created = await tx.path.create({ data: { slug: entry.data.slug, ...data } });
      idBySlug.set(entry.slug, created.id);
    } else if (entry.action === "update" && entry.existingId) {
      await tx.path.update({ where: { id: entry.existingId }, data });
      idBySlug.set(entry.slug, entry.existingId);
    }
  }

  return idBySlug;
}

/** Rewrites `CourseItem` ordering rows for every course that was created or updated this run (decision #5: the importer rewrites a course's ordering wholesale). */
async function rewriteCourseOrdering(
  tx: TransactionClient,
  courseEntries: SimplePlanEntry<LoadedCourse>[],
  courseIds: Map<string, string>,
  itemIds: Map<string, string>,
): Promise<void> {
  for (const entry of courseEntries) {
    if (entry.action !== "create" && entry.action !== "update") {
      continue;
    }
    const courseId = courseIds.get(entry.slug);
    const items = entry.data?.items ?? [];
    if (!courseId) {
      continue;
    }
    await tx.courseItem.deleteMany({ where: { courseId } });
    let position = 0;
    for (const itemSlug of items) {
      const contentItemId = itemIds.get(itemSlug);
      if (!contentItemId) {
        continue;
      }
      await tx.courseItem.create({ data: { courseId, contentItemId, position } });
      position += 1;
    }
  }
}

/** Rewrites `PathCourse` ordering rows for every path that was created or updated this run. */
async function rewritePathOrdering(
  tx: TransactionClient,
  pathEntries: SimplePlanEntry<LoadedPath>[],
  pathIds: Map<string, string>,
  courseIds: Map<string, string>,
): Promise<void> {
  for (const entry of pathEntries) {
    if (entry.action !== "create" && entry.action !== "update") {
      continue;
    }
    const pathId = pathIds.get(entry.slug);
    const courses = entry.data?.courses ?? [];
    if (!pathId) {
      continue;
    }
    await tx.pathCourse.deleteMany({ where: { pathId } });
    let position = 0;
    for (const courseSlug of courses) {
      const courseId = courseIds.get(courseSlug);
      if (!courseId) {
        continue;
      }
      await tx.pathCourse.create({ data: { pathId, courseId, position } });
      position += 1;
    }
  }
}

export interface ImportContentPackOptions {
  prisma: PrismaClient;
  pack: ContentPack;
  dryRun?: boolean;
}

export async function importContentPack({
  prisma,
  pack,
  dryRun = false,
}: ImportContentPackOptions): Promise<ImportSummary> {
  return prisma
    .$transaction(
      async (tx) => {
        const current = await loadCurrentState(tx);
        const plan = planImport(pack, current);

        const summary: ImportSummary = {
          topics: emptyCounts(),
          roleProfiles: emptyCounts(),
          glossary: emptyCounts(),
          items: emptyCounts(),
          courses: emptyCounts(),
          paths: emptyCounts(),
        };

        for (const entry of plan.topics) tally(summary.topics, entry.action);
        for (const entry of plan.roleProfiles) tally(summary.roleProfiles, entry.action);
        for (const entry of plan.glossary) tally(summary.glossary, entry.action);
        for (const entry of plan.items) tally(summary.items, entry.action);
        for (const entry of plan.courses) tally(summary.courses, entry.action);
        for (const entry of plan.paths) tally(summary.paths, entry.action);

        if (dryRun) {
          // Validated and planned; nothing written. Throwing and catching a
          // sentinel keeps the whole thing inside one transaction attempt
          // without ever committing a write, then we return the summary from
          // outside the transaction.
          throw new DryRunSentinel(summary);
        }

        await applyTopics(tx, plan.topics);
        await applyGlossary(tx, plan.glossary);
        await applyRoleProfiles(tx, plan.roleProfiles);
        const itemIds = await applyContentItems(tx, plan.items);
        const courseIds = await applyCourses(tx, plan.courses);
        const pathIds = await applyPaths(tx, plan.paths);
        await rewriteCourseOrdering(tx, plan.courses, courseIds, itemIds);
        await rewritePathOrdering(tx, plan.paths, pathIds, courseIds);

        return summary;
      },
      { timeout: 30_000 },
    )
    .catch((error) => {
      if (error instanceof DryRunSentinel) {
        return error.summary;
      }
      throw error;
    });
}

class DryRunSentinel extends Error {
  constructor(public summary: ImportSummary) {
    super("dry run — no changes written");
  }
}
