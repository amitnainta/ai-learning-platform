import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * NFR-SCALE-002 as an automated assertion (task 29): `getCourseRatingAggregates`
 * for a batch of course ids must issue exactly **one** `groupBy` — never one
 * per course. `@/lib/prisma` is mocked with counting `vi.fn()`s so these
 * tests assert call counts and query shape, never touching a database.
 */

const groupByMock = vi.fn();
const ratingFindManyMock = vi.fn();
const ratingCountMock = vi.fn();
const courseFindFirstMock = vi.fn();
const pathFindFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rating: {
      groupBy: (...args: unknown[]) => groupByMock(...args),
      findMany: (...args: unknown[]) => ratingFindManyMock(...args),
      count: (...args: unknown[]) => ratingCountMock(...args),
    },
    course: { findFirst: (...args: unknown[]) => courseFindFirstMock(...args) },
    path: { findFirst: (...args: unknown[]) => pathFindFirstMock(...args) },
  },
}));

beforeEach(() => {
  groupByMock.mockReset();
  ratingFindManyMock.mockReset();
  ratingCountMock.mockReset();
  courseFindFirstMock.mockReset();
  pathFindFirstMock.mockReset();
});

describe("getCourseRatingAggregates", () => {
  it("issues exactly one groupBy for eight course ids and filters hiddenAt: null", async () => {
    const { getCourseRatingAggregates } = await import("../queries");
    const courseIds = Array.from({ length: 8 }, (_, i) => `course-${i}`);
    groupByMock.mockResolvedValue([
      { courseId: "course-0", _avg: { stars: 4.5 }, _count: { _all: 2 } },
    ]);

    const result = await getCourseRatingAggregates(courseIds);

    expect(groupByMock).toHaveBeenCalledTimes(1);
    const call = groupByMock.mock.calls[0]![0];
    expect(call.by).toEqual(["courseId"]);
    expect(call.where).toMatchObject({ courseId: { in: courseIds }, hiddenAt: null });
    expect(result.get("course-0")).toEqual({ average: 4.5, count: 2 });
  });

  it("returns an empty map with no query for an empty id list", async () => {
    const { getCourseRatingAggregates } = await import("../queries");
    const result = await getCourseRatingAggregates([]);
    expect(groupByMock).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});

describe("listVisibleRatings", () => {
  it("applies take: 20, orders newest first, excludes hidden and feedback-less rows, and selects no email field", async () => {
    const { listVisibleRatings } = await import("../queries");
    ratingFindManyMock.mockResolvedValue([]);
    ratingCountMock.mockResolvedValue(0);

    await listVisibleRatings({ courseId: "course-1" });

    const call = ratingFindManyMock.mock.calls[0]![0];
    expect(call.take).toBe(20);
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.where).toMatchObject({
      courseId: "course-1",
      hiddenAt: null,
      feedback: { not: null },
    });
    expect(call.select).not.toHaveProperty("user.email");
    expect(JSON.stringify(call.select)).not.toContain("email");
  });

  it("returns the totalWithFeedback count alongside entries", async () => {
    const { listVisibleRatings } = await import("../queries");
    ratingFindManyMock.mockResolvedValue([
      {
        id: "r1",
        stars: 5,
        feedback: "Loved it",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Ada", roleArchetype: "TECHNICAL_BUILDER", level: "ADVANCED" },
      },
    ]);
    ratingCountMock.mockResolvedValue(30);

    const result = await listVisibleRatings({ courseId: "course-1" });
    expect(result.entries).toHaveLength(1);
    expect(result.totalWithFeedback).toBe(30);
  });
});

describe("resolvePublishedCourseBySlug", () => {
  it("filters status: PUBLISHED", async () => {
    const { resolvePublishedCourseBySlug } = await import("../queries");
    courseFindFirstMock.mockResolvedValue({ id: "c1", slug: "my-course", title: "My Course" });

    await resolvePublishedCourseBySlug("my-course");

    expect(courseFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "my-course", status: "PUBLISHED" } }),
    );
  });

  it("returns null for an unknown slug", async () => {
    const { resolvePublishedCourseBySlug } = await import("../queries");
    courseFindFirstMock.mockResolvedValue(null);

    const result = await resolvePublishedCourseBySlug("nonexistent");
    expect(result).toBeNull();
  });
});
