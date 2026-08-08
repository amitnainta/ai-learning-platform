import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { RatingFlagReason, RoleArchetype, ProficiencyLevel } from "@prisma/client";
import type { RatingAggregate } from "@/lib/ratings/aggregate";
import { EMPTY_AGGREGATE } from "@/lib/ratings/aggregate";

/**
 * The only place routes read ratings from (task 8), mirroring
 * `src/lib/content/queries.ts` / `src/lib/progress/queries.ts`. Every
 * aggregate function issues exactly **one** `groupBy` for the whole list of
 * target ids it's given — never one query per course or per rating
 * (NFR-SCALE-002, decision #6) — and every function filters `hiddenAt:
 * null` so a moderation-hidden rating disappears from both the public list
 * and the aggregate (decision #5).
 */

const VISIBLE_RATING: { hiddenAt: null } = { hiddenAt: null };
const RATING_LIST_TAKE = 20;

export interface RatingListEntry {
  id: string;
  stars: number;
  feedback: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    name: string;
    roleArchetype: RoleArchetype | null;
    level: ProficiencyLevel | null;
  };
}

export interface RatingListResult {
  entries: RatingListEntry[];
  totalWithFeedback: number;
}

/** Published-only course lookup by slug — the only way a client-supplied slug resolves to an id (NFR-SEC-004). */
export const resolvePublishedCourseBySlug = cache(async (slug: string) => {
  return prisma.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, slug: true, title: true },
  });
});

/** Published-only path lookup by slug — same rationale as `resolvePublishedCourseBySlug`. */
export const resolvePublishedPathBySlug = cache(async (slug: string) => {
  return prisma.path.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, slug: true, title: true },
  });
});

/** One `groupBy` for every course id passed in — never one query per course (AC9). */
export const getCourseRatingAggregates = cache(
  async (courseIds: string[]): Promise<Map<string, RatingAggregate>> => {
    if (courseIds.length === 0) {
      return new Map();
    }
    const rows = await prisma.rating.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, ...VISIBLE_RATING },
      _avg: { stars: true },
      _count: { _all: true },
    });
    return new Map(
      rows
        .filter((row): row is typeof row & { courseId: string } => row.courseId !== null)
        .map((row) => [row.courseId, { average: row._avg.stars, count: row._count._all }]),
    );
  },
);

/** One `groupBy` for every path id passed in — same shape as `getCourseRatingAggregates`. */
export const getPathRatingAggregates = cache(
  async (pathIds: string[]): Promise<Map<string, RatingAggregate>> => {
    if (pathIds.length === 0) {
      return new Map();
    }
    const rows = await prisma.rating.groupBy({
      by: ["pathId"],
      where: { pathId: { in: pathIds }, ...VISIBLE_RATING },
      _avg: { stars: true },
      _count: { _all: true },
    });
    return new Map(
      rows
        .filter((row): row is typeof row & { pathId: string } => row.pathId !== null)
        .map((row) => [row.pathId, { average: row._avg.stars, count: row._count._all }]),
    );
  },
);

/** A single target's aggregate, built on top of the batched lookup above so a single-target page reuses the same one-query shape. */
export async function getSingleCourseRatingAggregate(courseId: string): Promise<RatingAggregate> {
  const map = await getCourseRatingAggregates([courseId]);
  return map.get(courseId) ?? EMPTY_AGGREGATE;
}

export async function getSinglePathRatingAggregate(pathId: string): Promise<RatingAggregate> {
  const map = await getPathRatingAggregates([pathId]);
  return map.get(pathId) ?? EMPTY_AGGREGATE;
}

/**
 * The public feedback list for one target (decision #4): non-hidden rows
 * with non-null feedback, newest first, capped at 20. Selects only what
 * FR-RATE-004 requires to be shown (display name, role archetype, level) —
 * no email, no other field. `totalWithFeedback` backs the "showing 20 of N"
 * line.
 */
export const listVisibleRatings = cache(
  async (target: { courseId: string } | { pathId: string }): Promise<RatingListResult> => {
    const where = { ...target, ...VISIBLE_RATING, feedback: { not: null } };

    const [rows, totalWithFeedback] = await Promise.all([
      prisma.rating.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: RATING_LIST_TAKE,
        select: {
          id: true,
          stars: true,
          feedback: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { name: true, roleArchetype: true, level: true } },
        },
      }),
      prisma.rating.count({ where }),
    ]);

    return {
      entries: rows.map((row) => ({
        id: row.id,
        stars: row.stars,
        // Non-null by the `where` clause above (`feedback: { not: null }`).
        feedback: row.feedback as string,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        author: {
          name: row.user.name,
          roleArchetype: row.user.roleArchetype,
          level: row.user.level,
        },
      })),
      totalWithFeedback,
    };
  },
);

export interface MyRating {
  id: string;
  stars: number;
  feedback: string | null;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The session user's own rating for one target, or `null` — powers the form's prefill/"update"/"remove" state. */
export const getMyRating = cache(
  async (
    userId: string,
    target: { courseId: string } | { pathId: string },
  ): Promise<MyRating | null> => {
    return prisma.rating.findFirst({
      where: { userId, ...target },
      select: {
        id: true,
        stars: true,
        feedback: true,
        hiddenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
);

export interface UnresolvedFlagGroup {
  ratingId: string;
  stars: number;
  feedback: string | null;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  targetType: "course" | "path";
  targetSlug: string;
  targetTitle: string;
  flagCount: number;
  reasons: RatingFlagReason[];
  notes: string[];
}

/**
 * Unresolved flags grouped by rating, for `scripts/moderation.ts list`
 * (decision #5). Not `cache()`-wrapped — this is a CLI read, not a
 * per-request server-component read.
 */
export async function listUnresolvedFlagsGroupedByRating(): Promise<UnresolvedFlagGroup[]> {
  const flags = await prisma.ratingFlag.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      reason: true,
      note: true,
      rating: {
        select: {
          id: true,
          stars: true,
          feedback: true,
          hiddenAt: true,
          createdAt: true,
          updatedAt: true,
          course: { select: { slug: true, title: true } },
          path: { select: { slug: true, title: true } },
        },
      },
    },
  });

  const groups = new Map<string, UnresolvedFlagGroup>();
  for (const flag of flags) {
    const { rating } = flag;
    const existing = groups.get(rating.id);
    if (existing) {
      existing.flagCount += 1;
      existing.reasons.push(flag.reason);
      if (flag.note) {
        existing.notes.push(flag.note);
      }
      continue;
    }

    const target = rating.course
      ? {
          targetType: "course" as const,
          targetSlug: rating.course.slug,
          targetTitle: rating.course.title,
        }
      : {
          targetType: "path" as const,
          targetSlug: rating.path!.slug,
          targetTitle: rating.path!.title,
        };

    groups.set(rating.id, {
      ratingId: rating.id,
      stars: rating.stars,
      feedback: rating.feedback,
      hiddenAt: rating.hiddenAt,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
      ...target,
      flagCount: 1,
      reasons: [flag.reason],
      notes: flag.note ? [flag.note] : [],
    });
  }

  return [...groups.values()];
}
