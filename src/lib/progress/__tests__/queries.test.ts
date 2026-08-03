import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * NFR-PERF-006 as an automated assertion (task 25): `getDashboardProgress`
 * for a user with 50 progress rows spread across 8 courses must issue a
 * *fixed* number of Prisma calls, with no call made per item or per
 * course. Both `@/lib/prisma` and `@/lib/content/queries` (whose own
 * `getPathForRoleLevel` this module reuses) are mocked with counting
 * `vi.fn()`s so this test asserts call counts, not query correctness —
 * the content-query module has its own tests for that.
 */

function buildFixtureCourses(courseCount: number, itemsPerCourse: number) {
  const courses = [];
  let itemCounter = 0;
  for (let c = 0; c < courseCount; c += 1) {
    const items = [];
    for (let i = 0; i < itemsPerCourse; i += 1) {
      items.push({
        position: i,
        contentItem: {
          id: `item-${itemCounter}`,
          slug: `item-${itemCounter}`,
          title: `Item ${itemCounter}`,
          sourceType: "ORIGINAL" as const,
        },
      });
      itemCounter += 1;
    }
    courses.push({
      id: `pc-${c}`,
      position: c,
      course: { slug: `course-${c}`, title: `Course ${c}`, items },
    });
  }
  return courses;
}

const FIXTURE_COURSES = buildFixtureCourses(8, 7); // 56 items across 8 courses; the >= 50 target.

function buildProgressRows() {
  const rows: {
    contentItemId: string;
    status: string;
    lastViewedAt: Date;
    completedAt: Date | null;
  }[] = [];
  let count = 0;
  for (const pathCourse of FIXTURE_COURSES) {
    for (const item of pathCourse.course.items) {
      if (count >= 50) {
        break;
      }
      rows.push({
        contentItemId: item.contentItem.id,
        status: "IN_PROGRESS",
        lastViewedAt: new Date(),
        completedAt: null,
      });
      count += 1;
    }
  }
  return rows;
}

const progressFindManyMock = vi.fn();
const pathFindManyMock = vi.fn();
const getPathForRoleLevelMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    progress: { findMany: (...args: unknown[]) => progressFindManyMock(...args) },
    path: { findMany: (...args: unknown[]) => pathFindManyMock(...args) },
  },
}));

vi.mock("@/lib/content/queries", () => ({
  getPathForRoleLevel: (...args: unknown[]) => getPathForRoleLevelMock(...args),
}));

beforeEach(() => {
  progressFindManyMock.mockReset();
  pathFindManyMock.mockReset();
  getPathForRoleLevelMock.mockReset();

  progressFindManyMock.mockResolvedValue(buildProgressRows());
  pathFindManyMock.mockResolvedValue([]);
  getPathForRoleLevelMock.mockResolvedValue({
    id: "path-1",
    slug: "technical-builder-zero-knowledge",
    title: "Technical Builder — Zero Knowledge",
    roleArchetype: "TECHNICAL_BUILDER",
    level: "ZERO_KNOWLEDGE",
    courses: FIXTURE_COURSES,
  });
});

describe("getProgressMapForUser", () => {
  it("issues exactly one findMany filtered by userId", async () => {
    const { getProgressMapForUser } = await import("../queries");
    const map = await getProgressMapForUser("user-1");

    expect(progressFindManyMock).toHaveBeenCalledTimes(1);
    expect(progressFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(map.size).toBe(50);
  });
});

describe("getDashboardProgress — NFR-PERF-006 fixed query count", () => {
  it("issues a fixed number of Prisma/content-query calls for a 50-item / 8-course user, none per item or per course", async () => {
    const { getDashboardProgress } = await import("../queries");

    const user = {
      id: "user-1",
      roleArchetype: "TECHNICAL_BUILDER" as const,
      level: "ZERO_KNOWLEDGE" as const,
    };
    const result = await getDashboardProgress(user);

    // Exactly: 1 progress.findMany + 1 getPathForRoleLevel (current path) +
    // 1 path.findMany (retained-path discovery) = 3, regardless of the 50
    // progress rows / 8 courses / 56 items involved.
    expect(progressFindManyMock).toHaveBeenCalledTimes(1);
    expect(getPathForRoleLevelMock).toHaveBeenCalledTimes(1);
    expect(pathFindManyMock).toHaveBeenCalledTimes(1);

    expect(result.activePaths).toHaveLength(1);
    expect(result.activePaths[0]?.isCurrent).toBe(true);
    expect(result.activePaths[0]?.progress.totalCount).toBe(56);
    expect(result.activePaths[0]?.progress.completedCount).toBe(0); // fixture rows are IN_PROGRESS, not COMPLETE
  });

  it("issues no progress query at all for a user with no progress rows, and no retained-path discovery query", async () => {
    progressFindManyMock.mockResolvedValue([]);
    const { getDashboardProgress } = await import("../queries");

    const user = {
      id: "user-2",
      roleArchetype: "TECHNICAL_BUILDER" as const,
      level: "ZERO_KNOWLEDGE" as const,
    };
    await getDashboardProgress(user);

    expect(progressFindManyMock).toHaveBeenCalledTimes(1);
    expect(getPathForRoleLevelMock).toHaveBeenCalledTimes(1);
    // listActivePathsForUser short-circuits with no progress rows — no join query at all.
    expect(pathFindManyMock).not.toHaveBeenCalled();
  });
});
