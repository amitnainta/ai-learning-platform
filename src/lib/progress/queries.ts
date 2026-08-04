import { cache } from "react";
import type { ProficiencyLevel, ProgressStatus, RoleArchetype, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPathForRoleLevel } from "@/lib/content/queries";
import {
  computeCourseProgress,
  computePathProgress,
  findResumeTarget,
  type ProgressCounts,
  type ProgressCourse,
  type ResumeTarget,
} from "@/lib/progress/percent";

/**
 * The only place routes read progress from (task 7), mirroring
 * `src/lib/content/queries.ts`. Every exported function issues a fixed
 * number of Prisma queries independent of how many items/courses/progress
 * rows are involved (NFR-PERF-006) — nothing here loops and queries per
 * item or per course.
 */

export interface ProgressRow {
  status: ProgressStatus;
  lastViewedAt: Date;
  completedAt: Date | null;
}

/** A `Map` from `ContentItem.id` to that item's progress row. Absence means "not started" (decision #2). */
export type ProgressMap = Map<string, ProgressRow>;

/** One indexed `findMany` — the only progress read every other query in this module builds on. */
export const getProgressMapForUser = cache(async (userId: string): Promise<ProgressMap> => {
  const rows = await prisma.progress.findMany({
    where: { userId },
    select: { contentItemId: true, status: true, lastViewedAt: true, completedAt: true },
  });
  return new Map(
    rows.map((row) => [
      row.contentItemId,
      { status: row.status, lastViewedAt: row.lastViewedAt, completedAt: row.completedAt },
    ]),
  );
});

export interface ActivePathSummary {
  id: string;
  slug: string;
  title: string;
  roleArchetype: RoleArchetype;
  level: ProficiencyLevel;
  isCurrent: boolean;
  progress: ProgressCounts;
  courses: { slug: string; title: string; progress: ProgressCounts }[];
  resumeTarget: ResumeTarget;
  /** Most recent `lastViewedAt` among this path's progress rows — used only to order the dashboard's retained-path list (decision #6). */
  lastViewedAt: Date;
}

/** The minimal path shape `buildPathSummary` needs, satisfied by both `getPathForRoleLevel`'s (heavier) and `listActivePathsForUser`'s (lighter) query results. */
interface PathForSummary {
  id: string;
  slug: string;
  title: string;
  roleArchetype: RoleArchetype;
  level: ProficiencyLevel;
  courses: {
    position: number;
    course: {
      slug: string;
      title: string;
      items: {
        position: number;
        contentItem: { id: string; slug: string; title: string; sourceType: SourceType };
      }[];
    };
  }[];
}

function toProgressCourses(courses: PathForSummary["courses"]): ProgressCourse[] {
  return courses.map((pathCourse) => ({
    slug: pathCourse.course.slug,
    title: pathCourse.course.title,
    position: pathCourse.position,
    items: pathCourse.course.items.map((courseItem) => ({
      id: courseItem.contentItem.id,
      slug: courseItem.contentItem.slug,
      title: courseItem.contentItem.title,
      sourceType: courseItem.contentItem.sourceType,
      position: courseItem.position,
    })),
  }));
}

function buildPathSummary(
  path: PathForSummary,
  progressMap: ProgressMap,
  isCurrent: boolean,
): ActivePathSummary {
  const progressCourses = toProgressCourses(path.courses);

  let lastViewedAt = new Date(0);
  for (const course of progressCourses) {
    for (const item of course.items) {
      const record = progressMap.get(item.id);
      if (record && record.lastViewedAt > lastViewedAt) {
        lastViewedAt = record.lastViewedAt;
      }
    }
  }

  return {
    id: path.id,
    slug: path.slug,
    title: path.title,
    roleArchetype: path.roleArchetype,
    level: path.level,
    isCurrent,
    progress: computePathProgress(progressCourses, progressMap),
    courses: progressCourses.map((course) => ({
      slug: course.slug,
      title: course.title,
      progress: computeCourseProgress(course.items, progressMap),
    })),
    resumeTarget: findResumeTarget(progressCourses, progressMap),
    lastViewedAt,
  };
}

