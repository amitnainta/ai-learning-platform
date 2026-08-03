import { describe, expect, it } from "vitest";
import { computeContentHash } from "../hash";
import { planContentItems, planCourses, planPaths, type CurrentContentState } from "../plan-import";
import type { ContentPack, LoadedContentItem, LoadedCourse, LoadedPath } from "../loader";

function makeItem(overrides: Partial<LoadedContentItem> = {}): LoadedContentItem {
  return {
    slug: "item-one",
    title: "Item One",
    summary: "Summary.",
    sourceType: "ORIGINAL",
    roles: ["TECHNICAL_BUILDER"],
    level: "ZERO_KNOWLEDGE",
    format: "ARTICLE",
    estimatedMinutes: 5,
    topics: ["sample-topic"],
    status: "PUBLISHED",
    lastReviewedAt: new Date("2026-01-01"),
    body: "Body text.",
    reviewCadenceDays: 365,
    sourceFile: "content/items/item-one.md",
    ...overrides,
  } as LoadedContentItem;
}

function emptyState(): CurrentContentState {
  return { topics: [], roleProfiles: [], items: [], courses: [], paths: [], glossary: [] };
}

function emptyPack(): ContentPack {
  return {
    taxonomy: { topics: [], formats: ["ARTICLE"], sourceTypes: ["ORIGINAL"] },
    roleProfiles: [],
    paths: [],
    courses: [],
    items: [],
    glossary: [],
  };
}

describe("planContentItems", () => {
  it("plans a new slug as created at version 1", () => {
    const pack = { ...emptyPack(), items: [makeItem()] };
    const plan = planContentItems(pack, emptyState());

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ action: "create", slug: "item-one", nextVersion: 1 });
  });

  it("leaves an unchanged item untouched — no version bump, no snapshot flag", () => {
    const item = makeItem();
    const { sourceFile: _sourceFile, ...hashable } = item;
    const contentHash = computeContentHash(hashable);
    const state: CurrentContentState = {
      ...emptyState(),
      items: [
        { id: "existing-id", slug: "item-one", status: "PUBLISHED", contentHash, version: 3 },
      ],
    };
    const pack = { ...emptyPack(), items: [item] };

    const plan = planContentItems(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      action: "unchanged",
      slug: "item-one",
      existingId: "existing-id",
    });
    expect(plan[0]?.nextVersion).toBeUndefined();
    expect(plan[0]?.contentHash).toBeUndefined();
  });

  it("bumps a changed item to version + 1 with a contentHash for the new snapshot", () => {
    const state: CurrentContentState = {
      ...emptyState(),
      items: [
        {
          id: "existing-id",
          slug: "item-one",
          status: "PUBLISHED",
          contentHash: "a-completely-different-hash",
          version: 1,
        },
      ],
    };
    const pack = { ...emptyPack(), items: [makeItem({ body: "Updated body text." })] };

    const plan = planContentItems(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ action: "update", slug: "item-one", nextVersion: 2 });
    expect(plan[0]?.contentHash).toBeTruthy();
  });

  it("plans an item absent from the pack as retired — never deleted", () => {
    const state: CurrentContentState = {
      ...emptyState(),
      items: [
        {
          id: "existing-id",
          slug: "item-gone",
          status: "PUBLISHED",
          contentHash: "some-hash",
          version: 1,
        },
      ],
    };
    const plan = planContentItems(emptyPack(), state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      action: "retire",
      slug: "item-gone",
      existingId: "existing-id",
    });
  });

  it("un-retires a previously retired slug that reappears with unchanged content", () => {
    const item = makeItem();
    const { sourceFile: _sourceFile, ...hashable } = item;
    const contentHash = computeContentHash(hashable);
    const state: CurrentContentState = {
      ...emptyState(),
      items: [{ id: "existing-id", slug: "item-one", status: "RETIRED", contentHash, version: 2 }],
    };
    const pack = { ...emptyPack(), items: [item] };

    const plan = planContentItems(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      action: "unretire",
      slug: "item-one",
      existingId: "existing-id",
    });
    // No version bump on a content-unchanged unretire.
    expect(plan[0]?.nextVersion).toBeUndefined();
  });

  it("does not re-retire an already-retired item that stays absent from the pack", () => {
    const state: CurrentContentState = {
      ...emptyState(),
      items: [
        {
          id: "existing-id",
          slug: "item-gone",
          status: "RETIRED",
          contentHash: "some-hash",
          version: 1,
        },
      ],
    };
    const plan = planContentItems(emptyPack(), state);

    expect(plan).toHaveLength(0);
  });
});

describe("planCourses / planPaths — ordering changes are a rewrite", () => {
  function makeCourse(items: string[]): LoadedCourse {
    return {
      slug: "course-one",
      title: "Course One",
      summary: "Summary.",
      status: "PUBLISHED",
      items,
      sourceFile: "content/courses/course-one.yaml",
    };
  }

  it("plans a course whose item order changed as an update, even with identical metadata", () => {
    const state: CurrentContentState = {
      ...emptyState(),
      courses: [
        {
          id: "existing-id",
          slug: "course-one",
          status: "PUBLISHED",
          title: "Course One",
          summary: "Summary.",
          description: null,
          itemSlugs: ["item-a", "item-b"],
        },
      ],
    };
    const pack = { ...emptyPack(), courses: [makeCourse(["item-b", "item-a"])] };

    const plan = planCourses(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ action: "update", slug: "course-one" });
  });

  it("plans an unchanged course (same order) as unchanged", () => {
    const state: CurrentContentState = {
      ...emptyState(),
      courses: [
        {
          id: "existing-id",
          slug: "course-one",
          status: "PUBLISHED",
          title: "Course One",
          summary: "Summary.",
          description: null,
          itemSlugs: ["item-a", "item-b"],
        },
      ],
    };
    const pack = { ...emptyPack(), courses: [makeCourse(["item-a", "item-b"])] };

    const plan = planCourses(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ action: "unchanged", slug: "course-one" });
  });

  it("plans a path whose course order changed as an update", () => {
    function makePath(courses: string[]): LoadedPath {
      return {
        slug: "path-one",
        role: "TECHNICAL_BUILDER",
        level: "ZERO_KNOWLEDGE",
        title: "Path One",
        summary: "Summary.",
        description: "Description.",
        status: "PUBLISHED",
        courses,
        sourceFile: "content/paths/path-one.yaml",
      };
    }

    const state: CurrentContentState = {
      ...emptyState(),
      paths: [
        {
          id: "existing-id",
          slug: "path-one",
          status: "PUBLISHED",
          role: "TECHNICAL_BUILDER",
          level: "ZERO_KNOWLEDGE",
          title: "Path One",
          summary: "Summary.",
          description: "Description.",
          courseSlugs: ["course-a", "course-b"],
        },
      ],
    };
    const pack = { ...emptyPack(), paths: [makePath(["course-b", "course-a"])] };

    const plan = planPaths(pack, state);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ action: "update", slug: "path-one" });
  });
});
