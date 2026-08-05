import { describe, expect, it } from "vitest";
import {
  computeCourseProgress,
  computePathProgress,
  findResumeTarget,
  type ProgressByItemId,
  type ProgressCourse,
  type ProgressItem,
} from "../percent";

function item(
  id: string,
  position: number,
  sourceType: "ORIGINAL" | "CURATED" = "ORIGINAL",
): ProgressItem {
  return { id, slug: id, title: `Item ${id}`, sourceType, position };
}

function course(slug: string, position: number, items: ProgressItem[]): ProgressCourse {
  return { slug, title: `Course ${slug}`, position, items };
}

function progressMap(entries: [string, "IN_PROGRESS" | "COMPLETE"][]): ProgressByItemId {
  return new Map(entries.map(([id, status]) => [id, { status }]));
}

describe("computeCourseProgress", () => {
  it("returns zero counts for an empty course without dividing by zero", () => {
    expect(computeCourseProgress([], new Map())).toEqual({
      completedCount: 0,
      totalCount: 0,
      percent: 0,
    });
  });

  it("returns 0% when nothing is complete", () => {
    const items = [item("a", 1), item("b", 2)];
    const result = computeCourseProgress(items, new Map());
    expect(result).toEqual({ completedCount: 0, totalCount: 2, percent: 0 });
  });

  it("returns 100% when everything is complete", () => {
    const items = [item("a", 1), item("b", 2)];
    const map = progressMap([
      ["a", "COMPLETE"],
      ["b", "COMPLETE"],
    ]);
    const result = computeCourseProgress(items, map);
    expect(result).toEqual({ completedCount: 2, totalCount: 2, percent: 100 });
  });

  it("returns a partial count/percent for some complete", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3)];
    const map = progressMap([["a", "COMPLETE"]]);
    const result = computeCourseProgress(items, map);
    expect(result.completedCount).toBe(1);
    expect(result.totalCount).toBe(3);
    expect(result.percent).toBe(33);
  });

  it("never rounds a partially complete course up to 100", () => {
    // 99/100 would round to 99 anyway, but 999/1000 rounds to 100 without clamping.
    const items = Array.from({ length: 1000 }, (_, i) => item(`i${i}`, i));
    const map = progressMap(items.slice(0, 999).map((i) => [i.id, "COMPLETE"] as const));
    const result = computeCourseProgress(items, map);
    expect(result.completedCount).toBe(999);
    expect(result.percent).toBe(99);
  });

  it("never rounds a partially started course down to 0", () => {
    const items = Array.from({ length: 1000 }, (_, i) => item(`i${i}`, i));
    const map = progressMap([["i0", "COMPLETE"]]);
    const result = computeCourseProgress(items, map);
    expect(result.completedCount).toBe(1);
    expect(result.percent).toBe(1);
  });

  it("counts an IN_PROGRESS (not complete) item as not-complete", () => {
    const items = [item("a", 1), item("b", 2)];
    const map = progressMap([["a", "IN_PROGRESS"]]);
    const result = computeCourseProgress(items, map);
    expect(result.completedCount).toBe(0);
    expect(result.percent).toBe(0);
  });
});

describe("computePathProgress", () => {
  it("de-duplicates an item shared between two courses of the same path, counting it once", () => {
    const shared = item("shared", 1);
    const courses = [
      course("c1", 1, [shared, item("a", 2)]),
      course("c2", 2, [shared, item("b", 2)]),
    ];
    const map = progressMap([["shared", "COMPLETE"]]);
    const result = computePathProgress(courses, map);
    // 3 unique items total (shared, a, b), 1 complete.
    expect(result.totalCount).toBe(3);
    expect(result.completedCount).toBe(1);
    expect(result.percent).toBeLessThan(100);
  });

  it("returns 100% only when every unique item across courses is complete", () => {
    const shared = item("shared", 1);
    const courses = [course("c1", 1, [shared, item("a", 2)]), course("c2", 2, [shared])];
    const map = progressMap([
      ["shared", "COMPLETE"],
      ["a", "COMPLETE"],
    ]);
    const result = computePathProgress(courses, map);
    expect(result.totalCount).toBe(2);
    expect(result.completedCount).toBe(2);
    expect(result.percent).toBe(100);
  });

  it("returns zero counts for a path with no items", () => {
    expect(computePathProgress([], new Map())).toEqual({
      completedCount: 0,
      totalCount: 0,
      percent: 0,
    });
  });
});