/**
 * Decision #7: paths **other than** the user's current role/level path that
 * contain at least one of the user's progress rows — the "retention is
 * visible" half of FR-PATH-009. One join query
 * (`path` -> `pathCourse` -> `course` -> `courseItem` -> `contentItem`,
 * filtered to paths containing a touched item), ordered by the most
 * recent `lastViewedAt` among each path's touched items, capped at 5.
 * Returns `[]` (no query at all) for a user with no progress rows.
 */
export const listActivePathsForUser = cache(
  async (
    user: { roleArchetype: RoleArchetype | null; level: ProficiencyLevel | null },
    progressMap: ProgressMap,
  ): Promise<ActivePathSummary[]> => {
    const contentItemIds = [...progressMap.keys()];
    if (contentItemIds.length === 0) {
      return [];
    }

    const hasCurrentPath = Boolean(user.roleArchetype) && Boolean(user.level);

    const paths = await prisma.path.findMany({
      where: {
        status: "PUBLISHED",
        courses: {
          some: {
            course: {
              status: "PUBLISHED",
              items: {
                some: {
                  contentItemId: { in: contentItemIds },
                  contentItem: { status: "PUBLISHED" },
                },
              },
            },
          },
        },
        ...(hasCurrentPath
          ? { NOT: { roleArchetype: user.roleArchetype!, level: user.level! } }
          : {}),
      },
      include: {
        courses: {
          where: { course: { status: "PUBLISHED" } },
          orderBy: { position: "asc" },
          include: {
            course: {
              include: {
                items: {
                  where: { contentItem: { status: "PUBLISHED" } },
                  orderBy: { position: "asc" },
                  select: {
                    position: true,
                    contentItem: {
                      select: { id: true, slug: true, title: true, sourceType: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return paths
      .map((path) => buildPathSummary(path, progressMap, false))
      .sort((a, b) => b.lastViewedAt.getTime() - a.lastViewedAt.getTime())
      .slice(0, 5);
  },
);

export interface DashboardProgress {
  progressMap: ProgressMap;
  /** Current path first (when the user has one), then retained paths (decision #7), most-recently-touched first. */
  activePaths: ActivePathSummary[];
  /**
   * Whether a *published path actually exists* for the user's current
   * role/level — i.e. whether `getPathForRoleLevel` resolved a path, not
   * merely whether the user has role/level fields set. `ENGINEERING_LEADER`
   * and `INVESTOR` are selectable roles with no R1 path, so a user can have
   * a real role and level and still have `hasCurrentPath === false` (B1
   * fix). The dashboard uses this, combined with `activePaths`, to decide
   * whether to show the "no path available, browse paths" fallback.
   */
  hasCurrentPath: boolean;
}

/**
 * Composes `getProgressMapForUser`, `listActivePathsForUser`, and the
 * existing `getPathForRoleLevel` content query into the dashboard's full
 * progress view (FR-PROG-003). Fixed query count: one for the progress
 * map, one for the current path (reusing the existing, cached content
 * query), and at most one for retained paths — independent of the number
 * of items, courses, or progress rows (NFR-PERF-006, AC7).
 */
export const getDashboardProgress = cache(
  async (user: {
    id: string;
    roleArchetype: RoleArchetype | null;
    level: ProficiencyLevel | null;
  }): Promise<DashboardProgress> => {
    const progressMap = await getProgressMapForUser(user.id);

    const roleAndLevelSet =
      Boolean(user.roleArchetype) && user.roleArchetype !== "NOT_SURE_YET" && Boolean(user.level);

    const [currentPathDetail, retainedPaths] = await Promise.all([
      roleAndLevelSet && user.roleArchetype && user.level
        ? getPathForRoleLevel(user.roleArchetype, user.level)
        : Promise.resolve(null),
      listActivePathsForUser(user, progressMap),
    ]);

    const activePaths: ActivePathSummary[] = [];
    if (currentPathDetail) {
      activePaths.push(buildPathSummary(currentPathDetail, progressMap, true));
    }
    activePaths.push(...retainedPaths);

    return { progressMap, activePaths, hasCurrentPath: currentPathDetail !== null };
  },
);
