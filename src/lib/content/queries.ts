import { cache } from "react";
import type { ProficiencyLevel, RoleArchetype } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The only place routes read content from (task 13). Every function
 * filters to `status: "PUBLISHED"` (FR-ACC-008: anonymously readable, but
 * only published content is public) and is wrapped in React `cache()` for
 * per-request deduplication (decision #11 — dynamic rendering, not ISR).
 */

const publishedContentItem = { status: "PUBLISHED" as const };

export const listRolePaths = cache(async () => {
  return prisma.roleProfile.findMany({
    where: publishedContentItem,
    orderBy: { role: "asc" },
  });
});

export const getRoleProfile = cache(async (role: RoleArchetype) => {
  return prisma.roleProfile.findFirst({
    where: { role, ...publishedContentItem },
  });
});

/** All published paths for a role, one per level, with title/summary only — used by the role landing page (task 25). */
export const listPathsForRole = cache(async (role: RoleArchetype) => {
  return prisma.path.findMany({
    where: { roleArchetype: role, ...publishedContentItem },
    orderBy: { level: "asc" },
    include: {
      courses: {
        where: { course: publishedContentItem },
        include: {
          course: { include: { items: { where: { contentItem: publishedContentItem } } } },
        },
      },
    },
  });
});

/** The full ordered path for a role x level, with its ordered courses and their ordered items (FR-PATH-001/002). */
export const getPathForRoleLevel = cache(async (role: RoleArchetype, level: ProficiencyLevel) => {
  return prisma.path.findFirst({
    where: { roleArchetype: role, level, ...publishedContentItem },
    include: {
      courses: {
        where: { course: publishedContentItem },
        orderBy: { position: "asc" },
        include: {
          course: {
            include: {
              items: {
                where: { contentItem: publishedContentItem },
                orderBy: { position: "asc" },
                include: { contentItem: { include: { topics: true } } },
              },
            },
          },
        },
      },
    },
  });
});

/** A single course, its ordered items, and every published path that contains it (task 27 — makes the overlap from decision #5 visible). */
export const getCourseBySlug = cache(async (slug: string) => {
  return prisma.course.findFirst({
    where: { slug, ...publishedContentItem },
    include: {
      items: {
        where: { contentItem: publishedContentItem },
        orderBy: { position: "asc" },
        include: { contentItem: { include: { topics: true } } },
      },
      paths: {
        where: { path: publishedContentItem },
        include: { path: true },
      },
    },
  });
});

/** An original lesson only (curated items have no detail page — decision #10) with the course it belongs to, for previous/next links. */
export const getLessonBySlug = cache(async (slug: string) => {
  return prisma.contentItem.findFirst({
    where: { slug, sourceType: "ORIGINAL", ...publishedContentItem },
    include: {
      topics: true,
      courses: {
        include: {
          course: {
            include: {
              items: {
                where: { contentItem: publishedContentItem },
                orderBy: { position: "asc" },
                include: { contentItem: true },
              },
            },
          },
        },
      },
    },
  });
});

export const listGlossaryTerms = cache(async () => {
  return prisma.glossaryTerm.findMany({
    where: publishedContentItem,
    orderBy: { term: "asc" },
  });
});

export const getGlossaryTerm = cache(async (slug: string) => {
  return prisma.glossaryTerm.findFirst({
    where: { slug, ...publishedContentItem },
  });
});

/** A slug -> term lookup map for the subset of glossary terms referenced by one Markdown body (`<Markdown>`'s `glossary:` links). */
export const getGlossaryTermsBySlugs = cache(async (slugs: string[]) => {
  if (slugs.length === 0) {
    return new Map<string, Awaited<ReturnType<typeof getGlossaryTerm>>>();
  }
  const terms = await prisma.glossaryTerm.findMany({
    where: { slug: { in: slugs }, ...publishedContentItem },
  });
  return new Map(terms.map((term) => [term.slug, term]));
});
