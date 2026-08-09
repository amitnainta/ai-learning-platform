import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FR-RATE-008 (task 28), mocked Prisma + hand-built fixtures — never a
 * database. `@/lib/prisma` and `@/lib/progress/queries` (whose
 * `getProgressMapForUser` this module reuses) are both mocked;
 * `computePathProgress` itself is the real implementation, so these tests
 * also exercise the "live denominator" property it already guarantees.
 */

const courseItemCountMock = vi.fn();
const progressCountMock = vi.fn();
const pathFindUniqueMock = vi.fn();
const getProgressMapForUserMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseItem: { count: (...args: unknown[]) => courseItemCountMock(...args) },
    progress: { count: (...args: unknown[]) => progressCountMock(...args) },
    path: { findUnique: (...args: unknown[]) => pathFindUniqueMock(...args) },
  },
}));

vi.mock("@/lib/progress/queries", () => ({
  getProgressMapForUser: (...args: unknown[]) => getProgressMapForUserMock(...args),
}));

beforeEach(() => {
  courseItemCountMock.mockReset();
  progressCountMock.mockReset();
  pathFindUniqueMock.mockReset();
  getProgressMapForUserMock.mockReset();
});

function buildPathItem(id: string) {
  return { position: 0, contentItem: { id, slug: id, title: id, sourceType: "ORIGINAL" as const } };
}

describe("getCourseRatingEligibility", () => {
  it("a user with no progress in a course is COURSE_NOT_STARTED", async () => {
    const { getCourseRatingEligibility } = await import("../eligibility");
    courseItemCountMock.mockResolvedValue(3);
    progressCountMock.mockResolvedValue(0);

    const result = await getCourseRatingEligibility("user-1", "course-1");
    expect(result).toEqual({ eligible: false, reason: "COURSE_NOT_STARTED" });
  });

  it("one IN_PROGRESS row makes them eligible (policy is STARTED, not COMPLETED)", async () => {
    const { getCourseRatingEligibility } = await import("../eligibility");
    courseItemCountMock.mockResolvedValue(3);
    progressCountMock.mockResolvedValue(1);

    const result = await getCourseRatingEligibility("user-1", "course-1");
    expect(result).toEqual({ eligible: true });
  });

  it("a course with zero published items is NO_ITEMS, never eligible", async () => {
    const { getCourseRatingEligibility } = await import("../eligibility");
    courseItemCountMock.mockResolvedValue(0);

    const result = await getCourseRatingEligibility("user-1", "course-1");
    expect(result).toEqual({ eligible: false, reason: "NO_ITEMS" });
    expect(progressCountMock).not.toHaveBeenCalled();
  });
});

describe("getPathRatingEligibility", () => {
  it("a path at 80% is PATH_NOT_COMPLETE", async () => {
    const { getPathRatingEligibility } = await import("../eligibility");
    const items = [buildPathItem("a"), buildPathItem("b"), buildPathItem("c"), buildPathItem("d")];
    pathFindUniqueMock.mockResolvedValue({
      courses: [{ position: 0, course: { slug: "c1", title: "Course 1", items } }],
    });
    getProgressMapForUserMock.mockResolvedValue(
      new Map([
        ["a", { status: "COMPLETE" }],
        ["b", { status: "COMPLETE" }],
        ["c", { status: "COMPLETE" }],
        ["d", { status: "IN_PROGRESS" }],
      ]),
    );

    const result = await getPathRatingEligibility("user-1", "path-1");
    expect(result).toEqual({ eligible: false, reason: "PATH_NOT_COMPLETE" });
  });

  it("a path where every published item is COMPLETE is eligible", async () => {
    const { getPathRatingEligibility } = await import("../eligibility");
    const items = [buildPathItem("a"), buildPathItem("b")];
    pathFindUniqueMock.mockResolvedValue({
      courses: [{ position: 0, course: { slug: "c1", title: "Course 1", items } }],
    });
    getProgressMapForUserMock.mockResolvedValue(
      new Map([
        ["a", { status: "COMPLETE" }],
        ["b", { status: "COMPLETE" }],
      ]),
    );

    const result = await getPathRatingEligibility("user-1", "path-1");
    expect(result).toEqual({ eligible: true });
  });

  it("a path whose only incomplete item is retired is eligible (live-denominator property)", async () => {
    const { getPathRatingEligibility } = await import("../eligibility");
    // The retired item never appears here at all — `path.findUnique`'s own
    // `where: { contentItem: { status: "PUBLISHED" } }` already excludes it
    // at the query level in the real implementation; this fixture reflects
    // that by simply omitting it from the returned shape.
    const items = [buildPathItem("a"), buildPathItem("b")];
    pathFindUniqueMock.mockResolvedValue({
      courses: [{ position: 0, course: { slug: "c1", title: "Course 1", items } }],
    });
    getProgressMapForUserMock.mockResolvedValue(
      new Map([
        ["a", { status: "COMPLETE" }],
        ["b", { status: "COMPLETE" }],
      ]),
    );

    const result = await getPathRatingEligibility("user-1", "path-1");
    expect(result).toEqual({ eligible: true });
  });

  it("a path with zero currently-published items is NO_ITEMS, never eligible", async () => {
    const { getPathRatingEligibility } = await import("../eligibility");
    pathFindUniqueMock.mockResolvedValue({ courses: [] });
    getProgressMapForUserMock.mockResolvedValue(new Map());

    const result = await getPathRatingEligibility("user-1", "path-1");
    expect(result).toEqual({ eligible: false, reason: "NO_ITEMS" });
  });
});

describe("RATING_ELIGIBILITY_MESSAGES", () => {
  it("has an entry for every reason", async () => {
    const { RATING_ELIGIBILITY_MESSAGES } = await import("../eligibility");
    const reasons = [
      "NOT_SIGNED_IN",
      "COURSE_NOT_STARTED",
      "PATH_NOT_COMPLETE",
      "NO_ITEMS",
    ] as const;
    for (const reason of reasons) {
      expect(typeof RATING_ELIGIBILITY_MESSAGES[reason]).toBe("string");
      expect(RATING_ELIGIBILITY_MESSAGES[reason].length).toBeGreaterThan(0);
    }
  });
});