describe("findResumeTarget", () => {
  it("returns kind 'empty' for a path with no items", () => {
    expect(findResumeTarget([], new Map())).toEqual({ kind: "empty" });
    expect(findResumeTarget([course("c1", 1, [])], new Map())).toEqual({ kind: "empty" });
  });

  it("returns kind 'start' on the first item when nothing is started", () => {
    const courses = [course("c1", 1, [item("a", 1), item("b", 2)])];
    const result = findResumeTarget(courses, new Map());
    expect(result).toMatchObject({ kind: "start", item: { id: "a" }, course: { slug: "c1" } });
  });

  it("returns kind 'complete' when everything is complete", () => {
    const courses = [course("c1", 1, [item("a", 1), item("b", 2)])];
    const map = progressMap([
      ["a", "COMPLETE"],
      ["b", "COMPLETE"],
    ]);
    expect(findResumeTarget(courses, map)).toEqual({ kind: "complete" });
  });

  it("returns kind 'resume' on the first non-complete item in course-then-item order, even when a later item was completed first", () => {
    const courses = [
      course("c1", 1, [item("a", 1), item("b", 2)]),
      course("c2", 2, [item("c", 1)]),
    ];
    // "c" (course 2) was completed, but "a" and "b" (course 1) were not —
    // resume must still point at "a", the first non-complete item in
    // authored order, not at whatever was most recently touched.
    const map = progressMap([["c", "COMPLETE"]]);
    const result = findResumeTarget(courses, map);
    expect(result).toMatchObject({ kind: "resume", item: { id: "a" }, course: { slug: "c1" } });
  });

  it("advances to the second course once the first is fully complete", () => {
    const courses = [
      course("c1", 1, [item("a", 1)]),
      course("c2", 2, [item("b", 1), item("c", 2)]),
    ];
    const map = progressMap([["a", "COMPLETE"]]);
    const result = findResumeTarget(courses, map);
    expect(result).toMatchObject({ kind: "resume", item: { id: "b" }, course: { slug: "c2" } });
  });

  it("de-duplicates a shared item, resolving to its first course occurrence", () => {
    const shared = item("shared", 1);
    const courses = [course("c1", 1, [shared]), course("c2", 2, [shared, item("only-in-c2", 2)])];
    const result = findResumeTarget(courses, new Map());
    expect(result).toMatchObject({ kind: "start", item: { id: "shared" }, course: { slug: "c1" } });
  });
});

describe("50-item / 8-course fixture (NFR-PERF-006 shape)", () => {
  function buildFixture() {
    const courses: ProgressCourse[] = [];
    let itemCounter = 0;
    for (let c = 0; c < 8; c += 1) {
      const itemsInCourse = c < 6 ? 7 : 4; // 6*7 + 2*4 = 50
      const items: ProgressItem[] = [];
      for (let i = 0; i < itemsInCourse; i += 1) {
        items.push(item(`item-${itemCounter}`, i));
        itemCounter += 1;
      }
      courses.push(course(`course-${c}`, c, items));
    }
    return courses;
  }

  it("computes the exact path percentage for a known number of completed items", () => {
    const courses = buildFixture();
    const allItems = courses.flatMap((c) => c.items);
    expect(allItems).toHaveLength(50);

    // Complete the first 25 items across the fixture.
    const map = progressMap(allItems.slice(0, 25).map((i) => [i.id, "COMPLETE"] as const));
    const result = computePathProgress(courses, map);
    expect(result.totalCount).toBe(50);
    expect(result.completedCount).toBe(25);
    expect(result.percent).toBe(50);
  });

  it("resumes at the first non-complete item after completing the first course fully", () => {
    const courses = buildFixture();
    const firstCourseItems = courses[0]!.items;
    const map = progressMap(firstCourseItems.map((i) => [i.id, "COMPLETE"] as const));
    const result = findResumeTarget(courses, map);
    expect(result).toMatchObject({
      kind: "resume",
      item: { id: "item-7" },
      course: { slug: "course-1" },
    });
  });
});
